'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, TestTube, CheckCircle, XCircle, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEnvironment } from '@/lib/environmentContext'

type CredentialItem = {
  _id: string
  locationId: string
  locationName: string | null
  baseUrl: string
  hasApiKey: boolean
}

type LocationItem = { _id: string; name: string }

type ClientProps = {
  params?: Record<string, string | string[]>
  searchParams?: Record<string, string | string[] | undefined>
}

export default function BorkApiSettingsClient(_props: ClientProps) {
  const { setActiveEnvironment } = useEnvironment()
  const [credentials, setCredentials] = useState<CredentialItem[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [editing, setEditing] = useState<Record<string, { baseUrl: string; apiKey: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, 'success' | 'error'>>({})

  const [addLocationId, setAddLocationId] = useState('')
  const [addBaseUrl, setAddBaseUrl] = useState('')
  const [addApiKey, setAddApiKey] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const [dailyCronStatus, setDailyCronStatus] = useState<Record<string, unknown> | null>(null)
  const [masterCronStatus, setMasterCronStatus] = useState<Record<string, unknown> | null>(null)
  const [historicalCronStatus, setHistoricalCronStatus] = useState<Record<string, unknown> | null>(null)
  const [isLoadingCronStatus, setIsLoadingCronStatus] = useState(false)

  useEffect(() => {
    setActiveEnvironment('daily-ops')
  }, [setActiveEnvironment])

  const loadCredentials = async () => {
    try {
      const res = await fetch('/api/bork/v2/credentials')
      const data = await res.json()
      if (data.success && Array.isArray(data.credentials)) {
        setCredentials(data.credentials)
      } else if (!res.ok) {
        toast.error(data.error || 'Failed to load credentials')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load credentials')
    }
  }

  const loadLocations = async () => {
    try {
      const res = await fetch('/api/bork/v2/locations')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.locations)) setLocations(data.locations)
      }
    } catch {
      // silent
    }
  }

  const loadCronStatus = async () => {
    setIsLoadingCronStatus(true)
    try {
      const [daily, master, historical] = await Promise.all([
        fetch('/api/bork/v2/cron?jobType=daily-data'),
        fetch('/api/bork/v2/cron?jobType=master-data'),
        fetch('/api/bork/v2/cron?jobType=historical-data'),
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
    } catch {
      // silent
    } finally {
      setIsLoadingCronStatus(false)
    }
  }

  useEffect(() => {
    loadCredentials()
    loadLocations()
    loadCronStatus()
  }, [])

  const getEdit = (c: CredentialItem) => editing[c._id] ?? { baseUrl: c.baseUrl, apiKey: '' }
  const setEdit = (credId: string, baseUrl: string, apiKey: string) => {
    setEditing((prev) => ({ ...prev, [credId]: { baseUrl, apiKey } }))
  }

  const handleSaveCredential = async (c: CredentialItem) => {
    const e = getEdit(c)
    if (!e.baseUrl.trim()) {
      toast.error('Base URL is required')
      return
    }
    setSavingId(c._id)
    try {
      const body: { locationId: string; baseUrl: string; apiKey?: string } = {
        locationId: c.locationId,
        baseUrl: e.baseUrl.trim(),
      }
      if (e.apiKey.trim()) body.apiKey = e.apiKey.trim()
      const res = await fetch('/api/bork/v2/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('Credentials saved')
        setEditing((prev) => ({ ...prev, [c._id]: { baseUrl: e.baseUrl, apiKey: '' } }))
        loadCredentials()
      } else {
        toast.error(result.error || 'Failed to save')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingId(null)
    }
  }

  const handleTestCredential = async (locationId: string, credId: string) => {
    setTestingId(credId)
    try {
      const res = await fetch('/api/bork/v2/master-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, endpoint: 'product_groups' }),
      })
      const result = await res.json()
      if (result.success) {
        setTestResult((prev) => ({ ...prev, [credId]: 'success' }))
        toast.success('Connection successful')
      } else {
        setTestResult((prev) => ({ ...prev, [credId]: 'error' }))
        toast.error(result.error || 'Connection failed')
      }
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [credId]: 'error' }))
      toast.error(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setTestingId(null)
    }
  }

  const handleAddCredential = async () => {
    if (!addLocationId || !addBaseUrl.trim() || !addApiKey.trim()) {
      toast.error('Select location and enter base URL and API key')
      return
    }
    setIsAdding(true)
    try {
      const res = await fetch('/api/bork/v2/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: addLocationId, baseUrl: addBaseUrl.trim(), apiKey: addApiKey.trim() }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('Credentials saved')
        setAddLocationId('')
        setAddBaseUrl('')
        setAddApiKey('')
        setAddModalOpen(false)
        loadCredentials()
      } else {
        toast.error(result.error || 'Failed to save')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsAdding(false)
    }
  }

  const handleCronAction = async (jobType: string, action: string, config?: Record<string, unknown>) => {
    try {
      if (action === 'start') {
        const currentStatus =
          jobType === 'daily-data' ? dailyCronStatus :
          jobType === 'master-data' ? masterCronStatus :
          historicalCronStatus
        if (!currentStatus) {
          const defaultConfig = {
            isActive: true,
            schedule: jobType === 'daily-data' ? '0 1,8,15,18,19,20,21,23 * * *' :
                     jobType === 'master-data' ? '0 0 * * *' :
                     '0 1 * * *',
          }
          const createResponse = await fetch('/api/bork/v2/cron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', jobType, config: defaultConfig }),
          })
          const createResult = await createResponse.json()
          if (!createResult.success) {
            toast.error(createResult.error || 'Failed to create cron job')
            return
          }
        }
      }
      const isRunNow = action === 'run-now'
      if (isRunNow) {
        toast.info(`Running ${jobType.replace(/-/g, ' ')}…`, { description: 'This may take a few minutes for historical.' })
      }
      const controller = new AbortController()
      const timeoutId = isRunNow ? window.setTimeout(() => controller.abort(), 300000) : undefined
      const response = await fetch('/api/bork/v2/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, jobType, config }),
        signal: controller.signal,
      })
      if (timeoutId) window.clearTimeout(timeoutId)
      const result = await response.json()
      if (result.success) {
        const detail =
          result.credentialsRun != null
            ? `Locations: ${result.credentialsRun}, Records saved: ${result.totalRecordsSaved ?? 0}${result.totalTicketsProcessed != null ? `, Tickets: ${result.totalTicketsProcessed}` : ''}`
            : undefined
        toast.success(result.message || 'Action completed successfully', { description: detail })
        await loadCronStatus()
      } else {
        toast.error(result.error || 'Action failed')
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request timed out. Check the terminal for sync progress.')
      } else {
        toast.error(error instanceof Error ? error.message : 'Action failed')
      }
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Bork API Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your Bork API connection and automated sync schedules (all locations)
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
              <CardTitle>API Credentials (per location)</CardTitle>
              <CardDescription>
                Each location has its own base URL and API key. Edit and save per location; leave API key blank to keep current.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {credentials.map((c) => {
                const e = getEdit(c)
                const isSaving = savingId === c._id
                const isTesting = testingId === c._id
                const status = testResult[c._id]
                return (
                  <div key={c._id} className="rounded-lg border p-4 space-y-3">
                    <div className="font-medium">{c.locationName ?? c.locationId}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Base URL</Label>
                        <Input
                          value={e.baseUrl}
                          onChange={(ev) => setEdit(c._id, ev.target.value, e.apiKey)}
                          placeholder="https://xxx.trivecgateway.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">API Key</Label>
                        <Input
                          type="password"
                          value={e.apiKey}
                          onChange={(ev) => setEdit(c._id, e.baseUrl, ev.target.value)}
                          placeholder={c.hasApiKey ? 'Leave blank to keep current' : 'Your API key (appid)'}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleSaveCredential(c)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="ml-1">Save</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleTestCredential(c.locationId, c._id)} disabled={isTesting}>
                        {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                        <span className="ml-1">Test</span>
                      </Button>
                      {status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </div>
                )
              })}

              {credentials.length === 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    No Bork credentials found. Add credentials per location below. Ensure this app uses the same <code className="text-xs">MONGODB_URI</code> and <code className="text-xs">MONGODB_DB_NAME</code> where locations and api_credentials (provider: bork) are stored.
                  </AlertDescription>
                </Alert>
              )}

              <div className="border-t pt-4 mt-4">
                <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add credential
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add credential for another location</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Select value={addLocationId} onValueChange={setAddLocationId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations
                              .filter((loc) => !credentials.some((cr) => cr.locationId === loc._id))
                              .map((loc) => (
                                <SelectItem key={loc._id} value={loc._id}>{loc.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Base URL</Label>
                        <Input
                          value={addBaseUrl}
                          onChange={(ev) => setAddBaseUrl(ev.target.value)}
                          placeholder="https://xxx.trivecgateway.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={addApiKey}
                          onChange={(ev) => setAddApiKey(ev.target.value)}
                          placeholder="API key"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleAddCredential}
                        disabled={isAdding || !addLocationId || !addBaseUrl.trim() || !addApiKey.trim()}
                      >
                        {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add credential
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron-jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Data Sync</CardTitle>
              <CardDescription>Automated sync for today&apos;s sales data. Runs for all locations with Bork credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Daily Data Sync</Label>
                  <p className="text-sm text-muted-foreground">Sync today&apos;s data at set times for all locations</p>
                  <p className="text-xs text-muted-foreground/80">Sync runs at 01:00, 08:00, 15:00, 18:00, 19:00, 20:00, 21:00, 23:00 (Europe/Amsterdam)</p>
                </div>
                <Switch
                  checked={Boolean(dailyCronStatus?.isActive)}
                  onCheckedChange={(checked) => handleCronAction('daily-data', checked ? 'start' : 'stop')}
                />
              </div>
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Scope</Label>
                <p className="text-sm text-muted-foreground">All locations with Bork credentials; sales (tickets) for today</p>
              </div>
              {dailyCronStatus?.lastRun && (
                <p className="text-sm text-muted-foreground">
                  Last run: {new Date((dailyCronStatus.lastRunUTC as string) || (dailyCronStatus.lastRun as string)).toLocaleString()}
                </p>
              )}
              {!dailyCronStatus && (
                <p className="text-sm text-muted-foreground">Cron job not configured yet. Toggle the switch to create it.</p>
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
              <CardDescription>Sync product groups, payment methods, cost centers, and users. Runs for all locations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Master Data Sync</Label>
                  <p className="text-sm text-muted-foreground">Sync master data daily for all locations</p>
                </div>
                <Switch
                  checked={Boolean(masterCronStatus?.isActive)}
                  onCheckedChange={(checked) => handleCronAction('master-data', checked ? 'start' : 'stop')}
                />
              </div>
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Endpoints (all locations)</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">product_groups</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">payment_methods</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">cost_centers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">users</span>
                  </div>
                </div>
              </div>
              {masterCronStatus?.lastRun && (
                <p className="text-sm text-muted-foreground">
                  Last run: {new Date((masterCronStatus.lastRunUTC as string) || (masterCronStatus.lastRun as string)).toLocaleString()}
                </p>
              )}
              {!masterCronStatus && (
                <p className="text-sm text-muted-foreground">Cron job not configured yet. Toggle the switch to create it.</p>
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
              <CardDescription>Sync last 30 days of sales data to catch any missed changes. Runs for all locations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Historical Data Sync</Label>
                  <p className="text-sm text-muted-foreground">Sync last 30 days daily for all locations</p>
                </div>
                <Switch
                  checked={Boolean(historicalCronStatus?.isActive)}
                  onCheckedChange={(checked) => handleCronAction('historical-data', checked ? 'start' : 'stop')}
                />
              </div>
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Scope</Label>
                <p className="text-sm text-muted-foreground">All locations; sales (tickets) for last 30 days</p>
              </div>
              {historicalCronStatus?.lastRun && (
                <p className="text-sm text-muted-foreground">
                  Last run: {new Date((historicalCronStatus.lastRunUTC as string) || (historicalCronStatus.lastRun as string)).toLocaleString()}
                </p>
              )}
              {!historicalCronStatus && (
                <p className="text-sm text-muted-foreground">Cron job not configured yet. Toggle the switch to create it.</p>
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
