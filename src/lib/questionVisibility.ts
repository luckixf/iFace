import type { CategoryMap } from '@/lib/db'

export function getHiddenModulesFromCategories(
  categoryMap: CategoryMap,
  hiddenCategories: Set<string>,
): Set<string> {
  const modules = new Set<string>()
  if (hiddenCategories.size === 0) return modules

  for (const [categoryKey, category] of Object.entries(categoryMap)) {
    if (!hiddenCategories.has(categoryKey) && !hiddenCategories.has(category.name)) continue
    for (const module of category.modules) modules.add(module)
  }

  return modules
}

export function filterQuestionsByHiddenModules<T extends { module: string }>(
  questions: T[],
  hiddenModules: Set<string>,
): T[] {
  if (hiddenModules.size === 0) return questions
  return questions.filter((question) => !hiddenModules.has(question.module))
}
