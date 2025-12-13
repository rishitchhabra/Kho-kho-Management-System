// Authentication module for Kho Kho Premier League Admin
// Supports multiple users with granular role-based permissions stored in Supabase

// Session management
const AUTH_KEY = "khoKhoAdmin_auth";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Permission definitions - granular like ERP systems
const PERMISSION_SCHEMA = {
    teams: {
        label: "👥 Teams",
        actions: {
            view: "View Teams",
            add: "Add Team",
            edit: "Edit Team",
            delete: "Delete Team"
        }
    },
    pools: {
        label: "🏊 Pools",
        actions: {
            view: "View Pools",
            add: "Create Pool",
            edit: "Edit Pool",
            delete: "Delete Pool",
            fixMatch: "Fix Matches"
        }
    },
    matches: {
        label: "⚔️ Matches",
        actions: {
            view: "View Matches",
            reorder: "Reorder Matches",
            complete: "Complete Match",
            edit: "Edit Match",
            delete: "Delete Match"
        }
    },
    users: {
        label: "👤 Users",
        actions: {
            view: "View Users",
            add: "Add User",
            edit: "Edit User",
            delete: "Delete User",
            toggleStatus: "Enable/Disable User",
            viewLogs: "View Login History",
            viewActivity: "View Activity Log"
        }
    }
};

// Default permissions by role
const ROLE_DEFAULTS = {
    admin: {
        teams: { view: true, add: true, edit: true, delete: true },
        pools: { view: true, add: true, edit: true, delete: true, fixMatch: true },
        matches: { view: true, reorder: true, complete: true, edit: true, delete: true },
        users: { view: true, add: true, edit: true, delete: true, toggleStatus: true, viewLogs: true, viewActivity: true }
    },
    editor: {
        teams: { view: true, add: true, edit: true, delete: false },
        pools: { view: true, add: true, edit: true, delete: false, fixMatch: true },
        matches: { view: true, reorder: true, complete: true, edit: true, delete: false },
        users: { view: false, add: false, edit: false, delete: false, toggleStatus: false, viewLogs: false, viewActivity: false }
    },
    viewer: {
        teams: { view: true, add: false, edit: false, delete: false },
        pools: { view: true, add: false, edit: false, delete: false, fixMatch: false },
        matches: { view: true, reorder: false, complete: false, edit: false, delete: false },
        users: { view: false, add: false, edit: false, delete: false, toggleStatus: false, viewLogs: false, viewActivity: false }
    }
};

// Default admin credentials (fallback if Supabase is not available)
const DEFAULT_ADMIN = {
    username: "admin",
    password: "khokho2024",
    display_name: "Administrator",
    role: "admin",
    permissions: ROLE_DEFAULTS.admin
};

/**
 * Get the permission schema for UI rendering
 */
function getPermissionSchema() {
    return PERMISSION_SCHEMA;
}

/**
 * Get default permissions for a role
 */
function getDefaultPermissions(role) {
    return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.viewer;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    const session = localStorage.getItem(AUTH_KEY);
    if (!session) return false;

    try {
        const data = JSON.parse(session);
        const now = Date.now();
        
        // Check if session is expired
        if (now > data.expiresAt) {
            localStorage.removeItem(AUTH_KEY);
            return false;
        }
        
        return data.authenticated === true;
    } catch (e) {
        localStorage.removeItem(AUTH_KEY);
        return false;
    }
}

