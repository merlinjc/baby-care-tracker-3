import type { CareRecord, RecordType, FeedingData, SleepData, DiaperData, TemperatureData, GrowthData } from '@baby-care-tracker/shared'

const DIAPER_COLOR_MAP: Record<string, string> = {
  normal: '正常色',
  yellow: '黄色',
  green: '绿色',
  black: '黑色',
  red: '红色',
}

const DIAPER_CONSISTENCY_MAP: Record<string, string> = {
  watery: '水样',
  soft: '软便',
  formed: '成型',
  hard: '硬便',
}

const TEMP_METHOD_MAP: Record<string, string> = {
  oral: '口腔',
  axillary: '腋下',
  rectal: '直肠',
  ear: '耳温',
}

export function getRecordSummary(record: CareRecord): string {
  switch (record.recordType) {
    case 'feeding': {
      const d = record.feedingData as FeedingData | undefined
      if (!d) return '喂养记录'
      const parts: string[] = []
      if (d.feedingType === 'formula') parts.push('配方奶')
      else if (d.feedingType === 'breast') parts.push('母乳')
      else if (d.feedingType === 'solid') parts.push('辅食')
      if (d.amount) parts.push(`${d.amount}ml`)
      if (d.duration) parts.push(`${Math.round(d.duration / 60)}分钟`)
      if (d.breastSide === 'left') parts.push('左侧')
      else if (d.breastSide === 'right') parts.push('右侧')
      else if (d.breastSide === 'both') parts.push('两侧')
      return parts.join(' · ') || '喂养记录'
    }
    case 'sleep': {
      const d = record.sleepData as SleepData | undefined
      if (!d) return '睡眠记录'
      const parts: string[] = []
      parts.push(d.sleepType === 'night' ? '夜间' : '午睡')
      parts.push(formatDurationShort(d.duration))
      if (d.location) parts.push(d.location)
      return parts.join(' · ')
    }
    case 'diaper': {
      const d = record.diaperData as DiaperData | undefined
      if (!d) return '换尿布'
      const parts: string[] = []
      if (d.diaperType === 'pee') parts.push('尿')
      else if (d.diaperType === 'poop') parts.push('便')
      else parts.push('尿+便')
      if (d.consistency) parts.push(DIAPER_CONSISTENCY_MAP[d.consistency] ?? d.consistency)
      if (d.color) parts.push(DIAPER_COLOR_MAP[d.color] ?? d.color)
      return parts.join(' · ')
    }
    case 'temperature': {
      const d = record.temperatureData as TemperatureData | undefined
      if (!d) return '体温记录'
      const parts: string[] = [`${d.temperature}°C`]
      if (d.method) parts.push(TEMP_METHOD_MAP[d.method] ?? d.method)
      const status = classifyTemperature(d.temperature)
      if (status) parts.push(status)
      return parts.join(' · ')
    }
    case 'growth': {
      const d = record.growthData as GrowthData | undefined
      if (!d) return '生长记录'
      const parts: string[] = []
      if (d.height) parts.push(`身高 ${d.height}cm`)
      if (d.weight) parts.push(`体重 ${d.weight}kg`)
      if (d.headCircumference) parts.push(`头围 ${d.headCircumference}cm`)
      return parts.join(' · ') || '生长记录'
    }
    default:
      return '记录'
  }
}

/**
 * 详情字段（用于卡片次要行展示更丰富的属性）
 *
 * 与 `getRecordSummary` 配合：summary 给一行总览，本函数补充结构化的多键值对，
 * 在卡片中以「key: value」形式展示，便于在不打开详情页的情况下快速浏览。
 */
export function getRecordDetails(record: CareRecord): Array<{ key: string; value: string }> {
  switch (record.recordType) {
    case 'feeding': {
      const d = record.feedingData as FeedingData | undefined
      if (!d) return []
      const list: Array<{ key: string; value: string }> = []
      if (d.feedingType === 'formula' && d.amount) list.push({ key: '奶量', value: `${d.amount} ml` })
      if (d.feedingType === 'breast' && d.duration) list.push({ key: '时长', value: formatDurationShort(d.duration) })
      if (d.feedingType === 'breast' && d.breastSide) {
        const sideMap: Record<string, string> = { left: '左侧', right: '右侧', both: '两侧' }
        list.push({ key: '哺乳侧', value: sideMap[d.breastSide] ?? d.breastSide })
      }
      if (d.feedingType === 'solid' && d.amount) list.push({ key: '分量', value: `${d.amount} g` })
      return list
    }
    case 'sleep': {
      const d = record.sleepData as SleepData | undefined
      if (!d) return []
      const list: Array<{ key: string; value: string }> = []
      list.push({ key: '类型', value: d.sleepType === 'night' ? '夜间睡眠' : '午睡' })
      list.push({ key: '时长', value: formatDurationShort(d.duration) })
      if (d.location) list.push({ key: '地点', value: d.location })
      if (record.endTime) {
        list.push({
          key: '结束于',
          value: new Date(record.endTime).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })
      } else {
        list.push({ key: '状态', value: '进行中' })
      }
      return list
    }
    case 'diaper': {
      const d = record.diaperData as DiaperData | undefined
      if (!d) return []
      const list: Array<{ key: string; value: string }> = []
      const typeMap: Record<string, string> = { pee: '尿', poop: '便', both: '尿 + 便' }
      list.push({ key: '类型', value: typeMap[d.diaperType] ?? d.diaperType })
      if (d.consistency) list.push({ key: '性状', value: DIAPER_CONSISTENCY_MAP[d.consistency] ?? d.consistency })
      if (d.color) list.push({ key: '颜色', value: DIAPER_COLOR_MAP[d.color] ?? d.color })
      return list
    }
    case 'temperature': {
      const d = record.temperatureData as TemperatureData | undefined
      if (!d) return []
      const list: Array<{ key: string; value: string }> = []
      list.push({ key: '体温', value: `${d.temperature} °C` })
      if (d.method) list.push({ key: '部位', value: TEMP_METHOD_MAP[d.method] ?? d.method })
      const status = classifyTemperature(d.temperature)
      if (status) list.push({ key: '状态', value: status })
      return list
    }
    case 'growth': {
      const d = record.growthData as GrowthData | undefined
      if (!d) return []
      const list: Array<{ key: string; value: string }> = []
      if (d.height) list.push({ key: '身高', value: `${d.height} cm` })
      if (d.weight) list.push({ key: '体重', value: `${d.weight} kg` })
      if (d.headCircumference) list.push({ key: '头围', value: `${d.headCircumference} cm` })
      return list
    }
    default:
      return []
  }
}

export function getRecordTypeLabel(type: RecordType): string {
  const map: Record<RecordType, string> = {
    feeding: '喂养',
    sleep: '睡眠',
    diaper: '换尿布',
    temperature: '体温',
    growth: '生长',
  }
  return map[type]
}

/**
 * 体温归类（与小程序端 service 约定一致）：
 * < 36.0 偏低；36.0–37.4 正常；37.5–37.9 低热；38.0–38.9 中热；≥ 39.0 高热
 */
function classifyTemperature(t: number): string | null {
  if (t < 36) return '偏低'
  if (t < 37.5) return '' // 正常体温不显式标注
  if (t < 38) return '低热'
  if (t < 39) return '中热'
  return '高热'
}

function formatDurationShort(seconds: number): string {
  if (!seconds) return '0 分钟'
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 60) return `${totalMin} 分钟`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}
