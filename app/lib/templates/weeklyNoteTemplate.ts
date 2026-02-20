/**
 * @registry-id: weeklyNoteTemplate
 * @created: 2026-02-19T00:00:00.000Z
 * @last-modified: 2026-02-19T00:00:00.000Z
 * @description: Weekly meeting note template - blocks match email format (RECAP, CHECK-IN, etc.)
 *
 * @exports-to:
 *   ✓ app/components/notes/NoteEditorV2.tsx
 */

import type { NoteBlock } from '@/lib/types/noteBlock.types'
import { createEmptyBlock } from '@/lib/types/noteBlock.types'

function block(id: string, title: string, content: string): NoteBlock {
  return {
    ...createEmptyBlock(),
    id,
    title,
    content,
    todos: [],
  }
}

/** Returns blocks for the weekly MT template (Recap, Check-in, Operationeel, Financien, Gastbeleving, Events, Verbeterpunten). */
export function getWeeklyTemplateBlocks(): NoteBlock[] {
  const prefix = 'weekly-'
  return [
    block(
      `${prefix}recap-intro`,
      'RECAP VORIGE NOTULEN (5 MIN)',
      `<p>→ Wat is afgerond en hoe?</p><p></p><hr><p></p>`
    ),
    block(
      `${prefix}header`,
      'Header',
      `<p><strong>[Locatie]</strong> <strong>[Datum]</strong> | Wekelijks MT</p><p>Aanwezig: </p><p></p>`
    ),
    block(
      `${prefix}checkin`,
      'CHECK-IN (5 MIN)',
      `<p></p>`
    ),
    block(
      `${prefix}recap`,
      'RECAP VORIGE NOTULEN (5 MIN)',
      `<p>→ Wat is afgerond en hoe?</p><p></p><p>→ Wat staat nog open?</p><p></p>`
    ),
    block(
      `${prefix}rooster`,
      'OPERATIONEEL ROOSTER (15-20 MIN)',
      `<p>→ Roosters Komende 7 Dagen: Planning, gaten, ziektes, nieuwe instromers</p><p></p><p>→ Leveranciers: klachten, vertraging, alternatief nodig?</p><p></p><p>→ Incidenten: klachten, no-shows, interne fricties</p><p></p><p>→ Team: wie is moe, wie moet extra aandacht krijgen?</p><p></p>`
    ),
    block(
      `${prefix}financien`,
      'OPERATIONEEL FINANCIEN (15-20 MIN)',
      `<p>→ Financiën Vorige Week: Totale Omzet, Arbeidsproductiviteit &amp; Arbeidskosten</p><p></p><p>→ Financiën Verbeter en Aandachtspunten: Roosteren, Afbellen, etc.</p><p></p>`
    ),
    block(
      `${prefix}gastbeleving`,
      'GASTBELEVING (5-10 MIN)',
      `<p>→ Reviews en feedback doornemen</p><p></p><p>→ Gekke dingen opgevallen?</p><p></p><p>→ Stijgende of dalende lijn in service?</p><p></p>`
    ),
    block(
      `${prefix}events`,
      'EVENTS & PARTIJEN (5-10 MIN)',
      `<p>→ Deze week</p><p></p><p>→ Volgende week</p><p></p>`
    ),
    block(
      `${prefix}verbeterpunten`,
      'VERBETERPUNTEN (5-10 MIN)',
      `<p>→ Wat loopt al weken te sudderen?</p><p></p><p>→ Welke kleine aanpassing kan nú verschil maken?</p><p></p>`
    ),
  ]
}

/** Default title for a new weekly note (e.g. "Wekelijks MT - 19 feb 2026"). */
export function getWeeklyNoteTitle(): string {
  const d = new Date()
  const day = d.getDate()
  const month = d.toLocaleDateString('nl-NL', { month: 'short' })
  const year = d.getFullYear()
  return `Wekelijks MT - ${day} ${month} ${year}`
}
