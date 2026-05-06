import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, TrendingUp, Info } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { trendService } from '@/services/baby-extra'
import { GrowthDialog } from '@/components/growth-dialog'
import { useDialog } from '@/hooks/use-dialog'
import { recordService } from '@/services/record'
import { getWHOReferenceLines } from '@/lib/who-standards'
import type { TrendType, TrendDataPoint, Baby } from '@/types'

const trendLabels: Record<TrendType, { label: string; unit: string; color: string }> = {
  weight: { label: '体重', unit: 'kg', color: 'var(--feeding)' },
  height: { label: '身高', unit: 'cm', color: 'var(--sleep)' },
  headCircumference: { label: '头围', unit: 'cm', color: 'var(--growth)' },
}

const trendTypeToWHOType: Record<TrendType, 'weight' | 'height' | 'headCircumference'> = {
  weight: 'weight',
  height: 'height',
  headCircumference: 'headCircumference',
}

/** Calculate baby age in months */
function getAgeMonths(baby: Baby): number {
  const birth = new Date(baby.birthDate)
  const now = new Date()
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

/** Calculate month age at a specific date */
function getMonthAgeAtDate(birthDate: string, dateStr: string): number {
  const birth = new Date(birthDate)
  const date = new Date(dateStr)
  return (date.getFullYear() - birth.getFullYear()) * 12 + (date.getMonth() - birth.getMonth())
}

export function GrowthPage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const growthDialog = useDialog()
  const [trendType, setTrendType] = useState<TrendType>('weight')
  const [points, setPoints] = useState<TrendDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showWHO, setShowWHO] = useState(true)

  useEffect(() => {
    if (!currentBaby) return
    setIsLoading(true)
    trendService.get(currentBaby.id, trendType)
      .then((data) => setPoints(data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setIsLoading(false))
  }, [currentBaby, trendType])

  const handleCreateGrowth = async (data: { height?: number; weight?: number; headCircumference?: number; note?: string }) => {
    if (!currentBaby) return
    await recordService.createRecord({
      babyId: currentBaby.id,
      recordType: 'growth',
      startTime: new Date().toISOString(),
      growthData: data,
    })
    growthDialog.closeDialog()
    const data2 = await trendService.get(currentBaby.id, trendType)
    setPoints(data2.points || [])
  }

  // WHO reference data for chart
  const whoRefs = useMemo(() => {
    if (!currentBaby || !showWHO) return []
    return getWHOReferenceLines(trendTypeToWHOType[trendType], currentBaby.gender)
  }, [currentBaby, trendType, showWHO])

  // Chart calculations
  const ageMonths = currentBaby ? getAgeMonths(currentBaby) : 24
  const chartMonths = Math.min(Math.max(ageMonths + 3, 12), 24)

  // Data points with month age
  const chartPoints = useMemo(() => {
    if (!currentBaby) return []
    return points.map((p) => ({
      ...p,
      monthAge: getMonthAgeAtDate(currentBaby.birthDate, p.date),
    }))
  }, [points, currentBaby])

  // Y-axis range
  const allValues = useMemo(() => {
    const vals: number[] = []
    chartPoints.forEach((p) => vals.push(p.value))
    if (showWHO) {
      whoRefs.forEach((r) => {
        if (r.month <= chartMonths) {
          vals.push(r.p3, r.p97)
        }
      })
    }
    return vals
  }, [chartPoints, whoRefs, showWHO, chartMonths])

  const maxY = allValues.length > 0 ? Math.max(...allValues) * 1.05 : 10
  const minY = allValues.length > 0 ? Math.min(...allValues) * 0.95 : 0
  const yRange = maxY - minY || 1

  // Chart dimensions
  const chartW = 400
  const chartH = 200
  const padL = 45
  const padR = 10
  const padT = 10
  const padB = 25
  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB

  const toX = (month: number) => padL + (month / chartMonths) * plotW
  const toY = (val: number) => padT + ((maxY - val) / yRange) * plotH

  // Percentile colors
  const percentileColors: Record<string, string> = {
    p3: '#FFB3B3',
    p15: '#FFD4A3',
    p50: '#90C8A0',
    p85: '#FFD4A3',
    p97: '#FFB3B3',
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[var(--text-hint)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="heading-lg text-[var(--text-primary)]">生长曲线</h1>
        </div>
        <button
          onClick={growthDialog.openDialog}
          className="btn-primary text-[var(--text-xs)] px-3 py-1.5"
          style={{ backgroundColor: 'var(--growth)' }}
        >
          + 记录
        </button>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2">
        {(Object.entries(trendLabels) as [TrendType, typeof trendLabels.weight][]).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setTrendType(key)}
            className={`chip flex-1 justify-center ${trendType === key ? 'chip--active' : 'chip--inactive'}`}
            style={trendType === key ? { backgroundColor: val.color } : undefined}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* WHO Reference Toggle */}
      {currentBaby && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowWHO(!showWHO)}
            className={`chip ${showWHO ? 'chip--active' : 'chip--inactive'}`}
            style={showWHO ? { backgroundColor: 'var(--growth)' } : undefined}
          >
            WHO 参考线
          </button>
          {currentBaby && (
            <span className="caption">
              {currentBaby.name} · {currentBaby.gender === 'male' ? '男' : '女'} · {ageMonths}月龄
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="card-base">
        {isLoading ? (
          <div className="text-center py-12 caption">加载中...</div>
        ) : points.length === 0 && !showWHO ? (
          <div className="empty-state">
            <TrendingUp className="h-12 w-12 empty-state__icon" />
            <p className="empty-state__title">暂无{trendLabels[trendType].label}数据</p>
            <p className="empty-state__desc">点击右上角「记录」添加生长数据</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="caption">{trendLabels[trendType].label}趋势</span>
              <span className="caption">单位: {trendLabels[trendType].unit}</span>
            </div>

            {/* SVG Chart with WHO references */}
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line key={`grid-${pct}`} x1={padL} y1={padT + pct * plotH} x2={chartW - padR} y2={padT + pct * plotH} stroke="var(--border-light)" strokeWidth="0.5" strokeDasharray="4" />
              ))}

              {/* Y-axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const val = maxY - pct * yRange
                return <text key={`y-${pct}`} x={padL - 4} y={padT + pct * plotH + 3} textAnchor="end" className="text-[8px]" fill="var(--text-hint)">{val.toFixed(1)}</text>
              })}

              {/* X-axis labels (months) */}
              {Array.from({ length: Math.floor(chartMonths / 3) + 1 }, (_, i) => i * 3)
                .filter((m) => m <= chartMonths)
                .map((month) => (
                  <text key={`x-${month}`} x={toX(month)} y={chartH - 4} textAnchor="middle" className="text-[8px]" fill="var(--text-hint)">
                    {month}月
                  </text>
                ))}

              {/* WHO reference lines (P3, P15, P50, P85, P97) */}
              {showWHO && whoRefs.filter((r) => r.month <= chartMonths).length > 1 && (
                <>
                  {(['p3', 'p15', 'p50', 'p85', 'p97'] as const).map((pKey) => {
                    const filteredRefs = whoRefs.filter((r) => r.month <= chartMonths)
                    if (filteredRefs.length < 2) return null
                    const linePoints = filteredRefs.map((r) => `${toX(r.month)},${toY(r[pKey])}`).join(' ')
                    return (
                      <g key={`who-${pKey}`}>
                        <polyline
                          fill="none"
                          stroke={percentileColors[pKey]}
                          strokeWidth={pKey === 'p50' ? '1.5' : '0.8'}
                          strokeDasharray={pKey === 'p50' ? 'none' : '4,3'}
                          points={linePoints}
                        />
                        {/* Label */}
                        {filteredRefs.length > 0 && (
                          <text
                            x={toX(filteredRefs[filteredRefs.length - 1].month) + 3}
                            y={toY(filteredRefs[filteredRefs.length - 1][pKey]) + 3}
                            className="text-[7px]"
                            fill={percentileColors[pKey]}
                          >
                            {pKey.toUpperCase().replace('P', 'P')}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </>
              )}

              {/* Baby data line */}
              {chartPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke={trendLabels[trendType].color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  points={chartPoints.map((p) => `${toX(p.monthAge)},${toY(p.value)}`).join(' ')}
                />
              )}

              {/* Baby data points */}
              {chartPoints.map((p, i) => (
                <circle key={i} cx={toX(p.monthAge)} cy={toY(p.value)} r="3" fill={trendLabels[trendType].color} />
              ))}
            </svg>

            {/* Legend */}
            {showWHO && (
              <div className="flex flex-wrap gap-3 mt-2 mb-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded" style={{ background: trendLabels[trendType].color }} />
                  <span className="caption">{currentBaby?.name}</span>
                </div>
                {(['p3', 'p15', 'p50', 'p85', 'p97'] as const).map((pKey) => (
                  <div key={pKey} className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded" style={{ background: percentileColors[pKey], borderStyle: pKey === 'p50' ? 'solid' : 'dashed' }} />
                    <span className="caption">P{pKey.slice(1)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            <div className="mt-2 space-y-2">
              {chartPoints.slice().reverse().slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center justify-between body-md py-1.5 border-b border-[var(--border-light)] last:border-0">
                  <span className="text-[var(--text-hint)]">
                    {new Date(p.date).toLocaleDateString('zh-CN')} ({p.monthAge}月)
                  </span>
                  <span className="font-medium text-[var(--text-primary)] number-display">{p.value} {trendLabels[trendType].unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* WHO Info */}
      {showWHO && (
        <div className="card-base flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--growth)' }} />
          <div className="caption space-y-1">
            <p>WHO 参考线基于世界卫生组织儿童生长标准。P50 为中位数，P3-P97 为正常范围。</p>
            <p>超出 P3-P97 范围不代表异常，请咨询医生进行专业评估。</p>
          </div>
        </div>
      )}

      <GrowthDialog
        open={growthDialog.open}
        onClose={growthDialog.closeDialog}
        onSubmit={handleCreateGrowth}
      />
    </div>
  )
}