/**
 * Login with username and password (checks Supabase first, then fallback)
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function login(username, password) {
    try {
        // Try to authenticate against Supabase first
        if (typeof supabase !== 'undefined') {
            const { data: user, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .eq('is_active', true)
                .single();

            if (user && !error) {
                const session = {
                    authenticated: true,
                    userId: user.id,
                    username: user.username,
                    displayName: user.display_name || user.username,
                    role: user.role,
                    permissions: user.permissions || getDefaultPermissions(user.role),
                    loginAt: Date.now(),
                    expiresAt: Date.now() + SESSION_DURATION
                };
                localStorage.setItem(AUTH_KEY, JSON.stringify(session));
                // Log the login (await to ensure it completes before redirect)
                await logLogin(user.id, user.username, true);
                return { success: true };
            }
        }
    } catch (e) {
        console.log("Supabase auth failed, trying fallback:", e.message);
    }

    // Fallback to default admin credentials
    if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
        const session = {
            authenticated: true,
            userId: 0,
            username: DEFAULT_ADMIN.username,
            displayName: DEFAULT_ADMIN.display_name,
            role: DEFAULT_ADMIN.role,
            permissions: DEFAULT_ADMIN.permissions,
            loginAt: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        // Log the login for fallback admin (null for user_id since 0 may violate FK)
        await logLogin(null, DEFAULT_ADMIN.username, true);
        return { success: true };
    }

    // Log failed login attempt
    await logLogin(null, username, false);
    return { success: false, error: "Invalid username or password" };
}

/**
 * Logout and clear session
 * @param {string} reason - Optional reason for logout ('manual', 'timeout', 'session_expired')
 */
function logout(reason = 'manual') {
    const session = getSession();
    if (session) {
        logLogout(session.userId, session.username, reason);
    }
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('khoKhoAdmin_lastActivity');
    window.location.href = "login.html";
}

// ==================== AUTO-LOGOUT ====================
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
let inactivityTimer = null;

/**
 * Reset the inactivity timer
 */
function resetInactivityTimer() {
    localStorage.setItem('khoKhoAdmin_lastActivity', Date.now().toString());
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    inactivityTimer = setTimeout(() => {
        if (isAuthenticated()) {
            showAutoLogoutWarning();
        }
    }, INACTIVITY_TIMEOUT - 60000); // Show warning 1 minute before logout
}

/**
 * Show auto-logout warning
 */
function showAutoLogoutWarning() {
    // Check if we're on a protected page
    if (!isAuthenticated()) return;
    
    const existingWarning = document.getElementById('autoLogoutWarning');
    if (existingWarning) return;
    
    const warning = document.createElement('div');
    warning.id = 'autoLogoutWarning';
    warning.className = 'auto-logout-warning';
    warning.innerHTML = `
        <div class="auto-logout-content">
            <div class="auto-logout-icon">⚠️</div>
            <h3>Session Expiring</h3>
            <p>You will be logged out in <span id="logoutCountdown">60</span> seconds due to inactivity.</p>
            <button id="stayLoggedIn" class="btn-primary">Stay Logged In</button>
        </div>
    `;
    document.body.appendChild(warning);
    
    let countdown = 60;
    const countdownEl = document.getElementById('logoutCountdown');
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            logout('timeout');
        }
    }, 1000);
    
    document.getElementById('stayLoggedIn')?.addEventListener('click', () => {
        clearInterval(countdownInterval);
        warning.remove();
        resetInactivityTimer();
        logActivity('session', 'extend', null, 'Extended session after inactivity warning');
    });
}

/**
 * Initialize auto-logout monitoring
 */
function initAutoLogout() {
    if (!isAuthenticated()) return;
    
    // Reset timer on user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
    
    // Check if session expired while page was idle
    const lastActivity = localStorage.getItem('khoKhoAdmin_lastActivity');
    if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity);
        if (elapsed > INACTIVITY_TIMEOUT) {
            logout('timeout');
            return;
        }
    }
    
    // Start the timer
    resetInactivityTimer();
}

/**
 * Protect a page - redirect to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

/**
 * Get current session info
 * @returns {Object|null}
 */
function getSession() {
    const session = localStorage.getItem(AUTH_KEY);
    if (!session) return null;
    
    try {
        return JSON.parse(session);
    } catch (e) {
        return null;
    }
}

/**
 * Check if current user has a specific permission
 * @param {string} module - 'teams', 'pools', 'matches', 'users'
 * @param {string} action - 'view', 'add', 'edit', 'delete', etc.
 * @returns {boolean}
 */
function hasPermission(module, action) {
    const session = getSession();
    if (!session) return false;
    
    // Admins have all permissions
    if (session.role === 'admin') return true;
    
    const permissions = session.permissions;
    if (!permissions) return false;
    
    // Check specific module and action
    if (permissions[module] && permissions[module][action] === true) {
        return true;
    }
    
    return false;
}

/**
 * Check if current user can view a module (for tab visibility)
 * @param {string} module
 * @returns {boolean}
 */
