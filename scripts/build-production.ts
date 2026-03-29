#!/usr/bin/env ts-node
/**
 * Production Build Script
 * 
 * Strips all unused code, docs, and dev files from the production deployment.
 * Creates a clean production directory that can be pushed to the production branch.
 * 
 * Usage: npm run build:production
 * 
 * IMPORTANT: Run from main branch
 * 
 * What it does:
 * 1. Copies repo to production/ directory (excludes node_modules, .git, etc)
 * 2. Removes all old Next.js app code
 * 3. Keeps only active MongoDB collections & dependencies
 * 4. Strips all documentation except README-PRODUCTION.md
 * 5. Removes dev scripts, tests, .cursor, node_modules
 * 6. Generates removal report
 * 7. Optimizes package.json for production
 */

import fs from 'fs'
import path from 'path'
import { rm } from 'fs/promises'

const ROOT = process.cwd()
const PROD_DIR = path.join(ROOT, 'production')

interface RemovalReport {
  directories: string[]
  files: string[]
  totalSize: number
  timestamp: string
}

const report: RemovalReport = {
  directories: [],
  files: [],
  totalSize: 0,
  timestamp: new Date().toISOString()
}

async function getDirectorySize(dir: string): Promise<number> {
  if (!fs.existsSync(dir)) return 0
  let size = 0
  const files = fs.readdirSync(dir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      size += await getDirectorySize(fullPath)
    } else {
      size += fs.statSync(fullPath).size
    }
  }
  return size
}

async function removeDir(dir: string, reason: string) {
  if (fs.existsSync(dir)) {
    const size = await getDirectorySize(dir)
    report.directories.push(`${path.relative(PROD_DIR, dir)} (${formatBytes(size)}) - ${reason}`)
    report.totalSize += size
    await rm(dir, { recursive: true, force: true })
    console.log(`✗ Removed: ${path.relative(PROD_DIR, dir)}`)
  }
}

