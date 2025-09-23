/**
 * Team Schema - Team and company organization for collaborative competitive intelligence
 * 
 * This schema manages:
 * 1. Team and company hierarchies
 * 2. Shared competitive context and settings
 * 3. Collaborative learning and knowledge sharing
 * 4. Role-based permissions and access control
 */

const { z } = require('zod');

// Team member roles and permissions
const TeamRole = z.enum([
  'owner',        // Full admin access
  'admin',        // Team management, settings
  'manager',      // View analytics, manage sources
  'member',       // Standard access
  'viewer'        // Read-only access
]);

// Company size categories for context
const CompanySize = z.enum([
  'startup',      // < 50 employees
  'small',        // 50-200 employees  
  'medium',       // 200-1000 employees
  'large',        // 1000-5000 employees
  'enterprise'    // 5000+ employees
]);

// Subscription tiers with feature access
const SubscriptionTier = z.enum([
  'trial',        // 30-day trial
  'individual',   // Single user
  'team',         // Up to 50 users
  'enterprise'    // Unlimited users + compliance
]);

// Team member schema
const TeamMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: TeamRole,
  joined_at: z.date().default(() => new Date()),
  invited_by: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
  last_active: z.date().optional()
});

// Shared competitive context
const CompetitiveContext = z.object({
  // Primary competitive landscape
  primary_competitors: z.array(z.object({
    name: z.string(),
    domain: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    added_by: z.string().uuid(),
    added_at: z.date().default(() => new Date()),
    notes: z.string().max(500).optional()
  })).default([]),
  
  // Secondary competitors and partners
  secondary_competitors: z.array(z.string()).default([]),
  strategic_partners: z.array(z.string()).default([]),
  
  // Company's own products and services
  our_products: z.array(z.object({
    name: z.string(),
    category: z.string().optional(),
    description: z.string().max(200).optional(),
    keywords: z.array(z.string()).default([]),
    owner: z.string().uuid().optional()
  })).default([]),
  
  // Technologies and markets
  technologies: z.array(z.string()).default([]),
  target_markets: z.array(z.string()).default([]),
  geographic_regions: z.array(z.string()).default([])
});

// Team-wide signal preferences
const TeamSignalPreferences = z.object({
  // Default relevance thresholds
  default_thresholds: z.object({
    slack: z.number().min(0).max(1).default(0.7),
    desktop: z.number().min(0).max(1).default(0.5),
    email: z.number().min(0).max(1).default(0.9)
  }),
  
  // Shared source configurations
  approved_sources: z.array(z.string()).default([]),
  blocked_sources: z.array(z.string()).default([]),
  
  // Category priorities for the team
  category_priorities: z.record(z.string(), z.number().min(0).max(1)).default({}),
  
  // Keyword tracking
  tracked_keywords: z.array(z.object({
    keyword: z.string(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    added_by: z.string().uuid(),
    added_at: z.date().default(() => new Date())
  })).default([]),
  
  // Auto-routing rules
  routing_rules: z.array(z.object({
    name: z.string(),
    condition: z.object({
      category: z.string().optional(),
      priority: z.string().optional(),
      keywords: z.array(z.string()).default([]),
      source: z.string().optional()
    }),
    action: z.object({
      channel: z.enum(['slack', 'teams', 'email']),
      destination: z.string(), // Channel ID or email
      notify_roles: z.array(TeamRole).default([])
    }),
    is_active: z.boolean().default(true),
    created_by: z.string().uuid(),
    created_at: z.date().default(() => new Date())
  })).default([])
});

// Team analytics and metrics
const TeamMetrics = z.object({
  // Usage metrics
  total_signals_processed: z.number().default(0),
  total_signals_delivered: z.number().default(0),
  total_user_actions: z.number().default(0),
  
  // Engagement metrics
  active_users_30d: z.number().default(0),
  avg_signals_per_user: z.number().default(0),
  avg_actions_per_signal: z.number().default(0),
  
  // Quality metrics
  overall_feedback_score: z.number().min(0).max(1).default(0.5),
  noise_reduction_rate: z.number().min(0).max(1).default(0),
  
  // ROI metrics
  estimated_time_saved_hours: z.number().default(0),
  critical_signals_caught: z.number().default(0),
  
  // Last updated
  last_calculated: z.date().default(() => new Date())
});

// Main Team schema
const TeamSchema = z.object({
  // Core identification
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/), // URL-friendly identifier
  
  // Organization details
  company_id: z.string().uuid().optional(), // Parent company if part of larger org
  department: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  
  // Members and roles
  members: z.array(TeamMemberSchema).default([]),
  max_members: z.number().default(50), // Based on subscription
  
  // Competitive intelligence context
  competitive_context: CompetitiveContext.default({}),
  signal_preferences: TeamSignalPreferences.default({}),
  
  // Collaboration features
  shared_learning: z.boolean().default(true), // Share feedback across team
  knowledge_base: z.boolean().default(true),  // Maintain team knowledge base
  
  // Subscription and billing
  subscription: z.object({
    tier: SubscriptionTier,
    status: z.enum(['active', 'trial', 'suspended', 'cancelled']).default('trial'),
    trial_ends_at: z.date().optional(),
    billing_email: z.string().email().optional(),
    seats_used: z.number().default(0),
    seats_total: z.number().default(50)
  }),
  
  // Team metrics
  metrics: TeamMetrics.default({}),
  
  // Settings
  settings: z.object({
    // Data retention
    signal_retention_days: z.number().default(90),
    feedback_retention_days: z.number().default(365),
    
    // Privacy and security
    require_sso: z.boolean().default(false),
    allow_external_sharing: z.boolean().default(true),
    data_residency: z.enum(['us', 'eu', 'global']).default('global'),
    
    // Notifications
    admin_notifications: z.boolean().default(true),
    usage_reports: z.boolean().default(true),
    
    // Integrations
    allowed_integrations: z.array(z.string()).default(['slack', 'teams', 'jira', 'notion'])
  }).default({}),
  
  // System metadata
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
  created_by: z.string().uuid()
});

