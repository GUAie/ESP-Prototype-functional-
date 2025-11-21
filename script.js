console.log('Loading optimized Energy Saving Pro...');

const Utils = {
    showMessage: function(message, type = 'info', duration = 3000) {
        // Fast DOM cleanup and insertion
        const existingMessage = document.querySelector('.message');
        if (existingMessage) existingMessage.remove();
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        
        const formHeader = document.querySelector('.form-header');
        if (formHeader) {
            formHeader.parentNode.insertBefore(messageEl, formHeader.nextSibling);
        }
        
        setTimeout(() => {
            if (messageEl.parentNode) messageEl.parentNode.removeChild(messageEl);
        }, duration);
    },
    
    isValidEmail: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    isValidPassword: function(password) {
        // Enhanced password validation with criteria:
        // - Minimum 8 characters
        // - At least one capital letter
        // - At least one number
        // - At least one special character (!@#$%^&*()\-_=+{};:,<.>)
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/;
        return passwordRegex.test(password);
    },
    
    getPasswordValidationMessage: function(password) {
        const requirements = [];
        
        if (password.length < 8) {
            requirements.push('at least 8 characters');
        }
        if (!/(?=.*[A-Z])/.test(password)) {
            requirements.push('one capital letter');
        }
        if (!/(?=.*\d)/.test(password)) {
            requirements.push('one number');
        }
        if (!/(?=.*[!@#$%^&*()\-_=+{};:,<.>])/.test(password)) {
            requirements.push('one special character (!@#$%^&*()-_=+{};:,<.>)');
        }
        
        if (requirements.length === 0) {
            return 'Password meets all requirements';
        } else {
            return 'Password must contain: ' + requirements.join(', ');
        }
    },
    
    doPasswordsMatch: function(password, confirmPassword) {
        return password === confirmPassword;
    }
};

//hide unhide password
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggleBtn = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.textContent = '🔒';
    } else {
        input.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

// ===== ENHANCED SESSION MANAGEMENT =====
window.EnergySavingApp = window.EnergySavingApp || {};

window.EnergySavingApp.FailedAttemptsManager = {
    getFailedAttempts: function(email) {
        try {
            const attemptsData = localStorage.getItem('failedLoginAttempts');
            if (attemptsData) {
                const attempts = JSON.parse(attemptsData);
                return attempts[email] || 0;
            }
            return 0;
        } catch (error) {
            console.error('Error getting failed attempts:', error);
            return 0;
        }
    },
    
    incrementFailedAttempts: function(email) {
        try {
            const attemptsData = localStorage.getItem('failedLoginAttempts') || '{}';
            const attempts = JSON.parse(attemptsData);
            attempts[email] = (attempts[email] || 0) + 1;
            localStorage.setItem('failedLoginAttempts', JSON.stringify(attempts));
            console.log(`Failed attempts for ${email}: ${attempts[email]}`);
            return attempts[email];
        } catch (error) {
            console.error('Error incrementing failed attempts:', error);
            return 1;
        }
    },
    
    resetFailedAttempts: function(email) {
        try {
            const attemptsData = localStorage.getItem('failedLoginAttempts') || '{}';
            const attempts = JSON.parse(attemptsData);
            delete attempts[email];
            localStorage.setItem('failedLoginAttempts', JSON.stringify(attempts));
            console.log(`Reset failed attempts for: ${email}`);
        } catch (error) {
            console.error('Error resetting failed attempts:', error);
        }
    },
    
    shouldShowResetButton: function(email) {
        return this.getFailedAttempts(email) >= 3;
    }
};

window.EnergySavingApp.SessionManager = {
    getCurrentAccount: function() {
        try {
            const accountId = localStorage.getItem('currentAccountId');
            const email = localStorage.getItem('currentUser');
            const sessionToken = localStorage.getItem('sessionToken');
            
            if (accountId && email && sessionToken) {
                return { 
                    id: parseInt(accountId), 
                    email: email,
                    sessionToken: sessionToken
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting current account:', error);
            return null;
        }
    },
    
    setCurrentAccount: function(accountId, email, sessionToken = null) {
        try {
            localStorage.setItem('currentAccountId', accountId.toString());
            localStorage.setItem('currentUser', email);
            
            if (sessionToken) {
                localStorage.setItem('sessionToken', sessionToken);
            } else {
                // Generate a simple session token if not provided
                const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                localStorage.setItem('sessionToken', token);
            }
            
            console.log('Session set for account:', accountId, email);
        
            
        } catch (error) {
            console.error('Error setting session:', error);
        }
    },
    
    clearSession: function() {
        try {
            localStorage.removeItem('currentAccountId');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionToken');
            console.log('Session cleared');
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    },
    
    isLoggedIn: function() {
        const account = this.getCurrentAccount();
        if (!account) return false;
        
        // Additional validation with database if available
        if (typeof energyDB !== 'undefined' && energyDB && energyDB.db) {
            // We could validate the session token here, but for now just check existence
            return true;
        }
        
        return !!account;
    },
    
    validateSession: async function() {
        try {
            const account = this.getCurrentAccount();
            if (!account) return false;
            
            if (typeof energyDB !== 'undefined' && energyDB && energyDB.db) {
                // Validate session with database
                const isValid = await energyDB.validateUserSession(account.id, account.sessionToken);
                return isValid;
            }
            
            return true; // Fallback to basic validation
        } catch (error) {
            console.error('Error validating session:', error);
            return false;
        }
    },

    
    getCurrentPage: function() {
        const path = window.location.pathname;
        if (path.includes('dashboard.html')) return 'Dashboard';
        if (path.includes('preferences.html')) return 'Preferences';
        if (path.includes('calculators.html')) return 'Calculators';
        if (path.includes('CreateAccount.html')) return 'Create Account';
        if (path.includes('resetpassword.html')) return 'Reset Password';
        return 'Login';
    }
};

// ===== DATABASE STATUS MONITORING =====
let dbReady = false;
let dbInitializing = false;

async function waitForDatabaseReady(maxWait = 10000) {
    if (dbReady) return true;
    
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        function checkDB() {
            if (dbReady) {
                resolve(true);
            } else if (Date.now() - startTime > maxWait) {
                reject(new Error('Database initialization timeout'));
            } else if (typeof energyDB !== 'undefined' && energyDB.db && !dbInitializing) {
                // Test if database is actually working
                try {
                    // Try a simple query to verify database is functional
                    energyDB.db.accounts.count().then(() => {
                        dbReady = true;
                        resolve(true);
                    }).catch(() => {
                        setTimeout(checkDB, 100);
                    });
                } catch (error) {
                    setTimeout(checkDB, 100);
                }
            } else {
                setTimeout(checkDB, 100);
            }
        }
        
        checkDB();
    });
}

// ===== ULTRA-FAST LOGIN WITH DB INTEGRATION =====
async function simulateLogin(email, password) {
    console.log('Starting fast login process...');
    const loginBtn = document.querySelector('.btn-primary');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;

    const startTime = performance.now();

    try {
        // Phase 1: Instant validation (no async)
        if (!email || !password) {
            Utils.showMessage('Please fill in all fields', 'info');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.showMessage('Please enter a valid email address', 'info');
            return;
        }

        console.log('Phase 1 - Validation passed');

        // Phase 2: Wait for database with progress feedback
        loginBtn.textContent = 'Initializing system...';
        
        try {
            await waitForDatabaseReady();
            console.log('Database ready for authentication');
        } catch (error) {
            console.error('Database wait error:', error);
            Utils.showMessage('System is initializing. Please try again.', 'info');
            return;
        }

        // Phase 3: Fast authentication
        loginBtn.textContent = 'Authenticating...';
        const authStart = performance.now();
        
        const account = await energyDB.authenticateAccount(email, password);
        console.log(`Authentication took: ${(performance.now() - authStart).toFixed(1)}ms`);

        if (account) {
            // Reset failed attempts on successful login
            window.EnergySavingApp.FailedAttemptsManager.resetFailedAttempts(email);
            
            // Create user session in database
            const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
            await energyDB.createUserSession(account.id, sessionToken);
            
            // Store session using SessionManager
            window.EnergySavingApp.SessionManager.setCurrentAccount(account.id, email, sessionToken);
            
            const totalTime = performance.now() - startTime;
            console.log(`LOGIN COMPLETE: ${totalTime.toFixed(1)}ms`);
            
            Utils.showMessage('Welcome back! Redirecting...', 'success');
            
            // Hide reset button if it was shown
            hideResetButton();
            
            // Fast redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
            
        } else {
            // Increment failed attempts
            const failedAttempts = window.EnergySavingApp.FailedAttemptsManager.incrementFailedAttempts(email);
            
            if (failedAttempts >= 3) {
                Utils.showMessage(`Too many failed attempts. Please reset your password.`, 'info');
                showResetButton();
            } else {
                const remainingAttempts = 3 - failedAttempts;
                Utils.showMessage(`Invalid email or password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`, 'info');
            }
        }
        
    } catch (error) {
        console.error('Login process error:', error);
        Utils.showMessage('Login failed. Please try again.', 'info');
    } finally {
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

// ===== RESET BUTTON MANAGEMENT =====
function showResetButton() {
    const buttonGroup = document.querySelector('.button-group');
    if (!buttonGroup) return;
    
    // Check if reset button already exists
    let resetBtn = document.querySelector('.btn-reset-password');
    
    if (!resetBtn) {
        resetBtn = document.createElement('a');
        resetBtn.className = 'btn btn-tertiary btn-reset-password';
        resetBtn.textContent = 'Reset Password';
        resetBtn.href = 'resetpassword.html';
        
        // Insert after the login button
        const loginBtn = buttonGroup.querySelector('.btn-primary');
        if (loginBtn && loginBtn.parentNode) {
            loginBtn.parentNode.insertBefore(resetBtn, loginBtn.nextSibling);
        }
    }
    
    resetBtn.style.display = 'block';
}

function hideResetButton() {
    const resetBtn = document.querySelector('.btn-reset-password');
    if (resetBtn) {
        resetBtn.style.display = 'none';
    }
}

// ===== OPTIMIZED ACCOUNT CREATION =====
async function simulateAccountCreation(email, password, confirmPassword, surname, firstName, middleName = '') {
    console.log('Starting fast account creation...');
    const createAccountBtn = document.querySelector('.btn-create-account');
    const originalText = createAccountBtn.textContent;
    createAccountBtn.textContent = 'Creating...';
    createAccountBtn.disabled = true;

    const startTime = performance.now();

    try {
        // Phase 1: Instant validation
        if (!email || !password || !confirmPassword || !surname || !firstName) {
            Utils.showMessage('Please fill in all required fields', 'info');
            return;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.showMessage('Please enter a valid email address', 'info');
            return;
        }

        // Enhanced password validation with detailed message
        if (!Utils.isValidPassword(password)) {
            const validationMessage = Utils.getPasswordValidationMessage(password);
            Utils.showMessage(validationMessage, 'info');
            return;
        }

        if (!Utils.doPasswordsMatch(password, confirmPassword)) {
            Utils.showMessage('Passwords do not match', 'info');
            return;
        }

        // Check if terms and privacy policy are accepted
        const termsChecked = document.getElementById('termsOfUse')?.checked;
        const privacyChecked = document.getElementById('privacyPolicy')?.checked;
        
        if (!termsChecked || !privacyChecked) {
            Utils.showMessage('Please accept both Terms of Use and Data Privacy Policy', 'info');
            return;
        }

        console.log('Phase 1 - Validation passed');

        // Phase 2: Wait for database
        createAccountBtn.textContent = 'Initializing system...';
        
        try {
            await waitForDatabaseReady();
            console.log('Database ready for account creation');
        } catch (error) {
            Utils.showMessage('System is initializing. Please try again.', 'info');
            return;
        }

        // Phase 3: Create account with new fields
        createAccountBtn.textContent = 'Creating account...';
        const accountId = await energyDB.createAccount(email, password, surname, firstName, middleName);
        
        console.log('Account created with ID:', accountId);

        // Create user session
        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await energyDB.createUserSession(accountId, sessionToken);
        
        // Store session using SessionManager
        window.EnergySavingApp.SessionManager.setCurrentAccount(accountId, email, sessionToken);

        const totalTime = performance.now() - startTime;
        console.log(`ACCOUNT CREATION COMPLETE: ${totalTime.toFixed(1)}ms`);

        Utils.showMessage('Account created! Welcome!', 'success');
        
        // Fast redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 800);
        
    } catch (error) {
        console.error('Account creation error:', error);
        if (error.message === 'Account already exists') {
            Utils.showMessage('An account with this email already exists', 'info');
        } else {
            Utils.showMessage('Account creation failed. Please try again.', 'info');
        }
    } finally {
        createAccountBtn.textContent = originalText;
        createAccountBtn.disabled = false;
    }
}

// Update the account creation form handler
function setupAccountCreationHandlers() {
    const createAccountForm = document.getElementById('createAccountForm');
    if (createAccountForm) {
        createAccountForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const surname = document.getElementById('surname').value;
            const firstName = document.getElementById('firstname').value;
            const middleName = document.getElementById('middlename').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            simulateAccountCreation(email, password, confirmPassword, surname, firstName, middleName);
        });
    }
}

function openTermsModal() {
    const modal = document.getElementById('termsModal');
    if (modal) {
        modal.style.display = 'block';
        const modalBody = modal.querySelector('.modal-body');
        const termsCheckbox = document.getElementById('termsOfUse');
        
        // Reset scroll and disable checkbox
        modalBody.scrollTop = 0;
        termsCheckbox.disabled = true;
        termsCheckbox.parentElement.classList.add('checkbox-disabled');
        
        // Add scroll event listener
        modalBody.onscroll = function() {
            const isAtBottom = modalBody.scrollHeight - modalBody.scrollTop <= modalBody.clientHeight + 10;
            if (isAtBottom) {
                termsCheckbox.disabled = false;
                termsCheckbox.parentElement.classList.remove('checkbox-disabled');
                termsCheckbox.parentElement.classList.add('checkbox-enabled');
            }
        };
    }
}

function closeTermsModal() {
    const modal = document.getElementById('termsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openPrivacyModal() {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.style.display = 'block';
        const modalBody = modal.querySelector('.modal-body');
        const privacyCheckbox = document.getElementById('privacyPolicy');
        
        // Reset scroll and disable checkbox
        modalBody.scrollTop = 0;
        privacyCheckbox.disabled = true;
        privacyCheckbox.parentElement.classList.add('checkbox-disabled');
        
        // Add scroll event listener
        modalBody.onscroll = function() {
            const isAtBottom = modalBody.scrollHeight - modalBody.scrollTop <= modalBody.clientHeight + 10;
            if (isAtBottom) {
                privacyCheckbox.disabled = false;
                privacyCheckbox.parentElement.classList.remove('checkbox-disabled');
                privacyCheckbox.parentElement.classList.add('checkbox-enabled');
            }
        };
    }
}

function closePrivacyModal() {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== OPTIMIZED EVENT HANDLERS =====
function setupLoginHandlers() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            simulateLogin(email, password);
        });
    }
}

