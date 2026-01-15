'use client';

import { useState, useEffect } from 'react';
import type { IEvent } from '@/models/Event';

interface Location {
  _id: string;
  name: string;
}

interface Channel {
  _id: string;
  name: string;
}

interface Member {
  _id: string;
  name: string;
}

interface Section {
  title: string;
  items: Array<{
    name: string;
    portion_count: number;
    prep_time_minutes?: number;
    dietary_restrictions?: string[];
  }>;
}

interface TimelineItem {
  time: string;
  activity: string;
  assigned_to?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface InventoryItem {
  item_name: string;
  quantity: number;
  unit: string;
  status: 'ordered' | 'received' | 'prepared';
}

interface StaffingItem {
  member_id: string;
  role: string;
  start_time: string;
  end_time: string;
  confirmed: boolean;
}

interface Event {
  _id?: string;
  name: string;
  client_name: string;
  guest_count: number;
  date: string;
  location_id?: string | { _id: string; name: string };
  channel_id?: string | { _id: string; name: string };
  assigned_to?: string | { _id: string; name: string };
  status?: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  sections?: Section[];
  timeline?: TimelineItem[];
  inventory?: InventoryItem[];
  staffing?: StaffingItem[];
  estimated_labor_cost?: number;
  actual_labor_cost?: number;
  revenue?: number;
  estimated_profit?: number;
}

interface EventFormProps {
  event?: Event;
  onSave: () => void;
  onCancel: () => void;
}

export default function EventForm({ event, onSave, onCancel }: EventFormProps) {
  const [formData, setFormData] = useState({
    name: event?.name || '',
    client_name: event?.client_name || '',
    guest_count: event?.guest_count || 0,
    date: event?.date ? new Date(event.date).toISOString().split('T')[0] : '',
    location_id: event?.location_id 
      ? (typeof event.location_id === 'object' ? event.location_id._id : event.location_id)
      : '',
    channel_id: event?.channel_id
      ? (typeof event.channel_id === 'object' ? event.channel_id._id : event.channel_id)
      : '',
    assigned_to: event?.assigned_to
      ? (typeof event.assigned_to === 'object' ? event.assigned_to._id : event.assigned_to)
      : '',
    status: event?.status || 'planning',
    sections: event?.sections || [],
    timeline: event?.timeline || [],
    inventory: event?.inventory || [],
    staffing: event?.staffing || [],
    estimated_labor_cost: event?.estimated_labor_cost || 0,
    actual_labor_cost: event?.actual_labor_cost || 0,
    revenue: event?.revenue || 0,
    estimated_profit: event?.estimated_profit || 0,
  });

  const [locations, setLocations] = useState<Location[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'sections' | 'timeline' | 'inventory' | 'staffing' | 'financial'>('basic');

  useEffect(() => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLocations(data.data);
      });
    
    fetch('/api/channels')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setChannels(data.data);
      });
    
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMembers(data.data);
      });
  }, []);

  const addSection = () => {
    setFormData({
      ...formData,
      sections: [...formData.sections, { title: '', items: [] }],
    });
  };

  const updateSection = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...formData.sections];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, sections: updated });
  };

  const addSectionItem = (sectionIndex: number) => {
    const updated = [...formData.sections];
    updated[sectionIndex].items.push({ name: '', portion_count: 0 });
    setFormData({ ...formData, sections: updated });
  };

  const updateSectionItem = (sectionIndex: number, itemIndex: number, field: string, value: string | number | boolean) => {
    const updated = [...formData.sections];
    updated[sectionIndex].items[itemIndex] = { ...updated[sectionIndex].items[itemIndex], [field]: value };
    setFormData({ ...formData, sections: updated });
  };

  const addTimelineItem = () => {
    setFormData({
      ...formData,
      timeline: [...formData.timeline, { time: '', activity: '', status: 'pending' }],
    });
  };

  const updateTimelineItem = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...formData.timeline];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, timeline: updated });
  };

  const addInventoryItem = () => {
    setFormData({
      ...formData,
      inventory: [...formData.inventory, { item_name: '', quantity: 0, unit: '', status: 'ordered' }],
    });
  };

  const updateInventoryItem = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...formData.inventory];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, inventory: updated });
  };

  const addStaffingItem = () => {
    setFormData({
      ...formData,
      staffing: [...formData.staffing, { member_id: '', role: '', start_time: '', end_time: '', confirmed: false }],
    });
  };

  const updateStaffingItem = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...formData.staffing];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, staffing: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        client_name: formData.client_name,
        guest_count: formData.guest_count,
        date: formData.date,
        location_id: formData.location_id || undefined,
        channel_id: formData.channel_id || undefined,
        assigned_to: formData.assigned_to || undefined,
        status: formData.status,
        sections: formData.sections.filter(s => s.title),
        timeline: formData.timeline.filter(t => t.time && t.activity),
        inventory: formData.inventory.filter(i => i.item_name),
        staffing: formData.staffing.filter(s => s.member_id && s.role),
        estimated_labor_cost: formData.estimated_labor_cost || undefined,
        actual_labor_cost: formData.actual_labor_cost || undefined,
        revenue: formData.revenue || undefined,
        estimated_profit: formData.estimated_profit || undefined,
        created_by: members[0]?._id || '',
      };

      const url = event?._id ? `/api/events/${event._id}` : '/api/events';
      const method = event?._id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        onSave();
      } else {
        setError(data.error || 'Failed to save event');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white border rounded-lg space-y-4">
      <div className="border-b flex gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={`pb-2 px-2 ${activeTab === 'basic' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Basic Info
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`pb-2 px-2 ${activeTab === 'sections' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Sections
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`pb-2 px-2 ${activeTab === 'timeline' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Timeline
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`pb-2 px-2 ${activeTab === 'inventory' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Inventory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('staffing')}
          className={`pb-2 px-2 ${activeTab === 'staffing' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Staffing
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('financial')}
          className={`pb-2 px-2 ${activeTab === 'financial' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Financial
        </button>
      </div>

      {activeTab === 'basic' && (
        <>
          <div>
            <input
              type="text"
              placeholder="Event Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded bg-white text-gray-900 text-lg font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
              <input
                type="text"
                placeholder="Client Name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guest Count *</label>
              <input
                type="number"
                min="1"
                value={formData.guest_count}
                onChange={(e) => setFormData({ ...formData, guest_count: parseInt(e.target.value) || 0 })}
                required
                className="w-full px-3 py-2 border rounded bg-white text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as IEvent['status'] })}
                className="w-full px-3 py-2 border rounded bg-white text-gray-900"
              >
                <option value="planning">Planning</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded bg-white text-gray-900"
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={formData.channel_id}
                onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                className="w-full px-3 py-2 border rounded bg-white text-gray-900"
              >
                <option value="">Select Channel (Optional)</option>
                {channels.map((channel) => (
                  <option key={channel._id} value={channel._id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border rounded bg-white text-gray-900"
            >
              <option value="">No Assignment</option>
              {members.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Assigned member will see this event in their dashboard</p>
          </div>
        </>
      )}

      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Menu Sections</h3>
            <button
              type="button"
              onClick={addSection}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              + Add Section
            </button>
          </div>
          {formData.sections.map((section, sIdx) => (
            <div key={sIdx} className="p-4 border rounded">
              <input
                type="text"
                placeholder="Section Title"
                value={section.title}
                onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white text-gray-900 mb-2"
              />
              {section.items.map((item, iIdx) => (
                <div key={iIdx} className="grid grid-cols-4 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Item Name"
                    value={item.name}
                    onChange={(e) => updateSectionItem(sIdx, iIdx, 'name', e.target.value)}
                    className="px-3 py-2 border rounded bg-white text-gray-900"
                  />
                  <input
                    type="number"
                    placeholder="Portions"
                    value={item.portion_count}
                    onChange={(e) => updateSectionItem(sIdx, iIdx, 'portion_count', parseInt(e.target.value) || 0)}
                    className="px-3 py-2 border rounded bg-white text-gray-900"
                  />
                  <input
                    type="number"
                    placeholder="Prep Time (min)"
                    value={item.prep_time_minutes || ''}
                    onChange={(e) => updateSectionItem(sIdx, iIdx, 'prep_time_minutes', parseInt(e.target.value) || undefined)}
                    className="px-3 py-2 border rounded bg-white text-gray-900"
                  />
                  <input
                    type="text"
                    placeholder="Dietary Restrictions"
                    value={(item.dietary_restrictions || []).join(', ')}
                    onChange={(e) => updateSectionItem(sIdx, iIdx, 'dietary_restrictions', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                    className="px-3 py-2 border rounded bg-white text-gray-900"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSectionItem(sIdx)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              >
                + Add Item
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Event Timeline</h3>
            <button
              type="button"
              onClick={addTimelineItem}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              + Add Timeline Item
            </button>
          </div>
          {formData.timeline.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 p-4 border rounded">
              <input
                type="time"
                value={item.time}
                onChange={(e) => updateTimelineItem(idx, 'time', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <input
                type="text"
                placeholder="Activity"
                value={item.activity}
                onChange={(e) => updateTimelineItem(idx, 'activity', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <select
                value={item.assigned_to || ''}
                onChange={(e) => updateTimelineItem(idx, 'assigned_to', e.target.value || undefined)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
              <select
                value={item.status}
                onChange={(e) => updateTimelineItem(idx, 'status', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Inventory</h3>
            <button
              type="button"
              onClick={addInventoryItem}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              + Add Item
            </button>
          </div>
          {formData.inventory.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 p-4 border rounded">
              <input
                type="text"
                placeholder="Item Name"
                value={item.item_name}
                onChange={(e) => updateInventoryItem(idx, 'item_name', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={item.quantity}
                onChange={(e) => updateInventoryItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <input
                type="text"
                placeholder="Unit"
                value={item.unit}
                onChange={(e) => updateInventoryItem(idx, 'unit', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <select
                value={item.status}
                onChange={(e) => updateInventoryItem(idx, 'status', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              >
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
                <option value="prepared">Prepared</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'staffing' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Staffing</h3>
            <button
              type="button"
              onClick={addStaffingItem}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              + Add Staff
            </button>
          </div>
          {formData.staffing.map((item, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2 p-4 border rounded">
              <select
                value={item.member_id}
                onChange={(e) => updateStaffingItem(idx, 'member_id', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              >
                <option value="">Select Member</option>
                {members.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Role"
                value={item.role}
                onChange={(e) => updateStaffingItem(idx, 'role', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <input
                type="datetime-local"
                value={item.start_time}
                onChange={(e) => updateStaffingItem(idx, 'start_time', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <input
                type="datetime-local"
                value={item.end_time}
                onChange={(e) => updateStaffingItem(idx, 'end_time', e.target.value)}
                className="px-3 py-2 border rounded bg-white text-gray-900"
              />
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={item.confirmed}
                  onChange={(e) => updateStaffingItem(idx, 'confirmed', e.target.checked)}
                  className="mr-2"
                />
                Confirmed
              </label>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Labor Cost</label>
            <input
              type="number"
              step="0.01"
              value={formData.estimated_labor_cost}
              onChange={(e) => setFormData({ ...formData, estimated_labor_cost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actual Labor Cost</label>
            <input
              type="number"
              step="0.01"
              value={formData.actual_labor_cost}
              onChange={(e) => setFormData({ ...formData, actual_labor_cost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Revenue</label>
            <input
              type="number"
              step="0.01"
              value={formData.revenue}
              onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Profit</label>
            <input
              type="number"
              step="0.01"
              value={formData.estimated_profit}
              onChange={(e) => setFormData({ ...formData, estimated_profit: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded bg-white text-gray-900"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Event'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