// Company schema for enterprise organizations
const CompanySchema = z.object({
  // Core identification
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  domain: z.string().optional(), // Company domain for SSO
  
  // Organization details
  industry: z.string().max(100).optional(),
  size: CompanySize,
  headquarters: z.string().max(100).optional(),
  website: z.string().url().optional(),
  
  // Teams within company
  teams: z.array(z.string().uuid()).default([]),
  
  // Enterprise settings
  enterprise_settings: z.object({
    // SSO configuration
    sso_provider: z.enum(['okta', 'auth0', 'azure', 'google']).optional(),
    sso_domain: z.string().optional(),
    enforce_sso: z.boolean().default(false),
    
    // Security policies
    require_2fa: z.boolean().default(false),
    session_timeout_minutes: z.number().default(480), // 8 hours
    ip_whitelist: z.array(z.string()).default([]),
    
    // Data governance
    data_retention_policy: z.object({
      signals: z.number().default(365), // days
      feedback: z.number().default(730), // days
      audit_logs: z.number().default(2555) // 7 years
    }),
    
    // Compliance
    compliance_requirements: z.array(z.enum(['soc2', 'gdpr', 'ccpa', 'hipaa'])).default([]),
    audit_logging: z.boolean().default(true),
    
    // Billing
    centralized_billing: z.boolean().default(true),
    cost_center_tracking: z.boolean().default(false)
  }).default({}),
  
  // Subscription
  enterprise_subscription: z.object({
    contract_start: z.date(),
    contract_end: z.date(),
    total_seats: z.number(),
    used_seats: z.number().default(0),
    annual_contract_value: z.number().optional()
  }).optional(),
  
  // System metadata
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date())
});

// Derived schemas
const TeamSummarySchema = TeamSchema.pick({
  id: true,
  name: true,
  slug: true,
  department: true,
  description: true,
  subscription: true,
  created_at: true
});

const TeamCreateSchema = TeamSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  metrics: true
});

const TeamUpdateSchema = TeamCreateSchema.partial();

// Helper functions
class TeamHelpers {
  static generateId() {
    return crypto.randomUUID();
  }
  
