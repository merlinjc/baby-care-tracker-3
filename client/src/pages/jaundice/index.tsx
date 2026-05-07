/**
 * /jaundice - 黄疸记录子页
 *
 * 列表 + 新建 + 编辑 + 删除 + 简单 TSB/TcB 趋势（SVG 迷你折线）。
 * 数据源：localStorage（见 lib/jaundice.ts）；不走后端。
 */
import { useEffect, useMemo, useState } from 'react'
import { Sun, Plus, Pencil, Trash2, Baby } from 'lucide-react'
import { useBabyStore } from '@/stores/baby-store'
import { usePermission } from '@/hooks/use-permission'
import { useDialog } from '@/hooks/use-dialog'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { JaundiceDialog } from '@/components/jaundice-dialog'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  KRAMER_ZONE_OPTIONS,
  classifyTsb,
  deleteJaundiceRecord,
  listJaundiceRecords,
  saveJaundiceRecord,
  type JaundiceRecord,
} from '@/lib/jaundice'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function zoneLabel(zone: JaundiceRecord['kramerZone']): string {
  if (zone === null) return '无明显黄染'
  const hit = KRAMER_ZONE_OPTIONS.find((o) => o.value === zone)
  return hit ? `${hit.desc}（${hit.label}）` : `Ⅰ-${zone} 区`
}

