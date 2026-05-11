/**
 * GrowthPage v7 - iOS Health × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader（右上「记录」按钮）
 * - 类型 chip → SegmentedControl（体重/身高/头围）
 * - 图表卡：Card variant="plain"（去掉 gradient-header）
 * - 历史记录列表：用 ListRow 风（日期 + 月龄 + 数值）
 * - WHO 参考线 + 颜色保留（以业务色重映射）
 */
import { useState, useEffect, useMemo } from 'react'
import { Info, PlusCircle, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useBabyStore } from '@/stores/baby-store'
import { trendService } from '@/services/baby-extra'
import { GrowthDialog } from '@/components/growth-dialog'
import { useDialog } from '@/hooks/use-dialog'
import { recordService } from '@/services/record'
import { getWHOReferenceLines } from '@/lib/who-standards'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChartSkeleton } from '@/components/ui/chart-skeleton'
import { Switch } from '@/components/ui/switch'
import { staggerContainer, staggerItem } from '@/lib/motion'
import type { TrendType, TrendDataPoint, Baby } from '@/types'

const trendLabels: Record<TrendType, { label: string; unit: string; color: string; bg: string; fg: string }> = {
  weight: {
    label: '体重',
    unit: 'kg',
    color: 'var(--feeding)',
    bg: 'var(--feeding-bg)',
    fg: 'var(--feeding-fg)',
  },
  height: {
    label: '身高',
    unit: 'cm',
    color: 'var(--sleep)',
    bg: 'var(--sleep-bg)',
    fg: 'var(--sleep-fg)',
  },
  headCircumference: {
    label: '头围',
    unit: 'cm',
    color: 'var(--growth)',
    bg: 'var(--growth-bg)',
    fg: 'var(--growth-fg)',
  },
}

const trendTypeToWHOType: Record<TrendType, 'weight' | 'height' | 'headCircumference'> = {
  weight: 'weight',
  height: 'height',
  headCircumference: 'headCircumference',
}

