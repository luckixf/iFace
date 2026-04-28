import type { Difficulty, QuestionType } from '@/types'

type ImportedQuestion = Record<string, unknown>

const TYPE_ALIASES: Record<string, QuestionType> = {
  single: 'single',
  'single-choice': 'single',
  radio: 'single',
  '单选': 'single',
  '单选题': 'single',
  multiple: 'multiple',
  'multiple-choice': 'multiple',
  checkbox: 'multiple',
  '多选': 'multiple',
  '多选题': 'multiple',
  essay: 'essay',
  answer: 'essay',
  subjective: 'essay',
  '解答': 'essay',
  '解答题': 'essay',
  '简答': 'essay',
  '简答题': 'essay',
  '案例': 'essay',
  '案例题': 'essay',
}

const DIFFICULTY_ALIASES: Record<string, Difficulty> = {
  '1': 1,
  easy: 1,
  basic: 1,
  '基础': 1,
  '入门': 1,
  '2': 2,
  medium: 2,
  normal: 2,
  '综合': 2,
  '中等': 2,
  '3': 3,
  hard: 3,
  advanced: 3,
  '案例': 3,
  '提高': 3,
}

function getField(block: string, keys: string[]): string {
  for (const key of keys) {
    const pattern = new RegExp(
      String.raw`(?:^|\n)(?:\*\*${key}\*\*|${key})\s*[:：]\s*(.+)`,
      'i',
    )
    const match = block.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

function stripMetaLines(block: string): string {
  return block
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (/^#{2,}\s*/.test(trimmed)) return false
      return !/^(?:\*\*)?(?:模块|module|难度|difficulty|题型|类型|type|标签|tags|来源|source|ID|id|正确答案|答案键|correctAnswers?)(?:\*\*)?\s*[:：]/i.test(
        trimmed,
      )
    })
    .join('\n')
    .trim()
}

function parseOptions(text: string): { options: { key: string; text: string }[]; rest: string } {
  const optionLines = text.split('\n')
  const options: { key: string; text: string }[] = []
  const rest: string[] = []

  for (const line of optionLines) {
    const match = line.trim().match(/^([A-H])[\.\u3001\uFF0E:：]\s*(.+)$/)
    if (match) {
      options.push({ key: match[1], text: match[2].trim() })
    } else {
      rest.push(line)
    }
  }

  return { options, rest: rest.join('\n').trim() }
}

function parseAnswerAndAnalysis(text: string): string {
  const explicit = text.match(
    /(?:^|\n)(?:#{2,}\s*)?(?:参考答案|答案|解析)\s*[:：]?\s*\n?([\s\S]+)$/i,
  )
  if (explicit?.[1]?.trim()) return explicit[1].trim()
  return text.trim()
}

function parseCorrectAnswers(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(/[\s,，、/]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

export function mdToQuestions(md: string): {
  questions: ImportedQuestion[]
  errors: string[]
} {
  const questions: ImportedQuestion[] = []
  const errors: string[] = []

  const blocks = md
    .split(/\n(?:---|\*\*\*)\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]
    const titleMatch = block.match(/^#{2,}\s*(?:Q[:：]\s*|题目[:：]\s*|\d+[.、]\s*)?(.+)$/m)
    if (!titleMatch?.[1]?.trim()) {
      errors.push(`第 ${index + 1} 个区块缺少题目标题，请使用 "## 题目内容" 的格式。`)
      continue
    }

    const questionText = titleMatch[1].trim().replace(/^\*+|\*+$/g, '').trim()
    const module = getField(block, ['模块', 'module'])
    if (!module) {
      errors.push(`第 ${index + 1} 个区块缺少模块字段。`)
      continue
    }

    const rawDifficulty = getField(block, ['难度', 'difficulty'])
    const difficulty =
      DIFFICULTY_ALIASES[rawDifficulty.toLowerCase().trim()] ??
      DIFFICULTY_ALIASES[rawDifficulty.trim()] ??
      2

    const rawType = getField(block, ['题型', '类型', 'type'])
    const type =
      TYPE_ALIASES[rawType.toLowerCase().trim()] ?? TYPE_ALIASES[rawType.trim()] ?? 'essay'

    const tags = getField(block, ['标签', 'tags'])
      .split(/[,\uFF0C\u3001]/)
      .map((tag) => tag.trim())
      .filter(Boolean)

    const source = getField(block, ['来源', 'source'])
    const rawId = getField(block, ['ID', 'id'])
    const correctAnswers = parseCorrectAnswers(
      getField(block, ['正确答案', '答案键', 'correctAnswer', 'correctAnswers']),
    )

    const content = stripMetaLines(block)
    const { options, rest } = parseOptions(content)
    const answer = parseAnswerAndAnalysis(rest)

    if (!answer) {
      errors.push(`第 ${index + 1} 个区块缺少答案或解析内容。`)
      continue
    }

    if ((type === 'single' || type === 'multiple') && options.length === 0) {
      errors.push(`第 ${index + 1} 个区块被标记为选择题，但没有解析出选项。`)
      continue
    }

    if (type === 'single' && correctAnswers.length > 1) {
      errors.push(`第 ${index + 1} 个区块是单选题，但提供了多个正确答案。`)
      continue
    }

    const record: ImportedQuestion = {
      id: rawId || `md-${String(index + 1).padStart(3, '0')}`,
      module,
      difficulty,
      type,
      question: questionText,
      answer,
      tags,
    }

    if (source) record.source = source
    if (options.length > 0) record.options = options
    if (correctAnswers.length > 0) record.correctAnswers = correctAnswers

    questions.push(record)
  }

  return { questions, errors }
}
