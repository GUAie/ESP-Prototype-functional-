console.log('Initializing Energy Saving Pro Database...');

// Global database instance
let energyDB;

class EnergySavingDB {
    constructor() {
        console.log('Creating database instance...');
        
        this.db = new Dexie("EnergySavingProDB");
        
        // Enhanced database schema with separated dashboard support
        this.db.version(10).stores({
            accounts: '++id, fullname, email, password, createdAt',
            userProfiles: '++id, accountId, lastName, firstName, middleName, email, phone, householdSize, updatedAt',
            locationTariffs: '++id, accountId, region, province, city, zipCode, electricityProvider, electricityTariff, currency, updatedAt',
            preferences: '++id, accountId, energyUnit, carbonUnit, timeFormat, dateFormat, darkMode, budgetAlerts, goalProgressAlerts, updatedAt',
            appliances: '++id, accountId, name, wattage, usageHours, category, createdAt, updatedAt',
            goals: '++id, accountId, type, period, target, current, unit, createdAt, updatedAt',
            notifications: '++id, accountId, type, title, message, timestamp, read, createdAt',
            passwordResetTokens: '++id, email, token, expiresAt, used',
            calendarEvents: '++id, accountId, applianceId, title, description, startDate, endDate, allDay, category, usageHours, estimatedCost, estimatedCarbon, createdAt',
            userSessions: '++id, accountId, sessionToken, expiresAt, lastActivity',
            dashboardSettings: '++id, accountId, layout, widgets, lastViewed, updatedAt'
        });

        // Add schema upgrade handling
        this.db.on('ready', () => {
            console.log('Database is ready and schema is up to date');
        });

        this.db.on('versionchange', () => {
            console.log('Database version changed, reloading page...');
            window.location.reload();
        });
        
        console.log('Enhanced database schema with separated dashboard support');
    }

    async open() {
        try {
            await this.db.open();
            console.log('Database opened successfully');
            
            // Verify all tables exist and are accessible
            const tables = ['accounts', 'userProfiles', 'locationTariffs', 'preferences', 'appliances', 'goals', 'notifications', 'calendarEvents', 'userSessions', 'dashboardSettings'];
            for (const table of tables) {
                try {
                    const count = await this.db[table].count();
                    console.log(`Table ${table}: ${count} records`);
                } catch (error) {
                    console.error(`Error accessing table ${table}:`, error);
                }
            }
            
            return true;
        } catch (error) {
            console.error('Failed to open database:', error);
            
            // Try to delete and recreate the database if there's a version error
            if (error.name === 'VersionError') {
                console.log('Version error detected, attempting to reset database...');
                try {
                    this.db.close();
                    await this.db.delete();
                    console.log('Database deleted, recreating...');
                    return await this.open();
                } catch (deleteError) {
                    console.error('Error resetting database:', deleteError);
                }
            }
            
            return false;
        }
    }

    // ===== ACCOUNT MANAGEMENT =====
    async createAccount(email, password, surname, firstName, middleName = '') {
        console.log('Creating account for:', email);
        
        try {
            const existing = await this.db.accounts.where('email').equals(email).first();
            if (existing) {
                console.log('Account already exists for:', email);
                throw new Error('Account already exists');
            }
            
            const fullname = `${firstName} ${surname}`.trim();
            
            const accountId = await this.db.accounts.add({
                fullname: fullname,
                email: email,
                password: password,
                createdAt: new Date()
            });
            
            console.log('Account created with ID:', accountId);
            
            // Create user profile with the new fields
            await this.saveUserProfile(accountId, {
                surname: surname,
                firstName: firstName,
                middleName: middleName,
                email: email,
                phone: '',
                householdSize: 1,
                updatedAt: new Date()
            });
            
            // Create default location data
            await this.saveLocationTariff(accountId, {
                region: 'NCR',
                province: 'Metro Manila',
                city: '',
                zipCode: '',
                electricityProvider: 'Meralco',
                electricityTariff: 11.00,
                currency: 'PHP',
                updatedAt: new Date()
            });

            // Create default preferences
            await this.savePreferences(accountId, {
                energyUnit: 'kWh',
                carbonUnit: 'kg',
                timeFormat: '24h',
                dateFormat: 'DD/MM/YYYY',
                darkMode: false,
                budgetAlerts: true,
                goalProgressAlerts: true,
                updatedAt: new Date()
            });

            // Create default dashboard settings
            await this.saveDashboardSettings(accountId, {
                layout: 'default',
                widgets: ['quick-stats', 'appliance-management', 'goal-setting', 'data-visualization'],
                lastViewed: new Date(),
                updatedAt: new Date()
            });
            
            return accountId;
            
        } catch (error) {
            console.error('Error creating account:', error);
            throw error;
        }
    }

