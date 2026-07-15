/**
 * Aggregate todos, agreements, @mentions, and #tags from a weekly report document.
 */

import { parseBlockAgrees, parseBlockTodos } from '~/lib/utils/blockTodoParser'
import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { WeeklyReportDocument, WeeklyReportSectionKey } from '~/types/weeklyReportDocument'
import { WEEKLY_REPORT_SECTION_KEYS } from '~/types/weeklyReportDocument'

export const WEEKLY_REPORT_SECTION_LABELS: Record<WeeklyReportSectionKey, string> = {
  kpi: 'KPI',
  staff: 'Staff General',
  productSales: 'Product Sales',
  labor: 'Labor Productivity',
  revenuePnl: 'Revenue + COGS + Results',
}

export type WeeklyReportTodoItem = BlockTodo & {
  sectionKey: WeeklyReportSectionKey
  sectionLabel: string
}

export type WeeklyReportAgreeItem = BlockAgree & {
  sectionKey: WeeklyReportSectionKey
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

export function aggregateWeeklyReportTodos(doc: WeeklyReportDocument): WeeklyReportTodoItem[] {
  const items: WeeklyReportTodoItem[] = []
  for (const key of WEEKLY_REPORT_SECTION_KEYS) {
    const section = doc.sections[key]
    const label = WEEKLY_REPORT_SECTION_LABELS[key]
    const todos = parseBlockTodos(section.text, section.todos)
    for (const todo of todos) {
      items.push({ ...todo, sectionKey: key, sectionLabel: label })
    }
  }
  return items
}

export function aggregateWeeklyReportAgrees(doc: WeeklyReportDocument): WeeklyReportAgreeItem[] {
  const items: WeeklyReportAgreeItem[] = []
  for (const key of WEEKLY_REPORT_SECTION_KEYS) {
    const section = doc.sections[key]
    const label = WEEKLY_REPORT_SECTION_LABELS[key]
    const agrees = parseBlockAgrees(section.text, section.agrees)
    for (const agree of agrees) {
      items.push({ ...agree, sectionKey: key, sectionLabel: label })
    }
  }
  return items
}

export function collectMentionSlugsFromWeeklyReport(doc: WeeklyReportDocument): string[] {
  const slugs = new Set<string>()
  for (const key of WEEKLY_REPORT_SECTION_KEYS) {
    const section = doc.sections[key]
    for (const slug of mentionSlugsFromHtml(section.text)) slugs.add(slug)
    for (const todo of section.todos) {
      if (todo.assignedTo) slugs.add(todo.assignedTo.toLowerCase())
      for (const s of mentionSlugsFromHtml(todo.text)) slugs.add(s)
    }
  }
  return [...slugs]
}

export function collectTagsFromWeeklyReport(doc: WeeklyReportDocument): string[] {
  const tags = new Set<string>()
  for (const key of WEEKLY_REPORT_SECTION_KEYS) {
    for (const tag of tagsFromHtml(doc.sections[key].text)) tags.add(tag)
  }
  return [...tags]
}