function setupAccountCreationHandlers() {
    const createAccountForm = document.getElementById('createAccountForm');
    if (createAccountForm) {
        createAccountForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const surname = document.getElementById('surname').value;
            const firstName = document.getElementById('firstname').value;
            const middleName = document.getElementById('middlename').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            simulateAccountCreation(email, password, confirmPassword, surname, firstName, middleName);
        });
    }
}

function setupPasswordResetHandlers() {
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            simulatePasswordReset(email);
        });
    }
}


// ===== FAST SPLASH SCREEN HANDLING =====
function handleSplashScreen() {
    const splashScreen = document.getElementById('splashScreen');
    if (splashScreen) {
        // Reduced splash screen time
        setTimeout(() => {
            splashScreen.style.opacity = '0';
            setTimeout(() => {
                splashScreen.style.display = 'none';
            }, 300);
        }, 1000); // Reduced from 2000ms to 1000ms
    }
}

// ===== DATABASE STATUS UPDATER =====
function updateDatabaseStatus() {
    const dbCheckInterval = setInterval(() => {
        if (typeof energyDB !== 'undefined' && energyDB.db) {
            dbReady = true;
            console.log('Database is ready and operational');
            clearInterval(dbCheckInterval);
        }
    }, 500);
}

// ===== SESSION VALIDATION FOR PROTECTED PAGES =====
async function validateSessionForProtectedPages() {
    const currentPage = window.EnergySavingApp.SessionManager.getCurrentPage();
    const protectedPages = ['Dashboard', 'Preferences', 'Calculators'];
    
    if (protectedPages.includes(currentPage)) {
        const isValid = await window.EnergySavingApp.SessionManager.validateSession();
        if (!isValid) {
            console.log('Session invalid or expired, redirecting to login');
            window.EnergySavingApp.SessionManager.clearSession();
            window.location.href = 'index.html';
            return false;
        }
        
    
    }
    
    return true;
}

