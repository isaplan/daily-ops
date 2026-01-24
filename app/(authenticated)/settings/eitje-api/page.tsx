'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Save, TestTube, CheckCircle, XCircle, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEnvironment } from '@/lib/environmentContext'

export default function EitjeApiSettingsPage() {
  const { activeEnvironment, setActiveEnvironment } = useEnvironment()

  // Ensure we're in Daily Ops environment when this page loads
  useEffect(() => {
    if (activeEnvironment !== 'daily-ops') {
      setActiveEnvironment('daily-ops')
    }
  }, [activeEnvironment, setActiveEnvironment])
  const [credentials, setCredentials] = useState({
    baseUrl: 'https://open-api.eitje.app/open_api',
    partner_username: '',
    partner_password: '',
    api_username: '',
    api_password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionMessage, setConnectionMessage] = useState('')

  // Cron job states
  const [dailyCronStatus, setDailyCronStatus] = useState<any>(null)
  const [masterCronStatus, setMasterCronStatus] = useState<any>(null)
  const [historicalCronStatus, setHistoricalCronStatus] = useState<any>(null)
  const [isLoadingCronStatus, setIsLoadingCronStatus] = useState(false)

  // Load existing credentials
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const response = await fetch('/api/eitje/v2/credentials')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.credentials) {
            setCredentials({
              baseUrl: data.credentials.baseUrl || 'https://open-api.eitje.app/open_api',
              partner_username: data.credentials.additionalConfig?.partner_username || '',
              partner_password: data.credentials.additionalConfig?.partner_password || '',
              api_username: data.credentials.additionalConfig?.api_username || '',
              api_password: data.credentials.additionalConfig?.api_password || '',
            })
          }
        }
      } catch (error) {
        console.error('Error loading credentials:', error)
      }
    }
    loadCredentials()
    loadCronStatus()
  }, [])

  const loadCronStatus = async () => {
    setIsLoadingCronStatus(true)
    try {
      const [daily, master, historical] = await Promise.all([
        fetch('/api/eitje/v2/cron?jobType=daily-data'),
        fetch('/api/eitje/v2/cron?jobType=master-data'),
        fetch('/api/eitje/v2/cron?jobType=historical-data'),
      ])

      if (daily.ok) {
        const data = await daily.json()
        if (data.success) setDailyCronStatus(data.data)
      }
      if (master.ok) {
        const data = await master.json()
        if (data.success) setMasterCronStatus(data.data)
      }
      if (historical.ok) {
        const data = await historical.json()
        if (data.success) setHistoricalCronStatus(data.data)
      }
    } catch (error) {
      console.error('Error loading cron status:', error)
    } finally {
      setIsLoadingCronStatus(false)
    }
  }

  const handleSaveCredentials = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/eitje/v2/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: credentials.baseUrl,
          additionalConfig: {
            partner_username: credentials.partner_username,
            partner_password: credentials.partner_password,
            api_username: credentials.api_username,
            api_password: credentials.api_password,
          },
        }),
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Credentials saved successfully')
      } else {
        toast.error(result.error || 'Failed to save credentials')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save credentials')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setConnectionStatus('idle')
    try {
      const response = await fetch('/api/eitje/v2/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'environments',
        }),
      })

      const result = await response.json()
      if (result.success) {
        setConnectionStatus('success')
        setConnectionMessage('Connection successful!')
        toast.success('Connection test successful')
      } else {
        setConnectionStatus('error')
        setConnectionMessage(result.error || 'Connection failed')
        toast.error(result.error || 'Connection test failed')
      }
    } catch (error: any) {
      setConnectionStatus('error')
      setConnectionMessage(error.message || 'Connection test failed')
      toast.error(error.message || 'Connection test failed')
    } finally {
      setIsTesting(false)
    }
  }

  const handleCronAction = async (jobType: string, action: string, config?: any) => {
    try {
      // If trying to start a job that doesn't exist, create it first with default config
      if (action === 'start') {
        const currentStatus = 
          jobType === 'daily-data' ? dailyCronStatus :
          jobType === 'master-data' ? masterCronStatus :
          historicalCronStatus
        
        if (!currentStatus) {
          // Create the job with default configuration
          const defaultConfig = {
            isActive: true,
            schedule: jobType === 'daily-data' ? '0 * * * *' : // Hourly
                     jobType === 'master-data' ? '0 0 * * *' : // Daily at midnight
                     '0 1 * * *', // Daily at 1 AM for historical
            enabledEndpoints: jobType === 'daily-data' || jobType === 'historical-data' ? {
              hours: true,
              revenue: true,
              planning: false,
            } : undefined,
            enabledMasterEndpoints: jobType === 'master-data' ? {
              environments: true,
              teams: true,
              users: true,
              shiftTypes: true,
            } : undefined,
          }
          
          const createResponse = await fetch('/api/eitje/v2/cron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              jobType,
              config: defaultConfig,
            }),
          })
          
          const createResult = await createResponse.json()
          if (!createResult.success) {
            toast.error(createResult.error || 'Failed to create cron job')
            return
          }
        }
      }
      
      const response = await fetch('/api/eitje/v2/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          jobType,
          config,
        }),
      })

      const result = await response.json()
      if (result.success) {
        toast.success(result.message || 'Action completed successfully')
        await loadCronStatus()
      } else {
        toast.error(result.error || 'Action failed')
      }
    } catch (error: any) {
      console.error('Cron action error:', error)
      toast.error(error.message || 'Action failed')
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Eitje API Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your Eitje API connection and automated sync schedules
        </p>
      </div>

      <Tabs defaultValue="credentials" className="space-y-6">
        <TabsList>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="cron-jobs">Cron Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Credentials</CardTitle>
              <CardDescription>
                Enter your Eitje API credentials to connect to the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={credentials.baseUrl}
                  onChange={(e) => setCredentials({ ...credentials, baseUrl: e.target.value })}
                  placeholder="https://open-api.eitje.app/open_api"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner_username">Partner Username</Label>
                <Input
                  id="partner_username"
                  type="text"
                  value={credentials.partner_username}
                  onChange={(e) => setCredentials({ ...credentials, partner_username: e.target.value })}
                  placeholder="Your partner username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner_password">Partner Password</Label>
                <Input
                  id="partner_password"
                  type="password"
                  value={credentials.partner_password}
                  onChange={(e) => setCredentials({ ...credentials, partner_password: e.target.value })}
                  placeholder="Your partner password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_username">API Username</Label>
                <Input
                  id="api_username"
                  type="text"
                  value={credentials.api_username}
                  onChange={(e) => setCredentials({ ...credentials, api_username: e.target.value })}
                  placeholder="Your API username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_password">API Password</Label>
                <Input
                  id="api_password"
                  type="password"
                  value={credentials.api_password}
                  onChange={(e) => setCredentials({ ...credentials, api_password: e.target.value })}
                  placeholder="Your API password"
                />
              </div>

              {connectionStatus !== 'idle' && (
                <Alert variant={connectionStatus === 'success' ? 'default' : 'destructive'}>
                  <AlertDescription className="flex items-center gap-2">
                    {connectionStatus === 'success' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {connectionMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSaveCredentials} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Credentials
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron-jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Data Sync</CardTitle>
              <CardDescription>Automated sync for daily labor and revenue data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Daily Data Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Sync today&apos;s data hourly
                  </p>
                </div>
                <Switch
                  checked={dailyCronStatus?.isActive || false}
                  onCheckedChange={(checked) =>
                    handleCronAction('daily-data', checked ? 'start' : 'stop')
                  }
                />
              </div>
              
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Endpoints being synced:</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">time_registration_shifts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">revenue_days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">planning_shifts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">availability_shifts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">leave_requests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">events</span>
                  </div>
                </div>
              </div>

              {dailyCronStatus?.lastRun && (
                <p className="text-sm text-muted-foreground">
                  Last run: {new Date(dailyCronStatus.lastRunUTC || dailyCronStatus.lastRun).toLocaleString()}
                </p>
              )}
              {!dailyCronStatus && (
                <p className="text-sm text-muted-foreground">
                  Cron job not configured yet. Toggle the switch to create it.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCronAction('daily-data', 'run-now')}
                disabled={!dailyCronStatus}
              >
                Run Now
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Master Data Sync</CardTitle>
              <CardDescription>Sync environments, teams, users, and shift types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Master Data Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Sync master data daily
                  </p>
                </div>
                <Switch
                  checked={masterCronStatus?.isActive || false}
                  onCheckedChange={(checked) =>
                    handleCronAction('master-data', checked ? 'start' : 'stop')
                  }
                />
              </div>
              
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Endpoints being synced:</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">environments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">teams</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">shift_types</span>
                  </div>
                </div>
              </div>

              {masterCronStatus?.lastRun && (
                <p className="text-sm text-muted-foreground">
                  Last run: {new Date(masterCronStatus.lastRunUTC || masterCronStatus.lastRun).toLocaleString()}
                </p>
              )}
              {!masterCronStatus && (
                <p className="text-sm text-muted-foreground">
                  Cron job not configured yet. Toggle the switch to create it.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCronAction('master-data', 'run-now')}
                disabled={!masterCronStatus}
              >
                Run Now
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historical Data Sync</CardTitle>
              <CardDescription>Sync last 30 days of data to catch any missed changes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Historical Data Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Sync last 30 days daily
                  </p>
                </div>
                <Switch
                  checked={historicalCronStatus?.isActive || false}
                  onCheckedChange={(checked) =>
                    handleCronAction('historical-data', checked ? 'start' : 'stop')
                  }
                />
              </div>
              
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Endpoints being synced:</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">time_registration_shifts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">revenue_days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">planning_shifts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">availability_shifts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">leave_requests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">events</span>
                  </div>
                </div>
              </div>

              {historicalCronStatus?.lastRun && (
                <p className="text-sm text-muted-foreground">
                  Last run: {new Date(historicalCronStatus.lastRunUTC || historicalCronStatus.lastRun).toLocaleString()}
                </p>
              )}
              {!historicalCronStatus && (
                <p className="text-sm text-muted-foreground">
                  Cron job not configured yet. Toggle the switch to create it.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCronAction('historical-data', 'run-now')}
                disabled={!historicalCronStatus}
              >
                Run Now
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
