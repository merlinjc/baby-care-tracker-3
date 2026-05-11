// Baby Care Tracker - Shared Types

// ============ User Preferences (v7.2+) ============
/**
 * 用户个性化偏好。后端以 JSON 字符串持久化在 `User.preferences`，
 * 服务端 `auth.service.updateProfile` 按顶层 key 做"深合并"（部分更新），
 * 客户端使用 `auth-store.updatePreferences(patch)` 入口写入。
 *
 * 所有键均为可选；未知键允许并保留（服务端不会主动丢弃），
 * 便于跨版本前后端并行升级。
 */
export interface UserPreferences {
  /** F1：首次使用引导是否完成 */
  onboardingCompleted?: boolean;
  /** F1：引导中跳过的步骤 ID，用于"重新观看"逻辑 */
  onboardingSkippedSteps?: string[];
  /** F8：当前语言代码（如 'zh-CN' / 'en-US'），默认 'zh-CN' */
  lang?: string;
  /** F8：是否曾手动切换过语言（决定是否再尊重浏览器 locale） */
  langManuallySet?: boolean;
  /** v7.1 字体档：跨设备种子（运行时仍以本地 font-scale-store 为准） */
  fontScale?: 'sm' | 'md' | 'lg' | 'xl';
  /** v7.1 主题模式：跨设备种子（运行时仍以本地 theme-store 为准） */
  themeMode?: 'light' | 'warm-night' | 'system';
}

// ============ User Types ============
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  nickname: string;
  avatar: string | null;
  familyId: string | null;
  /** v7.2+：用户个性化偏好（可能为 null：旧用户从未写过） */
  preferences?: UserPreferences | null;
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
  updatedAt: string;
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

// ============ Upload Types (v7.2+ T-S1-INF-02) ============
/**
 * 文件上传分类，决定 COS 桶内的 key 前缀与上下文必填字段。
 *
 * - `avatar`：用户头像，key = `avatars/{userId}/{cuid}.{ext}`
 * - `baby-avatar`：宝宝头像，key = `babies/{familyId}/{babyId}/{cuid}.{ext}`
 *   需要 ctx.familyId + ctx.babyId
 * - `daily-checkin`：每日打卡照片（v7.2 Sprint 2 F11 用），
 *   key = `checkins/{familyId}/{babyId}/{date}-{cuid}.{ext}`
 *   需要 ctx.familyId + ctx.babyId + ctx.date (YYYY-MM-DD)
 */
export type UploadKind = 'avatar' | 'baby-avatar' | 'daily-checkin';

/** 预签名上传所需的上下文（按 kind 不同字段必填） */
export interface UploadContext {
  familyId?: string;
  babyId?: string;
  /** 日期（YYYY-MM-DD），仅 daily-checkin 需要 */
  date?: string;
}

/**
 * POST /api/uploads (multipart/form-data) 的成功响应。
 *
 * 架构说明（v7.2 方案 B 服务端代理）：
 * - 客户端不再直传 COS，而是 multipart 提交给 Express，由服务端代理 putObject
 * - 不再返回 publicUrl / uploadUrl —— 客户端只需 key
 * - 展示时拼 `/api/uploads/{key}` 走我方下载代理（GET /api/uploads/* 路由）
 */
export interface UploadResult {
  /** 桶内对象 key，前端落库 + 拼接代理 URL 用 */
  key: string;
  /** 上传后的字节数（兜底信息） */
  size: number;
  /** 内容类型 */
  contentType: string;
}

// ============ Daily Check-in (v7.2+ T-S2-F11) ============
/**
 * 每日打卡记录。一个 baby 每天 (checkinDate) 最多一条。
 *
 * 字段约定：
 * - `checkinDate`：本地时区的 YYYY-MM-DD（前端 `lib/daily-checkin-date.todayLocalYmd()`）。
 *   后端不做时区换算，前端传什么落什么；按字符串字典序可用于范围查询。
 * - `photoKey`：COS 桶内 key（INF-02 方案 B），展示拼 `/api/uploads/{key}`。
 * - `aiSummary` / `aiSummaryAt`：AI 自动小记；用户编辑后 `aiSummaryAt = null`，
 *   UI 用此字段判断"已人工修改"。
 */
export interface DailyCheckin {
  id: string;
  babyId: string;
  familyId: string;
  checkinDate: string; // YYYY-MM-DD
  photoKey: string;
  photoWidth: number | null;
  photoHeight: number | null;
  caption: string | null;
  aiSummary: string | null;
  /** ISO string；null 表示未生成 / 已被用户编辑 */
  aiSummaryAt: string | null;
  createdBy: string;
  creator?: Pick<User, 'id' | 'nickname' | 'avatar'>;
  createdAt: string;
  updatedAt: string;
}

/** 列表查询参数（按月/按区间） */
export interface DailyCheckinListQuery {
  /** YYYY-MM-DD 起（含），不传默认本月初 */
  startDate?: string;
  /** YYYY-MM-DD 止（含），不传默认本月末 */
  endDate?: string;
}

export interface DailyCheckinCreateInput {
  /** YYYY-MM-DD，必须落在 [today-7d, today] 区间且不早于宝宝出生日 */
  checkinDate: string;
  /** 上传后返回的 COS key */
  photoKey: string;
  photoWidth?: number;
  photoHeight?: number;
  caption?: string;
}

export interface DailyCheckinPatchInput {
  photoKey?: string;
  photoWidth?: number;
  photoHeight?: number;
  caption?: string | null;
  /** 仅前端编辑后置入；后端会同时把 aiSummaryAt 置 null */
  aiSummary?: string | null;
}


/**
 * 家庭成员在育儿中的角色，用于 AI 洞察 / 对话的人设分支。
 * - 妈妈 / 爸爸：父母视角，侧重喂养作息 + 情感支持
 * - 外婆 / 奶奶 / 外公 / 爷爷：祖辈视角，强调代际差异科学育儿、避免传统误区
 * - 月嫂 / 育儿嫂：专业护理视角，侧重技巧 + 交接要点
 * - 其他 / 未设置：中立顾问视角
 */
export type CareRole =
  | 'mom'
  | 'dad'
  | 'grandma_m'
  | 'grandma_p'
  | 'grandpa_m'
  | 'grandpa_p'
  | 'nanny'
  | 'other';

// ============ AI Types ============
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  messages: ChatMessage[];
  babyId?: string;
  /** 可选：以某个育儿角色的视角生成回复（不传则使用中立顾问视角） */
  role?: CareRole;
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
