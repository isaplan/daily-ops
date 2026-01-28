#!/usr/bin/env node

/**
 * Gmail OAuth2 Refresh Token Generator
 * 
 * This script helps you get a refresh token for Gmail API access.
 * It will:
 * 1. Start a local server to catch the OAuth redirect
 * 2. Open your browser to authorize
 * 3. Automatically exchange the code for tokens
 * 4. Display your refresh token
 */

import { google } from 'googleapis'
import http from 'http'
import { URL } from 'url'

// Simple cross-platform open function
const openBrowser = async (url) => {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)
  
  const platform = process.platform
  const command = 
    platform === 'darwin' ? `open "${url}"` :
    platform === 'win32' ? `start "${url}"` :
    `xdg-open "${url}"`
  
  try {
    await execAsync(command)
  } catch (err) {
    // Fallback - just log the URL
    return false
  }
  return true
}

// Secrets from env only (never commit). Copy from .env.local or: GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/get-gmail-refresh-token.mjs
const CLIENT_ID = process.env.GMAIL_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || ''
const PORT = 8081 // Use different port to avoid conflict with Next.js dev server
const REDIRECT_URI = `http://localhost:${PORT}`

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.local (see env.example).')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
)

// Generate authorization URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  prompt: 'consent' // Force consent screen to get refresh token
})

console.log('\n🔐 Gmail OAuth2 Authorization\n')
console.log('📋 Your credentials:')
console.log(`   Client ID: ${CLIENT_ID.substring(0, 30)}...`)
console.log(`   Redirect URI: ${REDIRECT_URI}\n`)

// Start local server to catch redirect
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1 style="color: red;">❌ Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p>Please try again.</p>
          </body>
        </html>
      `)
      server.close()
      process.exit(1)
    }

    if (code) {
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code)
      
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1 style="color: green;">✅ Authorization Successful!</h1>
            <p>You can close this window.</p>
            <p>Check your terminal for the refresh token.</p>
          </body>
        </html>
      `)

      server.close()

      if (tokens.refresh_token) {
        console.log('\n✅ SUCCESS! Your refresh token:\n')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(tokens.refresh_token)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        console.log('📝 Add this to your .env.local file:')
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`)
      } else {
        console.log('\n⚠️  WARNING: No refresh token received!')
        console.log('This usually means you already authorized this app before.')
        console.log('Try revoking access and running this script again.\n')
        console.log('Access token (temporary):', tokens.access_token?.substring(0, 30) + '...\n')
      }

      process.exit(0)
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1>Waiting for authorization...</h1>
            <p>Please complete the authorization in your browser.</p>
          </body>
        </html>
      `)
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Error processing authorization')
    server.close()
    process.exit(1)
  }
})

server.listen(PORT, async () => {
  console.log(`🌐 Local server started on http://localhost:${PORT}`)
  console.log('\n🔗 Opening browser for authorization...\n')
  
  const opened = await openBrowser(authUrl)
  if (!opened) {
    console.log('⚠️  Could not open browser automatically.')
  }
  console.log('📖 Visit this URL to authorize:\n')
  console.log(`   ${authUrl}\n`)
  console.log('⏳ Waiting for authorization...\n')
})

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\n👋 Exiting...')
  server.close()
  process.exit(0)
})
