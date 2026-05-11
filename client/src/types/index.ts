// Re-export all types from shared package
export type {
  User, AuthUser, Family, FamilyMember, FamilyDetail, FamilyRole,
  LeaveFamilyStatus, LeaveFamilyResult,
  Baby, Gender,
  CareRecord as Record, RecordType, FeedingData, FeedingType, BreastSide,
  SleepData, SleepType, DiaperData, DiaperType, Consistency, DiaperColor,
  TemperatureData, TempMethod, GrowthData,
  VaccineRecord, MilestoneRecord,
  LoginRequest, RegisterRequest, AuthResponse, RefreshResponse,
  ApiResponse, PaginatedResponse, RecordQueryParams, TodayStats,
  TrendType, TrendDataPoint, TrendData,
  // FR-B：本周趋势增强
  WeeklyTrendStatus, WeeklyTrendDimension, WeeklyTrendData, ReferenceRange,
  // FR-F：AI
  ChatMessage, AIChatRequest, AIChatResponse, DailyInsight,
  AIQuotaStatus, ChatStreamEvent,
  // FR-F 扩展：按角色差异化
  CareRole,
  // v7.2+ 用户个性化偏好
  UserPreferences,
} from '@baby-care-tracker/shared'

export { Permission } from '@baby-care-tracker/shared'

// Also export CareRecord directly for compatibility
export type { CareRecord } from '@baby-care-tracker/shared'