function getAgeMonths(baby: Baby): number {
  const birth = new Date(baby.birthDate)
  const now = new Date()
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

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
    trendService
      .get(currentBaby.id, trendType)
      .then((data) => setPoints(data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setIsLoading(false))
  }, [currentBaby, trendType])

  const handleCreateGrowth = async (
    data: { height?: number; weight?: number; headCircumference?: number; note?: string },
    meta: { recordTime: string; editingId?: string },
  ) => {
    if (!currentBaby) return
    await recordService.createRecord({
      babyId: currentBaby.id,
      recordType: 'growth',
      startTime: meta.recordTime,
      growthData: data,
    })
    growthDialog.closeDialog()
    const data2 = await trendService.get(currentBaby.id, trendType)
    setPoints(data2.points || [])
  }

  const whoRefs = useMemo(() => {
    if (!currentBaby || !showWHO) return []
    return getWHOReferenceLines(trendTypeToWHOType[trendType], currentBaby.gender)
  }, [currentBaby, trendType, showWHO])

  const ageMonths = currentBaby ? getAgeMonths(currentBaby) : 24
  const chartMonths = Math.min(Math.max(ageMonths + 3, 12), 24)

  const chartPoints = useMemo(() => {
    if (!currentBaby) return []
    return points.map((p) => ({
      ...p,
      monthAge: getMonthAgeAtDate(currentBaby.birthDate, p.date),
    }))
  }, [points, currentBaby])

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

  // 用美拉德兄弟色重映射 WHO 百分位
  const percentileColors: Record<string, string> = {
    p3: '#C86464', // danger 暖玫红
    p15: '#D4A87A', // diaper 奶油橙
    p50: '#9BBF7F', // feeding 抹茶绿（中位数）
    p85: '#D4A87A',
    p97: '#C86464',
  }

  const cfg = trendLabels[trendType]

  return (
    <motion.div
      className="space-y-5"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <LargeTitleHeader
          title="生长曲线"
          subtitle={
            currentBaby
              ? `${currentBaby.name} · ${currentBaby.gender === 'male' ? '男' : '女'} · ${ageMonths}月龄`
              : undefined
          }
          backTo="/discover"
          rightAction={
            <div className="flex items-center gap-2">
              <Link to="/growth/calendar" aria-label="成长日历">
                <Button
                  variant="plain"
                  size="sm"
                  leftIcon={<CalendarIcon className="h-3.5 w-3.5" />}
                >
                  日历
                </Button>
              </Link>
              <Button
                variant="tinted"
                size="sm"
                leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
                onClick={growthDialog.openDialog}
              >
                记录
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* 类型切换 */}
      <motion.div variants={staggerItem}>
        <SegmentedControl
          value={trendType}
          onChange={(v) => setTrendType(v as TrendType)}
          options={(Object.entries(trendLabels) as [TrendType, typeof trendLabels.weight][]).map(([key, val]) => ({
            value: key,
            label: val.label,
          }))}
          size="md"
        />
      </motion.div>

      {/* WHO 开关 */}
      {currentBaby && (
        <motion.div
          variants={staggerItem}
          className="flex items-center justify-between px-1"
        >
          <span className="footnote font-medium" style={{ color: 'var(--label-secondary)' }}>
            WHO 参考曲线
          </span>
          <Switch checked={showWHO} onCheckedChange={setShowWHO} aria-label="显示 WHO 参考线" />
        </motion.div>
      )}

      {/* Chart Card */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <ChartSkeleton chartHeight={200} rows={4} />
        ) : (
          <Card padding="md">
            {points.length === 0 && !showWHO ? (
              <div className="empty-state">
                <TrendingUp className="h-12 w-12 empty-state__icon" />
                <p className="empty-state__title">暂无{cfg.label}数据</p>
                <p className="empty-state__desc">点击右上角「记录」添加生长数据</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="footnote" style={{ color: 'var(--label-secondary)' }}>
                    {cfg.label}趋势
                  </span>
                  <span className="caption-1" style={{ color: 'var(--label-tertiary)' }}>
                    单位: {cfg.unit}
                  </span>
                </div>

                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                    <line
                      key={`grid-${pct}`}
                      x1={padL}
                      y1={padT + pct * plotH}
                      x2={chartW - padR}
                      y2={padT + pct * plotH}
                      stroke="var(--separator)"
                      strokeWidth="0.5"
                      strokeDasharray="4"
                    />
                  ))}

                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const val = maxY - pct * yRange
                    return (
                      <text
                        key={`y-${pct}`}
                        x={padL - 4}
                        y={padT + pct * plotH + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill="var(--label-tertiary)"
                      >
                        {val.toFixed(1)}
                      </text>
                    )
                  })}

                  {Array.from({ length: Math.floor(chartMonths / 3) + 1 }, (_, i) => i * 3)
                    .filter((m) => m <= chartMonths)
                    .map((month) => (
                      <text
                        key={`x-${month}`}
                        x={toX(month)}
                        y={chartH - 4}
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--label-tertiary)"
                      >
                        {month}月
                      </text>
                    ))}

                  {showWHO && whoRefs.filter((r) => r.month <= chartMonths).length > 1 && (
                    <>
                      {(['p3', 'p15', 'p50', 'p85', 'p97'] as const).map((pKey) => {
                        const filteredRefs = whoRefs.filter((r) => r.month <= chartMonths)
                        if (filteredRefs.length < 2) return null
                        const linePoints = filteredRefs
                          .map((r) => `${toX(r.month)},${toY(r[pKey])}`)
                          .join(' ')
                        return (
                          <g key={`who-${pKey}`}>
                            <polyline
                              fill="none"
                              stroke={percentileColors[pKey]}
                              strokeWidth={pKey === 'p50' ? '1.5' : '0.8'}
                              strokeDasharray={pKey === 'p50' ? 'none' : '4,3'}
                              points={linePoints}
                            />
                          </g>
                        )
                      })}
                    </>
                  )}

                  {chartPoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      points={chartPoints.map((p) => `${toX(p.monthAge)},${toY(p.value)}`).join(' ')}
                    />
                  )}

                  {chartPoints.map((p, i) => (
                    <g key={i}>
                      <circle
                        cx={toX(p.monthAge)}
                        cy={toY(p.value)}
                        r="6"
                        fill="transparent"
                        className="cursor-pointer"
                      />
                      <circle
                        cx={toX(p.monthAge)}
                        cy={toY(p.value)}
                        r="3.5"
                        fill={cfg.color}
                        stroke="var(--surface-1)"
                        strokeWidth="1.5"
                        className="pointer-events-none"
                      />
                      <title>{`${new Date(p.date).toLocaleDateString('zh-CN')}: ${p.value}${cfg.unit}`}</title>
                    </g>
                  ))}
                </svg>

                {/* Legend */}
                {showWHO && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: 'var(--surface-2)',
                        color: cfg.fg,
                      }}
                    >
                      <span className="w-3 h-0.5 rounded" style={{ background: cfg.color }} />
                      {currentBaby?.name}
                    </span>
                    {(['p3', 'p15', 'p50', 'p85', 'p97'] as const).map((pKey) => (
                      <span
                        key={pKey}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          color: 'var(--label-secondary)',
                        }}
                      >
                        <span
                          className="w-3 h-0.5 rounded"
                          style={{ background: percentileColors[pKey] }}
                        />
                        P{pKey.slice(1)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </motion.div>

      {/* 历史记录 */}
      {chartPoints.length > 0 && (
        <motion.div variants={staggerItem}>
          <SectionHeader title="历史记录" variant="grouped" />
          <Card variant="elevated" padding="none">
            <div className="ios-list">
              {chartPoints
                .slice()
                .reverse()
                .slice(0, 10)
                .map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-5 py-3 min-w-0 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cfg.bg, color: cfg.fg }}
                      >
                        <span className="caption-1 font-bold number-display">{p.monthAge}m</span>
                      </div>
                      <div className="min-w-0">
                        <p className="callout font-medium truncate" style={{ color: 'var(--label)' }}>
                          {new Date(p.date).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="caption-1" style={{ color: 'var(--label-tertiary)' }}>
                          {p.monthAge} 月龄
                        </p>
                      </div>
                    </div>
                    <span
                      className="metric-md number-display shrink-0"
                      style={{ color: cfg.fg }}
                    >
                      {p.value}
                      <span
                        className="caption-1 font-medium ml-1"
                        style={{ color: 'var(--label-tertiary)' }}
                      >
                        {cfg.unit}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* WHO 说明 */}
      {showWHO && (
        <motion.div variants={staggerItem}>
          <Card
            padding="md"
            className="flex items-start gap-2.5"
            style={{ backgroundColor: 'var(--growth-bg)' }}
          >
            <Info
              className="h-4 w-4 shrink-0 mt-0.5"
              style={{ color: 'var(--growth-fg)' }}
            />
            <div className="caption-1 space-y-1" style={{ color: 'var(--growth-fg)' }}>
              <p>WHO 参考线基于世界卫生组织儿童生长标准。P50 为中位数，P3-P97 为正常范围。</p>
              <p>超出 P3-P97 范围不代表异常，请咨询医生进行专业评估。</p>
            </div>
          </Card>
        </motion.div>
      )}

      <GrowthDialog
        open={growthDialog.open}
        onClose={growthDialog.closeDialog}
        onSubmit={handleCreateGrowth}
      />
    </motion.div>
  )
}