    async authenticateAccount(email, password) {
        console.log('Authenticating:', email);
        
        try {
            const account = await this.db.accounts
                .where('email')
                .equals(email)
                .first();
            
            if (account && account.password === password) {
                console.log('Authentication successful for:', email);
                
                // Update last activity
                await this.updateUserSession(account.id);
                
                return account;
            } else {
                console.log('Authentication failed for:', email);
                return null;
            }
        } catch (error) {
            console.error('Error authenticating account:', error);
            return null;
        }
    }

    async getAccountById(id) {
        try {
            return await this.db.accounts.get(id);
        } catch (error) {
            console.error('Error getting account:', error);
            return null;
        }
    }

    async deleteAccount(accountId) {
        try {
            console.log('Deleting account and all related data for ID:', accountId);
            
            // Delete all related data
            await this.db.calendarEvents.where('accountId').equals(accountId).delete();
            await this.db.notifications.where('accountId').equals(accountId).delete();
            await this.db.goals.where('accountId').equals(accountId).delete();
            await this.db.appliances.where('accountId').equals(accountId).delete();
            await this.db.preferences.where('accountId').equals(accountId).delete();
            await this.db.locationTariffs.where('accountId').equals(accountId).delete();
            await this.db.userProfiles.where('accountId').equals(accountId).delete();
            await this.db.userSessions.where('accountId').equals(accountId).delete();
            await this.db.dashboardSettings.where('accountId').equals(accountId).delete();
            
            // Finally delete the account
            await this.db.accounts.delete(accountId);
            
            console.log('Account and all related data deleted successfully');
            return true;
        } catch (error) {
            console.error('Error deleting account:', error);
            throw error;
        }
    }

    // ===== USER SESSION MANAGEMENT =====
    async createUserSession(accountId, sessionToken, expiresInHours = 24) {
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + expiresInHours);
            
            await this.db.userSessions.add({
                accountId: accountId,
                sessionToken: sessionToken,
                expiresAt: expiresAt,
                lastActivity: new Date()
            });
            
