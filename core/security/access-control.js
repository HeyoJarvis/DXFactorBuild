/**
 * Role-Based Access Control (RBAC) System
 * 
 * Manages user permissions and data access for workflow intelligence:
 * - CEO: Full access to all users and team analytics
 * - Org Admin: Access to team analytics and user management
 * - Manager: Access to direct reports and team metrics
 * - User: Access only to their own data
 * - Guest: Limited read-only access to own data
 */

const winston = require('winston');

class AccessControlManager {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      defaultRole: 'user',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'access-control' }
    });
    
    // User roles and permissions
    this.userRoles = new Map(); // userId → role
    this.userOrganizations = new Map(); // userId → orgId
    this.organizationHierarchy = new Map(); // orgId → { admins: [], managers: Map(managerId → [reportIds]) }
    this.rolePermissions = this.initializeRolePermissions();
    
    // Session management
    this.activeSessions = new Map(); // sessionId → { userId, role, orgId, permissions, expires }
  }

  /**
   * Initialize role-based permissions
   */
  initializeRolePermissions() {
    return {
      'ceo': {
        // Full system access
        canViewAllUsers: true,
        canViewAllTeams: true,
        canViewAllChannels: true,
        canViewTeamAnalytics: true,
        canManageUsers: true,
        canManageOrganization: true,
        canViewSystemMetrics: true,
        canExportAllData: true,
        canManageIntegrations: true,
        canViewFinancialMetrics: true,
        dataScope: 'global'
      },
      
      'org_admin': {
        // Organization-wide access
        canViewAllUsers: true,
        canViewAllTeams: true,
        canViewAllChannels: true,
        canViewTeamAnalytics: true,
        canManageUsers: true,
        canManageOrganization: false,
        canViewSystemMetrics: false,
        canExportAllData: true,
        canManageIntegrations: true,
        canViewFinancialMetrics: false,
        dataScope: 'organization'
      },
      
      'manager': {
        // Team and direct reports access
        canViewAllUsers: false,
        canViewAllTeams: false,
        canViewAllChannels: false,
        canViewTeamAnalytics: true,
        canManageUsers: false,
        canManageOrganization: false,
        canViewSystemMetrics: false,
        canExportAllData: false,
        canManageIntegrations: false,
        canViewFinancialMetrics: false,
        dataScope: 'team'
      },
      
      'user': {
        // Personal data access only
        canViewAllUsers: false,
        canViewAllTeams: false,
        canViewAllChannels: false,
        canViewTeamAnalytics: false,
        canManageUsers: false,
        canManageOrganization: false,
        canViewSystemMetrics: false,
        canExportAllData: false,
        canManageIntegrations: false,
        canViewFinancialMetrics: false,
        dataScope: 'personal'
      },
      
      'guest': {
        // Very limited read-only access
        canViewAllUsers: false,
        canViewAllTeams: false,
        canViewAllChannels: false,
        canViewTeamAnalytics: false,
        canManageUsers: false,
        canManageOrganization: false,
        canViewSystemMetrics: false,
        canExportAllData: false,
        canManageIntegrations: false,
        canViewFinancialMetrics: false,
        dataScope: 'personal_readonly'
      }
    };
  }

  /**
   * Set user role and organization
   */
  setUserRole(userId, role, organizationId = null) {
    if (!this.rolePermissions[role]) {
      throw new Error(`Invalid role: ${role}`);
    }
    
    this.userRoles.set(userId, role);
    
    if (organizationId) {
      this.userOrganizations.set(userId, organizationId);
    }
    
    this.logger.info('User role updated', {
      user_id: userId,
      role,
      organization_id: organizationId
    });
  }

  /**
   * Set organization hierarchy (managers and their reports)
   */
  setOrganizationHierarchy(organizationId, hierarchy) {
    this.organizationHierarchy.set(organizationId, {
      admins: hierarchy.admins || [],
      ceo: hierarchy.ceo || null,
      managers: new Map(Object.entries(hierarchy.managers || {}))
    });
    
    this.logger.info('Organization hierarchy updated', {
      organization_id: organizationId,
      admin_count: hierarchy.admins?.length || 0,
      manager_count: Object.keys(hierarchy.managers || {}).length
    });
  }

  /**
   * Create authenticated session
   */
  createSession(userId, additionalContext = {}) {
    const sessionId = this.generateSessionId();
    const role = this.userRoles.get(userId) || this.options.defaultRole;
    const organizationId = this.userOrganizations.get(userId);
    const permissions = this.rolePermissions[role];
    
    const session = {
      sessionId,
      userId,
      role,
      organizationId,
      permissions,
      context: additionalContext,
      createdAt: new Date(),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      lastActivity: new Date()
    };
    
    this.activeSessions.set(sessionId, session);
    
    this.logger.info('Session created', {
      session_id: sessionId,
      user_id: userId,
      role,
      organization_id: organizationId
    });
    
    return session;
  }

  /**
   * Validate session and refresh activity
   */
  validateSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (new Date() > session.expires) {
      this.activeSessions.delete(sessionId);
      throw new Error('Session expired');
    }
    
    // Update last activity
    session.lastActivity = new Date();
    
    return session;
  }

  /**
   * Check if user can access another user's data
   */
  canAccessUserData(requestingUserId, targetUserId, sessionId = null) {
    let session;
    
    if (sessionId) {
      session = this.validateSession(sessionId);
      if (session.userId !== requestingUserId) {
        return false;
      }
    } else {
      // Create temporary session for validation
      session = {
        userId: requestingUserId,
        role: this.userRoles.get(requestingUserId) || this.options.defaultRole,
        organizationId: this.userOrganizations.get(requestingUserId),
        permissions: this.rolePermissions[this.userRoles.get(requestingUserId) || this.options.defaultRole]
      };
    }
    
    // Self-access is always allowed
    if (requestingUserId === targetUserId) {
      return true;
    }
    
    // CEO can access all users
    if (session.role === 'ceo') {
      return true;
    }
    
    // Org admin can access users in same organization
    if (session.role === 'org_admin') {
      const requestingUserOrg = session.organizationId;
      const targetUserOrg = this.userOrganizations.get(targetUserId);
      return requestingUserOrg && requestingUserOrg === targetUserOrg;
    }
    
    // Manager can access direct reports
    if (session.role === 'manager') {
      const orgHierarchy = this.organizationHierarchy.get(session.organizationId);
      if (orgHierarchy && orgHierarchy.managers.has(requestingUserId)) {
        const directReports = orgHierarchy.managers.get(requestingUserId);
        return directReports.includes(targetUserId);
      }
    }
    
    // Regular users and guests cannot access other users' data
    return false;
  }

  /**
   * Check if user can access team analytics
   */
  canAccessTeamAnalytics(userId, sessionId = null) {
    const session = sessionId ? this.validateSession(sessionId) : {
      permissions: this.rolePermissions[this.userRoles.get(userId) || this.options.defaultRole]
    };
    
    return session.permissions.canViewTeamAnalytics;
  }

  /**
   * Check if user can access channel data
   */
  canAccessChannelData(userId, channelId, sessionId = null) {
    const session = sessionId ? this.validateSession(sessionId) : {
      role: this.userRoles.get(userId) || this.options.defaultRole,
      permissions: this.rolePermissions[this.userRoles.get(userId) || this.options.defaultRole]
    };
    
    // CEO and org admin can access all channels
    if (session.permissions.canViewAllChannels) {
      return true;
    }
    
    // For other roles, they can only access channels they're part of
    // This would need to be integrated with your channel membership system
    return this.isUserInChannel(userId, channelId);
  }

  /**
   * Get accessible user list for a requesting user
   */
  getAccessibleUsers(requestingUserId, sessionId = null) {
    const session = sessionId ? this.validateSession(sessionId) : {
      userId: requestingUserId,
      role: this.userRoles.get(requestingUserId) || this.options.defaultRole,
      organizationId: this.userOrganizations.get(requestingUserId),
      permissions: this.rolePermissions[this.userRoles.get(requestingUserId) || this.options.defaultRole]
    };
    
    const accessibleUsers = new Set([requestingUserId]); // Always include self
    
    if (session.permissions.canViewAllUsers) {
      // CEO can see all users, org admin can see org users
      if (session.role === 'ceo') {
        // Return all users in system
        this.userRoles.forEach((role, userId) => {
          accessibleUsers.add(userId);
        });
      } else if (session.role === 'org_admin') {
        // Return users in same organization
        this.userOrganizations.forEach((orgId, userId) => {
          if (orgId === session.organizationId) {
            accessibleUsers.add(userId);
          }
        });
      }
    } else if (session.role === 'manager') {
      // Add direct reports
      const orgHierarchy = this.organizationHierarchy.get(session.organizationId);
      if (orgHierarchy && orgHierarchy.managers.has(requestingUserId)) {
        const directReports = orgHierarchy.managers.get(requestingUserId);
        directReports.forEach(reportId => accessibleUsers.add(reportId));
      }
    }
    
    return Array.from(accessibleUsers);
  }

  /**
   * Filter analytics data based on user permissions
   */
  filterAnalyticsData(requestingUserId, analyticsData, sessionId = null) {
    const session = sessionId ? this.validateSession(sessionId) : {
      role: this.userRoles.get(requestingUserId) || this.options.defaultRole,
      permissions: this.rolePermissions[this.userRoles.get(requestingUserId) || this.options.defaultRole]
    };
    
    // CEO and org admin get full data
    if (session.permissions.dataScope === 'global' || session.permissions.dataScope === 'organization') {
      return analyticsData;
    }
    
    // Manager gets filtered team data
    if (session.permissions.dataScope === 'team') {
      return this.filterTeamAnalytics(requestingUserId, analyticsData);
    }
    
    // Regular users get only their personal data
    if (session.permissions.dataScope === 'personal' || session.permissions.dataScope === 'personal_readonly') {
      return this.filterPersonalAnalytics(requestingUserId, analyticsData);
    }
    
    return null;
  }

  /**
   * Filter team analytics for managers
   */
  filterTeamAnalytics(managerId, analyticsData) {
    const accessibleUsers = this.getAccessibleUsers(managerId);
    
    // Filter user-specific data
    if (analyticsData.user_breakdown) {
      analyticsData.user_breakdown = Object.fromEntries(
        Object.entries(analyticsData.user_breakdown)
          .filter(([userId]) => accessibleUsers.includes(userId))
      );
    }
    
    // Keep team-level aggregates but remove sensitive details
    if (analyticsData.individual_insights) {
      delete analyticsData.individual_insights;
    }
    
    return analyticsData;
  }

  /**
   * Filter analytics to personal data only
   */
  filterPersonalAnalytics(userId, analyticsData) {
    return {
      user_id: userId,
      personal_analytics: analyticsData[userId] || {},
      // Remove all team/organization level data
      message: 'Personal analytics only - upgrade permissions for team insights'
    };
  }

  /**
   * Check if user is in channel (placeholder - integrate with your channel system)
   */
  isUserInChannel(userId, channelId) {
    // This should integrate with your actual channel membership system
    // For now, return true as placeholder
    return true;
  }

  /**
   * Generate secure session ID
   */
  generateSessionId() {
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.activeSessions) {
      if (now > session.expires) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.info('Cleaned up expired sessions', { count: cleanedCount });
    }
  }

  /**
   * Get user's current permissions
   */
  getUserPermissions(userId) {
    const role = this.userRoles.get(userId) || this.options.defaultRole;
    return {
      role,
      permissions: this.rolePermissions[role],
      organization_id: this.userOrganizations.get(userId)
    };
  }

  /**
   * Audit log for access attempts
   */
  logAccessAttempt(requestingUserId, action, targetResource, allowed, sessionId = null) {
    this.logger.info('Access attempt', {
      requesting_user: requestingUserId,
      action,
      target_resource: targetResource,
      allowed,
      session_id: sessionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Initialize demo organization for testing
   */
  initializeDemoOrganization() {
    // Set up CEO
    this.setUserRole('ceo_user_001', 'ceo', 'org_demo_001');
    
    // Set up org admin
    this.setUserRole('admin_user_002', 'org_admin', 'org_demo_001');
    
    // Set up managers and their reports
    this.setUserRole('manager_alice_123', 'manager', 'org_demo_001');
    this.setUserRole('manager_bob_456', 'manager', 'org_demo_001');
    
    // Set up regular users
    this.setUserRole('user_charlie_789', 'user', 'org_demo_001');
    this.setUserRole('user_diana_012', 'user', 'org_demo_001');
    this.setUserRole('user_eve_345', 'user', 'org_demo_001');
    this.setUserRole('user_frank_678', 'user', 'org_demo_001');
    
    // Set up organization hierarchy
    this.setOrganizationHierarchy('org_demo_001', {
      ceo: 'ceo_user_001',
      admins: ['admin_user_002'],
      managers: {
        'manager_alice_123': ['user_charlie_789', 'user_diana_012'],
        'manager_bob_456': ['user_eve_345', 'user_frank_678']
      }
    });
    
    this.logger.info('Demo organization initialized', {
      organization_id: 'org_demo_001',
      total_users: 7
    });
  }
}

module.exports = AccessControlManager;
