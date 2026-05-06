import type { CareRecord, RecordType, FeedingData, SleepData, DiaperData, TemperatureData, GrowthData } from '@baby-care-tracker/shared'

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
      parts.push(`${Math.round(d.duration / 60)}分钟`)
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
      if (d.consistency) {
        const cMap: Record<string, string> = { watery: '水样', soft: '软便', formed: '成型', hard: '硬便' }
        parts.push(cMap[d.consistency] || d.consistency)
      }
      return parts.join(' · ')
    }
    case 'temperature': {
      const d = record.temperatureData as TemperatureData | undefined
      if (!d) return '体温记录'
      const parts: string[] = [`${d.temperature}°C`]
      if (d.method) {
        const mMap: Record<string, string> = { oral: '口腔', axillary: '腋下', rectal: '直肠', ear: '耳温' }
        parts.push(mMap[d.method] || d.method)
      }
      return parts.join(' · ')
    }
    case 'growth': {
      const d = record.growthData as GrowthData | undefined
      if (!d) return '生长记录'
      const parts: string[] = []
      if (d.height) parts.push(`${d.height}cm`)
      if (d.weight) parts.push(`${d.weight}kg`)
      if (d.headCircumference) parts.push(`头围${d.headCircumference}cm`)
      return parts.join(' · ') || '生长记录'
    }
    default:
      return '记录'
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