// ===== PAGE INITIALIZATION OPTIMIZED =====
async function initializePage() {
    console.log('Initializing page with optimized flow...');
    const initStart = performance.now();
    
    // Enhanced session check for redirection
    const currentAccount = window.EnergySavingApp.SessionManager.getCurrentAccount();
    const currentPage = window.EnergySavingApp.SessionManager.getCurrentPage();
    
    // Redirect logic
    if (currentAccount) {
        if (currentPage === 'Login' || currentPage === 'Create Account' || currentPage === 'Reset Password') {
            console.log('User already logged in, redirecting to dashboard');
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Validate session for protected pages
        await validateSessionForProtectedPages();
    } else {
        // Not logged in - redirect to login if trying to access protected pages
        const protectedPages = ['Dashboard', 'Preferences', 'Calculators'];
        if (protectedPages.includes(currentPage)) {
            console.log('No active session, redirecting to login');
            window.location.href = 'index.html';
            return;
        }
    }
    
    // Setup page-specific handlers
    if (currentPage === 'Login') {
        setupLoginHandlers();
        
        // Check for failed attempts to show reset button
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('blur', function() {
                const email = this.value;
                if (email && window.EnergySavingApp.FailedAttemptsManager.shouldShowResetButton(email)) {
                    showResetButton();
                }
            });
        }
    } else if (currentPage === 'Create Account') {
        setupAccountCreationHandlers();
    } else if (currentPage === 'Reset Password') {
        setupPasswordResetHandlers();
    }
    
    // Handle splash screen
    handleSplashScreen();
    
    console.log(`Page initialized in: ${(performance.now() - initStart).toFixed(1)}ms`);
}

