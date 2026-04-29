import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, EmptyState, Skeleton } from '@/components/ui'
import { applyFilters, useQuestions } from '@/hooks/useQuestions'
import { DEFAULT_CATEGORY_MAP, getCategoryMap, type CategoryMap } from '@/lib/db'
import {
  filterQuestionsByHiddenModules,
  getHiddenModulesFromCategories,
} from '@/lib/questionVisibility'
import { useStudyStore } from '@/store/useStudyStore'
import {
  BUILTIN_CATEGORIES,
  BUILTIN_MODULE_BUCKET,
  BUILTIN_MODULE_SUBJECT,
  BUILTIN_MODULES,
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  type Difficulty,
  type Module,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_STYLES,
  type QuestionType,
  STATUS_LABELS,
  STATUS_STYLES,
  type StudyStatus,
} from '@/types'

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  selectedModules: Module[]
  selectedDifficulties: Difficulty[]
  selectedStatuses: StudyStatus[]
  onModuleToggle: (m: Module) => void
  onDifficultyToggle: (d: Difficulty) => void
  onStatusToggle: (s: StudyStatus) => void
  onClear: () => void
  totalFiltered: number
  totalAll: number
  /** All module names present in current DB (built-in + custom) */
  availableModules: Module[]
}

function FilterPanel({
  selectedModules,
  selectedDifficulties,
  selectedStatuses,
  onModuleToggle,
  onDifficultyToggle,
  onStatusToggle,
  onClear,
  totalFiltered,
  totalAll,
  availableModules,
}: FilterPanelProps) {
  const hasFilters =
    selectedModules.length > 0 || selectedDifficulties.length > 0 || selectedStatuses.length > 0

  return (
    <aside
      style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          筛选
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            style={{
              fontSize: 12,
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            清除全部
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        显示 <span style={{ fontWeight: 600, color: 'var(--text)' }}>{totalFiltered}</span> /{' '}
        {totalAll} 题
      </div>

      {/* Module */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            模块
          </p>
          {/* Show badge when custom modules exist */}
          {availableModules.some((m) => !(BUILTIN_MODULES as readonly string[]).includes(m)) && (
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid rgba(var(--primary-rgb),0.2)',
              }}
            >
              含自定义
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {availableModules.map((mod) => {
            const active = selectedModules.includes(mod)
            const subjectLabel = BUILTIN_MODULE_SUBJECT[mod] ?? null
            const bucketLabel = BUILTIN_MODULE_BUCKET[mod] ?? null
            const isCustom = !(BUILTIN_MODULES as readonly string[]).includes(mod)
            return (
              <button
                type="button"
                key={mod}
                onClick={() => onModuleToggle(mod)}
                className="questionlist-module-button"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--primary)' : 'var(--text-2)',
                  background: active ? 'var(--primary-light)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--text-2)'
                  }
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 5,
                  }}
                >
                  <span
                    className="questionlist-module-label"
                    style={{
                      width: '100%',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}
                  >
                    {mod}
                  </span>
                  {(subjectLabel || bucketLabel || isCustom) && (
                    <span
                      className="questionlist-module-meta"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      {subjectLabel && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: active ? 'rgba(255,255,255,0.2)' : 'var(--surface-3)',
                            color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-3)',
                            flexShrink: 0,
                          }}
                        >
                          {subjectLabel}
                        </span>
                      )}
                      {bucketLabel && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: active ? 'rgba(255,255,255,0.2)' : 'var(--surface-3)',
                            color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-3)',
                            flexShrink: 0,
                          }}
                        >
                          {bucketLabel}
                        </span>
                      )}
                      {isCustom && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: active ? 'rgba(255,255,255,0.2)' : 'var(--surface-3)',
                            color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-3)',
                            flexShrink: 0,
                          }}
                        >
                          自定义
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {active && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-3)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          难度
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([1, 2, 3] as Difficulty[]).map((d) => {
            const active = selectedDifficulties.includes(d)
            return (
              <button
                type="button"
                key={d}
                onClick={() => onDifficultyToggle(d)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: active ? 'var(--surface-2)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = active
                    ? 'var(--surface-2)'
                    : 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid',
                    color: DIFFICULTY_STYLES[d].color,
                    background: DIFFICULTY_STYLES[d].background,
                    borderColor: DIFFICULTY_STYLES[d].borderColor,
                  }}
                >
                  {DIFFICULTY_LABELS[d]}
                </span>
                {active && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--primary)', marginLeft: 'auto' }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Status */}
      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-3)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          学习状态
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(['unlearned', 'review', 'mastered'] as StudyStatus[]).map((s) => {
            const active = selectedStatuses.includes(s)
            return (
              <button
                type="button"
                key={s}
                onClick={() => onStatusToggle(s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: active ? 'var(--surface-2)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = active
                    ? 'var(--surface-2)'
                    : 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid',
                    color: STATUS_STYLES[s].color,
                    background: STATUS_STYLES[s].background,
                    borderColor: STATUS_STYLES[s].borderColor,
                  }}
                >
                  {STATUS_LABELS[s]}
                </span>
                {active && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--primary)', marginLeft: 'auto' }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

void FilterPanel

interface DirectoryBucketGroup {
  key: string
  label: string
  modules: Module[]
}

interface DirectorySubjectGroup {
  key: string
  label: string
  modules: Module[]
  buckets: DirectoryBucketGroup[]
}

interface DirectoryCustomGroup {
  key: string
  label: string
  modules: Module[]
}

interface DirectoryFilterPanelProps {
  selectedModules: Module[]
  selectedDifficulties: Difficulty[]
  selectedStatuses: StudyStatus[]
  onModuleToggle: (module: Module) => void
  onModuleGroupToggle: (modules: Module[]) => void
  onDifficultyToggle: (difficulty: Difficulty) => void
  onStatusToggle: (status: StudyStatus) => void
  onClear: () => void
  totalFiltered: number
  totalAll: number
  directorySubjects: DirectorySubjectGroup[]
  customGroups: DirectoryCustomGroup[]
  moduleQuestionCounts: Record<string, number>
}

function DirectoryFilterPanel({
  selectedModules,
  selectedDifficulties,
  selectedStatuses,
  onModuleToggle,
  onModuleGroupToggle,
  onDifficultyToggle,
  onStatusToggle,
  onClear,
  totalFiltered,
  totalAll,
  directorySubjects,
  customGroups,
  moduleQuestionCounts,
}: DirectoryFilterPanelProps) {
  const hasFilters =
    selectedModules.length > 0 || selectedDifficulties.length > 0 || selectedStatuses.length > 0
  const selectedSet = useMemo(() => new Set(selectedModules), [selectedModules])

  const countQuestions = useCallback(
    (modules: Module[]) =>
      modules.reduce((sum, module) => sum + (moduleQuestionCounts[module] ?? 0), 0),
    [moduleQuestionCounts],
  )

  const renderGroupAction = useCallback(
    (modules: Module[]) => {
      const allSelected = modules.length > 0 && modules.every((module) => selectedSet.has(module))
      const someSelected = modules.some((module) => selectedSet.has(module))

      return (
        <button
          type="button"
          onClick={() => onModuleGroupToggle(modules)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: allSelected || someSelected ? 'var(--primary)' : 'var(--text-3)',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              border:
                allSelected || someSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: allSelected
                ? 'var(--primary)'
                : someSelected
                  ? 'var(--primary-light)'
                  : 'transparent',
              color: allSelected ? 'white' : 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {allSelected ? (
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : someSelected ? (
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            ) : null}
          </span>
          <span>{allSelected ? '清空' : someSelected ? '补齐' : '全选'}</span>
        </button>
      )
    },
    [onModuleGroupToggle, selectedSet],
  )

  const renderModuleButton = useCallback(
    (module: Module) => {
      const active = selectedSet.has(module)
      const questionCount = moduleQuestionCounts[module] ?? 0

      return (
        <button
          type="button"
          key={module}
          onClick={() => onModuleToggle(module)}
          className="questionlist-module-button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 10px',
            borderRadius: 10,
            border: active
              ? '1px solid rgba(var(--primary-rgb), 0.28)'
              : '1px solid var(--border-subtle)',
            background: active ? 'var(--primary-light)' : 'var(--surface)',
            color: active ? 'var(--primary)' : 'var(--text-2)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(event) => {
            if (!active) {
              event.currentTarget.style.background = 'var(--surface-2)'
              event.currentTarget.style.color = 'var(--text)'
            }
          }}
          onMouseLeave={(event) => {
            if (!active) {
              event.currentTarget.style.background = 'var(--surface)'
              event.currentTarget.style.color = 'var(--text-2)'
            }
          }}
        >
          <span
            className="questionlist-module-label"
            style={{
              flex: 1,
              minWidth: 0,
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {module}
          </span>
          <span
            style={{
              minWidth: 28,
              padding: '2px 6px',
              borderRadius: 999,
              background: active ? 'rgba(var(--primary-rgb), 0.12)' : 'var(--surface-3)',
              color: active ? 'var(--primary)' : 'var(--text-3)',
              fontSize: 11,
              fontWeight: 600,
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {questionCount}
          </span>
        </button>
      )
    },
    [moduleQuestionCounts, onModuleToggle, selectedSet],
  )

  const totalCustomModules = customGroups.reduce((sum, group) => sum + group.modules.length, 0)
  const totalCustomQuestions = countQuestions(customGroups.flatMap((group) => group.modules))

  return (
    <aside
      style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          筛选
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            style={{
              fontSize: 12,
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            清空全部
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        显示 <span style={{ fontWeight: 600, color: 'var(--text)' }}>{totalFiltered}</span> /{' '}
        {totalAll} 题
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            目录浏览
          </p>
          {customGroups.length > 0 && (
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 999,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid rgba(var(--primary-rgb), 0.2)',
              }}
            >
              含自定义
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {directorySubjects.map((subject) => (
            <section
              key={subject.key}
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                background: 'var(--surface)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {subject.label}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {subject.modules.length} 个模块 · {countQuestions(subject.modules)} 题
                  </p>
                </div>
                {renderGroupAction(subject.modules)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subject.buckets.map((bucket) => (
                  <div
                    key={bucket.key}
                    style={{
                      paddingTop: 10,
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                          {bucket.label}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                          {bucket.modules.length} 个模块 · {countQuestions(bucket.modules)} 题
                        </p>
                      </div>
                      {renderGroupAction(bucket.modules)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {bucket.modules.map(renderModuleButton)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {customGroups.length > 0 && (
            <section
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                background: 'var(--surface)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>自定义题库</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  {totalCustomModules} 个模块 · {totalCustomQuestions} 题
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {customGroups.map((group) => (
                  <div
                    key={group.key}
                    style={{
                      paddingTop: 10,
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                          {group.label}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                          {group.modules.length} 个模块 · {countQuestions(group.modules)} 题
                        </p>
                      </div>
                      {renderGroupAction(group.modules)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.modules.map(renderModuleButton)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-3)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          难度
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([1, 2, 3] as Difficulty[]).map((difficulty) => {
            const active = selectedDifficulties.includes(difficulty)
            return (
              <button
                type="button"
                key={difficulty}
                onClick={() => onDifficultyToggle(difficulty)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: active ? 'var(--surface-2)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = active
                    ? 'var(--surface-2)'
                    : 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid',
                    color: DIFFICULTY_STYLES[difficulty].color,
                    background: DIFFICULTY_STYLES[difficulty].background,
                    borderColor: DIFFICULTY_STYLES[difficulty].borderColor,
                  }}
                >
                  {DIFFICULTY_LABELS[difficulty]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-3)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          学习状态
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(['unlearned', 'review', 'mastered'] as StudyStatus[]).map((status) => {
            const active = selectedStatuses.includes(status)
            return (
              <button
                type="button"
                key={status}
                onClick={() => onStatusToggle(status)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: active ? 'var(--surface-2)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = active
                    ? 'var(--surface-2)'
                    : 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid',
                    color: STATUS_STYLES[status].color,
                    background: STATUS_STYLES[status].background,
                    borderColor: STATUS_STYLES[status].borderColor,
                  }}
                >
                  {STATUS_LABELS[status]}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

interface QuestionCardProps {
  question: {
    id: string
    module: Module
    difficulty: Difficulty
    type: QuestionType
    question: string
    tags: string[]
    source?: string
  }
  status: StudyStatus
  index: number
}

function QuestionCard({ question: q, status, index }: QuestionCardProps) {
  return (
    <Link
      to={`/questions/${q.id}`}
      className="animate-fade-in card card-interactive"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 16px',
        textDecoration: 'none',
        animationDelay: `${Math.min(index * 0.025, 0.3)}s`,
      }}
    >
      {/* Status indicator strip */}
      <div
        style={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: 99,
          flexShrink: 0,
          background:
            status === 'mastered'
              ? 'var(--success)'
              : status === 'review'
                ? 'var(--warning)'
                : 'var(--border)',
          opacity: status === 'unlearned' ? 0.4 : 1,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Question text */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text)',
            lineHeight: 1.55,
            marginBottom: 8,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {q.question}
        </p>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {/* Module */}
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{q.module}</span>

          <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>

          {/* Difficulty */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 5,
              border: '1px solid',
              color: DIFFICULTY_STYLES[q.difficulty].color,
              background: DIFFICULTY_STYLES[q.difficulty].background,
              borderColor: DIFFICULTY_STYLES[q.difficulty].borderColor,
            }}
          >
            {DIFFICULTY_LABELS[q.difficulty]}
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 5,
              border: '1px solid',
              color: QUESTION_TYPE_STYLES[q.type].color,
              background: QUESTION_TYPE_STYLES[q.type].background,
              borderColor: QUESTION_TYPE_STYLES[q.type].borderColor,
            }}
          >
            {QUESTION_TYPE_LABELS[q.type]}
          </span>

          {/* Status badge */}
          {status !== 'unlearned' && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '2px 7px',
                borderRadius: 5,
                border: '1px solid',
                color: STATUS_STYLES[status].color,
                background: STATUS_STYLES[status].background,
                borderColor: STATUS_STYLES[status].borderColor,
              }}
            >
              {STATUS_LABELS[status]}
            </span>
          )}

          {/* Source */}
          {q.source && (
            <span
              style={{
                fontSize: 11,
                padding: '1px 7px',
                borderRadius: 5,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid rgba(var(--primary-rgb), 0.2)',
              }}
            >
              {q.source}
            </span>
          )}

          {/* Tags (first 2 only) */}
          {q.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                padding: '1px 7px',
                borderRadius: 5,
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-3)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Arrow */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-3)' }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        'question-list-skeleton-1',
        'question-list-skeleton-2',
        'question-list-skeleton-3',
        'question-list-skeleton-4',
        'question-list-skeleton-5',
        'question-list-skeleton-6',
        'question-list-skeleton-7',
        'question-list-skeleton-8',
      ].map((key) => (
        <div
          key={key}
          className="card"
          style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <Skeleton width={3} height={52} rounded="sm" />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Skeleton width="75%" height={14} />
            <Skeleton width="45%" height={12} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sort Button ──────────────────────────────────────────────────────────────

type SortOption = {
  value: string
  label: string
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'default', label: '默认排序' },
  { value: 'difficulty-asc', label: '难度↑' },
  { value: 'difficulty-desc', label: '难度↓' },
  { value: 'module', label: '按模块' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30

export default function QuestionList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { allQuestions, initializing } = useQuestions()
  const { records, getStatus, hiddenCategories } = useStudyStore()

  // ── Filter state (sync with URL) ──
  const initModules = useMemo(() => {
    const raw = searchParams.get('module')
    return raw ? (raw.split(',').filter(Boolean) as Module[]) : []
  }, [searchParams])

  const [categoryMap, setCategoryMap] = useState<CategoryMap>({ ...DEFAULT_CATEGORY_MAP })

  const [selectedModules, setSelectedModules] = useState<Module[]>(initModules)
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<StudyStatus[]>([])
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [sort, setSort] = useState<string>('default')
  const [page, setPage] = useState(1)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true

    getCategoryMap().then((map) => {
      if (active) {
        setCategoryMap(map)
      }
    })

    return () => {
      active = false
    }
  }, [allQuestions.length])

  const hiddenModules = useMemo(
    () => getHiddenModulesFromCategories(categoryMap, hiddenCategories),
    [categoryMap, hiddenCategories],
  )

  const visibleQuestions = useMemo(
    () => filterQuestionsByHiddenModules(allQuestions, hiddenModules),
    [allQuestions, hiddenModules],
  )

  const hiddenQuestionCount = allQuestions.length - visibleQuestions.length

  // Derive sorted module list from visible questions (built-ins first, then custom alphabetically)
  const availableModules = useMemo<Module[]>(() => {
    const moduleSet = new Set(visibleQuestions.map((q) => q.module))
    const builtins = (BUILTIN_MODULES as readonly string[]).filter((m) => moduleSet.has(m))
    const custom = [...moduleSet]
      .filter((m) => !(BUILTIN_MODULES as readonly string[]).includes(m))
      .sort((a, b) => a.localeCompare(b))
    return [...builtins, ...custom]
  }, [visibleQuestions])

  const moduleQuestionCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const question of visibleQuestions) {
      counts[question.module] = (counts[question.module] ?? 0) + 1
    }
    return counts
  }, [visibleQuestions])

  const directorySubjects = useMemo<DirectorySubjectGroup[]>(() => {
    const activeBuiltinModules = new Set(
      availableModules.filter((module) => (BUILTIN_MODULES as readonly string[]).includes(module)),
    )
    const subjects = new Map<string, DirectorySubjectGroup>()

    for (const category of BUILTIN_CATEGORIES) {
      const modules = category.modules.filter((module): module is Module =>
        activeBuiltinModules.has(module),
      )
      if (modules.length === 0) continue

      const existing = subjects.get(category.subject)
      if (existing) {
        existing.modules.push(...modules)
        existing.buckets.push({
          key: category.category,
          label: category.bucket,
          modules,
        })
        continue
      }

      subjects.set(category.subject, {
        key: category.subjectSlug,
        label: category.subject,
        modules: [...modules],
        buckets: [
          {
            key: category.category,
            label: category.bucket,
            modules,
          },
        ],
      })
    }

    return [...subjects.values()]
  }, [availableModules])

  const customGroups = useMemo<DirectoryCustomGroup[]>(() => {
    const builtinSet = new Set(BUILTIN_MODULES as readonly string[])
    const activeCustomModules = availableModules.filter((module) => !builtinSet.has(module))
    const activeCustomSet = new Set(activeCustomModules)

    const groups = Object.values(categoryMap)
      .filter((category) => !category.builtin)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((category) => ({
        key: category.name,
        label: category.name,
        modules: category.modules.filter((module): module is Module => activeCustomSet.has(module)),
      }))
      .filter((group) => group.modules.length > 0)

    const assigned = new Set(groups.flatMap((group) => group.modules))
    const uncategorized = activeCustomModules.filter((module) => !assigned.has(module))
    if (uncategorized.length > 0) {
      groups.push({
        key: '__custom_other__',
        label: '其他 / 自定义',
        modules: uncategorized,
      })
    }

    return groups
  }, [availableModules, categoryMap])

  // ── Debounced search ──
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // ── Reset page on filter change ──
  useEffect(() => {
    setPage(1)
  }, [selectedModules, selectedDifficulties, selectedStatuses, debouncedSearch, sort])

  // ── Sync URL params ──
  useEffect(() => {
    const params: Record<string, string> = {}
    if (selectedModules.length > 0) params.module = selectedModules.join(',')
    if (debouncedSearch) params.q = debouncedSearch
    setSearchParams(params, { replace: true })
  }, [selectedModules, debouncedSearch, setSearchParams])

  // ── Keyboard shortcut: / to focus search ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement !== searchRef.current &&
        !['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName ?? '')
      ) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Filter helpers ──
  const toggleModule = useCallback((m: Module) => {
    setSelectedModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }, [])

  const toggleModuleGroup = useCallback((modules: Module[]) => {
    setSelectedModules((prev) => {
      const allSelected = modules.length > 0 && modules.every((module) => prev.includes(module))
      if (allSelected) {
        return prev.filter((module) => !modules.includes(module))
      }

      const next = new Set(prev)
      for (const module of modules) {
        next.add(module)
      }
      return [...next]
    })
  }, [])

  const toggleDifficulty = useCallback((d: Difficulty) => {
    setSelectedDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    )
  }, [])

  const toggleStatus = useCallback((s: StudyStatus) => {
    setSelectedStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedModules([])
    setSelectedDifficulties([])
    setSelectedStatuses([])
    setSearch('')
  }, [])

  // ── Filtered questions ──
  const filteredQuestions = useMemo(() => {
    const recordMap = Object.fromEntries(
      Object.entries(records).map(([k, v]) => [k, { status: v.status }]),
    )
    return applyFilters(
      visibleQuestions,
      {
        modules: selectedModules,
        difficulties: selectedDifficulties,
        statuses: selectedStatuses,
        search: debouncedSearch,
      },
      recordMap,
      sort as any,
    )
  }, [
    visibleQuestions,
    selectedModules,
    selectedDifficulties,
    selectedStatuses,
    debouncedSearch,
    sort,
    records,
  ])

  // ── Paginated ──
  const pagedQuestions = filteredQuestions.slice(0, page * PAGE_SIZE)
  const hasMore = pagedQuestions.length < filteredQuestions.length

  // ── Load more on scroll ──
  const loaderRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setPage((p) => p + 1)
      },
      { threshold: 0.1 },
    )
    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [hasMore])

  const hasFilters =
    selectedModules.length > 0 ||
    selectedDifficulties.length > 0 ||
    selectedStatuses.length > 0 ||
    debouncedSearch.length > 0
  const allQuestionsHidden = allQuestions.length > 0 && visibleQuestions.length === 0

  // Keep selectedModules valid when availableModules changes (e.g. after import)
  useEffect(() => {
    setSelectedModules((prev) => prev.filter((m) => availableModules.includes(m)))
  }, [availableModules])

  return (
    <div className="page-container">
      {/* ── Page header ── */}
      <div
        className="animate-fade-in questionlist-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.015em',
            }}
          >
            题库
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            共 {visibleQuestions.length} 道题
            {hiddenQuestionCount > 0 && ` · 已按偏好隐藏 ${hiddenQuestionCount} 道`}
          </p>
        </div>
        <div
          className="questionlist-header-actions"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {/* Mobile filter toggle */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen((v) => !v)}
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13,
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            className="mobile-filter-btn"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            筛选
            {hasFilters && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  display: 'inline-block',
                }}
              />
            )}
          </button>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              fontSize: 13,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="animate-fade-in" style={{ position: 'relative', marginBottom: 16 }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-3)',
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          placeholder="搜索题目、标签或模块…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base"
          style={{
            paddingLeft: 36,
            paddingRight: 60,
            borderRadius: 10,
            boxShadow: 'var(--shadow-xs)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                color: 'var(--text-3)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                padding: 2,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : (
            <span className="kbd">/</span>
          )}
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {hasFilters && (
        <div
          className="animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}
        >
          {selectedModules.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => toggleModule(m)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid rgba(var(--primary-rgb), 0.2)',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {m}
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ))}
          {selectedDifficulties.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => toggleDifficulty(d)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s',
                color: DIFFICULTY_STYLES[d].color,
                background: DIFFICULTY_STYLES[d].background,
                borderColor: DIFFICULTY_STYLES[d].borderColor,
              }}
            >
              {DIFFICULTY_LABELS[d]}
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ))}
          {selectedStatuses.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => toggleStatus(s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s',
                color: STATUS_STYLES[s].color,
                background: STATUS_STYLES[s].background,
                borderColor: STATUS_STYLES[s].borderColor,
              }}
            >
              {STATUS_LABELS[s]}
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ))}
          {debouncedSearch && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--surface-3)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              "{debouncedSearch}"
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="questionlist-main-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Sidebar filter (desktop) ── */}
        <div
          style={{
            position: 'sticky',
            top: 'calc(var(--navbar-h) + 20px)',
            width: 280,
            flexShrink: 0,
            maxHeight: 'calc(100dvh - var(--navbar-h) - 32px)',
            overflowY: 'auto',
            paddingRight: 4,
          }}
          className="ql-sidebar"
        >
          <DirectoryFilterPanel
            selectedModules={selectedModules}
            selectedDifficulties={selectedDifficulties}
            selectedStatuses={selectedStatuses}
            onModuleToggle={toggleModule}
            onModuleGroupToggle={toggleModuleGroup}
            onDifficultyToggle={toggleDifficulty}
            onStatusToggle={toggleStatus}
            onClear={clearFilters}
            totalFiltered={filteredQuestions.length}
            totalAll={visibleQuestions.length}
            directorySubjects={directorySubjects}
            customGroups={customGroups}
            moduleQuestionCounts={moduleQuestionCounts}
          />
        </div>

        {/* ── Mobile filter drawer ── */}
        {mobileFilterOpen && (
          <>
            <button
              type="button"
              aria-label="关闭筛选面板"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 40,
                background: 'rgba(0,0,0,0.2)',
                backdropFilter: 'blur(2px)',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
              }}
              onClick={() => setMobileFilterOpen(false)}
            />
            <div
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
              }}
              className="animate-slide-up"
            >
              <div
                className="glass questionlist-mobile-filter-sheet"
                style={{
                  borderRadius: '18px 18px 0 0',
                  padding: 20,
                  boxShadow: 'var(--shadow-xl)',
                  maxHeight: '80dvh',
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: 'var(--text)',
                    }}
                  >
                    筛选
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setMobileFilterOpen(false)}>
                    完成
                  </Button>
                </div>
                <DirectoryFilterPanel
                  selectedModules={selectedModules}
                  selectedDifficulties={selectedDifficulties}
                  selectedStatuses={selectedStatuses}
                  onModuleToggle={toggleModule}
                  onModuleGroupToggle={toggleModuleGroup}
                  onDifficultyToggle={toggleDifficulty}
                  onStatusToggle={toggleStatus}
                  onClear={clearFilters}
                  totalFiltered={filteredQuestions.length}
                  totalAll={visibleQuestions.length}
                  directorySubjects={directorySubjects}
                  customGroups={customGroups}
                  moduleQuestionCounts={moduleQuestionCounts}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Question list ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {initializing ? (
            <ListSkeleton />
          ) : filteredQuestions.length === 0 ? (
            <div className="card">
              <EmptyState
                title={
                  allQuestionsHidden ? '题库已全部隐藏' : hasFilters ? '没有匹配的题目' : '题库为空'
                }
                description={
                  allQuestionsHidden
                    ? '请在「设置 → 刷题偏好 → 题库展示」中打开至少一个题库'
                    : hasFilters
                      ? '试试调整筛选条件或清除搜索词'
                      : '请前往「导入题目」页面加载题库'
                }
                action={
                  allQuestionsHidden ? undefined : hasFilters ? (
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      清除筛选
                    </Button>
                  ) : (
                    <Link to="/import">
                      <Button variant="primary" size="sm">
                        去导入
                      </Button>
                    </Link>
                  )
                }
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pagedQuestions.map((q, i) => (
                <QuestionCard key={q.id} question={q} status={getStatus(q.id)} index={i} />
              ))}

              {/* Infinite scroll loader */}
              {hasMore && (
                <div ref={loaderRef} style={{ paddingTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      'question-list-loader-skeleton-1',
                      'question-list-loader-skeleton-2',
                      'question-list-loader-skeleton-3',
                    ].map((key) => (
                      <div
                        key={key}
                        className="card"
                        style={{
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 14,
                        }}
                      >
                        <Skeleton width={3} height={48} rounded="sm" />
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <Skeleton width="70%" height={13} />
                          <Skeleton width="40%" height={11} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasMore && filteredQuestions.length > PAGE_SIZE && (
                <p
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--text-3)',
                    paddingTop: 16,
                  }}
                >
                  已显示全部 {filteredQuestions.length} 道题
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
				.questionlist-module-label {
					display: -webkit-box;
					-webkit-line-clamp: 2;
					-webkit-box-orient: vertical;
					overflow: hidden;
				}
				@media (max-width: 768px) {
					.ql-sidebar { display: none !important; }
					.mobile-filter-btn { display: flex !important; }
					.questionlist-main-layout {
						gap: 16px !important;
					}
					.questionlist-mobile-filter-sheet {
						padding: 16px 14px 20px !important;
						max-height: 85dvh !important;
					}
					.questionlist-module-label {
						display: block !important;
						-webkit-line-clamp: unset !important;
						overflow: visible !important;
					}
				}
				@media (max-width: 640px) {
					.questionlist-header {
						flex-direction: column;
						align-items: flex-start !important;
						gap: 12px;
					}
					.questionlist-header-actions {
						width: 100%;
						justify-content: space-between;
					}
					.questionlist-module-button {
						padding-top: 8px !important;
						padding-bottom: 8px !important;
					}
				}
				@media (max-width: 480px) {
					.questionlist-header-actions {
						gap: 6px !important;
					}
					.questionlist-mobile-filter-sheet {
						padding: 14px 12px 18px !important;
					}
				}
			`}</style>
    </div>
  )
}