async function removeFile(file: string, reason: string) {
  if (fs.existsSync(file)) {
    const size = fs.statSync(file).size
    report.files.push(`${path.relative(PROD_DIR, file)} (${formatBytes(size)}) - ${reason}`)
    report.totalSize += size
    await rm(file, { force: true })
    console.log(`✗ Removed: ${path.relative(PROD_DIR, file)}`)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function copyDirRecursive(src: string, dest: string, excludeList: Set<string>) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    if (excludeList.has(entry.name)) continue

    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, excludeList)
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

async function cleanupPackageJson() {
  const pkgPath = path.join(PROD_DIR, 'package.json')
  const pkgContent = fs.readFileSync(pkgPath, 'utf-8')
  const pkg = JSON.parse(pkgContent)

  // Remove dev dependencies - keep only production deps
  pkg.devDependencies = {}

  // Update scripts - keep only essential
  pkg.scripts = {
    'build': 'nuxt build',
    'start': 'node .output/server/index.mjs',
    'dev': 'nuxt dev'
  }

  // Add production metadata
  pkg.engines = { node: '22.22.1' }
  pkg.private = true

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  console.log('✓ Optimized package.json for production')
}

async function main() {
  try {
    console.log('\n🚀 Starting Production Build...\n')
    console.log(`📍 Working directory: ${ROOT}\n`)

    // Step 1: Clean or create production directory
    if (fs.existsSync(PROD_DIR)) {
      console.log('🧹 Cleaning existing production directory...')
      await rm(PROD_DIR, { recursive: true, force: true })
    }

    // Step 2: Create exclude list
    const excludeList = new Set([
      'node_modules',
      'nuxt-app/node_modules',
      '.git',
      '.gitignore',
      '.next',
      '.cursor',
      '.DS_Store',
      'dist',
      'build',
      '.env.local',
      'dev-docs',
      'scripts',
      'app',
      'docker-compose.yml',
      'components.json',
      'check_data.js',
      'test-aggregation.sh',
      'data-sources',
      'EITJE_COLLECTION_RENAME_OVERVIEW.md',
      'production',
      '.husky',
      'package-lock.json'
    ])

    // Step 3: Copy files
    console.log('📋 Copying repository files...')
    copyDirRecursive(ROOT, PROD_DIR, excludeList)
    console.log('✓ Repository copied to production/\n')

    // Step 4: Remove old Next.js app code
    console.log('📦 Removing old Next.js app code...')
    await removeDir(path.join(PROD_DIR, 'app'), 'Old Next.js app (not used)')
    await removeFile(path.join(PROD_DIR, 'next.config.js'), 'Next.js config')
    await removeFile(path.join(PROD_DIR, 'next-env.d.ts'), 'Next.js types')
    await removeFile(path.join(PROD_DIR, '.eslintrc.json'), 'Next.js eslint')
    await removeFile(path.join(PROD_DIR, 'components.json'), 'Next.js components config')
    await removeFile(path.join(PROD_DIR, 'tailwind.config.ts'), 'Next.js tailwind config')
    await removeFile(path.join(PROD_DIR, 'postcss.config.js'), 'PostCSS config (Nuxt includes)')

    // Step 5: Clean documentation
    console.log('\n📚 Cleaning documentation...')
    const docDir = PROD_DIR
    if (fs.existsSync(docDir)) {
      const docFiles = fs.readdirSync(docDir).filter(f => 
        (f.endsWith('.md') || f.endsWith('.MD')) && f !== 'README.md'
      )
      for (const file of docFiles) {
        await removeFile(path.join(docDir, file), 'Dev documentation')
      }
    }

    // Step 6: Remove function registry and cursor rules
    console.log('\n🔧 Removing development infrastructure...')
    await removeFile(path.join(PROD_DIR, 'function-registry.json'), 'Development registry')

    // Step 7: Optimize package.json
    console.log('\n📋 Optimizing package.json...')
    await cleanupPackageJson()

    // Step 8: Create .env template
    console.log('📝 Creating .env.example...')
    const envContent = `# Production Environment Variables
MONGODB_URI=mongodb+srv://daily-ops:PASSWORD@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true
MONGODB_DB_NAME=daily-ops-db
NODE_ENV=production
PORT=3000
`
    fs.writeFileSync(path.join(PROD_DIR, '.env.example'), envContent)
    console.log('✓ Created .env.example')

    // Step 9: Create production README
    const prodReadme = `# Daily Ops - Production Backend

**Nuxt 3 backend for Daily Operations management.**

## Active MongoDB Collections

- \`notes\`
- \`unified_user\`
- \`menu_items\`
- \`menus\`
- \`menu_versions\`
- \`members\`
- \`teams\`
- \`locations\`
- \`api_credentials\`
- \`integration_cron_jobs\`
- \`eitje_raw_data\`
- \`eitje_time_registration_aggregation\`
- \`eitje_planning_registration_aggregation\`
- \`unified_location\`
- \`data_source_mappings\`
- \`test-eitje-contracts\`

## Deployment

\`\`\`bash
# Install dependencies
npm install --production

# Build
npm run build

# Start
npm start
\`\`\`

## Environment Variables

Set in \`.env\` or DigitalOcean App Platform:
- \`MONGODB_URI\` - MongoDB connection string
- \`MONGODB_DB_NAME\` - Database name
- \`NODE_ENV\` - Set to \`production\`
- \`PORT\` - Server port (default 3000)

## API Routes

All active API routes are in \`nuxt-app/server/api/\`

Only the collections listed above are used in production.

## Build Output

Production build output is in \`.output/\` directory.
`
    fs.writeFileSync(path.join(PROD_DIR, 'README-PRODUCTION.md'), prodReadme)
    console.log('✓ Created README-PRODUCTION.md')

    // Step 10: Create .gitignore for production
    const gitignoreContent = `node_modules/
.output/
.nuxt/
dist/
build/
.env.local
.DS_Store
*.log
`
    fs.writeFileSync(path.join(PROD_DIR, '.gitignore'), gitignoreContent)
    console.log('✓ Created .gitignore')

    // Step 11: Generate removal report
    console.log('\n📊 Generating removal report...')
    const reportPath = path.join(PROD_DIR, 'PRODUCTION_BUILD_REPORT.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    console.log('\n✅ Production build complete!')
    console.log(`\n📈 Summary:`)
    console.log(`   Directories removed: ${report.directories.length}`)
    console.log(`   Files removed: ${report.files.length}`)
    console.log(`   Space saved: ${formatBytes(report.totalSize)}`)
    console.log(`\n📂 Production directory: ./production/`)
    console.log(`📋 Report: production/PRODUCTION_BUILD_REPORT.json`)

    console.log('\n🚀 Next steps:')
    console.log('   1. Review production/ directory')
    console.log('   2. git init production && cd production')
    console.log('   3. git add .')
    console.log('   4. git commit -m "chore: production build - stripped unused code"')
    console.log('   5. git push -u origin production (or force if production exists)')
    console.log('   6. DigitalOcean will auto-deploy from production branch')

  } catch (error) {
    console.error('\n❌ Build failed:', error)
    process.exit(1)
  }
}

main()
