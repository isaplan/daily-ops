/**
 * Webhook Setup Verification Script
 * 
 * Checks:
 * 1. Environment variables are set
 * 2. Watch subscription status
 * 3. Webhook endpoint accessibility
 * 4. Database logs for webhook activity
 */

require('dotenv').config({ path: '.env.local' })
const mongoose = require('mongoose')

const results = []

async function verifyEnvironmentVariables() {
  const required = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'GMAIL_PUBSUB_TOPIC',
    'GMAIL_INBOX_ADDRESS',
    'MONGODB_URI',
  ]

  const missing = []
  const present = []

  for (const key of required) {
    const value = process.env[key]
    if (!value || value.includes('YOUR_') || value.includes('your-')) {
      missing.push(key)
    } else {
      present.push(key)
    }
  }

  if (missing.length > 0) {
    results.push({
      step: 'Environment Variables',
      status: '❌',
      message: `Missing or invalid: ${missing.join(', ')}`,
      details: `Found: ${present.length}/${required.length} variables`,
    })
  } else {
    results.push({
      step: 'Environment Variables',
      status: '✅',
      message: 'All required environment variables are set',
      details: `Topic: ${process.env.GMAIL_PUBSUB_TOPIC}`,
    })
  }
}

async function verifyDatabaseConnection() {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      results.push({
        step: 'Database Connection',
        status: '❌',
        message: 'MONGODB_URI not set',
      })
      return
    }

    await mongoose.connect(uri)
    results.push({
      step: 'Database Connection',
      status: '✅',
      message: 'Successfully connected to MongoDB',
    })
  } catch (error) {
    results.push({
      step: 'Database Connection',
      status: '❌',
      message: `Failed to connect: ${error.message}`,
    })
  }
}

async function checkWebhookLogs() {
  try {
    const ProcessingLog = mongoose.model(
      'ProcessingLog',
      new mongoose.Schema({}, { strict: false })
    )

    const webhookLogs = await ProcessingLog.find({ message: /webhook/i })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean()

    if (webhookLogs.length === 0) {
      results.push({
        step: 'Webhook Activity',
        status: '⚠️',
        message: 'No webhook logs found in database',
        details: 'This means no webhooks have been received yet',
      })
    } else {
      const latest = webhookLogs[0]
      results.push({
        step: 'Webhook Activity',
        status: '✅',
        message: `Found ${webhookLogs.length} webhook log(s)`,
        details: `Latest: ${latest.message} at ${latest.timestamp}`,
      })
    }
  } catch (error) {
    results.push({
      step: 'Webhook Activity',
      status: '❌',
      message: `Failed to check logs: ${error.message}`,
    })
  }
}

async function verifyWatchSubscription() {
  try {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:8080'
    const response = await fetch(`${baseUrl}/api/inbox/watch`, {
      method: 'GET',
    })

    if (!response.ok) {
      results.push({
        step: 'Watch Subscription',
        status: '⚠️',
        message: 'Could not check watch status',
        details: `API returned: ${response.status} ${response.statusText}`,
      })
      return
    }

    const data = await response.json()
    results.push({
      step: 'Watch Subscription',
      status: '⚠️',
      message: 'Watch status check not fully implemented',
      details: 'Use POST /api/inbox/watch to start a watch subscription',
    })
  } catch (error) {
    results.push({
      step: 'Watch Subscription',
      status: '❌',
      message: `Failed to check watch status: ${error.message}`,
      details: 'Make sure your Next.js server is running',
    })
  }
}

async function verifyWebhookEndpoint() {
  try {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:8080'
    const testPayload = {
      message: {
        data: Buffer.from(
          JSON.stringify({
            emailAddress: process.env.GMAIL_INBOX_ADDRESS || 'test@example.com',
            historyId: '123456',
          })
        ).toString('base64'),
        messageId: 'test-message-id',
        publishTime: new Date().toISOString(),
      },
      subscription: 'test-subscription',
    }

    const response = await fetch(`${baseUrl}/api/inbox/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })

    if (response.ok) {
      results.push({
        step: 'Webhook Endpoint',
        status: '✅',
        message: 'Webhook endpoint is accessible',
        details: `Status: ${response.status}`,
      })
    } else {
      results.push({
        step: 'Webhook Endpoint',
        status: '⚠️',
        message: 'Webhook endpoint returned non-200 status',
        details: `Status: ${response.status}`,
      })
    }
  } catch (error) {
    results.push({
      step: 'Webhook Endpoint',
      status: '❌',
      message: `Webhook endpoint not accessible: ${error.message}`,
      details: 'Make sure your Next.js server is running and endpoint is publicly accessible',
    })
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60))
  console.log('🔍 Webhook Setup Verification Report')
  console.log('='.repeat(60) + '\n')

  for (const result of results) {
    console.log(`${result.status} ${result.step}`)
    console.log(`   ${result.message}`)
    if (result.details) {
      console.log(`   → ${result.details}`)
    }
    console.log()
  }

  const successCount = results.filter((r) => r.status === '✅').length
  const warningCount = results.filter((r) => r.status === '⚠️').length
  const errorCount = results.filter((r) => r.status === '❌').length

  console.log('='.repeat(60))
  console.log(`Summary: ${successCount} ✅ | ${warningCount} ⚠️ | ${errorCount} ❌`)
  console.log('='.repeat(60))

  if (errorCount > 0) {
    console.log('\n❌ Issues found. Please fix errors before webhooks can work.')
  } else if (warningCount > 0) {
    console.log('\n⚠️  Setup looks good, but some warnings need attention.')
  } else {
    console.log('\n✅ All checks passed! Webhook setup looks good.')
  }

  console.log('\n📋 Next Steps:')
  console.log('1. Ensure Pub/Sub subscription is configured in Google Cloud Console')
  console.log('2. Start watch subscription: POST /api/inbox/watch')
  console.log('3. For local dev, use ngrok to expose webhook endpoint')
  console.log('4. Send a test email to trigger a webhook')
}

async function main() {
  console.log('Starting webhook setup verification...\n')

  await verifyEnvironmentVariables()
  await verifyDatabaseConnection()

  if (results[results.length - 1]?.status === '✅') {
    await checkWebhookLogs()
  }

  await verifyWatchSubscription()
  await verifyWebhookEndpoint()

  printSummary()

  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('Verification failed:', error)
  process.exit(1)
})
