import type { NoteBlock } from '~/types/noteBlock'
import { createEmptyBlock } from '~/types/noteBlock'

function block(id: string, title: string, content: string): NoteBlock {
  return {
    ...createEmptyBlock(),
    id,
    title,
    content,
    todos: [],
  }
}

export const WEEKLY_DETAILS_BLOCK_ID = 'weekly-details'

export function getWeeklyTemplateBlocks(): NoteBlock[] {
  const prefix = 'weekly-'
  return [
    block(
      WEEKLY_DETAILS_BLOCK_ID,
      'Details',
      ''
    ),
    block(
      `${prefix}recap-intro`,
      'RECAP VORIGE NOTULEN (5 MIN)',
      '<p>→ Wat is afgerond en hoe?</p><p></p><hr><p></p>'
    ),
    block(
      `${prefix}header`,
      'Header',
      '<p><strong>[Locatie]</strong> <strong>[Datum]</strong> | Wekelijks MT</p><p>Aanwezig: </p><p></p>'
    ),
    block(
      `${prefix}checkin`,
      'CHECK-IN (5 MIN)',
      '<p></p>'
    ),
    block(
      `${prefix}recap`,
      'RECAP VORIGE NOTULEN (5 MIN)',
      '<p>→ Wat is afgerond en hoe?</p><p></p><p>→ Wat staat nog open?</p><p></p>'
    ),
    block(
      `${prefix}rooster`,
      'OPERATIONEEL ROOSTER (15-20 MIN)',
      '<p>→ Roosters Komende 7 Dagen: Planning, gaten, ziektes, nieuwe instromers</p><p></p><p>→ Leveranciers: klachten, vertraging, alternatief nodig?</p><p></p><p>→ Incidenten: klachten, no-shows, interne fricties</p><p></p><p>→ Team: wie is moe, wie moet extra aandacht krijgen?</p><p></p>'
    ),
    block(
      `${prefix}financien`,
      'OPERATIONEEL FINANCIEN (15-20 MIN)',
      '<p>→ Financiën Vorige Week: Totale Omzet, Arbeidsproductiviteit &amp; Arbeidskosten</p><p></p><p>→ Financiën Verbeter en Aandachtspunten: Roosteren, Afbellen, etc.</p><p></p>'
    ),
    block(
      `${prefix}gastbeleving`,
      'GASTBELEVING (5-10 MIN)',
      '<p>→ Reviews en feedback doornemen</p><p></p><p>→ Gekke dingen opgevallen?</p><p></p><p>→ Stijgende of dalende lijn in service?</p><p></p>'
    ),
    block(
      `${prefix}events`,
      'EVENTS & PARTIJEN (5-10 MIN)',
      '<p>→ Deze week</p><p></p><p>→ Volgende week</p><p></p>'
    ),
    block(
      `${prefix}verbeterpunten`,
      'VERBETERPUNTEN (5-10 MIN)',
      '<p>→ Wat loopt al weken te sudderen?</p><p></p><p>→ Welke kleine aanpassing kan nú verschil maken?</p><p></p>'
    ),
  ]
}

export function getWeeklyNoteTitle(): string {
  const d = new Date()
  const day = d.getDate()
  const month = d.toLocaleDateString('nl-NL', { month: 'short' })
  const year = d.getFullYear()
  return `Wekelijks MT - ${day} ${month} ${year}`
}