function canView(module) {
    return hasPermission(module, 'view');
}

/**
 * Check if current user is an admin
 * @returns {boolean}
 */
function isAdmin() {
    const session = getSession();
    return session && session.role === 'admin';
}

/**
 * Get current user's display name
 * @returns {string}
 */
function getCurrentUserName() {
    const session = getSession();
    return session ? (session.displayName || session.username) : 'Guest';
}

/**
 * Get current user's role
 * @returns {string}
 */
function getCurrentUserRole() {
    const session = getSession();
    return session ? session.role : 'viewer';
}

// ==================== USER MANAGEMENT (Admin Only) ====================

/**
 * Get all users from Supabase
 * @returns {Promise<Array>}
 */
async function getAllUsers() {
    if (typeof supabase === 'undefined') return [];
    
    const { data, error } = await supabase
        .from('admin_users')
        .select('id, username, display_name, role, permissions, is_active, created_at')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching users:", error);
        return [];
    }
    return data || [];
}

/**
 * Create a new user
 * @param {Object} userData - {username, password, display_name, role, permissions}
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function createUser(userData) {
    if (!hasPermission('users', 'add')) {
        return { success: false, error: "You don't have permission to add users" };
    }
    
    if (typeof supabase === 'undefined') {
        return { success: false, error: "Database not available" };
    }

    // Merge with default permissions for the role
    const defaultPerms = getDefaultPermissions(userData.role);
    const mergedPermissions = userData.permissions || defaultPerms;

    const { data, error } = await supabase
        .from('admin_users')
        .insert([{
            username: userData.username,
            password: userData.password,
            display_name: userData.display_name || userData.username,
            role: userData.role || 'editor',
            permissions: mergedPermissions,
            is_active: true
        }])
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: "Username already exists" };
        }
        return { success: false, error: error.message };
    }
    
    return { success: true, user: data };
}

/**
 * Update a user
 * @param {number} userId
 * @param {Object} updates
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateUser(userId, updates) {
    if (!hasPermission('users', 'edit')) {
        return { success: false, error: "You don't have permission to edit users" };
    }
    
    if (typeof supabase === 'undefined') {
        return { success: false, error: "Database not available" };
    }

    // Don't allow updating the main admin's role
    if (userId === 1 && updates.role && updates.role !== 'admin') {
        return { success: false, error: "Cannot change the main admin's role" };
    }

    const updateData = { ...updates, updated_at: new Date().toISOString() };
    
    const { error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('id', userId);

    if (error) {
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

/**
 * Delete a user
 * @param {number} userId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteUser(userId) {
    if (!hasPermission('users', 'delete')) {
        return { success: false, error: "You don't have permission to delete users" };
    }
    
    if (typeof supabase === 'undefined') {
        return { success: false, error: "Database not available" };
    }

    // Don't allow deleting the main admin
    if (userId === 1) {
        return { success: false, error: "Cannot delete the main admin" };
    }

    const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', userId);

    if (error) {
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

/**
 * Toggle user active status
 * @param {number} userId
 * @param {boolean} isActive
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function toggleUserStatus(userId, isActive) {
    if (!hasPermission('users', 'toggleStatus')) {
        return { success: false, error: "You don't have permission to enable/disable users" };
    }
    
    if (typeof supabase === 'undefined') {
        return { success: false, error: "Database not available" };
    }

    // Don't allow disabling the main admin
    if (userId === 1 && !isActive) {
        return { success: false, error: "Cannot disable the main admin" };
    }

    const { error } = await supabase
        .from('admin_users')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (error) {
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

// ==================== LOGIN & ACTIVITY LOGGING ====================

/**
 * Log a login attempt
 * @param {number|null} userId - User ID (null for failed attempts)
 * @param {string} username - Username attempted
 * @param {boolean} success - Whether login was successful
 */
