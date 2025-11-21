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
        initializePreferences();
    });

    // Data storage
    let userProfile = {};
    let notifications = [];

    async function initializePreferences() {
        console.log('Preferences page loaded');
        
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
            initializeNotificationSystem();
            initializeDarkMode();
            setupEventListeners();
            
            console.log('Preferences page initialized successfully');
            
        } catch (error) {
            console.error('Error initializing preferences:', error);
            showToast('Error initializing preferences', 'error');
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
            
            // Load notifications
            notifications = await energyDB.getNotifications(accountId) || [];
            
            // Update UI with loaded data
            loadUserProfile();
            updateProfileSummary();
            updateHeaderInfo();
            
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

    // Load user profile data into forms
    function loadUserProfile() {
        console.log('Loading user profile:', userProfile);
        
        // Personal Information
        if (document.getElementById('lastName')) {
            document.getElementById('lastName').value = userProfile.surname || '';
        }
        if (document.getElementById('firstName')) {
            document.getElementById('firstName').value = userProfile.firstName || '';
        }
        if (document.getElementById('middleName')) {
            document.getElementById('middleName').value = userProfile.middleName || '';
        }
        if (document.getElementById('userEmail')) {
            document.getElementById('userEmail').value = userProfile.email || '';
        }
        if (document.getElementById('phoneNumber')) {
            document.getElementById('phoneNumber').value = userProfile.phone || '';
        }
        if (document.getElementById('householdSize')) {
            document.getElementById('householdSize').value = userProfile.householdSize || 1;
        }
    
        // Location & Tariff - with proper fallbacks
        if (document.getElementById('region')) {
            document.getElementById('region').value = userProfile.region || 'NCR';
        }
        if (document.getElementById('province')) {
            document.getElementById('province').value = userProfile.province || 'Metro Manila';
        }
        if (document.getElementById('city')) {
            document.getElementById('city').value = userProfile.city || '';
        }
        if (document.getElementById('zipCode')) {
            document.getElementById('zipCode').value = userProfile.zipCode || '';
        }
        if (document.getElementById('electricityProvider')) {
            document.getElementById('electricityProvider').value = userProfile.electricityProvider || 'Meralco';
        }
        if (document.getElementById('electricityTariff')) {
            document.getElementById('electricityTariff').value = userProfile.electricityTariff || 11.00;
        }
    
        // Preferences
        if (document.getElementById('energyUnit')) {
            document.getElementById('energyUnit').value = userProfile.energyUnit || 'kWh';
        }
        if (document.getElementById('carbonUnit')) {
            document.getElementById('carbonUnit').value = userProfile.carbonUnit || 'kg';
        }
        if (document.getElementById('timeFormat')) {
            document.getElementById('timeFormat').value = userProfile.timeFormat || '24h';
        }
        if (document.getElementById('dateFormat')) {
            document.getElementById('dateFormat').value = userProfile.dateFormat || 'DD/MM/YYYY';
        }
    
        // Notification Preferences - Load switch states
        const budgetAlertsSwitch = document.getElementById('budgetAlerts');
        const goalProgressAlertsSwitch = document.getElementById('goalProgressAlerts');
        
        if (budgetAlertsSwitch) {
            budgetAlertsSwitch.checked = userProfile.budgetAlerts !== undefined ? userProfile.budgetAlerts : true;
            console.log('Budget alerts switch loaded:', budgetAlertsSwitch.checked);
        }
        
        if (goalProgressAlertsSwitch) {
            goalProgressAlertsSwitch.checked = userProfile.goalProgressAlerts !== undefined ? userProfile.goalProgressAlerts : true;
            console.log('Goal progress alerts switch loaded:', goalProgressAlertsSwitch.checked);
        }
    
        // Update dark mode toggle if preference exists
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle && userProfile.darkMode !== undefined) {
            darkModeToggle.checked = userProfile.darkMode;
            if (userProfile.darkMode) {
                document.body.classList.add('dark-mode');
            }
        }
        
        console.log('User profile loaded into forms');
    }

    function updateProfileSummary() {
        console.log('Updating profile summary with userProfile:', userProfile);
        
        // Update summary elements with proper null checks
        const summaryName = document.getElementById('summaryName');
        const summaryLocation = document.getElementById('summaryLocation');
        const summaryProvider = document.getElementById('summaryProvider');
        const summaryTariff = document.getElementById('summaryTariff');
        const summaryHousehold = document.getElementById('summaryHousehold');
        const summaryJoinDate = document.getElementById('summaryJoinDate');
    
        if (summaryName) {
            // Construct full name from individual components
            let fullName = '';
            if (userProfile.firstName) fullName += userProfile.firstName;
            if (userProfile.middleName) fullName += ' ' + userProfile.middleName;
            if (userProfile.surname) fullName += ' ' + userProfile.surname;
        
            summaryName.textContent = fullName.trim() || userProfile.fullName || userProfile.fullname || 'Not set';
        }
        
        if (summaryLocation) {
            let locationText = 'Not set';
            if (userProfile.city && userProfile.province) {
                locationText = `${userProfile.city}, ${userProfile.province}, ${userProfile.region}`;
            } else if (userProfile.city) {
                locationText = userProfile.city;
            } else if (userProfile.province) {
                locationText = userProfile.province;
            } else if (userProfile.region) {
                locationText = userProfile.region;
            }
            summaryLocation.textContent = locationText;
        }
        
        if (summaryProvider) {
            summaryProvider.textContent = userProfile.electricityProvider || 'Not set';
        }
        
        if (summaryTariff) {
            const tariff = userProfile.electricityTariff || userProfile.electricityTariff;
            summaryTariff.textContent = tariff ? 
                `₱${parseFloat(tariff).toFixed(2)}/kWh` : 'Not set';
        }
        
        if (summaryHousehold) {
            const householdSize = userProfile.householdSize || 1;
            summaryHousehold.textContent = `${householdSize} ${householdSize === 1 ? 'person' : 'people'}`;
        }
        
        // Set member since date
        if (summaryJoinDate) {
            if (userProfile.createdAt) {
                const joinDate = new Date(userProfile.createdAt);
                summaryJoinDate.textContent = joinDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                });
            } else {
                // Use current date as fallback
                summaryJoinDate.textContent = new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                });
            }
        }
        
        console.log('Profile summary updated successfully');
    }

    // Form Submission Handlers
    async function handlePersonalInfoSubmit(e) {
        e.preventDefault();
        
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        const profileData = {
            surname: document.getElementById('lastName').value,
            firstName: document.getElementById('firstName').value,
            middleName: document.getElementById('middleName').value,
            email: document.getElementById('userEmail').value,
            phone: document.getElementById('phoneNumber').value,
            householdSize: parseInt(document.getElementById('householdSize').value) || 1
        };
        
        try {
            await energyDB.saveUserProfile(accountId, profileData);
            Object.assign(userProfile, profileData);
            
            updateProfileSummary();
            updateHeaderInfo();
            showToast('Personal information updated successfully!', 'success');
        } catch (error) {
            console.error('Error saving profile:', error);
            showToast('Error updating personal information', 'error');
        }
    }

    async function handleLocationTariffSubmit(e) {
        e.preventDefault();
        
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        
        // Get all form values
        const locationData = {
            region: document.getElementById('region').value,
            province: document.getElementById('province').value,
            city: document.getElementById('city').value,
            zipCode: document.getElementById('zipCode').value,
            electricityProvider: document.getElementById('electricityProvider').value,
            electricityTariff: parseFloat(document.getElementById('electricityTariff').value) || 11.00,
            updatedAt: new Date()
        };
        
        console.log('Saving location data:', locationData);
        
        try {
            // Save to database
            await energyDB.saveLocationTariff(accountId, locationData);
            
            // Update userProfile object with new data
            Object.assign(userProfile, locationData);
            
            console.log('Location data saved, updating UI...');
            
            // Update all relevant UI elements
            updateProfileSummary();
            updateHeaderInfo();
            
            showToast('Location and tariff settings updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving location data:', error);
            showToast('Error updating location and tariff settings', 'error');
        }
    }

    async function handlePreferencesSubmit(e) {
        e.preventDefault();
        
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        const darkModeToggle = document.getElementById('darkModeToggle');
        const budgetAlertsSwitch = document.getElementById('budgetAlerts');
        const goalProgressAlertsSwitch = document.getElementById('goalProgressAlerts');
        
        const preferences = {
            energyUnit: document.getElementById('energyUnit').value,
            carbonUnit: document.getElementById('carbonUnit').value,
            timeFormat: document.getElementById('timeFormat').value,
            dateFormat: document.getElementById('dateFormat').value,
            darkMode: darkModeToggle ? darkModeToggle.checked : false,
            budgetAlerts: budgetAlertsSwitch ? budgetAlertsSwitch.checked : true,
            goalProgressAlerts: goalProgressAlertsSwitch ? goalProgressAlertsSwitch.checked : true
        };
        
        try {
            await energyDB.savePreferences(accountId, preferences);
            Object.assign(userProfile, preferences);
            
            // Apply dark mode immediately
            if (preferences.darkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            
            showToast('Application preferences saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving preferences:', error);
            showToast('Error saving preferences', 'error');
        }
    }

    function openDeleteAccountModal() {
        console.log('Opening delete account modal');
        const modal = document.getElementById('deleteAccountModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Reset form
            document.getElementById('confirmDeletePassword').value = '';
            document.getElementById('deletePasswordFeedback').textContent = '';
            document.getElementById('confirmDeleteBtn').disabled = true;
            
            // Add real-time password validation
            const passwordInput = document.getElementById('confirmDeletePassword');
            passwordInput.addEventListener('input', validateDeletePassword);
            
            // Focus on password input
            setTimeout(() => {
                passwordInput.focus();
            }, 300);
        }
    }

    function closeDeleteAccountModal() {
        console.log('Closing delete account modal');
        const modal = document.getElementById('deleteAccountModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function validateDeletePassword() {
        const password = document.getElementById('confirmDeletePassword').value;
        const feedback = document.getElementById('deletePasswordFeedback');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        if (password.length === 0) {
            feedback.textContent = '';
            feedback.className = 'real-time-feedback';
            confirmBtn.disabled = true;
            return;
        }
        
        if (password.length < 1) {
            feedback.textContent = 'Please enter your password';
            feedback.className = 'real-time-feedback invalid';
            confirmBtn.disabled = true;
        } else {
            feedback.textContent = '✓ Password entered';
            feedback.className = 'real-time-feedback valid';
            confirmBtn.disabled = false;
        }
    }

    async function confirmDeleteAccount() {
        console.log('Confirming account deletion');
        const password = document.getElementById('confirmDeletePassword').value;
        const currentAccount = window.EnergySavingApp.SessionManager.getCurrentAccount();
        
        if (!currentAccount) {
            showToast('No active session found', 'error');
            return;
        }
        
        if (!password) {
            showToast('Please enter your password', 'error');
            return;
        }
        
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const originalText = confirmBtn.textContent;
        confirmBtn.textContent = 'Deleting Account...';
        confirmBtn.disabled = true;
        
        try {
            console.log('Verifying password for account:', currentAccount.email);
            
            // Verify password first
            const account = await energyDB.authenticateAccount(currentAccount.email, password);
            if (!account) {
                showToast('Incorrect password. Please try again.', 'error');
                confirmBtn.textContent = originalText;
                confirmBtn.disabled = false;
                return;
            }
            
            console.log('Password verified, proceeding with account deletion');
            
            // Show processing message
            showToast('Deleting account and all data...', 'info');
            
            // Proceed with account deletion
            await deleteUserAccount(currentAccount.id);
            
            showToast('Account deleted successfully', 'success');
            
            // Clear session
            window.EnergySavingApp.SessionManager.clearSession();
            
            // Close modal
            closeDeleteAccountModal();
            
            // Redirect to login page
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('Error deleting account:', error);
            showToast('Error deleting account: ' + error.message, 'error');
            confirmBtn.textContent = originalText;
            confirmBtn.disabled = false;
        }
    }

    async function deleteUserAccount(accountId) {
        try {
            console.log('Starting account deletion for ID:', accountId);
            
            // Use the database's built-in deleteAccount method
            await energyDB.deleteAccount(accountId);
            
            console.log('Account and all related data deleted successfully');
            
        } catch (error) {
            console.error('Error in deleteUserAccount:', error);
            throw new Error('Failed to delete account and associated data: ' + error.message);
        }
    }

    // Add click outside to close modal
    window.onclick = function(event) {
        const modal = document.getElementById('deleteAccountModal');
        if (event.target === modal) {
            closeDeleteAccountModal();
        }
    }

    // Add escape key to close modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeDeleteAccountModal();
        }
    });
    async function handleDeleteAccount() {
        openDeleteAccountModal();
    }

    // Notification System
    async function saveNotificationPreferences() {
        const accountId = window.EnergySavingApp.SessionManager.getCurrentAccount().id;
        const budgetAlerts = document.getElementById('budgetAlerts')?.checked || false;
        const goalProgressAlerts = document.getElementById('goalProgressAlerts')?.checked || false;
        
        try {
            await energyDB.savePreferences(accountId, {
                budgetAlerts: budgetAlerts,
                goalProgressAlerts: goalProgressAlerts,
                energyUnit: userProfile.energyUnit || 'kWh',
                carbonUnit: userProfile.carbonUnit || 'kg',
                timeFormat: userProfile.timeFormat || '24h',
                dateFormat: userProfile.dateFormat || 'DD/MM/YYYY',
                darkMode: userProfile.darkMode || false,
                updatedAt: new Date()
            });
            
            // Update userProfile with new preferences
            userProfile.budgetAlerts = budgetAlerts;
            userProfile.goalProgressAlerts = goalProgressAlerts;
            
            console.log('Notification preferences saved:', { budgetAlerts, goalProgressAlerts });
        } catch (error) {
            console.error('Error saving notification preferences:', error);
        }
    }

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
        
        const deleteModal = document.getElementById('deleteAccountModal');
        if (event.target === deleteModal) {
            closeDeleteAccountModal();
        }
    }

    // Add escape key to close modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeDeleteAccountModal();
            closeNotificationModal();
        }
    });

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

    // Test notification functions
    function testBudgetAlert() {
        const budgetAlertsEnabled = document.getElementById('budgetAlerts')?.checked || false;
        if (budgetAlertsEnabled) {
            addNotification('warning', '💰 Budget Limit Alert', 
                'You are approaching your monthly budget limit! Current spending: ₱2,800 of ₱3,300. Consider reducing usage to stay within budget.');
        } else {
            showToast('Budget alerts are disabled. Enable them in notification settings.', 'info');
        }
    }

    function testGoalProgress() {
        const goalProgressAlertsEnabled = document.getElementById('goalProgressAlerts')?.checked || false;
        if (goalProgressAlertsEnabled) {
            addNotification('info', '🎯 Goal Progress Update', 
                'You\'ve reached 70% of your energy consumption goal (42.5kWh of 50kWh). You\'re almost there! Keep up the great work!');
        } else {
            showToast('Goal progress alerts are disabled. Enable them in notification settings.', 'info');
        }
    }

    function testGoalCompletion() {
        const goalProgressAlertsEnabled = document.getElementById('goalProgressAlerts')?.checked || false;
        if (goalProgressAlertsEnabled) {
            addNotification('success', 'Goal Achieved!', 
                '🎉 Amazing! You\'ve successfully achieved your energy consumption goal of 50kWh! Keep up the great work in conserving energy!');
        } else {
            showToast('Goal progress alerts are disabled. Enable them in notification settings.', 'info');
        }
    }

    function testLimitExceeded() {
        const budgetAlertsEnabled = document.getElementById('budgetAlerts')?.checked || false;
        if (budgetAlertsEnabled) {
            addNotification('warning', '💰 Budget Limit Exceeded!', 
            'You\'ve exceeded your monthly electricity budget by 17%! Current spending: ₱3500 of ₱3000. Review your appliance usage to reduce costs.');
        } else {
            showToast('Budget alerts are disabled. Enable them in notification settings.', 'info');
        }
    }

    // Setup Event Listeners
    function setupNotificationSwitchListeners() {
        const budgetAlertsSwitch = document.getElementById('budgetAlerts');
        const goalProgressAlertsSwitch = document.getElementById('goalProgressAlerts');
        
        if (budgetAlertsSwitch) {
            budgetAlertsSwitch.addEventListener('change', function() {
                console.log('Budget alerts switch changed:', this.checked);
                saveNotificationPreferences();
                
                // Show immediate feedback
                if (this.checked) {
                    showToast('Budget alerts enabled', 'info');
                } else {
                    showToast('Budget alerts disabled', 'info');
                }
            });
        }
        
        if (goalProgressAlertsSwitch) {
            goalProgressAlertsSwitch.addEventListener('change', function() {
                console.log('Goal progress alerts switch changed:', this.checked);
                saveNotificationPreferences();
                
                // Show immediate feedback
                if (this.checked) {
                    showToast('Goal progress alerts enabled', 'info');
                } else {
                    showToast('Goal progress alerts disabled', 'info');
                }
            });
        }
        
        console.log('Notification switch listeners setup complete');
    }
    
    function setupEventListeners() {
        // Form submissions
        const personalInfoForm = document.getElementById('personalInfoForm');
        const locationTariffForm = document.getElementById('locationTariffForm');
        const preferencesForm = document.getElementById('preferencesForm');
        
        if (personalInfoForm) personalInfoForm.addEventListener('submit', handlePersonalInfoSubmit);
        if (locationTariffForm) locationTariffForm.addEventListener('submit', handleLocationTariffSubmit);
        if (preferencesForm) preferencesForm.addEventListener('submit', handlePreferencesSubmit);
    
        // Setup notification switch listeners
        setupNotificationSwitchListeners();
    
        // Smooth scrolling for navigation
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetHref = this.getAttribute('href');
                window.location.href = targetHref;
            });
        });
    
        // Real-time updates when form fields change
        setupRealTimeFormUpdates();
    }

    // Setup real-time form updates
    function setupRealTimeFormUpdates() {
        console.log('Setting up real-time form updates...');
        
        // Update profile summary when location/tariff fields change
        const locationFields = ['region', 'province', 'city', 'electricityProvider', 'electricityTariff'];
        locationFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', function() {
                    console.log(`Field ${fieldId} updated, refreshing summary...`);
                    // Update userProfile immediately with the new value
                    if (fieldId === 'electricityTariff') {
                        userProfile[fieldId] = parseFloat(this.value) || 11.00;
                    } else {
                        userProfile[fieldId] = this.value;
                    }
                    updateProfileSummary();
                    updateHeaderInfo();
                });
                
                // Also update on input for immediate feedback
                field.addEventListener('input', function() {
                    if (fieldId === 'electricityTariff') {
                        userProfile[fieldId] = parseFloat(this.value) || 11.00;
                    } else {
                        userProfile[fieldId] = this.value;
                    }
                    updateProfileSummary();
                });
            }
        });
        
        // Update personal info fields
        const personalInfoFields = ['lastName', 'firstName', 'middleName', 'phoneNumber', 'householdSize'];
        personalInfoFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', function() {
                    if (fieldId === 'householdSize') {
                        userProfile[fieldId] = parseInt(this.value) || 1;
                    } else {    
                        userProfile[fieldId] = this.value;
                    }
                    updateProfileSummary();
                    updateHeaderInfo();
                });
            }
        });
        
        console.log('Real-time form updates setup complete');
    }

    // Make functions globally available
    window.openNotificationModal = openNotificationModal;
    window.closeNotificationModal = closeNotificationModal;
    window.markAllAsRead = markAllAsRead;
    window.clearAllNotifications = clearAllNotifications;
    window.deleteNotification = deleteNotification;
    window.markAsRead = markAsRead;
    window.testBudgetAlert = testBudgetAlert;
    window.testGoalProgress = testGoalProgress;
    window.testGoalCompletion = testGoalCompletion;
    window.testLimitExceeded = testLimitExceeded;
    window.logout = logout;
    window.openDeleteAccountModal = openDeleteAccountModal;
    window.closeDeleteAccountModal = closeDeleteAccountModal;   
    window.confirmDeleteAccount = confirmDeleteAccount;
    window.handleDeleteAccount = handleDeleteAccount;

})();