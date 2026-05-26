import {
  GENERATED_BUILTIN_CATEGORIES,
  GENERATED_BUILTIN_MODULE_BUCKET,
  GENERATED_BUILTIN_MODULE_CATEGORY,
  GENERATED_BUILTIN_MODULES,
  GENERATED_BUILTIN_MODULE_SUBJECT,
} from '@/generated/constructionBank'

export const BUILTIN_MODULES: readonly string[] = GENERATED_BUILTIN_MODULES

export const BUILTIN_MODULE_CATEGORY: Record<string, string> = {
  ...GENERATED_BUILTIN_MODULE_CATEGORY,
}

export const BUILTIN_MODULE_SUBJECT: Record<string, string> = {
  ...GENERATED_BUILTIN_MODULE_SUBJECT,
}

export const BUILTIN_MODULE_BUCKET: Record<string, string> = {
  ...GENERATED_BUILTIN_MODULE_BUCKET,
}

export const MODULE_LIST: string[] = [...GENERATED_BUILTIN_MODULES]

export type Module = string

export type Difficulty = 1 | 2 | 3

export type StudyStatus = 'unlearned' | 'mastered' | 'review'

export type QuestionType = 'single' | 'multiple' | 'essay'

export interface QuestionOption {
  key: string
  text: string
}

export interface Question {
  id: string
  module: Module
  difficulty: Difficulty
  type: QuestionType
  question: string
  answer: string
  tags: string[]
  source?: string
  options?: QuestionOption[]
  correctAnswers?: string[]
  questionImages?: string[]
}

export interface StudyRecord {
  questionId: string
  status: StudyStatus
  lastUpdated: number
  reviewCount: number
}

export type StudyRecordMap = Record<string, StudyRecord>

export interface FilterState {
  modules: Module[]
  difficulties: Difficulty[]
  statuses: StudyStatus[]
  search: string
}

export interface PracticeSession {
  module: Module | null
  difficulty: Difficulty | null
  questionIds: string[]
  currentIndex: number
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '基础',
  2: '综合',
  3: '案例',
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  1: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  2: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  3: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
}

export const DIFFICULTY_STYLES: Record<
  Difficulty,
  { color: string; background: string; borderColor: string }
> = {
  1: { color: '#37b987', background: 'rgba(55,185,135,0.13)', borderColor: 'rgba(55,185,135,0.22)' },
  2: { color: '#e8893d', background: 'rgba(243,155,74,0.14)', borderColor: 'rgba(243,155,74,0.24)' },
  3: { color: '#f05e86', background: 'rgba(240,94,134,0.13)', borderColor: 'rgba(240,94,134,0.24)' },
}

export const STATUS_LABELS: Record<StudyStatus, string> = {
  unlearned: '未学习',
  mastered: '已掌握',
  review: '待复习',
}

export const STATUS_COLORS: Record<StudyStatus, string> = {
  unlearned: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  mastered: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  review: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
}

export const STATUS_STYLES: Record<
  StudyStatus,
  { color: string; background: string; borderColor: string }
> = {
  unlearned: {
    color: '#a1a1aa',
    background: 'rgba(113,113,122,0.1)',
    borderColor: 'rgba(113,113,122,0.2)',
  },
  mastered: {
    color: '#10b981',
    background: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  review: {
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.2)',
  },
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  essay: '解答',
}

export const QUESTION_TYPE_STYLES: Record<
  QuestionType,
  { color: string; background: string; borderColor: string }
> = {
  single: {
    color: '#ff5da5',
    background: 'rgba(255,111,174,0.13)',
    borderColor: 'rgba(255,111,174,0.24)',
  },
  multiple: {
    color: '#8f6ff0',
    background: 'rgba(157,123,255,0.13)',
    borderColor: 'rgba(157,123,255,0.24)',
  },
  essay: {
    color: '#dd6f9f',
    background: 'rgba(224,160,192,0.16)',
    borderColor: 'rgba(224,160,192,0.28)',
  },
}

const CATEGORY_ICONS: Record<string, string> = {
  章节精讲: '🧱',
  历年真题: '🛣️',
  模拟试卷: '📝',
}

export function getModuleIcon(module: string): string {
  return CATEGORY_ICONS[BUILTIN_MODULE_BUCKET[module] ?? ''] ?? '📚'
}

const _paletteColors = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#ea580c',
  '#0f766e',
]

export function getModuleColor(module: string): string {
  let hash = 0
  for (let i = 0; i < module.length; i++) {
    hash = (hash * 31 + module.charCodeAt(i)) >>> 0
  }
  return _paletteColors[hash % _paletteColors.length]
}

export const BUILTIN_CATEGORIES = GENERATED_BUILTIN_CATEGORIES
