/**
 * @registry-id: adminSetupPage
 * @created: 2026-01-24T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Temporary dev page to set users as admin
 * @last-fix: [2026-01-24] Initial implementation
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminSetupPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSetAdmin = async () => {
    if (!email) {
      setResult({ success: false, message: 'Please enter an email' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/set-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: data.message || 'User is now an admin!' })
        setEmail('')
      } else {
        setResult({ success: false, message: data.error || 'Failed to set admin' })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Set User as Admin</CardTitle>
          <CardDescription>
            Enter a user's email to grant them admin access (temporary dev tool)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetAdmin()}
            />
          </div>
          <Button onClick={handleSetAdmin} disabled={loading || !email}>
            {loading ? 'Setting...' : 'Set as Admin'}
          </Button>
          {result && (
            <div
              className={`p-3 rounded-md ${
                result.success
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {result.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
