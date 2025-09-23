/**
 * Data Layer Entry Point - Exports all models, schemas, and storage utilities
 */

// Core schemas
const {
  SignalSchema,
  SignalSummarySchema,
  SignalCreateSchema,
  SignalUpdateSchema,
  SignalPriority,
  SignalCategory,
  TrustLevel,
  ProcessingStatus,
  EntityMention,
  ImpactAssessment,
  SignalHelpers
} = require('./models/signal.schema');

const {
  UserSchema,
  UserProfileSchema,
  UserPreferencesSchema,
  UserCreateSchema,
  UserUpdateSchema,
  UserRole,
  NotificationPreferences,
  WorkSchedule,
  UserContext,
  LearningProfile,
  IntegrationSettings,
  UserHelpers
} = require('./models/user.schema');

const {
  FeedbackSchema,
  FeedbackCreateSchema,
  FeedbackSummarySchema,
  FeedbackMetricsSchema,
  FeedbackType,
  FeedbackContext,
  FeedbackHelpers
} = require('./models/feedback.schema');

const {
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
} = require('./models/team.schema');

const {
  SourceSchema,
  SourceTemplateSchema,
  SourceSummarySchema,
  SourceCreateSchema,
  SourceUpdateSchema,
  SourceType,
  SourceCategory,
  SourceStatus,
  PollingConfig,
  ExtractionConfig,
  QualityMetrics,
  AuthConfig,
  SourceHelpers,
  CommonSourceTemplates
} = require('./models/source.schema');

// Storage layers
const SupabaseClient = require('./storage/supabase-client');
const SignalRepository = require('./repositories/signal-repository');

module.exports = {
  // Signal models
  SignalSchema,
  SignalSummarySchema,
  SignalCreateSchema,
  SignalUpdateSchema,
  SignalPriority,
  SignalCategory,
  TrustLevel,
  ProcessingStatus,
  EntityMention,
  ImpactAssessment,
  SignalHelpers,
  
  // User models
  UserSchema,
  UserProfileSchema,
  UserPreferencesSchema,
  UserCreateSchema,
  UserUpdateSchema,
  UserRole,
  NotificationPreferences,
  WorkSchedule,
  UserContext,
  LearningProfile,
  IntegrationSettings,
  UserHelpers,
  
  // Feedback models
  FeedbackSchema,
  FeedbackCreateSchema,
  FeedbackSummarySchema,
  FeedbackMetricsSchema,
  FeedbackType,
  FeedbackContext,
  FeedbackHelpers,
  
  // Team models
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
  TeamHelpers,
  
  // Source models
  SourceSchema,
  SourceTemplateSchema,
  SourceSummarySchema,
  SourceCreateSchema,
  SourceUpdateSchema,
  SourceType,
  SourceCategory,
  SourceStatus,
  PollingConfig,
  ExtractionConfig,
  QualityMetrics,
  AuthConfig,
  SourceHelpers,
  CommonSourceTemplates,
  
  // Storage and repositories
  SupabaseClient,
  SignalRepository
};
