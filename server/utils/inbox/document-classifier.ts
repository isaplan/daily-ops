/**
 * @registry-id: documentClassifier
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Document type classifier (ported from next-js-old)
 * @last-fix: [2026-04-18] Nuxt path imports
 *
 * @exports-to:
 * ✓ server/services/documentParserService.ts
 * ✓ server/services/dataMappingService.ts
 */

import type { DocumentType } from '~/types/inbox'

export type ClassificationResult = {
  type: DocumentType
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export function classifyByFilename(fileName: string): ClassificationResult {
  const lowerName = fileName.toLowerCase()

  // Eitje daily hours export
  if (lowerName.includes('dagelijkse-uren-export')) {
    return { type: 'hours', confidence: 'high', reason: 'Eitje daily hours export' }
  }
  if (lowerName.includes('hours') || lowerName.includes('uren')) {
    return { type: 'hours', confidence: 'high', reason: 'Filename contains "hours" or "uren"' }
  }
  if (lowerName.includes('contract') || lowerName.includes('contracten')) {
    return { type: 'contracts', confidence: 'high', reason: 'Filename contains "contract"' }
  }
  if (lowerName.includes('finance') || lowerName.includes('financien')) {
    return { type: 'finance', confidence: 'high', reason: 'Filename contains "finance" or "financien"' }
  }

  if (lowerName.includes('sales') || lowerName.includes('verkoop')) {
    if (
      lowerName.includes('product verkoop') ||
      lowerName.includes('productverkoop') ||
      lowerName.includes('verkoop per uur')
    ) {
      return {
        type: 'product_sales_per_hour',
        confidence: 'high',
        reason: 'Filename contains "product verkoop" or "verkoop per uur"',
      }
    }
    return { type: 'sales', confidence: 'high', reason: 'Filename contains "sales" or "verkoop"' }
  }
  if (lowerName.includes('product mix') || lowerName.includes('productmix')) {
    return { type: 'product_mix', confidence: 'high', reason: 'Filename contains "product mix"' }
  }
  if (lowerName.includes('foodbev') || lowerName.includes('food bev') || lowerName.includes('food & beverage')) {
    return { type: 'food_beverage', confidence: 'high', reason: 'Filename contains "foodbev" or "food & beverage"' }
  }
  if (lowerName.includes('basis rapport') || lowerName.includes('basisrapport') || lowerName.includes('basis report')) {
    return { type: 'basis_report', confidence: 'high', reason: 'Filename contains "basis rapport" or "basis report"' }
  }
  if (lowerName.includes('report')) {
    return { type: 'basis_report', confidence: 'high', reason: 'Filename contains "report"' }
  }
  if (lowerName.includes('registry') || lowerName.includes('register')) {
    return { type: 'other', confidence: 'medium', reason: 'Filename contains "registry" or "register"' }
  }

  if (lowerName.includes('power') || lowerName.includes('powerbi') || lowerName.includes('power-bi')) {
    return { type: 'bi', confidence: 'high', reason: 'Filename contains "power" or "powerbi"' }
  }

  if (lowerName.includes('formitabele')) {
    return { type: 'formitabele', confidence: 'high', reason: 'Filename contains "formitabele"' }
  }
  if (lowerName.includes('pasy')) {
    return { type: 'pasy', confidence: 'high', reason: 'Filename contains "pasy"' }
  }

  return { type: 'other', confidence: 'low', reason: 'No matching pattern found in filename' }
}

export function classifyByContent(headers: string[]): ClassificationResult {
  const lowerHeaders = headers.map((h) => String(h).trim().toLowerCase())

  const financeKeywords = ['gerealiseerde omzet', 'omzetgroep', 'loonkosten percentage', 'arbeidsproductiviteit']
  if (financeKeywords.some((kw) => lowerHeaders.some((h) => h.includes(kw)))) {
    return { type: 'finance', confidence: 'high', reason: 'Headers match Eitje Finance' }
  }

  const hasContracttype = lowerHeaders.some((h) => h.includes('contracttype') || h.includes('contract type'))
  const hasContractVestigingOrWekelijkse = lowerHeaders.some(
    (h) => h.includes('contractvestiging') || h.includes('wekelijkse contracturen'),
  )
  if (hasContracttype && hasContractVestigingOrWekelijkse) {
    return { type: 'contracts', confidence: 'high', reason: 'Headers match Eitje Contracts' }
  }

  const hasDatum = lowerHeaders.some((h) => h.includes('datum') || h === 'date')
  const hasNaam = lowerHeaders.some((h) => h.includes('naam') || h.includes('name') || h.includes('werknemer') || h.includes('employee'))
  const hasVestigingOrUren = lowerHeaders.some((h) => h.includes('vestiging') || h.includes('uren') || h.includes('locatie') || h.includes('location'))
  if (hasDatum && hasNaam && hasVestigingOrUren) {
    return { type: 'hours', confidence: 'high', reason: 'Headers match Eitje Hours' }
  }

  const hoursKeywords = ['date', 'datum', 'employee', 'werknemer', 'hours', 'uren', 'location', 'locatie']
  if (hoursKeywords.some((keyword) => lowerHeaders.some((h) => h.includes(keyword)))) {
    return { type: 'hours', confidence: 'medium', reason: 'Headers match Eitje Hours pattern' }
  }

  const contractKeywords = ['employee', 'werknemer', 'contract', 'start', 'end', 'type']
  if (contractKeywords.some((keyword) => lowerHeaders.some((h) => h.includes(keyword)))) {
    return { type: 'contracts', confidence: 'medium', reason: 'Headers match Eitje Contracts pattern' }
  }

  const salesKeywords = ['date', 'datum', 'product', 'quantity', 'revenue', 'omzet', 'salesperson']
  if (salesKeywords.some((keyword) => lowerHeaders.some((h) => h.includes(keyword)))) {
    if (lowerHeaders.some((h) => h.includes('uur') || h.includes('hour'))) {
      return { type: 'product_sales_per_hour', confidence: 'medium', reason: 'Headers match Product Sales Per Hour pattern' }
    }
    return { type: 'sales', confidence: 'medium', reason: 'Headers match Sales pattern' }
  }

  const productMixKeywords = ['product', 'mix', 'category', 'categorie']
  if (productMixKeywords.some((keyword) => lowerHeaders.some((h) => h.includes(keyword)))) {
    return { type: 'product_mix', confidence: 'medium', reason: 'Headers match Product Mix pattern' }
  }

  const foodBevKeywords = ['food', 'beverage', 'drink', 'drank', 'menu']
  if (foodBevKeywords.some((keyword) => lowerHeaders.some((h) => h.includes(keyword)))) {
    return { type: 'food_beverage', confidence: 'medium', reason: 'Headers match Food & Beverage pattern' }
  }

  const basisReportKeywords = ['basis', 'rapport', 'report', 'summary', 'totaal', 'total']
  if (basisReportKeywords.some((keyword) => lowerHeaders.some((h) => h.includes(keyword)))) {
    return { type: 'basis_report', confidence: 'medium', reason: 'Headers match Basis Report pattern' }
  }

  return { type: 'other', confidence: 'low', reason: 'No matching pattern found in headers' }
}

export function classifyDocument(fileName: string, headers?: string[]): ClassificationResult {
  // Check filename first — filename hints take priority
  const filenameResult = classifyByFilename(fileName)
  if (filenameResult.confidence === 'high') {
    return filenameResult
  }

  // If filename didn't give high confidence, check headers
  if (headers && headers.length > 0) {
    const contentResult = classifyByContent(headers)
    if (contentResult.confidence === 'high') {
      return contentResult
    }
    // If headers have medium confidence and filename has low, use headers
    if (contentResult.confidence === 'medium' && filenameResult.confidence === 'low') {
      return contentResult
    }
  }

  return filenameResult
}