  static generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  
  static canUserAccess(team, userId, requiredRole = 'viewer') {
    const member = team.members.find(m => m.user_id === userId);
    if (!member || !member.is_active) return false;
    
    const roleHierarchy = ['viewer', 'member', 'manager', 'admin', 'owner'];
    const userRoleIndex = roleHierarchy.indexOf(member.role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
    
    return userRoleIndex >= requiredRoleIndex;
  }
  
  static addMember(team, userId, role = 'member', invitedBy) {
    // Check if user is already a member
    const existingMember = team.members.find(m => m.user_id === userId);
    if (existingMember) {
      existingMember.role = role;
      existingMember.is_active = true;
      return team;
    }
    
    // Check seat limits
    const activeMembers = team.members.filter(m => m.is_active).length;
    if (activeMembers >= team.max_members) {
      throw new Error('Team has reached maximum member limit');
    }
    
    team.members.push({
      user_id: userId,
      role,
      joined_at: new Date(),
      invited_by: invitedBy,
      is_active: true
    });
    
    team.subscription.seats_used = activeMembers + 1;
    return team;
  }
  
  static removeMember(team, userId) {
    const memberIndex = team.members.findIndex(m => m.user_id === userId);
    if (memberIndex === -1) return team;
    
    // Don't allow removing the last owner
    const owners = team.members.filter(m => m.role === 'owner' && m.is_active);
    if (owners.length === 1 && owners[0].user_id === userId) {
      throw new Error('Cannot remove the last owner from the team');
    }
    
    team.members[memberIndex].is_active = false;
    team.subscription.seats_used = team.members.filter(m => m.is_active).length;
    return team;
  }
  
  static updateCompetitiveContext(team, updates, updatedBy) {
    // Add competitors
    if (updates.add_competitors) {
      updates.add_competitors.forEach(competitor => {
        const exists = team.competitive_context.primary_competitors
          .find(c => c.name.toLowerCase() === competitor.name.toLowerCase());
        
        if (!exists) {
          team.competitive_context.primary_competitors.push({
            ...competitor,
            added_by: updatedBy,
            added_at: new Date()
          });
        }
      });
    }
    
    // Add products
    if (updates.add_products) {
      updates.add_products.forEach(product => {
        const exists = team.competitive_context.our_products
          .find(p => p.name.toLowerCase() === product.name.toLowerCase());
        
        if (!exists) {
          team.competitive_context.our_products.push(product);
        }
      });
    }
    
    // Update other context fields
    ['technologies', 'target_markets', 'geographic_regions'].forEach(field => {
      if (updates[field]) {
        team.competitive_context[field] = [
          ...new Set([...team.competitive_context[field], ...updates[field]])
        ];
      }
    });
    
    return team;
  }
  
  static calculateTeamMetrics(team, signals, feedback, timeframe = 30) {
    const cutoff = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);
    const recentSignals = signals.filter(s => s.created_at >= cutoff);
    const recentFeedback = feedback.filter(f => f.created_at >= cutoff);
    
    const metrics = {
      total_signals_processed: recentSignals.length,
      total_signals_delivered: recentSignals.filter(s => s.delivered_to.length > 0).length,
      total_user_actions: recentFeedback.filter(f => 
        ['action', 'flag', 'create_task', 'share'].includes(f.type)
      ).length,
      
      active_users_30d: new Set(recentFeedback.map(f => f.user_id)).size,
      avg_signals_per_user: 0,
      avg_actions_per_signal: 0,
      
      overall_feedback_score: 0,
      noise_reduction_rate: 0,
      
      estimated_time_saved_hours: recentSignals.length * 0.1, // Rough estimate
      critical_signals_caught: recentSignals.filter(s => s.priority === 'critical').length,
      
      last_calculated: new Date()
    };
    
    if (metrics.active_users_30d > 0) {
      metrics.avg_signals_per_user = metrics.total_signals_delivered / metrics.active_users_30d;
    }
    
    if (metrics.total_signals_delivered > 0) {
      metrics.avg_actions_per_signal = metrics.total_user_actions / metrics.total_signals_delivered;
    }
    
    // Calculate feedback score
    const positiveFeedback = recentFeedback.filter(f => 
      f.type === 'explicit_rating' && f.value === true
    ).length;
    const totalExplicitFeedback = recentFeedback.filter(f => 
      f.type === 'explicit_rating'
    ).length;
    
    if (totalExplicitFeedback > 0) {
      metrics.overall_feedback_score = positiveFeedback / totalExplicitFeedback;
    }
    
    return metrics;
  }
}

module.exports = {
  TeamSchema,
  CompanySchema,
  TeamSummarySchema,
  TeamCreateSchema,
  TeamUpdateSchema,
  TeamMemberSchema,
  CompetitiveContext,
  TeamSignalPreferences,
  TeamMetrics,
  TeamRole,
  CompanySize,
  SubscriptionTier,
  TeamHelpers
};
