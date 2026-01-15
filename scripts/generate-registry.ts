#!/usr/bin/env ts-node
/**
 * Generate Function Registry
 * 
 * Scans all critical files and generates function-registry.json
 * Runs automatically on pre-commit via husky hook
 */

import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'
import { createHash } from 'crypto'
import { basename, relative } from 'path'

interface RegistryEntry {
  id: string
  name: string
  type: string
  file: string
  status: string
  touch_again: boolean
  description: string
  auto_detected: boolean
  detected_at: string
  last_seen: string
  last_seen_ms: number
  size: number
  lines: number
  checksum: string
  dependencies?: string[]
  exports_to?: string[]
}

interface Registry {
  metadata: {
    totalByType: Record<string, number>
    totalFiles: number
    version: string
    generated_at: string
  }
  index: {
    byName: Record<string, string>
    byFile: Record<string, string>
    byType: Record<string, string[]>
    byLastSeen: string[]
  }
  functions: RegistryEntry[]
}

// File patterns to scan
const SCAN_PATTERNS = [
  'app/lib/hooks/**/*.ts',
  'app/lib/services/**/*.ts',
  'app/lib/types/**/*.ts',
  'app/api/**/*.ts',
  'app/components/**/*.tsx',
  'app/components/**/*.ts',
]

// Extract metadata from file header
function extractMetadata(content: string): Partial<RegistryEntry> | null {
  const headerMatch = content.match(/\/\*\*([\s\S]*?)\*\//m)
  if (!headerMatch) return null

  const header = headerMatch[1]
  const registryId = header.match(/@registry-id:\s*(\S+)/)?.[1]
  const description = header.match(/@description:\s*(.+)/)?.[1]
  
  // Parse @exports-to
  const exportsMatch = header.match(/@exports-to:([\s\S]*?)(?=@|\*\/)/m)
  const exportsTo = exportsMatch
    ? exportsMatch[1]
        .split('\n')
        .map(line => line.match(/✓?\s*([^\s→=>]+)/)?.[1])
        .filter(Boolean) as string[]
    : []

  return {
    description,
    exports_to: exportsTo.length > 0 ? exportsTo : undefined,
  }
}

// Detect type based on file path and content
function detectType(filePath: string): string {
  if (filePath.includes('/hooks/')) return 'hook'
  if (filePath.includes('/services/')) return 'service'
  if (filePath.includes('/types/')) return 'type'
  if (filePath.includes('/api/')) return 'api-route'
  if (filePath.includes('/components/')) return 'component'
  return 'unknown'
}

// Generate ID from name and type
function generateId(name: string, type: string): string {
  return `${name}-${type}`
}

// Calculate MD5 checksum
function calculateChecksum(content: string): string {
  return createHash('md5').update(content).digest('hex').substring(0, 16)
}

// Main generation function
function generateRegistry() {
  console.log('📋 Generating function registry...')

  const files = globSync(SCAN_PATTERNS, {
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', '.next/**'],
  })

  console.log(`   Found ${files.length} files`)

  const entries: RegistryEntry[] = []
  const byName: Record<string, string> = {}
  const byFile: Record<string, string> = {}
  const byType: Record<string, string[]> = {}
  const byLastSeen: string[] = []

  const now = new Date().toISOString()
  const nowMs = Date.now()

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')
      const checksum = calculateChecksum(content)
      const lines = content.split('\n').length
      const size = content.length

      // Extract file name without extension
      const nameWithExt = basename(file)
      const name = nameWithExt.replace(/\.(ts|tsx)$/, '')
      const type = detectType(file)
      const id = generateId(name, type)

      // Extract metadata if available
      const metadata = extractMetadata(content) || {}

      const entry: RegistryEntry = {
        id,
        name,
        type,
        file: relative(process.cwd(), file),
        status: 'active',
        touch_again: true,
        description: metadata.description || `Auto-detected ${type}`,
        auto_detected: true,
        detected_at: now,
        last_seen: now,
        last_seen_ms: nowMs,
        size,
        lines,
        checksum,
        ...(metadata.exports_to && { exports_to: metadata.exports_to }),
      }

      entries.push(entry)

      // Build indices
      byName[name] = id
      byFile[entry.file] = id

      if (!byType[type]) byType[type] = []
      byType[type].push(id)

      byLastSeen.push(id)

      console.log(`   ✅ ${file} → ${id}`)
    } catch (err) {
      console.warn(`   ⚠️  Error reading ${file}: ${err}`)
    }
  }

  // Sort by last_seen descending
  entries.sort((a, b) => b.last_seen_ms - a.last_seen_ms)
  byLastSeen.sort((a, b) => {
    const entryA = entries.find(e => e.id === a)
    const entryB = entries.find(e => e.id === b)
    return (entryB?.last_seen_ms || 0) - (entryA?.last_seen_ms || 0)
  })

  // Calculate statistics
  const totalByType: Record<string, number> = {}
  for (const type in byType) {
    totalByType[type] = byType[type].length
  }

  const registry: Registry = {
    metadata: {
      totalByType,
      totalFiles: entries.length,
      version: '2.0.0',
      generated_at: now,
    },
    index: {
      byName,
      byFile,
      byType,
      byLastSeen,
    },
    functions: entries,
  }

  // Write registry
  writeFileSync('function-registry.json', JSON.stringify(registry, null, 2))

  console.log(`\n✅ Registry generated!`)
  console.log(`   Total files: ${entries.length}`)
  console.log(`   Types: ${Object.entries(totalByType).map(([t, c]) => `${t}(${c})`).join(', ')}`)
  console.log(`   Saved: function-registry.json`)
}

// Run generation
try {
  generateRegistry()
} catch (err) {
  console.error('❌ Registry generation failed:', err)
  process.exit(1)
}
