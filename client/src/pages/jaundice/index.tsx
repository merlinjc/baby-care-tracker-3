/**
 * JaundicePage v7 - iOS Health × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader（warning 主题）
 * - Alert 教育提示 → tinted Card warning
 * - TrendMini：去 gradient-header
 * - 列表：tinted warning Card 风
 *
 * v7.2 T-S1-F2-04：数据源从 localStorage 迁移到云端 API。
 *   - listJaundiceRecords / saveJaundiceRecord / deleteJaundiceRecord 不再使用
 *   - useJaundiceRecords / useCreateJaundice / useUpdateJaundice / useDeleteJaundice
 *   - 字段映射在 services/jaundice 内部完成，UI 层不动
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Baby, Pencil, PlusCircle, Sun, Trash2 } from 'lucide-react';import { useBabyStore } from '@/stores/baby-store'
import { usePermission } from '@/hooks/use-permission'
import { useDialog } from '@/hooks/use-dialog'
import {
  useJaundiceRecords,
  useCreateJaundice,
  useUpdateJaundice,
  useDeleteJaundice,
} from '@/hooks/use-jaundice'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JaundiceDialog } from '@/components/jaundice-dialog'
import { toast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { staggerContainer, staggerItem } from '@/lib/motion'
import {
  KRAMER_ZONE_OPTIONS,
  classifyTsb,
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
      <Card padding="md" className="text-center">
        <p className="footnote" style={{ color: 'var(--label-tertiary)' }}>
          至少需要 2 条含数值的记录才能显示趋势
        </p>
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

  const xFor = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, points.length - 1)
  const yFor = (v: number) => PAD_T + (1 - (v - minV) / range) * (H - PAD_T - PAD_B)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`).join(' ')

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-2">
        <span className="footnote font-medium" style={{ color: 'var(--label)' }}>
          胆红素趋势（近 {points.length} 次）
        </span>
        <span className="caption-1" style={{ color: 'var(--label-tertiary)' }}>
          单位：mg/dL
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
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={3.5}
            fill={p.isTsb ? 'var(--warning)' : 'var(--info)'}
            stroke="var(--surface-1)"
            strokeWidth="1"
          />
        ))}
        <text
          x={4}
          y={PAD_T + 8}
          fontSize={10}
          fill="var(--label-tertiary)"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {maxV.toFixed(0)}
        </text>
        <text
          x={4}
          y={H - PAD_B + 2}
          fontSize={10}
          fill="var(--label-tertiary)"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {minV.toFixed(0)}
        </text>
      </svg>
      <div
        className="caption-1 flex items-center gap-3 mt-1"
        style={{ color: 'var(--label-tertiary)' }}
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
        <span>虚线：12 / 17 mg/dL 警戒</span>
      </div>
    </Card>
  )
}

export function JaundicePage() {
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const { canEdit } = usePermission()
  const confirm = useConfirm()
  const dialog = useDialog<JaundiceRecord>()

  const { data: records = [] } = useJaundiceRecords(currentBaby?.id)
  const createMutation = useCreateJaundice(currentBaby?.id)
  const updateMutation = useUpdateJaundice(currentBaby?.id)
  const deleteMutation = useDeleteJaundice(currentBaby?.id)

  const handleSave: React.ComponentProps<typeof JaundiceDialog>['onSubmit'] = async (
    data,
    id,
  ) => {
    if (!currentBaby) return
    try {
      if (id) {
        // 编辑：传入完整字段集合，service 内部映射并去重
        await updateMutation.mutateAsync({
          recordId: id,
          patch: {
            date: data.date,
            ageDays: data.ageDays,
            kramerZone: data.kramerZone,
            scleraYellow: data.scleraYellow,
            tcb: data.tcb ?? null,
            tsb: data.tsb ?? null,
            jaundiceType: data.jaundiceType,
            symptoms: data.symptoms,
            actions: data.actions,
            note: data.note ?? null,
          },
        })
      } else {
        await createMutation.mutateAsync(data)
      }
      toast.success(id ? '已更新' : '已添加')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      toast.error(msg)
      throw err
    }
  }

  const handleDelete = async (r: JaundiceRecord) => {
    const ok = await confirm({
      title: '删除这条黄疸记录？',
      description: '删除后无法恢复。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok || !currentBaby) return
    try {
      await deleteMutation.mutateAsync(r.id)
      toast.success('已删除')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败'
      toast.error(msg)
    }
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
    <motion.div
      className="space-y-5"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <LargeTitleHeader
          title="黄疸记录"
          backTo="/discover"
          rightAction={
            canEdit ? (
              <Button
                variant="tinted"
                size="sm"
                leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
                onClick={() => dialog.openDialog()}
              >
                新增
              </Button>
            ) : undefined
          }
        />
      </motion.div>

      {/* 教育提示 - tinted warning Hero */}
      <motion.div variants={staggerItem}>
        <Card
          padding="md"
          className="flex items-start gap-3"
          style={{ backgroundColor: 'var(--warning-bg)' }}
        >
          <div
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--warning) 22%, transparent)',
              color: 'var(--warning-fg)',
            }}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="headline" style={{ color: 'var(--warning-fg)' }}>
              黄疸观察提醒
            </p>
            <p
              className="footnote mt-0.5"
              style={{ color: 'var(--warning-fg)', opacity: 0.78 }}
            >
              观察皮肤黄染范围（Kramer 分区）+ 经皮胆红素数值，严重或持续 &gt; 2 周请及时就医。
            </p>
          </div>
        </Card>
      </motion.div>

      {/* 趋势 */}
      <motion.div variants={staggerItem}>
        <SectionHeader title="趋势" variant="prominent" />
        <TrendMini records={records} />
      </motion.div>

      {/* 列表 */}
      {records.length === 0 ? (
        <motion.div variants={staggerItem}>
          <Card variant="cta" padding="lg" className="text-center">
            <Sun
              className="h-10 w-10 mx-auto mb-2"
              style={{ color: 'var(--warning)' }}
            />
            <p className="headline" style={{ color: 'var(--label)' }}>
              开始记录黄疸变化
            </p>
            <p className="footnote mt-1" style={{ color: 'var(--label-tertiary)' }}>
              点击右上角"新增"记录第一条观察
            </p>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem}>
          <SectionHeader title="历史记录" variant="grouped" />
          <Card variant="elevated" padding="none">
            <div className="ios-list">
              {records.map((r) => {
                const tsbMeta = classifyTsb(r.tsb ?? r.tcb)
                return (
                  <div
                    key={r.id}
                    className="relative flex items-start gap-3 px-5 py-3.5 min-w-0"
                  >
                    <span
                      className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                      style={{ backgroundColor: 'var(--warning)' }}
                      aria-hidden
                    />
                    <div
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--warning-bg)',
                        color: 'var(--warning-fg)',
                      }}
                    >
                      <Sun className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className="callout font-semibold"
                          style={{ color: 'var(--label)' }}
                        >
                          日龄 {r.ageDays} 天
                        </span>
                        <span
                          className="caption-1 number-display"
                          style={{ color: 'var(--label-tertiary)' }}
                        >
                          {formatDateTime(r.date)}
                        </span>
                      </div>
                      <p
                        className="footnote mt-0.5"
                        style={{ color: 'var(--label-secondary)' }}
                      >
                        {zoneLabel(r.kramerZone)}
                        {r.scleraYellow ? ' · 巩膜发黄' : ''}
                      </p>

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
                          className="caption-1 mt-1 line-clamp-2"
                          title={r.note}
                          style={{ color: 'var(--label-tertiary)' }}
                        >
                          {r.note}
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
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}

      <JaundiceDialog
        open={dialog.open}
        onClose={dialog.closeDialog}
        babyBirthDate={currentBaby.birthDate}
        editRecord={dialog.payload ?? null}
        onSubmit={handleSave}
      />
    </motion.div>
  )
}
