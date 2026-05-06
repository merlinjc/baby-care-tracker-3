// Baby Care Tracker - Shared Types

// ============ User Types ============
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  nickname: string;
  avatar: string | null;
  familyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {
  familyRole?: FamilyRole;
}

// ============ Family Types ============
export type FamilyRole = 'admin' | 'editor' | 'viewer';

export interface Family {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  inviteCodeExpiry: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  relation: string | null;
  /** 用户在该家庭中的展示昵称（创建/加入家庭时入参 nickname 会落库到此字段） */
  displayName: string | null;
  joinedAt: string;
  user?: Pick<User, 'id' | 'nickname' | 'avatar'>;
}

export interface FamilyDetail extends Family {
  members: FamilyMember[];
  babies: Baby[];
}

// ============ Family LeaveFamily ============
export type LeaveFamilyStatus =
  | 'ok'
  | 'dissolved'
  | 'need_transfer'
  | 'family_not_found'
  | 'not_member';

export interface LeaveFamilyResult {
  status: LeaveFamilyStatus;
  message: string;
  otherMembers?: Array<Pick<User, 'id' | 'nickname' | 'avatar'>>;
}

// ============ Baby Types ============
export type Gender = 'male' | 'female';

export interface Baby {
  id: string;
  familyId: string;
  name: string;
  gender: Gender;
  birthDate: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============ Record Types ============
export type RecordType = 'feeding' | 'sleep' | 'diaper' | 'temperature' | 'growth';

export interface CareRecord {
  id: string;
  babyId: string;
  familyId: string;
  recordType: RecordType;
  startTime: string;
  endTime: string | null;
  note: string | null;
  createdBy: string;
  creator?: Pick<User, 'id' | 'nickname' | 'avatar'>;
  createdAt: string;
  updatedAt: string;
  feedingData?: FeedingData;
  sleepData?: SleepData;
  diaperData?: DiaperData;
  temperatureData?: TemperatureData;
  growthData?: GrowthData;
}

// ============ Feeding Data ============
export type FeedingType = 'breast' | 'formula' | 'solid';
export type BreastSide = 'left' | 'right' | 'both';

export interface FeedingData {
  feedingType: FeedingType;
  amount: number | null;
  duration: number | null;
  breastSide: BreastSide | null;
}

// ============ Sleep Data ============
export type SleepType = 'night' | 'nap';

export interface SleepData {
  sleepType: SleepType;
  duration: number;
  location: string | null;
}

// ============ Diaper Data ============
export type DiaperType = 'pee' | 'poop' | 'both';
export type Consistency = 'watery' | 'soft' | 'formed' | 'hard';
export type DiaperColor = 'normal' | 'yellow' | 'green' | 'black' | 'red';

export interface DiaperData {
  diaperType: DiaperType;
  consistency: Consistency | null;
  color: DiaperColor | null;
}

// ============ Temperature Data ============
export type TempMethod = 'oral' | 'axillary' | 'rectal' | 'ear';

export interface TemperatureData {
  temperature: number;
  method: TempMethod | null;
}

// ============ Growth Data ============
export interface GrowthData {
  height: number | null;
  weight: number | null;
  headCircumference: number | null;
}

// ============ Vaccine Types ============
export interface VaccineRecord {
  id: string;
  babyId: string;
  familyId: string;
  name: string;
  dose: string;
  vaccinatedDate: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

// ============ Milestone Types ============
export interface MilestoneRecord {
  id: string;
  babyId: string;
  familyId: string;
  name: string;
  category: string;
  achievedDate: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

// ============ Auth Types ============
export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterRequest {
  email?: string;
  phone?: string;
  password: string;
  nickname: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

// ============ API Response Types ============
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============ Record Query Types ============
export interface RecordQueryParams {
  babyId: string;
  recordType?: RecordType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TodayStats {
  feeding: {
    count: number;
    totalAmount: number;
    lastTime: string | null;
    lastTimeTs: number | null;
  };
  sleep: {
    count: number;
    totalDuration: number;
    lastTime: string | null;
    lastTimeTs: number | null;
    lastEndTime: string | null;
    lastEndTimeTs: number | null;
  };
  diaper: {
    count: number;
    peeCount: number;
    poopCount: number;
    lastTime: string | null;
    lastTimeTs: number | null;
  };
  temperature: {
    count: number;
    /** 最新一次体温值，原字段 lastValue 已重命名为 latestValue（v4.4 breaking） */
    latestValue: number | null;
    lastTime: string | null;
    lastTimeTs: number | null;
  };
}

// ============ Trend Types ============
export type TrendType = 'weight' | 'height' | 'headCircumference';

export interface TrendDataPoint {
  date: string;
  value: number;
  whoP3?: number;
  whoP15?: number;
  whoP50?: number;
  whoP85?: number;
  whoP97?: number;
}

export interface TrendData {
  type: TrendType;
  points: TrendDataPoint[];
}

// ============ Weekly Trend Insight (FR-B) ============
export type WeeklyTrendStatus =
  | 'normal'
  | 'low'
  | 'high'
  | 'very_low'
  | 'very_high'
  | 'attention'
  | 'medical_attention'
  | 'no_data';

export interface ReferenceRange {
  min: number;
  max: number;
  unit: string;
}

export interface WeeklyTrendDimension {
  thisWeekAvg: number;
  lastWeekAvg: number;
  range: ReferenceRange | null;
  status: WeeklyTrendStatus;
  tip: string;
  changePercent: number | null;
}

export interface WeeklyTrendData {
  feeding: WeeklyTrendDimension;
  sleep: WeeklyTrendDimension;
  diaper: WeeklyTrendDimension;
  temperature: WeeklyTrendDimension;
  /** 本周窗口（本周一 00:00 → 今天 23:59:59，受 baby.birthDate 限制） */
  period: { start: string; end: string };
  /** 上周完整窗口（上周一 00:00 → 上周日 23:59:59）；当 birthDate 落在本周或之后时为 null */
  lastWeekPeriod: { start: string; end: string } | null;
  ageMonths: number;
}

// ============ AI Types ============
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  messages: ChatMessage[];
  babyId?: string;
}

export interface AIChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface DailyInsight {
  summary: string;
  suggestions: string[];
  alerts: string[];
  /** 当 source 为 fallback 时表示由本地规则引擎产出（AI 服务不可用） */
  source?: 'ai' | 'fallback';
}

export interface AIQuotaStatus {
  dailyLimit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

export type ChatStreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; usage?: { promptTokens: number; completionTokens: number } }
  | { type: 'error'; code: string; message: string };

// ============ Permission Types ============
export const Permission = {
  RECORD_CREATE: 'record:create',
  RECORD_UPDATE_OWN: 'record:update:own',
  RECORD_UPDATE_ANY: 'record:update:any',
  RECORD_DELETE_OWN: 'record:delete:own',
  RECORD_DELETE_ANY: 'record:delete:any',
  FAMILY_MANAGE: 'family:manage',
  FAMILY_DISSOLVE: 'family:dissolve',
  BABY_CREATE: 'baby:create',
  BABY_DELETE: 'baby:delete',
  MEMBER_MANAGE: 'member:manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
