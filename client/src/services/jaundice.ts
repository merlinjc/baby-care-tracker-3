/**
 * jaundiceService - 黄疸记录前端 service（v7.2 T-S1-F2-03）
 *
 * 与 server 的字段映射在本层完成（隔离 UI 与服务端命名差异），UI 继续使用
 * client/src/lib/jaundice 内定义的 JaundiceRecord（字段：date / ageDays /
 * scleraYellow / jaundiceType / actions / symptoms ...）。
 *
 * client field → server field
 *   date           → recordDate
 *   ageDays        → dayAge
 *   scleraYellow   → scleralIcterus
 *   jaundiceType   → category
 *   actions        → treatments
 *   symptoms       → symptoms (同名)
 *   tcb / tsb / kramerZone / note → 同名透传
 *
 * 注意：列表请求按 server 默认 100 条返回。
 */
import api from './api'
import type { JaundiceRecord } from '@/lib/jaundice'

/** 服务端 jaundice 记录 DTO（与 server format() 出参一致） */
interface JaundiceServerDto {
  id: string
  babyId: string
  familyId: string
  recordDate: string
  dayAge: number | null
  kramerZone: number | null
  scleralIcterus: boolean | null
  tcb: number | null
  tsb: number | null
  category: 'physiologic' | 'pathologic' | 'breast_milk' | null
  symptoms: string[]
  treatments: string[]
  note: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** 创建 / 更新时的 server payload（与 zod schema 一致；undefined 不传） */
interface JaundiceServerPayload {
  recordDate?: string
  dayAge?: number | null
  kramerZone?: number | null
  scleralIcterus?: boolean | null
  tcb?: number | null
  tsb?: number | null
  category?: JaundiceServerDto['category']
  symptoms?: string[]
  treatments?: string[]
  note?: string | null
}

/** server DTO → client JaundiceRecord（UI 形态） */
function toClient(dto: JaundiceServerDto): JaundiceRecord {
  return {
    id: dto.id,
    babyId: dto.babyId,
    date: dto.recordDate,
    ageDays: dto.dayAge ?? 1,
    kramerZone: (dto.kramerZone as JaundiceRecord['kramerZone']) ?? null,
    scleraYellow: dto.scleralIcterus ?? false,
    tcb: dto.tcb ?? undefined,
    tsb: dto.tsb ?? undefined,
    jaundiceType: dto.category,
    symptoms: dto.symptoms ?? [],
    actions: dto.treatments ?? [],
    note: dto.note ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

/** client → server payload（创建用，必填 date） */
export function toServerCreate(input: {
  date: string
  ageDays: number
  kramerZone: JaundiceRecord['kramerZone']
  scleraYellow: boolean
  tcb?: number
  tsb?: number
  jaundiceType?: JaundiceRecord['jaundiceType']
  symptoms?: string[]
  actions?: string[]
  note?: string
}): JaundiceServerPayload {
  const payload: JaundiceServerPayload = {
    recordDate: input.date,
    dayAge: input.ageDays,
    kramerZone: input.kramerZone,
    scleralIcterus: input.scleraYellow,
  }
  if (typeof input.tcb === 'number') payload.tcb = input.tcb
  if (typeof input.tsb === 'number') payload.tsb = input.tsb
  if (input.jaundiceType !== undefined) payload.category = input.jaundiceType
  if (input.symptoms && input.symptoms.length > 0) payload.symptoms = input.symptoms
  if (input.actions && input.actions.length > 0) payload.treatments = input.actions
  if (input.note) payload.note = input.note
  return payload
}

/** client → server payload（更新用：所有字段可选） */
export function toServerUpdate(patch: Partial<{
  date: string
  ageDays: number | null
  kramerZone: JaundiceRecord['kramerZone']
  scleraYellow: boolean
  tcb: number | null
  tsb: number | null
  jaundiceType: JaundiceRecord['jaundiceType']
  symptoms: string[]
  actions: string[]
  note: string | null
}>): JaundiceServerPayload {
  const payload: JaundiceServerPayload = {}
  if (patch.date !== undefined) payload.recordDate = patch.date
  if (patch.ageDays !== undefined) payload.dayAge = patch.ageDays
  if (patch.kramerZone !== undefined) payload.kramerZone = patch.kramerZone
  if (patch.scleraYellow !== undefined) payload.scleralIcterus = patch.scleraYellow
  if (patch.tcb !== undefined) payload.tcb = patch.tcb
  if (patch.tsb !== undefined) payload.tsb = patch.tsb
  if (patch.jaundiceType !== undefined) payload.category = patch.jaundiceType
  if (patch.symptoms !== undefined) payload.symptoms = patch.symptoms
  if (patch.actions !== undefined) payload.treatments = patch.actions
  if (patch.note !== undefined) payload.note = patch.note
  return payload
}

export interface ListJaundiceParams {
  /** ISO 字符串，闭区间起 */
  startDate?: string
  /** ISO 字符串，闭区间止 */
  endDate?: string
  /** 默认 100，最大 500 */
  limit?: number
}

export const jaundiceService = {
  async list(babyId: string, params?: ListJaundiceParams): Promise<JaundiceRecord[]> {
    const res = await api.get(`/babies/${babyId}/jaundice`, { params })
    const items: JaundiceServerDto[] = res.data.data.items ?? []
    return items.map(toClient)
  },

  async create(
    babyId: string,
    payload: Parameters<typeof toServerCreate>[0],
  ): Promise<JaundiceRecord> {
    const res = await api.post(
      `/babies/${babyId}/jaundice`,
      toServerCreate(payload),
    )
    return toClient(res.data.data.record)
  },

  async update(
    babyId: string,
    recordId: string,
    patch: Parameters<typeof toServerUpdate>[0],
  ): Promise<JaundiceRecord> {
    const res = await api.patch(
      `/babies/${babyId}/jaundice/${recordId}`,
      toServerUpdate(patch),
    )
    return toClient(res.data.data.record)
  },

  async remove(babyId: string, recordId: string): Promise<void> {
    await api.delete(`/babies/${babyId}/jaundice/${recordId}`)
  },
}