// ===== UPDATED MAIN INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Starting optimized initialization');
    
    // Initialize session manager first
    if (!window.EnergySavingApp) {
        window.EnergySavingApp = {};
    }
    
    // Initialize SessionManager
    if (!window.EnergySavingApp.SessionManager) {
        window.EnergySavingApp.SessionManager = {
            getCurrentAccount: function() {
                const accountId = localStorage.getItem('currentAccountId');
                const email = localStorage.getItem('currentUser');
                const sessionToken = localStorage.getItem('sessionToken');
                return accountId && email && sessionToken ? { 
                    id: parseInt(accountId), 
                    email: email,
                    sessionToken: sessionToken 
                } : null;
            },
            setCurrentAccount: function(accountId, email, sessionToken = null) {
                localStorage.setItem('currentAccountId', accountId.toString());
                localStorage.setItem('currentUser', email);
                
                if (sessionToken) {
                    localStorage.setItem('sessionToken', sessionToken);
                } else {
                    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                    localStorage.setItem('sessionToken', token);
                }
            },
            clearSession: function() {
                localStorage.removeItem('currentAccountId');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('sessionToken');
            },
            isLoggedIn: function() {
                return !!this.getCurrentAccount();
            },
            validateSession: async function() {
                try {
                    const account = this.getCurrentAccount();
                    if (!account) return false;
                    
                    if (typeof energyDB !== 'undefined' && energyDB && energyDB.db) {
                        const isValid = await energyDB.validateUserSession(account.id, account.sessionToken);
                        return isValid;
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Error validating session:', error);
                    return false;
                }
            },
        
            getCurrentPage: function() {
                const path = window.location.pathname;
                if (path.includes('dashboard.html')) return 'Dashboard';
                if (path.includes('preferences.html')) return 'Preferences';
                if (path.includes('calculators.html')) return 'Calculators';
                if (path.includes('CreateAccount.html')) return 'Create Account';
                if (path.includes('resetpassword.html')) return 'Reset Password';
                return 'Login';
            }
        };
    }
    
    // Initialize FailedAttemptsManager
    if (!window.EnergySavingApp.FailedAttemptsManager) {
        window.EnergySavingApp.FailedAttemptsManager = {
            getFailedAttempts: function(email) {
                try {
                    const attemptsData = localStorage.getItem('failedLoginAttempts');
                    if (attemptsData) {
                        const attempts = JSON.parse(attemptsData);
                        return attempts[email] || 0;
                    }
                    return 0;
                } catch (error) {
                    console.error('Error getting failed attempts:', error);
                    return 0;
                }
            },
            incrementFailedAttempts: function(email) {
                try {
                    const attemptsData = localStorage.getItem('failedLoginAttempts') || '{}';
                    const attempts = JSON.parse(attemptsData);
                    attempts[email] = (attempts[email] || 0) + 1;
                    localStorage.setItem('failedLoginAttempts', JSON.stringify(attempts));
                    return attempts[email];
                } catch (error) {
                    console.error('Error incrementing failed attempts:', error);
                    return 1;
                }
            },
            resetFailedAttempts: function(email) {
                try {
                    const attemptsData = localStorage.getItem('failedLoginAttempts') || '{}';
                    const attempts = JSON.parse(attemptsData);
                    delete attempts[email];
                    localStorage.setItem('failedLoginAttempts', JSON.stringify(attempts));
                } catch (error) {
                    console.error('Error resetting failed attempts:', error);
                }
            },
            shouldShowResetButton: function(email) {
                return this.getFailedAttempts(email) >= 3;
            }
        };
    }
    
    // Phase 1: Initialize page (fast, synchronous operations)
    initializePage();
    
    // Phase 2: Start database monitoring
    updateDatabaseStatus();
    
    console.log('Main initialization sequence started');
});

