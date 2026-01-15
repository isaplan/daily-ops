#!/usr/bin/env ts-node
/**
 * Metadata Header Validation & Sync
 * 
 * Runs on pre-commit to:
 * 1. Parse @registry-id, @exports-to, @last-modified from critical files
 * 2. Validate all @exports-to files exist
 * 3. Fail commit if dependencies broken
 */

import { readFileSync } from 'fs'
import { globSync } from 'glob'

interface MetadataHeader {
  registryId?: string
  lastModified?: string
  lastFix?: string
  exportsTo: string[]
  importsFrom: string[]
  description?: string
}

// Parse metadata header from file
function parseMetadata(filePath: string): MetadataHeader | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const headerMatch = content.match(/\/\*\*([\s\S]*?)\*\//m)

    if (!headerMatch) return null
    const header = headerMatch[1]
    if (!header) return null

    const registryId = header.match(/@registry-id:\s*(\S+)/)?.[1]
    const lastModified = header.match(/@last-modified:\s*(\S+)/)?.[1]
    const lastFix = header.match(/@last-fix:\s*(.+)/)?.[1]
    const description = header.match(/@description:\s*(.+)/)?.[1]

    // Parse @exports-to dependencies - more robust
    const exportsMatch = header.match(/@exports-to:([\s\S]*?)(?=@|\*\/)/m)
    let exportsTo: string[] = []
    if (exportsMatch) {
      const exportText = exportsMatch[1]
      // Skip lines with "(none" or empty lines
      if (exportText && !exportText.toLowerCase().includes('(none')) {
        exportsTo = exportText
          .split('\n')
          .map(line => {
            // Extract file paths from lines like "✓ path/to/file.ts => description"
            const match = line.match(/(?:✓\s+)?([^\s=>\n]+(?:\.ts|\.tsx|\.js|\.jsx))/)
            return match?.[1]
          })
          .filter(Boolean) as string[]
      }
    }

    // Parse @imports-from dependencies
    const importsMatch = header.match(/@imports-from:([\s\S]*?)(?=@|\*\/)/m)
    let importsFrom: string[] = []
    if (importsMatch) {
      const importText = importsMatch[1]
      if (importText && !importText.toLowerCase().includes('(none')) {
        importsFrom = importText
          .split('\n')
          .map(line => {
            const match = line.match(/[-–]\s*([^\s=>\n]+(?:\.ts|\.tsx|\.js|\.jsx))/)
            return match?.[1]
          })
          .filter(Boolean) as string[]
      }
    }

    return {
      registryId,
      lastModified,
      lastFix,
      exportsTo,
      importsFrom,
      description,
    }
  } catch (err) {
    return null
  }
}

// Critical file patterns that require metadata
const CRITICAL_PATTERNS = [
  'app/lib/hooks/**/*.ts',
  'app/lib/services/**/*.ts',
  'app/lib/types/**/*.ts',
  'app/api/**/*.ts',
]

// Main validation
async function validateMetadata() {
  let errors: string[] = []
  const criticalFiles = globSync(CRITICAL_PATTERNS, {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', '.next/**'],
  })

  console.log(`🔍 Validating metadata headers...`)
  console.log(`📋 Validating ${criticalFiles.length} critical files...`)

  for (const file of criticalFiles) {
    const metadata = parseMetadata(file)

    if (!metadata?.registryId) {
      errors.push(`⚠️  MISSING: No @registry-id in ${file}`)
      continue
    }

    // Validate @exports-to files exist
    for (const exportFile of metadata.exportsTo) {
      try {
        readFileSync(exportFile)
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