async function logLogin(userId, username, success) {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.log("Supabase not available for login logging");
        return;
    }
    
    try {
        // Get IP address (don't block on this)
        let ipAddress = 'unknown';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ipAddress = data.ip;
        } catch (e) {
            // IP fetch failed, continue with 'unknown'
        }
        
        const { data, error } = await supabase.from('login_logs').insert([{
            user_id: userId || null,
            username: username,
            action: 'login',
            success: success,
            ip_address: ipAddress,
            user_agent: navigator.userAgent
        }]).select();
        
        if (error) {
            console.error("Login log insert error:", error.message, error.details, error.hint);
        } else {
            console.log("Login logged successfully:", data);
        }
    } catch (e) {
        console.error("Failed to log login:", e.message);
    }
}

/**
 * Log a logout event
 * @param {number} userId
 * @param {string} username
 * @param {string} reason - 'manual', 'timeout', 'session_expired'
 */
async function logLogout(userId, username, reason) {
    if (typeof supabase === 'undefined') return;
    
    try {
        // Get IP address
        let ipAddress = 'unknown';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ipAddress = data.ip;
        } catch (e) {}
        
        const { error } = await supabase.from('login_logs').insert([{
            user_id: userId || null,
            username: username,
            action: 'logout',
            success: true,
            ip_address: ipAddress,
            user_agent: navigator.userAgent
        }]);
        
        if (error) {
            console.error("Logout log error:", error.message);
        }
    } catch (e) {
        console.log("Failed to log logout:", e.message);
    }
}

/**
 * Log user activity
 * @param {string} module - 'teams', 'pools', 'matches', 'users'
 * @param {string} action - 'create', 'update', 'delete', 'view', etc.
 * @param {number|string|null} entityId - ID of the affected entity
 * @param {string} description - Human-readable description
 * @param {Object} details - Additional details (optional)
 */
async function logActivity(module, action, entityId, description, details = null) {
    if (typeof supabase === 'undefined') return;
    
    const session = getSession();
    if (!session) return;
    
    try {
        await supabase.from('activity_logs').insert([{
            user_id: session.userId,
            username: session.username,
            module: module,
            action: action,
            entity_id: entityId ? String(entityId) : null,
            description: description,
            details: details,
            timestamp: new Date().toISOString()
        }]);
    } catch (e) {
        console.log("Failed to log activity:", e.message);
    }
}

/**
 * Get client IP address (approximate)
 */
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (e) {
        return 'unknown';
    }
}

/**
 * Get login logs (requires viewLogs permission)
 * Note: Login events are RECORDED for all users, but viewing requires permission
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function getLoginLogs(limit = 100) {
    // Recording happens for all users, but viewing requires permission
    if (!hasPermission('users', 'viewLogs')) {
        return { success: false, error: "Permission denied. Contact admin for access.", data: [] };
    }
    if (typeof supabase === 'undefined') {
        return { success: false, error: "Database not available", data: [] };
    }
    
    const { data, error } = await supabase
        .from('login_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error("Error fetching login logs:", error);
        return { success: false, error: error.message, data: [] };
    }
    return { success: true, data: data || [] };
}

/**
 * Get activity logs (requires viewActivity permission)
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function getActivityLogs(limit = 100) {
    if (!hasPermission('users', 'viewActivity')) {
        return { success: false, error: "Permission denied. Contact admin for access.", data: [] };
    }
    if (typeof supabase === 'undefined') {
        return { success: false, error: "Database not available", data: [] };
    }
    
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error("Error fetching activity logs:", error);
        return { success: false, error: error.message, data: [] };
    }
    return { success: true, data: data || [] };
}

// ==================== LOGIN FORM HANDLER ====================
// Only runs on login page
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginError = document.getElementById("loginError");

    if (loginForm) {
        // If already logged in, redirect to admin
        if (isAuthenticated()) {
            window.location.href = "admin.html";
            return;
        }

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Logging in...";
            submitBtn.disabled = true;
            
            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value;

            const result = await login(username, password);
            
            if (result.success) {
                window.location.href = "admin.html";
            } else {
                loginError.textContent = result.error || "Invalid username or password";
                loginError.classList.add("show");
                document.getElementById("password").value = "";
                document.getElementById("password").focus();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });

        // Hide error when typing
        document.getElementById("username")?.addEventListener("input", () => {
            loginError.classList.remove("show");
        });
        document.getElementById("password")?.addEventListener("input", () => {
            loginError.classList.remove("show");
        });
    }
});
