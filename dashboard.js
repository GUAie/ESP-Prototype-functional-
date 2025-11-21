(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        const currentAccount = window.EnergySavingApp?.SessionManager?.getCurrentAccount();
        
        if (!currentAccount) {
            console.log('No valid session found, redirecting to login page');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('User session found:', currentAccount);
        initializeDashboard();
    });

    // Data storage
    let userProfile = {};
    let appliances = [];
    let goals = [];
    let notifications = [];
    let usageChartInstance = null;
    let goalNotificationTracker = {};

    async function initializeDashboard() {
        console.log('Dashboard loaded');
        
        if (!window.EnergySavingApp.SessionManager.getCurrentAccount()) {
            window.location.href = 'index.html';
            return;
        }

        // Wait for database to be ready
        let attempts = 0;
        while ((!energyDB || !energyDB.db) && attempts < 10) {
            console.log('Waiting for database...', attempts);
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        if (!energyDB || !energyDB.db) {
            showToast('Database not ready. Please refresh the page.', 'error');
            return;
        }

        try {
            await loadAllData();
            initializeCharts();
            await updateDashboardStats();
            initializeNotificationSystem();
            initializeDarkMode();
            setupEventListeners();
            startGoalProgressMonitor();
            
            console.log('Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showToast('Error initializing dashboard', 'error');
        }
    }

    // Load all user data from database
    async function loadAllData() {
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        
        try {
            // Load account data first
            const accountData = await energyDB.getAccountById(accountId);
            console.log('Account data:', accountData);
            
            // Initialize userProfile
            userProfile = {};
            
            // Load and merge user profile
            const userProfileData = await energyDB.getUserProfile(accountId) || {};
            Object.assign(userProfile, userProfileData);
            
            // Load and merge location and tariff
            const locationTariff = await energyDB.getLocationTariff(accountId) || {};
            Object.assign(userProfile, locationTariff);
            
            // Load and merge preferences
            const preferences = await energyDB.getPreferences(accountId) || {};
            Object.assign(userProfile, preferences);
            
            // Add account data to userProfile
            if (accountData) {
                userProfile.fullName = accountData.fullname || userProfile.fullName;
                userProfile.email = accountData.email || userProfile.email;
                userProfile.createdAt = accountData.createdAt || userProfile.createdAt;
            }
            
            console.log('Final merged userProfile:', userProfile);
            
            // Load other data
            appliances = await energyDB.getAppliances(accountId) || [];
            goals = await energyDB.getGoals(accountId) || [];
            notifications = await energyDB.getNotifications(accountId) || [];
            
            // Update UI with loaded data
            updateHeaderInfo();
            loadAppliances();
            loadGoals();
            
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Error loading your data', 'error');
        }
    }

    // Update header information with user data
    function updateHeaderInfo() {
        const userNameElement = document.getElementById('userName');
        const userLocationElement = document.getElementById('userLocation');
        
        if (userNameElement) {
            let fullName = '';
            if (userProfile.firstName) fullName += userProfile.firstName;
            if (userProfile.surname) fullName += ' ' + userProfile.surname;
            
            userNameElement.textContent = fullName.trim() || userProfile.fullName || userProfile.fullname || 'User';
        }
        
        if (userLocationElement) {
            let locationText = 'Set your location';
            if (userProfile.city && userProfile.region) {
                locationText = `${userProfile.city}, ${userProfile.province}, ${userProfile.region}`;
            } else if (userProfile.city) {
                locationText = userProfile.city;
            } else if (userProfile.region) {
                locationText = userProfile.region;
            } else if (userProfile.province) {
                locationText = userProfile.province;
            }
            userLocationElement.textContent = locationText;
        }
        
        console.log('Header info updated:', {
            name: userNameElement?.textContent,
            location: userLocationElement?.textContent
        });
    }

    // Update dashboard statistics and goal progress
    async function updateDashboardStats() {
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        
        try {
            const dailyUsage = await energyDB.calculateDailyUsage(accountId);
            const currentCost = await energyDB.calculateCurrentCost(accountId);
            const carbonSaved = await energyDB.calculateCarbonSaved(accountId);
            
            // Update quick stats
            const statCards = document.querySelectorAll('.stat-card');
            if (statCards.length >= 4) {
                statCards[0].querySelector('.stat-value').textContent = 
                    `${dailyUsage.toFixed(1)} kWh`;
                statCards[1].querySelector('.stat-value').textContent = 
                    `₱${currentCost.toFixed(2)}`;
                statCards[2].querySelector('.stat-value').textContent = 
                    `${carbonSaved.toFixed(1)} kg`;
            }
            
            // Update goals with current data
            await energyDB.calculateGoalProgress(accountId);
            goals = await energyDB.getGoals(accountId);
            loadGoals();
            
            // Calculate overall goal progress for the stat card
            const goalProgress = await energyDB.calculateGoalProgress(accountId);
            const overallProgress = goalProgress.length > 0 ? 
                goalProgress.reduce((sum, goal) => sum + (Math.min(goal.progress || 0, 100)), 0) / goalProgress.length : 0;
            
            if (statCards.length >= 4) {
                statCards[3].querySelector('.stat-value').textContent = 
                    `${Math.round(overallProgress)}%`;
            }
                
        } catch (error) {
            console.error('Error updating dashboard stats:', error);
        }
    }

    // Chart Initialization with Dynamic Data
    async function initializeCharts() {
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        
        // Appliance Usage Breakdown Chart
        const usageCtx = document.getElementById('usageChart');
        if (usageCtx) {
            const usageData = await calculateApplianceUsageBreakdown(accountId);
            
            if (usageData.labels.length === 0) {
                usageCtx.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                        <p>No appliance data yet</p>
                        <small>Add appliances to see usage breakdown</small>
                    </div>
                `;
            } else {
                // Clear any existing chart
                if (usageChartInstance) {
                    usageChartInstance.destroy();
                }
                
                usageChartInstance = new Chart(usageCtx.getContext('2d'), {
                    type: 'pie',
                    data: {
                        labels: usageData.labels,
                        datasets: [{
                            data: usageData.data,
                            backgroundColor: [
                                '#4CAF50', '#388E3C', '#81C784', '#C8E6C9', 
                                '#A5D6A7', '#66BB6A', '#43A047', '#2E7D32',
                                '#1B5E20', '#E8F5E9'
                            ],
                            borderWidth: 1,
                            borderColor: '#fff'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
                                    usePointStyle: true
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.raw || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = Math.round((value / total) * 100);
                                        return `${label}: ${value} kWh (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    // Calculate appliance usage breakdown
    async function calculateApplianceUsageBreakdown(accountId) {
        const appliances = await energyDB.getAppliances(accountId);
        
        if (appliances.length === 0) {
            return { labels: [], data: [] };
        }
        
        const usageData = appliances.map(appliance => {
            const dailyKWh = (appliance.wattage * appliance.usageHours) / 1000;
            return {
                name: appliance.name,
                usage: dailyKWh
            };
        });
        
        // Sort by usage descending
        usageData.sort((a, b) => b.usage - a.usage);
        
        // If we have 7 or fewer appliances, show them all
        if (usageData.length <= 7) {
            return {
                labels: usageData.map(appliance => appliance.name),
                data: usageData.map(appliance => parseFloat(appliance.usage.toFixed(2)))
            };
        }
        
        // If more than 7 appliances, take top 6 and group the rest as "Others"
        const topAppliances = usageData.slice(0, 6);
        const otherUsage = usageData.slice(6).reduce((sum, appliance) => sum + appliance.usage, 0);
        
        const labels = topAppliances.map(appliance => appliance.name);
        const data = topAppliances.map(appliance => parseFloat(appliance.usage.toFixed(2)));
        
        if (otherUsage > 0) {
            labels.push('Others');
            data.push(parseFloat(otherUsage.toFixed(2)));
        }
        
        return { labels, data };
    }

    // Appliance Management
    function loadAppliances() {
        const container = document.getElementById('appliancesContainer');
        if (!container) return;
        
        container.innerHTML = '';

        if (appliances.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🔌</div>
                    <p>No appliances added yet</p>
                    <small>Add your first appliance above to get started</small>
                </div>
            `;
            return;
        }

        // Group appliances by date (current date for all)
        const currentDate = new Date();
        const dateString = currentDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        // Create date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-group-header';
        dateHeader.innerHTML = `
            <div class="date-line">
                <div class="date-bubble">${dateString}</div>
                <div class="timeline-line"></div>
            </div>
        `;
        container.appendChild(dateHeader);

        // Create appliances group for this date
        const appliancesGroup = document.createElement('div');
        appliancesGroup.className = 'appliances-group';
        
        appliances.forEach(appliance => {
            const dailyConsumption = (appliance.wattage * appliance.usageHours) / 1000;
            const dailyCost = dailyConsumption * (userProfile.electricityTariff || 11.00);
            
            const card = document.createElement('div');
            card.className = 'appliance-timeline-card';
            card.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="appliance-content">
                    <div class="appliance-header">
                        <div class="appliance-name">${appliance.name}</div>
                        <div class="appliance-time">${appliance.usageHours}h</div>
                    </div>
                    <div class="appliance-details">
                        <div class="detail-item">
                            <span class="detail-label">Wattage:</span>
                            <span class="detail-value">${appliance.wattage}W</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Consumption:</span>
                            <span class="detail-value">${dailyConsumption.toFixed(2)} kWh</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Cost:</span>
                            <span class="detail-value">₱${dailyCost.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="appliance-actions">
                        <button class="btn-delete-notification" onclick="editAppliance(${appliance.id})">Edit</button>
                        <button class="btn-delete-notification" onclick="deleteAppliance(${appliance.id})">Delete</button>
                    </div>
                </div>
            `;
            appliancesGroup.appendChild(card);
        });
        
        container.appendChild(appliancesGroup);
    }

    async function addAppliance(event) {
        event.preventDefault();
        
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        const name = document.getElementById('applianceName').value;
        const wattage = parseInt(document.getElementById('wattage').value);
        const usageHours = parseFloat(document.getElementById('usageHours').value);
        const category = document.getElementById('category').value;

        try {
            await energyDB.addAppliance(accountId, {
                name,
                wattage,
                usageHours,
                category
            });
            
            // Reload appliances from database
            appliances = await energyDB.getAppliances(accountId);
            loadAppliances();
            
            // Update all stats and goals with new appliance data
            await updateDashboardStats();
            
            // Refresh charts with new data
            initializeCharts();
            
            document.getElementById('addApplianceForm').reset();
            showToast('Appliance added successfully!', 'success');
        } catch (error) {
            console.error('Error adding appliance:', error);
            showToast('Error adding appliance', 'error');
        }
    }

    async function deleteAppliance(id) {
        try {
            await energyDB.deleteAppliance(id);
            
            // Reload appliances from database
            const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
            appliances = await energyDB.getAppliances(accountId);
            
            loadAppliances();
            
            // Update all stats and goals with removed appliance data
            await updateDashboardStats();
            
            // Refresh charts with updated data
            initializeCharts();
            
        } catch (error) {
            console.error('Error deleting appliance:', error);
        }
    }

    function editAppliance(id) {
        const appliance = appliances.find(a => a.id === id);
        if (appliance) {
            document.getElementById('applianceName').value = appliance.name;
            document.getElementById('wattage').value = appliance.wattage;
            document.getElementById('usageHours').value = appliance.usageHours;
            document.getElementById('category').value = appliance.category;
            
            // Remove the appliance and update form for editing
            deleteAppliance(id);
            showToast('Edit the appliance details below', 'info');
        }
    }

    // Goal Management
    async function loadGoals() {
        const container = document.getElementById('goalsContainer');
        if (!container) return;
        
        container.innerHTML = '';
    
        // Calculate current progress for each goal
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        const goalProgress = await energyDB.calculateGoalProgress(accountId);
        
        if (goalProgress.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No goals set yet. Create your first goal above!</p>';
            return;
        }
    
        goalProgress.forEach(goal => {
            const progress = goal.progress || 0;
            const progressPercent = Math.min(progress, 100); // For visual bar, cap at 100%
            const isExceeded = progress > 100;
            
            const card = document.createElement('div');
            card.className = `goal-item ${isExceeded ? 'goal-exceeded' : ''}`;
            card.innerHTML = `
                <div class="goal-header">
                    <div class="goal-title">${goal.type.charAt(0).toUpperCase() + goal.type.slice(1)} Goal</div>
                    <div class="goal-target">${goal.unit}${goal.current ? goal.current.toFixed(2) : '0'} / ${goal.unit}${goal.target}</div>
                </div>
                <div class="goal-progress-bar">
                    <div class="progress-fill ${isExceeded ? 'progress-exceeded' : ''}" style="width: ${progressPercent}%"></div>
                </div>
                <div class="goal-progress-text ${isExceeded ? 'progress-exceeded-text' : ''}">
                    ${isExceeded ? '⚠️ ' : ''}${progress.toFixed(1)}% Complete ${isExceeded ? '(Limit Exceeded!)' : ''}
                </div>
                <div class="goal-actions">
                <button class="btn-delete-notification" onclick="editGoal(${goal.id})">Edit</button>
                    <button class="btn-delete-notification" onclick="deleteGoal(${goal.id})">Delete</button>
                    
                </div>
            `;
            container.appendChild(card);
        });
    }

    async function setGoal(event) {
        event.preventDefault();
        
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        const type = document.getElementById('goalType').value;
        const target = parseFloat(document.getElementById('goalTarget').value);
    
        const unit = type === 'cost' ? '₱' : type === 'carbon' ? 'kg' : 'kWh';
        const current = 0;
    
        try {
            await energyDB.addGoal(accountId, {
                type,
                target,
                current,
                unit,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            // Reload goals from database
            goals = await energyDB.getGoals(accountId);
            loadGoals();
            updateDashboardStats();
            
            document.getElementById('goalForm').reset();
            showToast('New goal set successfully!', 'success');
        } catch (error) {
            console.error('Error setting goal:', error);
            showToast('Error setting goal', 'error');
        }
    }

    async function deleteGoal(goalId) {
        try {
            await energyDB.deleteGoal(goalId);
            
            // Reload goals from database
            const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
            goals = await energyDB.getGoals(accountId);
            
            loadGoals();
            updateDashboardStats();
        } catch (error) {
            console.error('Error deleting goal:', error);
            showToast('Error deleting goal', 'error');
        }
    }
    
    function editGoal(id) {
        const goal = goals.find(g => g.id === id);
        if (goal) {
            // Populate the form with existing goal data
            document.getElementById('goalType').value = goal.type;
            document.getElementById('goalTarget').value = goal.target;
            
            // Delete the goal immediately (same as editAppliance)
            deleteGoal(id);
            
            showToast('Edit the goal details below', 'info');
        }
    }

    // Smart Goal Notification System
    async function checkGoalProgressNotifications() {
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        const goalProgress = await energyDB.calculateGoalProgress(accountId);
        
        for (const goal of goalProgress) {
            const progress = goal.progress || 0;
            const goalKey = `${goal.id}_${goal.type}`;
            
            console.log(`Goal ${goal.type}: ${goal.current} / ${goal.target} = ${progress}%`);
            
            // Check if goal limit is exceeded (progress > 100)
            if (progress > 100) {
                if (!goalNotificationTracker[`${goalKey}_exceeded`]) {
                    console.log(`Limit exceeded detected for ${goal.type} goal: ${progress}%`);
                    await handleLimitExceeded(goal);
                    goalNotificationTracker[`${goalKey}_exceeded`] = true;
                }
                continue;
            }

            // Check if goal is completed (exactly 100%)
            if (progress >= 100 && !goalNotificationTracker[`${goalKey}_completed`]) {
                console.log(`Goal completed detected for ${goal.type} goal: ${progress}%`);
                await handleGoalCompletion(goal);
                goalNotificationTracker[`${goalKey}_completed`] = true;
                continue;
            }
            
            // Check progress milestones (70% and 90%)
            if (progress >=70 && !goalNotificationTracker[`${goalKey}_70`]) {
                console.log(`70% milestone detected for ${goal.type} goal: ${progress}%`);
                await handleProgressMilestone(goal, 70);
                goalNotificationTracker[`${goalKey}_70`] = true;
            } else if (progress >= 90 && !goalNotificationTracker[`${goalKey}_90`]) {
                console.log(`90% milestone detected for ${goal.type} goal: ${progress}%`);
                await handleProgressMilestone(goal, 90);
                goalNotificationTracker[`${goalKey}_90`] = true;
            }
        }
    }

    async function handleLimitExceeded(goal) {
        let title = '';
        let message = '';
        const exceededBy = Math.round(goal.progress - 100);
        const actualValue = goal.current?.toFixed(2) || '0';
        const targetValue = goal.target;
        
        switch(goal.type) {
            case 'consumption':
                title = '⚡ Energy Limit Exceeded!';
                message = `You've exceeded your energy consumption limit by ${exceededBy}%! Current usage: ${actualValue}${goal.unit} of ${targetValue}${goal.unit}. Consider reducing appliance usage to get back on track.`;
                break;
            case 'cost':
                title = '💰 Budget Limit Exceeded!';
                message = `You've exceeded your electricity budget by ${exceededBy}%! Current spending: ${goal.unit}${actualValue} of ${goal.unit}${targetValue}. Review your appliance usage to reduce costs.`;
                break;
            case 'carbon':
                title = '🌿 Carbon Limit Exceeded!';
                message = `You've exceeded your carbon emission limit by ${exceededBy}%! Current emissions: ${actualValue}${goal.unit} of ${targetValue}${goal.unit}. Try using energy-efficient appliances.`;
                break;
        }
        
        await addNotification('warning', title, message);
    }

    async function handleGoalCompletion(goal) {
        let message = '';
        const actualValue = goal.current?.toFixed(2) || '0';
        const targetValue = goal.target;
        
        switch(goal.type) {
            case 'consumption':
                message = `🎉 Perfect! You've exactly met your energy consumption goal of ${targetValue}${goal.unit}! Current usage: ${actualValue}${goal.unit}. Excellent energy management!`;
                break;
            case 'cost':
                message = `💰 Excellent budget control! You've stayed exactly within your electricity budget of ${goal.unit}${targetValue}! Current spending: ${goal.unit}${actualValue}.`;
                break;
            case 'carbon':
                message = `🌿 Perfect environmental stewardship! You've exactly met your carbon reduction goal of ${targetValue}${goal.unit}! Current emissions: ${actualValue}${goal.unit}.`;
                break;
        }
        
        await addNotification('success', 'Goal Achieved!', message);
    }

    async function handleProgressMilestone(goal, milestone) {
        let title = '';
        let message = '';
        const actualValue = goal.current?.toFixed(2) || '0';
        const targetValue = goal.target;
        
        if (goal.type === 'cost') {
            title = `💰 Budget Limit Alert`;
            message = `You've used ${milestone}% of your electricity budget (${goal.unit}${goal.current?.toFixed(2)} of ${goal.unit}${goal.target}). `;
            
            if (milestone === 90) {
                message += `You're approaching your budget limit! Consider reducing usage to stay within budget.`;
            } else {
                message += `You're making good progress with your budget management.`;
            }
        } else {
            title = `🎯 ${goal.type.charAt(0).toUpperCase() + goal.type.slice(1)} Goal Progress`;
            message = `You've reached ${milestone}% of your ${goal.type} goal (${goal.current?.toFixed(2)}${goal.unit} of ${goal.target}${goal.unit}). `;
            
            if (milestone === 90) {
                message += `You're approaching your limit! Consider reducing usage to stay within limit.`;
            } else {
                message += `You're making good progress with your usage management.`;
            }
        }
        
        await addNotification('info', title, message);
    }

    function startGoalProgressMonitor() {
        // Update goals and check notifications every 30 seconds
        setInterval(async () => {
            const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
            if (accountId) {
                await updateDashboardStats();
                await checkGoalProgressNotifications();
            }
        }, 30000); // 30 seconds
        
        // Also check immediately on load
        setTimeout(async () => {
            const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
            if (accountId) {
                await checkGoalProgressNotifications();
            }
        }, 5000);
    }

    // Notification System
    function initializeNotificationSystem() {
        updateInboxCounter();
        loadNotifications();
        
        const inbox = document.querySelector('.inbox');
        if (inbox) {
            inbox.addEventListener('click', openNotificationModal);
        }
    }

    function updateInboxCounter() {
        const inboxCount = document.querySelector('.inbox-count');
        const unreadBadge = document.querySelector('.unread-badge');
        const unreadCount = notifications.filter(notification => !notification.read).length;
        
        if (inboxCount) {
            inboxCount.textContent = notifications.length;
        }
        
        if (unreadCount > 0) {
            if (!unreadBadge) {
                const badge = document.createElement('div');
                badge.className = 'unread-badge';
                document.querySelector('.inbox').appendChild(badge);
            }
            document.querySelector('.unread-badge').textContent = unreadCount;
        } else if (unreadBadge) {
            unreadBadge.remove();
        }
    }

    function loadNotifications() {
        const notificationsList = document.getElementById('notificationsList');
        const emptyNotifications = document.getElementById('emptyNotifications');
        
        if (!notificationsList || !emptyNotifications) return;
        
        if (notifications.length === 0) {
            notificationsList.style.display = 'none';
            emptyNotifications.style.display = 'block';
            return;
        }
        
        notificationsList.style.display = 'block';
        emptyNotifications.style.display = 'none';
        notificationsList.innerHTML = '';
        
        const sortedNotifications = [...notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        sortedNotifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = `notification-item ${notification.read ? '' : 'unread'}`;
            notificationItem.onclick = () => markAsRead(notification.id);
            
            const icon = getNotificationIcon(notification.type);
            const timeAgo = getTimeAgo(notification.timestamp);
            
            notificationItem.innerHTML = `
                <div class="notification-icon ${notification.type}">${icon}</div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                    <div class="notification-actions-single">
                        <button class="btn-delete-notification" onclick="event.stopPropagation(); deleteNotification(${notification.id})">
                            Delete
                        </button>
                    </div>
                </div>
            `;
            
            notificationsList.appendChild(notificationItem);
        });
    }

    function getNotificationIcon(type) {
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            success: '✅',
            error: '❌'
        };
        return icons[type] || '🔔';
    }

    function getTimeAgo(timestamp) {
        const now = new Date();
        const diffMs = now - new Date(timestamp);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return new Date(timestamp).toLocaleDateString();
    }

    // Modal functions
    function openNotificationModal() {
        const modal = document.getElementById('notificationModal');
        if (modal) {
            modal.style.display = 'block';
            loadNotifications();
        }
    }

    function closeNotificationModal() {
        const modal = document.getElementById('notificationModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Click outside modal to close
    window.onclick = function(event) {
        const modal = document.getElementById('notificationModal');
        if (event.target === modal) {
            closeNotificationModal();
        }
    }

    // Notification actions
    async function markAsRead(notificationId) {
        try {
            await energyDB.markNotificationAsRead(notificationId);
            const notification = notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
            }
            updateInboxCounter();
            loadNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async function markAllAsRead() {
        try {
            for (const notification of notifications) {
                if (!notification.read) {
                    await energyDB.markNotificationAsRead(notification.id);
                    notification.read = true;
                }
            }
            updateInboxCounter();
            loadNotifications();
            showToast('All notifications marked as read', 'success');
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }

    async function deleteNotification(notificationId) {
        try {
            await energyDB.deleteNotification(notificationId);
            notifications = notifications.filter(notification => notification.id !== notificationId);
            updateInboxCounter();
            loadNotifications();
            showToast('Notification deleted', 'success');
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }

    async function clearAllNotifications() {
        if (notifications.length === 0) {
            showToast('No notifications to clear', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear all notifications?')) {
            try {
                for (const notification of notifications) {
                    await energyDB.deleteNotification(notification.id);
                }
                notifications = [];
                updateInboxCounter();
                loadNotifications();
                showToast('All notifications cleared', 'success');
            } catch (error) {
                console.error('Error clearing notifications:', error);
            }
        }
    }

    // Dark Mode Functionality
    function initializeDarkMode() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (!darkModeToggle) return;
        
        const savedDarkMode = localStorage.getItem('darkMode') === 'true';
        
        if (savedDarkMode) {
            document.body.classList.add('dark-mode');
            darkModeToggle.checked = true;
        }
        
        darkModeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'true');
                showToast('Dark mode enabled', 'info');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'false');
                showToast('Dark mode disabled', 'info');
            }
        });
    }

    // Utility Functions
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <span>${getNotificationIcon(type)}</span>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    async function addNotification(type, title, message) {
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        
        try {
            const notificationId = await energyDB.addNotification(accountId, {
                type: type,
                title: title,
                message: message,
                read: false,
                timestamp: new Date()
            });
            
            console.log('Notification added with ID:', notificationId);
            
            // Reload notifications from database
            notifications = await energyDB.getNotifications(accountId);
            updateInboxCounter();
            
            // Refresh notifications list if modal is open
            if (document.getElementById('notificationModal').style.display === 'block') {
                loadNotifications();
            }
            
            showToast('New notification received', 'info');
        } catch (error) {
            console.error('Error adding notification:', error);
            showToast('Error creating notification', 'error');
        }
    }

    // Setup Event Listeners
    function setupEventListeners() {
        // Form submissions
        const addApplianceForm = document.getElementById('addApplianceForm');
        const goalForm = document.getElementById('goalForm');
        
        if (addApplianceForm) addApplianceForm.addEventListener('submit', addAppliance);
        if (goalForm) goalForm.addEventListener('submit', setGoal);
    
        // Smooth scrolling for navigation
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetHref = this.getAttribute('href');
                window.location.href = targetHref;
            });
        });
    }

    // Add CSS for exceeded goals
    const exceededStyles = `
        .goal-exceeded {
            border-left: 4px solid #f44336 !important;
            background: #ffebee !important;
        }
        .progress-exceeded {
            background: #f44336 !important;
        }
        .progress-exceeded-text {
            color: #f44336 !important;
            font-weight: bold;
        }
    `;

    // Add the styles to the document
    const styleSheet = document.createElement("style");
    styleSheet.textContent = exceededStyles;
    document.head.appendChild(styleSheet);

    // Make functions globally available
    window.addAppliance = addAppliance;
    window.deleteAppliance = deleteAppliance;
    window.editAppliance = editAppliance;
    window.setGoal = setGoal;
    window.deleteGoal = deleteGoal;
    window.editGoal = editGoal;
    window.openNotificationModal = openNotificationModal;
    window.closeNotificationModal = closeNotificationModal;
    window.markAllAsRead = markAllAsRead;
    window.clearAllNotifications = clearAllNotifications;
    window.deleteNotification = deleteNotification;
    window.markAsRead = markAsRead;
    window.logout = logout;

})();