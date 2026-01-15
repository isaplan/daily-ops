/**
 * @registry-id: EventFormComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Event form component using MVVM pattern and microcomponents with tabs
 * @last-fix: [2026-01-16] Refactored to use useEventViewModel + microcomponents
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useEventViewModel.ts => Event ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/viewmodels/useChannelViewModel.ts => Channel ViewModel
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/EventList.tsx => Uses EventForm
 */

'use client'

import { useEffect, useState } from 'react'
import { useEventViewModel } from '@/lib/viewmodels/useEventViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { useChannelViewModel } from '@/lib/viewmodels/useChannelViewModel'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { Event } from '@/lib/services/eventService'

interface EventFormProps {
  event?: Event
  onSave: () => void
  onCancel: () => void
}

export default function EventForm({ event, onSave, onCancel }: EventFormProps) {
  const viewModel = useEventViewModel(event)
  const locationViewModel = useLocationViewModel()
  const channelViewModel = useChannelViewModel()
  const memberViewModel = useMemberViewModel()
  const [sections, setSections] = useState(event?.sections || [])
  const [timeline, setTimeline] = useState(event?.timeline || [])
  const [inventory, setInventory] = useState(event?.inventory || [])
  const [staffing, setStaffing] = useState(event?.staffing || [])
  const [financial, setFinancial] = useState({
    estimated_labor_cost: event?.estimated_labor_cost || 0,
    actual_labor_cost: event?.actual_labor_cost || 0,
    revenue: event?.revenue || 0,
    estimated_profit: event?.estimated_profit || 0,
  })

  useEffect(() => {
    locationViewModel.loadLocations()
    channelViewModel.loadChannels()
    memberViewModel.loadMembers()
  }, [])

  const addSection = () => {
    setSections([...sections, { title: '', items: [] }])
  }

  const updateSection = (index: number, field: string, value: string) => {
    const updated = [...sections]
    updated[index] = { ...updated[index], [field]: value }
    setSections(updated)
  }

  const addSectionItem = (sectionIndex: number) => {
    const updated = [...sections]
    updated[sectionIndex].items.push({ name: '', portion_count: 0 })
    setSections(updated)
  }

  const updateSectionItem = (
    sectionIndex: number,
    itemIndex: number,
    field: string,
    value: string | number | string[]
  ) => {
    const updated = [...sections]
    updated[sectionIndex].items[itemIndex] = {
      ...updated[sectionIndex].items[itemIndex],
      [field]: value,
    }
    setSections(updated)
  }

  const addTimelineItem = () => {
    setTimeline([...timeline, { time: '', activity: '', status: 'pending' }])
  }

  const updateTimelineItem = (index: number, field: string, value: string) => {
    const updated = [...timeline]
    updated[index] = { ...updated[index], [field]: value }
    setTimeline(updated)
  }

  const addInventoryItem = () => {
    setInventory([...inventory, { item_name: '', quantity: 0, unit: '', status: 'ordered' }])
  }

  const updateInventoryItem = (index: number, field: string, value: string | number) => {
    const updated = [...inventory]
    updated[index] = { ...updated[index], [field]: value }
    setInventory(updated)
  }

  const addStaffingItem = () => {
    setStaffing([
      ...staffing,
      { member_id: '', role: '', start_time: '', end_time: '', confirmed: false },
    ])
  }

  const updateStaffingItem = (index: number, field: string, value: string | boolean) => {
    const updated = [...staffing]
    updated[index] = { ...updated[index], [field]: value }
    setStaffing(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      name: viewModel.formData.name,
      client_name: viewModel.formData.client_name,
      guest_count: viewModel.formData.guest_count,
      date: viewModel.formData.date,
      location_id: viewModel.formData.location_id || undefined,
      channel_id: viewModel.formData.channel_id || undefined,
      assigned_to: viewModel.formData.assigned_to || undefined,
      status: viewModel.formData.status,
      sections: sections.filter((s) => s.title),
      timeline: timeline.filter((t) => t.time && t.activity),
      inventory: inventory.filter((i) => i.item_name),
      staffing: staffing.filter((s) => s.member_id && s.role),
      estimated_labor_cost: financial.estimated_labor_cost || undefined,
      actual_labor_cost: financial.actual_labor_cost || undefined,
      revenue: financial.revenue || undefined,
      estimated_profit: financial.estimated_profit || undefined,
    }

    if (event?._id) {
      await viewModel.updateEvent(event._id, payload)
    } else {
      await viewModel.createEvent(payload)
    }

    if (!viewModel.error) {
      onSave()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{event ? 'Update Event' : 'Create Event'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="staffing">Staffing</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  value={viewModel.formData.name}
                  onChange={(e) => viewModel.setFormData({ name: e.target.value })}
                  required
                  className="text-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Client Name *</Label>
                  <Input
                    id="client_name"
                    value={viewModel.formData.client_name}
                    onChange={(e) => viewModel.setFormData({ client_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_count">Guest Count *</Label>
                  <Input
                    id="guest_count"
                    type="number"
                    min="1"
                    value={viewModel.formData.guest_count}
                    onChange={(e) =>
                      viewModel.setFormData({ guest_count: parseInt(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={viewModel.formData.date}
                    onChange={(e) => viewModel.setFormData({ date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={viewModel.formData.status}
                    onValueChange={(value) =>
                      viewModel.setFormData({ status: value as Event['status'] })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select
                    value={viewModel.formData.location_id}
                    onValueChange={(value) => viewModel.setFormData({ location_id: value })}
                    required
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locationViewModel.locations.map((loc) => (
                        <SelectItem key={loc._id} value={loc._id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <Select
                    value={viewModel.formData.channel_id}
                    onValueChange={(value) => viewModel.setFormData({ channel_id: value })}
                  >
                    <SelectTrigger id="channel">
                      <SelectValue placeholder="Select Channel (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {channelViewModel.channels.map((channel) => (
                        <SelectItem key={channel._id} value={channel._id}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To</Label>
                <Select
                  value={viewModel.formData.assigned_to}
                  onValueChange={(value) => viewModel.setFormData({ assigned_to: value })}
                >
                  <SelectTrigger id="assigned_to">
                    <SelectValue placeholder="No Assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Assignment</SelectItem>
                    {memberViewModel.members.map((member) => (
                      <SelectItem key={member._id} value={member._id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assigned member will see this event in their dashboard
                </p>
              </div>
            </TabsContent>

            <TabsContent value="sections" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Menu Sections</h3>
                <Button type="button" variant="outline" size="sm" onClick={addSection}>
                  + Add Section
                </Button>
              </div>
              {sections.map((section, sIdx) => (
                <Card key={sIdx}>
                  <CardHeader>
                    <Input
                      placeholder="Section Title"
                      value={section.title}
                      onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
                    />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {section.items.map((item, iIdx) => (
                      <div key={iIdx} className="grid grid-cols-4 gap-2">
                        <Input
                          placeholder="Item Name"
                          value={item.name}
                          onChange={(e) => updateSectionItem(sIdx, iIdx, 'name', e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="Portions"
                          value={item.portion_count}
                          onChange={(e) =>
                            updateSectionItem(
                              sIdx,
                              iIdx,
                              'portion_count',
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Prep Time (min)"
                          value={item.prep_time_minutes || ''}
                          onChange={(e) =>
                            updateSectionItem(
                              sIdx,
                              iIdx,
                              'prep_time_minutes',
                              parseInt(e.target.value) || undefined
                            )
                          }
                        />
                        <Input
                          placeholder="Dietary Restrictions"
                          value={(item.dietary_restrictions || []).join(', ')}
                          onChange={(e) =>
                            updateSectionItem(
                              sIdx,
                              iIdx,
                              'dietary_restrictions',
                              e.target.value.split(',').map((s) => s.trim()).filter((s) => s)
                            )
                          }
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSectionItem(sIdx)}
                    >
                      + Add Item
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Event Timeline</h3>
                <Button type="button" variant="outline" size="sm" onClick={addTimelineItem}>
                  + Add Timeline Item
                </Button>
              </div>
              {timeline.map((item, idx) => (
                <Card key={idx}>
                  <CardContent className="grid grid-cols-4 gap-2 pt-6">
                    <Input
                      type="time"
                      value={item.time}
                      onChange={(e) => updateTimelineItem(idx, 'time', e.target.value)}
                    />
                    <Input
                      placeholder="Activity"
                      value={item.activity}
                      onChange={(e) => updateTimelineItem(idx, 'activity', e.target.value)}
                    />
                    <Select
                      value={item.assigned_to || ''}
                      onValueChange={(value) => updateTimelineItem(idx, 'assigned_to', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {memberViewModel.members.map((m) => (
                          <SelectItem key={m._id} value={m._id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={item.status}
                      onValueChange={(value) => updateTimelineItem(idx, 'status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Inventory</h3>
                <Button type="button" variant="outline" size="sm" onClick={addInventoryItem}>
                  + Add Item
                </Button>
              </div>
              {inventory.map((item, idx) => (
                <Card key={idx}>
                  <CardContent className="grid grid-cols-4 gap-2 pt-6">
                    <Input
                      placeholder="Item Name"
                      value={item.item_name}
                      onChange={(e) => updateInventoryItem(idx, 'item_name', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) =>
                        updateInventoryItem(idx, 'quantity', parseInt(e.target.value) || 0)
                      }
                    />
                    <Input
                      placeholder="Unit"
                      value={item.unit}
                      onChange={(e) => updateInventoryItem(idx, 'unit', e.target.value)}
                    />
                    <Select
                      value={item.status}
                      onValueChange={(value) => updateInventoryItem(idx, 'status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="prepared">Prepared</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="staffing" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Staffing</h3>
                <Button type="button" variant="outline" size="sm" onClick={addStaffingItem}>
                  + Add Staff
                </Button>
              </div>
              {staffing.map((item, idx) => (
                <Card key={idx}>
                  <CardContent className="grid grid-cols-5 gap-2 pt-6">
                    <Select
                      value={item.member_id}
                      onValueChange={(value) => updateStaffingItem(idx, 'member_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Member" />
                      </SelectTrigger>
                      <SelectContent>
                        {memberViewModel.members.map((m) => (
                          <SelectItem key={m._id} value={m._id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Role"
                      value={item.role}
                      onChange={(e) => updateStaffingItem(idx, 'role', e.target.value)}
                    />
                    <Input
                      type="datetime-local"
                      value={item.start_time}
                      onChange={(e) => updateStaffingItem(idx, 'start_time', e.target.value)}
                    />
                    <Input
                      type="datetime-local"
                      value={item.end_time}
                      onChange={(e) => updateStaffingItem(idx, 'end_time', e.target.value)}
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={item.confirmed}
                        onCheckedChange={(checked) =>
                          updateStaffingItem(idx, 'confirmed', checked === true)
                        }
                      />
                      <Label>Confirmed</Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated_labor_cost">Estimated Labor Cost</Label>
                  <Input
                    id="estimated_labor_cost"
                    type="number"
                    step="0.01"
                    value={financial.estimated_labor_cost}
                    onChange={(e) =>
                      setFinancial({
                        ...financial,
                        estimated_labor_cost: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual_labor_cost">Actual Labor Cost</Label>
                  <Input
                    id="actual_labor_cost"
                    type="number"
                    step="0.01"
                    value={financial.actual_labor_cost}
                    onChange={(e) =>
                      setFinancial({
                        ...financial,
                        actual_labor_cost: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenue">Revenue</Label>
                  <Input
                    id="revenue"
                    type="number"
                    step="0.01"
                    value={financial.revenue}
                    onChange={(e) =>
                      setFinancial({ ...financial, revenue: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimated_profit">Estimated Profit</Label>
                  <Input
                    id="estimated_profit"
                    type="number"
                    step="0.01"
                    value={financial.estimated_profit}
                    onChange={(e) =>
                      setFinancial({
                        ...financial,
                        estimated_profit: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {viewModel.error && (
            <Alert variant="destructive">
              <AlertDescription>{viewModel.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={viewModel.loading}>
              {viewModel.loading ? 'Saving...' : 'Save Event'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
