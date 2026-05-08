/**
 * NoteTagPicker - 记录备注的「标签 + 自由文本」选择器
 *
 * 作为受控组件嵌入各类记录 Dialog，替代原来的单行 `<input type="text">` 备注输入。
 *
 * value / onChange 对应 record.note 原字符串（形如 `#吃得多 #打嗝多 今晚多喝了 30ml`），
 * 内部会解析为「标签集合 + 自由文本」二元结构供用户编辑，提交时再 join 回去。
 *
 * 视觉：
 * - 上：预设标签 chip（按 recordType 过滤，内含通用 + 类型细分）
 * - 中：自定义标签 chip（可点击选中 / 点击删除图标移除）
 * - 下：自定义输入（支持回车 / 点击「+」添加，同时加入 localStorage）
 * - 底：自由文本 input，用于非标签化描述
 */
import { useEffect, useMemo, useState } from 'react'
import { PlusCircle, X } from 'lucide-react';
import type { RecordType } from '@baby-care-tracker/shared'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  addCustomNoteTag,
  buildNote,
  getPresetNoteTags,
  parseNote,
  readCustomNoteTags,
  removeCustomNoteTag,
} from '@/lib/note-tags'

interface NoteTagPickerProps {
  /** record.note 字符串（可能含 `#tag` 前缀 + 自由文本） */
  value: string
  onChange: (next: string) => void
  recordType: RecordType
  /** 覆盖标签 accent 颜色；默认 primary */
  accentColor?: string
  /** 自由文本输入框 placeholder */
  placeholder?: string
}

/**
 * 内部标签按钮（chip），不使用全局 `.chip` 样式是因为：
 * - 这里 chip 尺寸更紧凑、默认不带背景
 * - 需要针对 hover / active 做定制配色
 */
function TagChip({
  label,
  selected,
  onClick,
  onRemove,
  accentColor,
}: {
  label: string
  selected: boolean
  onClick: () => void
  onRemove?: () => void
  accentColor: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full transition-colors cursor-pointer select-none"
      style={{
        padding: '4px 10px',
        fontSize: 'var(--text-xs)',
        lineHeight: 1.4,
        backgroundColor: selected
          ? `color-mix(in srgb, ${accentColor} 18%, transparent)`
          : 'var(--bg-elevated)',
        border: selected
          ? `1px solid ${accentColor}`
          : '1px solid var(--border-light)',
        color: selected ? accentColor : 'var(--text-secondary)',
      }}
      onClick={onClick}
      role="button"
      aria-pressed={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          aria-label={`删除自定义标签 ${label}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:opacity-70"
          style={{ lineHeight: 0 }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export function NoteTagPicker({
  value,
  onChange,
  recordType,
  accentColor = 'var(--primary)',
  placeholder = '补充说明（选填）',
}: NoteTagPickerProps) {
  // value 是外部传入的 note 字符串；派生成内部结构
  const parsed = useMemo(() => parseNote(value), [value])
  const [selectedTags, setSelectedTags] = useState<string[]>(parsed.tags)
  const [freeText, setFreeText] = useState<string>(parsed.freeText)
  const [customTags, setCustomTags] = useState<string[]>(() => readCustomNoteTags(recordType))
  const [draftTag, setDraftTag] = useState<string>('')

  const presetTags = useMemo(() => getPresetNoteTags(recordType), [recordType])

  // 外部 value 发生变化（切换编辑目标）时同步内部状态
  useEffect(() => {
    const nextParsed = parseNote(value)
    setSelectedTags(nextParsed.tags)
    setFreeText(nextParsed.freeText)
  }, [value])

  // recordType 切换时重新读一次自定义标签（喂养与睡眠各一套）
  useEffect(() => {
    setCustomTags(readCustomNoteTags(recordType))
  }, [recordType])

  /** 每次状态变化统一向外发 note 字符串 */
  const emit = (tags: string[], text: string) => {
    onChange(buildNote(tags, text))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      emit(next, freeText)
      return next
    })
  }

  const handleFreeTextChange = (v: string) => {
    setFreeText(v)
    emit(selectedTags, v)
  }

  const handleAddCustom = () => {
    const tag = draftTag.trim()
    if (!tag) return
    const next = addCustomNoteTag(recordType, tag)
    setCustomTags(next)
    setDraftTag('')
    // 新增即选中（符合直觉）
    if (!selectedTags.includes(tag)) {
      const nextSelected = [...selectedTags, tag]
      setSelectedTags(nextSelected)
      emit(nextSelected, freeText)
    }
  }

  const handleRemoveCustom = (tag: string) => {
    const nextCustom = removeCustomNoteTag(recordType, tag)
    setCustomTags(nextCustom)
    // 若原本选中也一并取消
    if (selectedTags.includes(tag)) {
      const nextSelected = selectedTags.filter((t) => t !== tag)
      setSelectedTags(nextSelected)
      emit(nextSelected, freeText)
    }
  }

  return (
    // v5.0.0+：挂 data-note-tag-picker 钩子，space-y-2.5 升级到 space-y-3，
    // 同时交由 globals.css Layout Fallback 兜底间距。
    <div data-note-tag-picker className="space-y-3">
      {/* 预设标签 */}
      <div className="flex flex-wrap gap-2">
        {presetTags.map((tag) => (
          <TagChip
            key={tag}
            label={tag}
            selected={selectedTags.includes(tag)}
            onClick={() => toggleTag(tag)}
            accentColor={accentColor}
          />
        ))}
      </div>

      {/* 自定义标签 + 新增输入（仅当有自定义或在输入时展示分隔线，避免空占位） */}
      {(customTags.length > 0 || draftTag.length > 0) && (
        <>
          <Separator variant="dashed" />
          <div className="flex flex-wrap gap-2">
            {customTags.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                selected={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
                onRemove={() => handleRemoveCustom(tag)}
                accentColor={accentColor}
              />
            ))}
          </div>
        </>
      )}

      {/* 新增自定义标签 */}
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          type="text"
          value={draftTag}
          onChange={(e) => setDraftTag(e.target.value.slice(0, 10))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddCustom()
            }
          }}
          placeholder="自定义标签（最多 10 个字）"
          aria-label="新增自定义标签"
          wrapperClassName="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddCustom}
          disabled={!draftTag.trim()}
          aria-label="添加自定义标签"
          leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
        >
          添加
        </Button>
      </div>

      {/* 自由文本 */}
      <Input
        type="text"
        value={freeText}
        onChange={(e) => handleFreeTextChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
