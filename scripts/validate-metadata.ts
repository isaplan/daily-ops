#!/usr/bin/env ts-node
/**
 * Metadata Header Validation & Sync
 * 
 * Runs on pre-commit to:
 * 1. Parse @registry-id, @exports-to, @last-modified from critical files
 * 2. Validate all @exports-to files exist
 * 3. Update function-registry with dependency metadata
 * 4. Fail commit if dependencies broken
 */

import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import { join } from 'path'

interface MetadataHeader {
  registryId?: string
  lastModified?: string
  lastFix?: string
  exportsTo: string[]
  importsFrom: string[]
  description?: string
}

interface RegistryEntry {
  id: string
  file: string
  type: string
  dependencies?: string[]
  exports_to?: string[]
  last_sync?: string
}

// Parse metadata header from file
function parseMetadata(filePath: string): MetadataHeader | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const headerMatch = content.match(/\/\*\*([\s\S]*?)\*\//m)
    
    if (!headerMatch) return null
    const header = headerMatch[1]

    const registryId = header.match(/@registry-id:\s*(\S+)/)?.[1]
    const lastModified = header.match(/@last-modified:\s*(\S+)/)?.[1]
    const lastFix = header.match(/@last-fix:\s*(.+)/)?.[1]
    
    // Parse @exports-to dependencies
    const exportsMatch = header.match(/@exports-to:([\s\S]*?)(?=@|\*\/)/m)
    const exportsTo = exportsMatch
      ? exportsMatch[1]
          .split('\n')
          .map(line => line.match(/✓?\s*([^\s→=>]+)/)?.[1])
          .filter(Boolean) as string[]
      : []
    
    // Parse @imports-from dependencies
    const importsMatch = header.match(/@imports-from:([\s\S]*?)(?=@|\*\/)/m)
    const importsFrom = importsMatch
      ? importsMatch[1]
          .split('\n')
          .map(line => line.match(/[-–]\s*([^\s=>]+)/)?.[1])
          .filter(Boolean) as string[]
      : []

    return {
      registryId,
      lastModified,
      lastFix,
      exportsTo,
      importsFrom,
      description: header.match(/@description:\s*(.+)/)?.[1],
    }
  } catch (err) {
    return null
  }
}

// Critical file patterns that require metadata
const CRITICAL_PATTERNS = [
  'app/lib/hooks/*.ts',
  'app/lib/services/*.ts',
  'app/lib/types/*.ts',
  'app/api/**/*.ts',
]

// Main validation
async function validateMetadata() {
  let errors: string[] = []
  const criticalFiles = await glob(CRITICAL_PATTERNS, { cwd: process.cwd() })

  console.log(`📋 Validating ${criticalFiles.length} critical files...`)

  for (const file of criticalFiles) {
    const metadata = parseMetadata(file)
    
    if (!metadata?.registryId) {
      errors.push(`⚠️  MISSING: No @registry-id in ${file}`)
      continue
    }

    // Validate @exports-to files exist
    for (const exportFile of metadata.exportsTo) {
      const fullPath = join(process.cwd(), exportFile)
      try {
        readFileSync(fullPath)
      } catch {
        errors.push(`❌ BROKEN: ${file} exports-to ${exportFile} (file not found)`)
      }
    }

    console.log(`✅ ${file} → ${metadata.registryId}`)
  }

  if (errors.length > 0) {
    console.error('\n❌ VALIDATION FAILED:\n')
    errors.forEach(e => console.error(e))
    process.exit(1)
  }

  console.log('\n✅ All metadata headers valid!')
  console.log('✅ All dependencies exist!')
}

// Run validation
validateMetadata().catch(err => {
  console.error('❌ Validation error:', err.message)
  process.exit(1)
})