/** 迷你折线图：展示最近 N 条胆红素（优先 TSB，否则 TcB）随时间变化 */
function TrendMini({ records }: { records: JaundiceRecord[] }) {
  const points = useMemo(() => {
    const list = records
      .map((r) => ({
        date: r.date,
        value: typeof r.tsb === 'number' ? r.tsb : typeof r.tcb === 'number' ? r.tcb : null,
        isTsb: typeof r.tsb === 'number',
      }))
      .filter((p): p is { date: string; value: number; isTsb: boolean } => p.value !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return list.slice(-10)
  }, [records])

  if (points.length < 2) {
    return (
      <Card padding="sm" className="text-center" style={{ color: 'var(--text-hint)' }}>
        <p className="body-sm">至少需要 2 条含数值的记录才能显示趋势</p>
      </Card>
    )
  }

  const W = 320
  const H = 120
  const PAD_L = 28
  const PAD_R = 8
  const PAD_T = 8
  const PAD_B = 22

  const values = points.map((p) => p.value)
  const maxV = Math.max(...values, 20)
  const minV = Math.min(...values, 0)
  const range = Math.max(1, maxV - minV)

  const xFor = (i: number) =>
    PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, points.length - 1)
  const yFor = (v: number) =>
    PAD_T + (1 - (v - minV) / range) * (H - PAD_T - PAD_B)

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`)
    .join(' ')

  return (
    <Card padding="sm">
      <div className="flex items-center justify-between mb-2">
        <span className="body-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          胆红素趋势（近 {points.length} 次）
        </span>
        <span className="caption" style={{ color: 'var(--text-hint)' }}>
          数值单位：mg/dL
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {12 >= minV && 12 <= maxV && (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yFor(12)}
            y2={yFor(12)}
            stroke="var(--warning)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}
        {17 >= minV && 17 <= maxV && (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yFor(17)}
            y2={yFor(17)}
            stroke="var(--danger)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke="var(--warning)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={3}
            fill={p.isTsb ? 'var(--warning)' : 'var(--info)'}
          />
        ))}
        <text
          x={4}
          y={PAD_T + 8}
          fontSize={10}
          fill="var(--text-hint)"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {maxV.toFixed(0)}
        </text>
        <text
          x={4}
          y={H - PAD_B + 2}
          fontSize={10}
          fill="var(--text-hint)"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {minV.toFixed(0)}
        </text>
      </svg>
      <div
        className="caption flex items-center gap-3 mt-1"
        style={{ color: 'var(--text-hint)' }}
      >
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--warning)' }}
          />
          TSB
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--info)' }}
          />
          TcB
        </span>
        <span>虚线：12 / 17 mg/dL 参考警戒</span>
      </div>
    </Card>
  )
}

export function JaundicePage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const { canEdit } = usePermission()
  const confirm = useConfirm()
  const dialog = useDialog<JaundiceRecord>()
  const [records, setRecords] = useState<JaundiceRecord[]>([])

  useEffect(() => {
    if (!currentBaby) {
      setRecords([])
      return
    }
    setRecords(listJaundiceRecords(currentBaby.id))
  }, [currentBaby])

  const handleSave: React.ComponentProps<typeof JaundiceDialog>['onSubmit'] = async (data, id) => {
    if (!currentBaby) return
    saveJaundiceRecord(currentBaby.id, { ...data, id })
    setRecords(listJaundiceRecords(currentBaby.id))
    toast.success(id ? '已更新' : '已添加')
  }

  const handleDelete = async (r: JaundiceRecord) => {
    const ok = await confirm({
      title: '删除这条黄疸记录？',
      description: '删除后无法恢复。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok || !currentBaby) return
    deleteJaundiceRecord(currentBaby.id, r.id)
    setRecords(listJaundiceRecords(currentBaby.id))
  }

  if (!currentBaby) {
    return (
      <div className="empty-state min-h-[50vh]">
        <Baby className="h-12 w-12 empty-state__icon" />
        <p className="empty-state__title">请先选择一个宝宝</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="黄疸记录"
        backTo="/discover"
        icon={<Sun className="h-5 w-5" />}
        accentColor="var(--warning)"
        action={
          canEdit ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              accentColor="var(--warning)"
              onClick={() => dialog.openDialog()}
            >
              新增
            </Button>
          ) : undefined
        }
      />

      {/* 教育提示条 */}
      <Alert
        variant="warning"
        size="compact"
        icon={<Sun className="h-3.5 w-3.5" />}
      >
        观察皮肤黄染范围（Kramer 分区）+ 经皮胆红素数值，
        严重或持续时间 &gt; 2 周请及时就医。
      </Alert>

      {/* 趋势 */}
      <TrendMini records={records} />

      {/* 列表 */}
      {records.length === 0 ? (
        <div className="empty-state">
          <Sun className="h-10 w-10 empty-state__icon" style={{ color: 'var(--warning)' }} />
          <p className="empty-state__title">暂无黄疸记录</p>
          <p className="empty-state__desc">点击右上角"新增"记录第一条观察</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const tsbMeta = classifyTsb(r.tsb ?? r.tcb)
            return (
              <Card
                key={r.id}
                padding="sm"
                className="flex items-start gap-3"
                style={{ borderLeft: '3px solid var(--warning)' }}
              >
                <div
                  className="icon-circle icon-circle--sm shrink-0 mt-0.5"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--warning) 12%, transparent)',
                  }}
                >
                  <Sun className="h-4 w-4" style={{ color: 'var(--warning)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="body-md font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      日龄 {r.ageDays} 天
                    </span>
                    <span className="caption number-display">
                      {formatDateTime(r.date)}
                    </span>
                  </div>

                  <p
                    className="body-sm mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {zoneLabel(r.kramerZone)}
                    {r.scleraYellow ? ' · 巩膜发黄' : ''}
                  </p>

                  {/* 指标 */}
                  {(typeof r.tsb === 'number' || typeof r.tcb === 'number') && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {typeof r.tsb === 'number' && (
                        <Badge size="xs" accentColor={tsbMeta.color}>
                          TSB {r.tsb} mg/dL
                          {tsbMeta.label ? ` · ${tsbMeta.label}` : ''}
                        </Badge>
                      )}
                      {typeof r.tcb === 'number' && (
                        <Badge size="xs" variant="info">
                          TcB {r.tcb} mg/dL
                        </Badge>
                      )}
                      {r.jaundiceType && (
                        <Badge size="xs" variant="default">
                          {r.jaundiceType === 'physiologic'
                            ? '生理性'
                            : r.jaundiceType === 'pathologic'
                              ? '病理性'
                              : '母乳性'}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 标签行（symptoms + actions） */}
                  {(r.symptoms.length > 0 || r.actions.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.symptoms.map((s) => (
                        <Badge key={`s-${s}`} size="xs" variant="info">
                          {s}
                        </Badge>
                      ))}
                      {r.actions.map((s) => (
                        <Badge key={`a-${s}`} size="xs" variant="warning">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {r.note && (
                    <p
                      className="caption mt-1 line-clamp-2"
                      title={r.note}
                      style={{ color: 'var(--text-hint)' }}
                    >
                      📝 {r.note}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => dialog.openDialog(r)}
                      aria-label="编辑"
                    />
                    <IconButton
                      variant="danger-ghost"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => handleDelete(r)}
                      aria-label="删除"
                    />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <JaundiceDialog
        open={dialog.open}
        onClose={dialog.closeDialog}
        babyBirthDate={currentBaby.birthDate}
        editRecord={dialog.payload ?? null}
        onSubmit={handleSave}
      />
    </div>
  )
}
