// Re-export shared types
export type {
  User,
  AuthUser,
  UserPreferences,
  Family,
  FamilyMember,
  FamilyDetail,
  LeaveFamilyStatus,
  LeaveFamilyResult,
  Baby,
  CareRecord,
  FeedingData,
  SleepData,
  DiaperData,
  TemperatureData,
  GrowthData,
  VaccineRecord,
  MilestoneRecord,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshResponse,
  ApiResponse,
  PaginatedResponse,
  RecordQueryParams,
  TodayStats,
  TrendDataPoint,
  TrendData,
  WeeklyTrendData,
  WeeklyTrendDimension,
  WeeklyTrendStatus,
  ReferenceRange,
  ChatMessage,
  AIChatRequest,
  AIChatResponse,
  DailyInsight,
  AIQuotaStatus,
  ChatStreamEvent,
  CareRole,
} from '@shared/types/index';

export {
  Permission,
} from '@shared/types/index';

export type {
  FamilyRole,
  Gender,
  RecordType,
  FeedingType,
  BreastSide,
  SleepType,
  DiaperType,
  Consistency,
  DiaperColor,
  TempMethod,
  TrendType,
} from '@shared/types/index';

// ============ Extended Request Types ============

export interface AuthenticatedRequest {
  userId: string;
}

// ============ Service Layer Types ============

export interface CreateRecordInput {
  babyId: string;
  familyId: string;
  recordType: string;
  startTime: Date;
  endTime?: Date | null;
  note?: string | null;
  createdBy: string;
  feedingData?: {
    feedingType: string;
    amount?: number | null;
    duration?: number | null;
    breastSide?: string | null;
  };
  sleepData?: {
    sleepType: string;
    duration: number;
    location?: string | null;
  };
  diaperData?: {
    diaperType: string;
    consistency?: string | null;
    color?: string | null;
  };
  temperatureData?: {
    temperature: number;
    method?: string | null;
  };
  growthData?: {
    height?: number | null;
    weight?: number | null;
    headCircumference?: number | null;
  };
}

export interface CreateFamilyInput {
  name: string;
  nickname: string;
  relation?: string;
  relationText?: string;
}

export interface JoinFamilyInput {
  inviteCode: string;
  nickname: string;
  relation?: string;
  relationText?: string;
}