// ===== ERROR HANDLING =====
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});

// ===== FAST LOGOUT =====
async function logout() {
    try {
        const account = window.EnergySavingApp.SessionManager.getCurrentAccount();
        if (account && typeof energyDB !== 'undefined' && energyDB && energyDB.db) {
            // Clean up user session from database
            await energyDB.cleanupExpiredSessions();
        }
        
        window.EnergySavingApp.SessionManager.clearSession();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.EnergySavingApp.SessionManager.clearSession();
        window.location.href = 'index.html';
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

// ===== PASSWORD RESET SIMULATION =====
async function simulatePasswordReset(email) {
    console.log('Starting password reset process for:', email);
    const resetBtn = document.querySelector('.btn-primary');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = 'Sending...';
    resetBtn.disabled = true;
    try {
        if (!email) {
            Utils.showMessage('Please enter your email address', 'info');
            return;
        }
        if (!Utils.isValidEmail(email)) {
            Utils.showMessage('Please enter a valid email address', 'info');
            return;
        }
        // Wait for database to be ready
        await waitForDatabaseReady();
        // Check if account exists
        const account = await energyDB.db.accounts.where('email').equals(email).first();
        if (!account) {
            Utils.showMessage('No account found with this email address', 'info');
            return;
        }
        // Generate a secure reset token
        const resetToken = generateSecureToken();
        const hashedToken = await hashToken(resetToken); // Hash for storage
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour
        // Store the reset token in the database
        await energyDB.createPasswordResetToken(email, hashedToken);
        // Prepare the reset link (point to a reset page; adjust URL as needed)
        const resetLink = `${window.location.origin}/resetpassword.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
        await sendResetEmail(email, resetLink);
        Utils.showMessage('Password reset instructions sent to your email', 'success');
        
        // Reset failed attempts for this email
        window.EnergySavingApp.FailedAttemptsManager.resetFailedAttempts(email);
        
        // Redirect to login after delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Password reset error:', error);
        Utils.showMessage('Error sending reset instructions. Please try again.', 'error');
    } finally {
        resetBtn.textContent = originalText;
        resetBtn.disabled = false;
    }
}
function generateSecureToken() {
    return crypto.getRandomValues(new Uint8Array(32)).reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');
}
async function hashToken(token) {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendResetEmail(email, resetLink) {
    // Check if EmailJS is loaded
    if (typeof emailjs === 'undefined') {
        throw new Error('EmailJS is not loaded. Please check your internet connection or CDN setup.');
    }
    
    const templateParams = {
        to_email: email,
        reset_link: resetLink,
        subject: 'Password Reset Request - Energy Saving Pro'
    };
    
    try {
        // Send email using your Service ID and Template ID (replace with your actual IDs)
        await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams); // Replace with your real IDs
        console.log('Reset email sent successfully');
    } catch (emailError) {
        console.error('EmailJS send error:', emailError);
        throw new Error('Failed to send email. Please check your EmailJS configuration or try again.');
    }
}
document.addEventListener('DOMContentLoaded', function() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init('YOUR_PUBLIC_KEY'); // Replace with your real public key
        console.log('EmailJS initialized successfully');
    } else {
        console.error('EmailJS failed to load. Check the CDN script in resetpassword.html');
        Utils.showMessage('Email service unavailable. Please try again later.', 'error');
    }
    
    // Existing token check logic (from previous response)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    
    if (token && email) {
        document.getElementById('resetRequestForm').style.display = 'none';
        document.getElementById('resetConfirmForm').style.display = 'block';
        validateAndHandleToken(token, email);
    } else {
        setupPasswordResetHandlers();
    }
});

// Enhanced mobile detection and handling
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

function optimizeForMobile() {
    if (isMobileDevice()) {
        // Add mobile-specific optimizations
        document.body.classList.add('mobile-device');
        
        // Enhance touch interactions
        const buttons = document.querySelectorAll('.btn, .nav-item, .action-btn');
        buttons.forEach(btn => {
            btn.style.cursor = 'pointer';
        });
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    optimizeForMobile();
    
    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
        setTimeout(optimizeForMobile, 100);
    });
    
    // Handle resize events
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(optimizeForMobile, 250);
    });
});
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    
    if (token && email) {
        // Hide request form, show confirmation form
        document.getElementById('resetRequestForm').style.display = 'none';
        document.getElementById('resetConfirmForm').style.display = 'block';
        
        // Validate token on load
        validateAndHandleToken(token, email);
    } else {
        // Show request form by default
        setupPasswordResetHandlers();
    }
});
// Validate the reset token and handle errors
async function validateAndHandleToken(token, email) {
    try {
        await waitForDatabaseReady();
        
        // Validate token (checks existence, match, and expiration)
        const isValid = await energyDB.validatePasswordResetToken(email, token);
        
        if (!isValid) {
            throw new Error('Invalid or expired reset token. Please request a new one.');
        }
        
        // Token is valid; set up confirmation form
        setupConfirmResetHandlers(email, token);
        Utils.showMessage('Token validated. Enter your new password.', 'success');
        
    } catch (error) {
        console.error('Token validation error:', error);
        Utils.showMessage(error.message || 'Error validating token. Please try again.', 'error');
        
        // Redirect to request form after delay
        setTimeout(() => {
            window.location.href = 'resetpassword.html';
        }, 3000);
    }
}
// Set up event handlers for the confirmation form
function setupConfirmResetHandlers(email, token) {
    const confirmForm = document.getElementById('confirmResetForm');
    if (confirmForm) {
        confirmForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            handlePasswordUpdate(email, token, newPassword, confirmPassword);
        });
    }
}

async function handlePasswordUpdate(email, token, newPassword, confirmPassword) {
    const updateBtn = document.querySelector('#resetConfirmForm .btn-primary');
    const originalText = updateBtn.textContent;
    updateBtn.textContent = 'Updating...';
    updateBtn.disabled = true;
    
    try {
        // Basic validation
        if (!newPassword || newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }
        if (newPassword !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }
        await waitForDatabaseReady();
        
        // Re-validate token (in case of tampering or delay)
        const isValid = await energyDB.validatePasswordResetToken(email, token);
        if (!isValid) {
            throw new Error('Token is invalid or expired. Please request a new reset.');
        }
        
        // Hash the new password
        const hashedPassword = await hashPassword(newPassword);
        
        // Update the account password
        await energyDB.updateAccountPassword(email, hashedPassword);
        
        // Delete the used token
        await energyDB.deletePasswordResetToken(email);
        
        Utils.showMessage('Password updated successfully! You can now log in.', 'success');
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    } catch (error) {
        console.error('Password update error:', error);
        Utils.showMessage(error.message || 'Error updating password. Please try again.', 'error');
    } finally {
        updateBtn.textContent = originalText;
        updateBtn.disabled = false;
    }
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'salt'); // Add salt for security
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Make functions globally available
window.logout = logout;
window.openDeleteAccountModal = openDeleteAccountModal;
window.closeDeleteAccountModal = closeDeleteAccountModal;
window.confirmDeleteAccount = confirmDeleteAccount;
window.handleDeleteAccount = handleDeleteAccount;