            return true;
        } catch (error) {
            console.error('Error creating user session:', error);
            throw error;
        }
    }

    async validateUserSession(accountId, sessionToken) {
        try {
            const session = await this.db.userSessions
                .where('accountId')
                .equals(accountId)
                .and(s => s.sessionToken === sessionToken && s.expiresAt > new Date())
                .first();
            
            if (session) {
                // Update last activity
                await this.updateUserSession(accountId);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error validating user session:', error);
            return false;
        }
    }

    async updateUserSession(accountId) {
        try {
            const session = await this.db.userSessions
                .where('accountId')
                .equals(accountId)
                .first();
            
            if (session) {
                await this.db.userSessions.update(session.id, {
                    lastActivity: new Date()
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error updating user session:', error);
            return false;
        }
    }

    async cleanupExpiredSessions() {
        try {
            const expired = await this.db.userSessions
                .where('expiresAt')
                .below(new Date())
                .toArray();
            
            for (const session of expired) {
                await this.db.userSessions.delete(session.id);
            }
            
            console.log(`Cleaned up ${expired.length} expired sessions`);
            return expired.length;
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            return 0;
        }
    }

    // ===== DASHBOARD SETTINGS MANAGEMENT =====
    async saveDashboardSettings(accountId, settings) {
        try {
            const existing = await this.db.dashboardSettings
                .where('accountId')
                .equals(accountId)
                .first();

            if (existing) {
                await this.db.dashboardSettings.update(existing.id, {
                    ...settings,
                    updatedAt: new Date()
                });
                console.log('Dashboard settings updated');
            } else {
                await this.db.dashboardSettings.add({
                    accountId: accountId,
                    ...settings,
                    updatedAt: new Date()
                });
                console.log('Dashboard settings created');
            }
            
            return true;
        } catch (error) {
            console.error('Error saving dashboard settings:', error);
            throw error;
        }
    }

    async getDashboardSettings(accountId) {
        try {
            return await this.db.dashboardSettings
                .where('accountId')
                .equals(accountId)
                .first();
        } catch (error) {
            console.error('Error getting dashboard settings:', error);
            return null;
        }
    }

    async updateLastViewed(accountId, page) {
        try {
            const settings = await this.getDashboardSettings(accountId);
            if (settings) {
                await this.db.dashboardSettings.update(settings.id, {
                    lastViewed: new Date(),
                    currentPage: page,
                    updatedAt: new Date()
                });
            }
            return true;
        } catch (error) {
            console.error('Error updating last viewed:', error);
            return false;
        }
    }

    // ===== USER PROFILE MANAGEMENT =====
    async saveUserProfile(accountId, profileData) {
        console.log('Saving profile for account:', accountId);
        
        try {
            const existing = await this.db.userProfiles
                .where('accountId')
                .equals(accountId)
                .first();
            if (existing) {
                await this.db.userProfiles.update(existing.id, {
                    ...profileData,
                    updatedAt: new Date()
                });
                console.log('Profile updated');
            } else {
                await this.db.userProfiles.add({
                    accountId: accountId,
                    ...profileData,
                    updatedAt: new Date()
                });
                console.log('Profile created');
            }
            return true;
        } catch (error) {
            console.error('Error saving profile:', error);
            throw error;
        }
    }

    async getUserProfile(accountId) {
        try {
            return await this.db.userProfiles
                .where('accountId')
                .equals(accountId)
                .first();
        } catch (error) {
            console.error('Error getting profile:', error);
            return null;
        }
    }

    // ===== LOCATION & TARIFF MANAGEMENT =====
    async saveLocationTariff(accountId, locationData) {
        console.log('Saving location tariff for account:', accountId, locationData);
        
        try {
            const existing = await this.db.locationTariffs
                .where('accountId')
                .equals(accountId)
                .first();
    
            if (existing) {
                await this.db.locationTariffs.update(existing.id, {
                    ...locationData,
                    updatedAt: new Date()
                });
                console.log('Location tariff updated');
            } else {
                await this.db.locationTariffs.add({
                    accountId: accountId,
                    ...locationData,
                    updatedAt: new Date()
                });
                console.log('Location tariff created');
            }
            
            const savedData = await this.db.locationTariffs
                .where('accountId')
                .equals(accountId)
                .first();
                
            console.log('Location tariff saved successfully:', savedData);
            return savedData;
        } catch (error) {
            console.error('Error saving location data:', error);
            throw error;
        }
    }

    async getLocationTariff(accountId) {
        try {
            return await this.db.locationTariffs
                .where('accountId')
                .equals(accountId)
                .first();
        } catch (error) {
            console.error('Error getting location data:', error);
            return null;
        }
    }

    // ===== PREFERENCES MANAGEMENT =====
    async savePreferences(accountId, preferences) {
        try {
            const existing = await this.db.preferences
                .where('accountId')
                .equals(accountId)
                .first();

            if (existing) {
                await this.db.preferences.update(existing.id, {
                    ...preferences,
                    updatedAt: new Date()
                });
            } else {
                await this.db.preferences.add({
                    accountId: accountId,
                    ...preferences,
                    updatedAt: new Date()
                });
            }
            console.log('Preferences saved:', preferences);
            return true;
        } catch (error) {
            console.error('Error saving preferences:', error);
            throw error;
        }
    }

    async getPreferences(accountId) {
        try {
            return await this.db.preferences
                .where('accountId')
                .equals(accountId)
                .first();
        } catch (error) {
            console.error('Error getting preferences:', error);
            return null;
        }
    }

    // ===== APPLIANCE MANAGEMENT =====
    async addAppliance(accountId, applianceData) {
        try {
            const applianceId = await this.db.appliances.add({
                accountId: accountId,
                ...applianceData,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('Appliance added with ID:', applianceId);
            return applianceId;
        } catch (error) {
            console.error('Error adding appliance:', error);
            throw error;
        }
    }

    async getAppliances(accountId) {
        try {
            return await this.db.appliances
                .where('accountId')
                .equals(accountId)
                .toArray();
        } catch (error) {
            console.error('Error getting appliances:', error);
            return [];
        }
    }

    async deleteAppliance(applianceId) {
        try {
            // First delete related calendar events
            await this.db.calendarEvents.where('applianceId').equals(applianceId).delete();
            
            // Then delete the appliance
            await this.db.appliances.delete(applianceId);
            console.log('Appliance deleted:', applianceId);
            return true;
        } catch (error) {
            console.error('Error deleting appliance:', error);
            throw error;
        }
    }

    async updateAppliance(applianceId, applianceData) {
        try {
            await this.db.appliances.update(applianceId, {
                ...applianceData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating appliance:', error);
            throw error;
        }
    }

    // ===== GOAL MANAGEMENT =====
    async addGoal(accountId, goalData) {
        try {
            const goalId = await this.db.goals.add({
                accountId: accountId,
                ...goalData,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return goalId;
        } catch (error) {
            console.error('Error adding goal:', error);
            throw error;
        }
    }

    async getGoals(accountId) {
        try {
            return await this.db.goals
                .where('accountId')
                .equals(accountId)
                .toArray();
        } catch (error) {
            console.error('Error getting goals:', error);
            return [];
        }
    }

    async updateGoalProgress(goalId, currentValue) {
        try {
            await this.db.goals.update(goalId, {
                current: currentValue,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating goal:', error);
            throw error;
        }
    }

    async deleteGoal(goalId) {
        try {
            await this.db.goals.delete(goalId);
            return true;
        } catch (error) {
            console.error('Error deleting goal:', error);
            throw error;
        }
    }

    // ===== NOTIFICATION MANAGEMENT =====
    async addNotification(accountId, notificationData) {
        try {
            const notificationId = await this.db.notifications.add({
                accountId: accountId,
                ...notificationData,
                timestamp: new Date(),
                createdAt: new Date()
            });
            return notificationId;
        } catch (error) {
            console.error('Error adding notification:', error);
            throw error;
        }
    }

    async getNotifications(accountId) {
        try {
            return await this.db.notifications
                .where('accountId')
                .equals(accountId)
                .toArray();
        } catch (error) {
            console.error('Error getting notifications:', error);
            return [];
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            await this.db.notifications.update(notificationId, {
                read: true
            });
            return true;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    async deleteNotification(notificationId) {
        try {
            await this.db.notifications.delete(notificationId);
            return true;
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }

    // ===== CALENDAR EVENT MANAGEMENT =====
    async addCalendarEvent(accountId, eventData) {
        try {
            const eventId = await this.db.calendarEvents.add({
                accountId: accountId,
                ...eventData,
                createdAt: new Date()
            });
            console.log('Calendar event added with ID:', eventId);
            return eventId;
        } catch (error) {
            console.error('Error adding calendar event:', error);
            throw error;
        }
    }

    async getCalendarEvents(accountId, startDate = null, endDate = null) {
        try {
            let query = this.db.calendarEvents.where('accountId').equals(accountId);
            
            if (startDate && endDate) {
                query = query.and(event => 
                    event.startDate >= startDate && event.startDate <= endDate
                );
            }
            
            const events = await query.toArray();
            return events;
        } catch (error) {
            console.error('Error getting calendar events:', error);
            return [];
        }
    }

    async getCalendarEventsByDateRange(accountId, startDate, endDate) {
        try {
            const events = await this.db.calendarEvents
                .where('accountId')
                .equals(accountId)
                .and(event => event.startDate >= startDate && event.startDate <= endDate)
                .toArray();
            return events;
        } catch (error) {
            console.error('Error getting calendar events by date range:', error);
            return [];
        }
    }

    async updateCalendarEvent(eventId, eventData) {
        try {
            await this.db.calendarEvents.update(eventId, {
                ...eventData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating calendar event:', error);
            throw error;
        }
    }

    async deleteCalendarEvent(eventId) {
        try {
            await this.db.calendarEvents.delete(eventId);
            return true;
        } catch (error) {
            console.error('Error deleting calendar event:', error);
            throw error;
        }
    }

    async getCalendarEventsByAppliance(accountId, applianceId) {
        try {
            const events = await this.db.calendarEvents
                .where('accountId')
                .equals(accountId)
                .and(event => event.applianceId === applianceId)
                .toArray();
            return events;
        } catch (error) {
            console.error('Error getting calendar events by appliance:', error);
            return [];
        }
    }

    // ===== SYNC APPLIANCE WITH CALENDAR =====
    async syncApplianceToCalendar(accountId, applianceId, date, usageHours = null) {
        try {
            const appliance = await this.db.appliances.get(applianceId);
            if (!appliance) {
                throw new Error('Appliance not found');
            }

            const locationData = await this.getLocationTariff(accountId);
            const tariffRate = locationData?.electricityTariff || 11.00;
            
            // Calculate estimated cost and carbon
            const dailyConsumption = (appliance.wattage * (usageHours || appliance.usageHours)) / 1000;
            const estimatedCost = dailyConsumption * tariffRate;
            const estimatedCarbon = dailyConsumption * 0.5; // kg CO₂

            const eventData = {
                applianceId: applianceId,
                title: `${appliance.name} Usage`,
                description: `Scheduled usage for ${appliance.name} - ${appliance.wattage}W`,
                startDate: new Date(date),
                endDate: new Date(date),
                allDay: false,
                category: 'appliance-usage',
                usageHours: usageHours || appliance.usageHours,
                estimatedCost: estimatedCost,
                estimatedCarbon: estimatedCarbon
            };

            const eventId = await this.addCalendarEvent(accountId, eventData);
            
            // Create notification
            await this.addNotification(accountId, {
                type: 'info',
                title: 'Appliance Scheduled',
                message: `${appliance.name} has been scheduled for ${new Date(date).toLocaleDateString()}`
            });

            return eventId;
        } catch (error) {
            console.error('Error syncing appliance to calendar:', error);
            throw error;
        }
    }

    // ===== GET DAILY USAGE FROM CALENDAR =====
    async getDailyUsageFromCalendar(accountId, date) {
        try {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const events = await this.getCalendarEventsByDateRange(accountId, startOfDay, endOfDay);
            
            let totalUsage = 0;
            let totalCost = 0;
            let totalCarbon = 0;

            events.forEach(event => {
                if (event.usageHours && event.applianceId) {
                    totalUsage += (event.usageHours || 0);
                    totalCost += (event.estimatedCost || 0);
                    totalCarbon += (event.estimatedCarbon || 0);
                }
            });

            return {
                usage: totalUsage,
                cost: totalCost,
                carbon: totalCarbon,
                events: events
            };
        } catch (error) {
            console.error('Error getting daily usage from calendar:', error);
            return { usage: 0, cost: 0, carbon: 0, events: [] };
        }
    }

    // ===== GET MONTHLY SUMMARY FROM CALENDAR =====
    async getMonthlySummaryFromCalendar(accountId, year, month) {
        try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0); // Last day of the month

            const events = await this.getCalendarEventsByDateRange(accountId, startDate, endDate);
            
            const dailySummary = {};
            let monthlyUsage = 0;
            let monthlyCost = 0;
            let monthlyCarbon = 0;

            events.forEach(event => {
                const eventDate = new Date(event.startDate).toDateString();
                
                if (!dailySummary[eventDate]) {
                    dailySummary[eventDate] = {
                        usage: 0,
                        cost: 0,
                        carbon: 0,
                        events: []
                    };
                }

                dailySummary[eventDate].usage += (event.usageHours || 0);
                dailySummary[eventDate].cost += (event.estimatedCost || 0);
                dailySummary[eventDate].carbon += (event.estimatedCarbon || 0);
                dailySummary[eventDate].events.push(event);

                monthlyUsage += (event.usageHours || 0);
                monthlyCost += (event.estimatedCost || 0);
                monthlyCarbon += (event.estimatedCarbon || 0);
            });

            return {
                dailySummary,
                monthlyUsage,
                monthlyCost,
                monthlyCarbon,
                totalEvents: events.length
            };
        } catch (error) {
            console.error('Error getting monthly summary from calendar:', error);
            return { dailySummary: {}, monthlyUsage: 0, monthlyCost: 0, monthlyCarbon: 0, totalEvents: 0 };
        }
    }

    // ===== CALCULATION FUNCTIONS =====
    async calculateDailyUsage(accountId) {
        try {
            const appliances = await this.getAppliances(accountId);
            let totalDailyUsage = 0;
            
            appliances.forEach(appliance => {
                const dailyKWh = (appliance.wattage * appliance.usageHours) / 1000;
                totalDailyUsage += dailyKWh;
            });
            
            return totalDailyUsage;
        } catch (error) {
            console.error('Error calculating daily usage:', error);
            return 0;
        }
    }

    async calculateCurrentCost(accountId) {
        try {
            const dailyUsage = await this.calculateDailyUsage(accountId);
            const locationData = await this.getLocationTariff(accountId);
            const tariffRate = locationData?.electricityTariff || 11.00;
            
            return dailyUsage * tariffRate;
        } catch (error) {
            console.error('Error calculating current cost:', error);
            return 0;
        }
    }

    async calculateCarbonSaved(accountId) {
        try {
            const dailyUsage = await this.calculateDailyUsage(accountId);
            const emissionFactor = 0.5; // kg CO₂ per kWh
            return dailyUsage * emissionFactor;
        } catch (error) {
            console.error('Error calculating carbon saved:', error);
            return 0;
        }
    }

    async calculateGoalProgress(accountId) {
        try {
            const goals = await this.getGoals(accountId);
            const dailyUsage = await this.calculateDailyUsage(accountId);
            const currentCost = await this.calculateCurrentCost(accountId);
            const currentCarbon = await this.calculateCarbonSaved(accountId);
            
            const updatedGoals = [];
            
            for (const goal of goals) {
                let currentValue = 0;
                
                switch(goal.type) {
                    case 'consumption':
                        currentValue = dailyUsage;
                        break;
                    case 'cost':
                        currentValue = currentCost;
                        break;
                    case 'carbon':
                        currentValue = currentCarbon;
                        break;
                }
                
                await this.db.goals.update(goal.id, {
                    current: currentValue,
                    updatedAt: new Date()
                });
                
                // Calculate progress percentage (can be over 100% for exceeded limits)
                const progress = goal.target > 0 ? (currentValue / goal.target) * 100 : 0;
                
                updatedGoals.push({
                    ...goal,
                    current: currentValue,
                    progress: progress // Don't cap at 100% - allow values over 100 for exceeded limits
                });
            }
            
            return updatedGoals;
        } catch (error) {
            console.error('Error calculating goal progress:', error);
            return [];
        }
    }

    // ===== PASSWORD RESET TOKEN MANAGEMENT =====
    async createPasswordResetToken(email, token) {
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour
            
            await this.db.passwordResetTokens.add({
                email: email,
                token: token,
                expiresAt: expiresAt,
                used: false
            });
            
            return true;
        } catch (error) {
            console.error('Error creating password reset token:', error);
            throw error;
        }
    }

    async validatePasswordResetToken(email, plainToken) {
        try {
            const hashedToken = await this.hashToken(plainToken); // Hash the incoming token
            const tokenRecord = await this.db.passwordResetTokens.where('email').equals(email).first();
            
            if (!tokenRecord) {
                return false; // No token found
            }
            
            // Check if token matches and hasn't expired
            const now = new Date();
            return tokenRecord.token === hashedToken && tokenRecord.expiresAt > now;
        } catch (error) {
            console.error('Error validating token:', error);
            return false;
        }
    }

    async markPasswordResetTokenUsed(email, token) {
        try {
            const resetToken = await this.db.passwordResetTokens
                .where('email')
                .equals(email)
                .and(t => t.token === token)
                .first();
            
            if (resetToken) {
                await this.db.passwordResetTokens.update(resetToken.id, {
                    used: true
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error marking password reset token as used:', error);
            throw error;
        }
    }
    async updateAccountPassword(email, hashedPassword) {
        try {
            await this.db.accounts.where('email').equals(email).modify({ password: hashedPassword });
        } catch (error) {
            console.error('Error updating password:', error);
            throw new Error('Failed to update password in database.');
        }
    }
    async deletePasswordResetToken(email) {
        try {
            await this.db.passwordResetTokens.where('email').equals(email).delete();
        } catch (error) {
            console.error('Error deleting token:', error);
            // Non-critical; don't throw
        }
    }
    async hashToken(token) {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ===== PAGE NAVIGATION TRACKING =====
    

    async getUserActivity(accountId, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const activities = await this.db.notifications
                .where('accountId')
                .equals(accountId)
                .and(n => n.type === 'info' && n.title === 'Page View' && n.timestamp >= startDate)
                .toArray();
            
            return activities;
        } catch (error) {
            console.error('Error getting user activity:', error);
            return [];
        }
    }

    // ===== DEBUG AND UTILITY FUNCTIONS =====
    async debugAllData() {
        try {
            const accounts = await this.db.accounts.toArray();
            const profiles = await this.db.userProfiles.toArray();
            const locationTariffs = await this.db.locationTariffs.toArray();
            const preferences = await this.db.preferences.toArray();
            const appliances = await this.db.appliances.toArray();
            const goals = await this.db.goals.toArray();
            const notifications = await this.db.notifications.toArray();
            const calendarEvents = await this.db.calendarEvents.toArray();
            const userSessions = await this.db.userSessions.toArray();
            const dashboardSettings = await this.db.dashboardSettings.toArray();
            
            console.log('=== DATABASE DEBUG INFO ===');
            console.log('Accounts:', accounts);
            console.log('User Profiles:', profiles);
            console.log('Location Tariffs:', locationTariffs);
            console.log('Preferences:', preferences);
            console.log('Appliances:', appliances);
            console.log('Goals:', goals);
            console.log('Notifications:', notifications);
            console.log('Calendar Events:', calendarEvents);
            console.log('User Sessions:', userSessions);
            console.log('Dashboard Settings:', dashboardSettings);
            console.log('=== END DEBUG INFO ===');
            
            return { 
                accounts, 
                profiles, 
                locationTariffs, 
                preferences, 
                appliances, 
                goals, 
                notifications, 
                calendarEvents,
                userSessions,
                dashboardSettings
            };
        } catch (error) {
            console.error('Error getting debug data:', error);
            return {};
        }
    }

    async clearAllData() {
        try {
            await this.db.accounts.clear();
            await this.db.userProfiles.clear();
            await this.db.locationTariffs.clear();
            await this.db.preferences.clear();
            await this.db.appliances.clear();
            await this.db.goals.clear();
            await this.db.notifications.clear();
            await this.db.calendarEvents.clear();
            await this.db.passwordResetTokens.clear();
            await this.db.userSessions.clear();
            await this.db.dashboardSettings.clear();
            
            console.log('All database data cleared');
            return true;
        } catch (error) {
            console.error('Error clearing database:', error);
            throw error;
        }
    }

    async getDatabaseStats() {
        try {
            const stats = {
                accounts: await this.db.accounts.count(),
                userProfiles: await this.db.userProfiles.count(),
                locationTariffs: await this.db.locationTariffs.count(),
                preferences: await this.db.preferences.count(),
                appliances: await this.db.appliances.count(),
                goals: await this.db.goals.count(),
                notifications: await this.db.notifications.count(),
                calendarEvents: await this.db.calendarEvents.count(),
                passwordResetTokens: await this.db.passwordResetTokens.count(),
                userSessions: await this.db.userSessions.count(),
                dashboardSettings: await this.db.dashboardSettings.count()
            };
            
            console.log('Database Statistics:', stats);
            return stats;
        } catch (error) {
            console.error('Error getting database stats:', error);
            return {};
        }
    }
}

// Initialize database immediately
async function initializeDatabase() {
    console.log('Starting database initialization...');
    energyDB = new EnergySavingDB();
    const success = await energyDB.open();
    
    if (success) {
        console.log('Database initialized successfully with separated dashboard support');
        
        // Clean up expired sessions on startup
        await energyDB.cleanupExpiredSessions();
        
        // Debug: show all data
        setTimeout(() => {
            energyDB.getDatabaseStats();
        }, 1000);
    } else {
        console.error('Database initialization failed');
    }
    
    return success;
}

// Utility functions for external use
window.EnergySavingDB = {
    getInstance: () => energyDB,
    initialize: initializeDatabase,
    isReady: () => energyDB && energyDB.db
};

// Start initialization
initializeDatabase();