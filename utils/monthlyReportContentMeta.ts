/**
 * Aggregate todos, agreements, @mentions, and #tags from a monthly report document.
 */

import { parseBlockAgrees, parseBlockTodos } from '~/lib/utils/blockTodoParser'
import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { MonthlyReportDocument, MonthlyReportSectionKey } from '~/types/monthlyReportDocument'
import { MONTHLY_REPORT_SECTION_KEYS } from '~/types/monthlyReportDocument'

export const MONTHLY_REPORT_SECTION_LABELS: Record<MonthlyReportSectionKey, string> = {
  kpi: 'KPI',
  staff: 'Staff General',
  productSales: 'Product Sales',
  labor: 'Labor Productivity',
  revenuePnl: 'Revenue + COGS + Results',
}

export type MonthlyReportTodoItem = BlockTodo & {
  sectionKey: MonthlyReportSectionKey
  sectionLabel: string
}

export type MonthlyReportAgreeItem = BlockAgree & {
  sectionKey: MonthlyReportSectionKey
  sectionLabel: string
}

function mentionSlugsFromHtml(html: string): string[] {
  const raw = html.replace(/<[^>]+>/g, ' ')
  const matches = raw.match(/@([a-zA-Z0-9_-]+)/g)
  if (!matches) return []
  return matches
    .map((m) => m.slice(1).toLowerCase())
    .filter((s) => s !== 'todo')
}

function tagsFromHtml(html: string): string[] {
  const raw = html.replace(/<[^>]+>/g, ' ')
  const matches = raw.match(/#([a-zA-Z0-9_-]+)/g)
  if (!matches) return []
  return matches.map((m) => m.slice(1).trim().toLowerCase()).filter(Boolean)
}

export function aggregateMonthlyReportTodos(doc: MonthlyReportDocument): MonthlyReportTodoItem[] {
  const items: MonthlyReportTodoItem[] = []
  for (const key of MONTHLY_REPORT_SECTION_KEYS) {
    const section = doc.sections[key]
    const label = MONTHLY_REPORT_SECTION_LABELS[key]
    const todos = parseBlockTodos(section.text, section.todos)
    for (const todo of todos) {
      items.push({ ...todo, sectionKey: key, sectionLabel: label })
    }
  }
  return items
}

export function aggregateMonthlyReportAgrees(doc: MonthlyReportDocument): MonthlyReportAgreeItem[] {
  const items: MonthlyReportAgreeItem[] = []
  for (const key of MONTHLY_REPORT_SECTION_KEYS) {
    const section = doc.sections[key]
    const label = MONTHLY_REPORT_SECTION_LABELS[key]
    const agrees = parseBlockAgrees(section.text, section.agrees)
    for (const agree of agrees) {
      items.push({ ...agree, sectionKey: key, sectionLabel: label })
    }
  }
  return items
}

export function collectMentionSlugsFromMonthlyReport(doc: MonthlyReportDocument): string[] {
  const slugs = new Set<string>()
  for (const key of MONTHLY_REPORT_SECTION_KEYS) {
    const section = doc.sections[key]
    for (const slug of mentionSlugsFromHtml(section.text)) slugs.add(slug)
    for (const todo of section.todos) {
      if (todo.assignedTo) slugs.add(todo.assignedTo.toLowerCase())
      for (const s of mentionSlugsFromHtml(todo.text)) slugs.add(s)
    }
  }
  return [...slugs]
}

export function collectTagsFromMonthlyReport(doc: MonthlyReportDocument): string[] {
  const tags = new Set<string>()
  for (const key of MONTHLY_REPORT_SECTION_KEYS) {
    for (const tag of tagsFromHtml(doc.sections[key].text)) tags.add(tag)
  }
  return [...tags]
}
