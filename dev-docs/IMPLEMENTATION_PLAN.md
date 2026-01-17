# Unified Member-Centric Business App - Implementation Plan

**Project:** Private Slack + Ops Hub + Financial Dashboard
**Stack:** Next.js 15 + MongoDB + Socket.io + Shadcn + Tailwind
**Timeline:** 16 weeks (4 phases)
**Team Size:** Flexible (designed for 1-3 developers)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase Overview](#phase-overview)
3. [Phase 1: Foundation & Core Models (Weeks 1-4)](#phase-1-foundation--core-models-weeks-1-4)
4. [Phase 2: Member-Centric Dashboards (Weeks 5-8)](#phase-2-member-centric-dashboards-weeks-5-8)
5. [Phase 3: Real-Time & External Integrations (Weeks 9-12)](#phase-3-real-time--external-integrations-weeks-9-12)
6. [Phase 4: Events & Advanced Features (Weeks 13-16)](#phase-4-events--advanced-features-weeks-13-16)
7. [Data Models](#data-models)
8. [API Endpoints](#api-endpoints)
9. [WebSocket Events](#websocket-events)
10. [External Integrations](#external-integrations)
11. [Deployment & Infrastructure](#deployment--infrastructure)

---

## Executive Summary

This app unifies member management, task tracking, real-time communication, and financial data in a single platform that feels like a private Slack but acts as an operational hub.

**Core Concept:**
- **Members** are the central hub - everything connects to them
- **Teams & Locations** aggregate member data
- **Slack OAuth** syncs member identity
- **Eitje API + Excel** provides dual-verified labor data
- **Pasy PDFs + Email ingestion** auto-parses events and financial data
- **WebSocket** enables instant updates
- **Role-based dashboards** show different views per person

**Target Users:**
- Kitchen staff: See assigned tasks, daily shifts, personal stats
- Waitstaff: Track revenue, assigned tables, performance ratings
- Team managers: Monitor team productivity, tasks, schedules
- Location managers: View all teams, financial data, KPIs
- Overall manager (you): Cross-location insights, alerts, decisions

---

## Phase Overview

```
Phase 1: Foundation (Weeks 1-4)
├─ Database design & setup
├─ Core collections (Member, Team, Location, Note, Todo, Decision, Channel)
├─ Authentication (Slack OAuth)
├─ Basic API routes
└─ Testing & deployment pipeline

Phase 2: Member Dashboards (Weeks 5-8)
├─ Member-centric dashboard UI
├─ Team dashboard UI
├─ Location dashboard UI
├─ Role-based access control
├─ Initial labor sync (Eitje API read)
└─ Financial data upload (Excel)

Phase 3: Real-Time & Integrations (Weeks 9-12)
├─ WebSocket server setup (Socket.io)
├─ Real-time messaging
├─ Dual labor verification (API + Excel)
├─ Email ingestion (labor, finance, events)
├─ Slack member sync
└─ Data verification dashboard

Phase 4: Events & Advanced (Weeks 13-16)
├─ Events module with PDF extraction
├─ Event timeline & scheduling
├─ Inventory management from PDFs
├─ Event dashboard & analytics
├─ Performance metrics & reporting
├─ Polish & optimization
└─ Production launch
```

---

## Phase 1: Foundation & Core Models (Weeks 1-4)

### Goals
- Set up development environment
- Design and implement MongoDB schema
- Build authentication system
- Create API routes for core operations
- Deploy to Vercel staging

### Week 1: Setup & Database Design

#### Tasks

**1.1 Project Initialization**
```bash
# Create Next.js project
npx create-next-app@latest unified-ops --typescript --tailwind
cd unified-ops

# Install dependencies
npm install mongoose next-auth @slack/web-api socket.io socket.io-client
npm install zod react-hook-form @hookform/resolvers
npm install date-fns uuid axios
npm install -D @types/node
```

**1.2 Environment Configuration**
```env
# .env.local

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/unified-ops
MONGODB_DB_NAME=unified-ops

# Slack OAuth
SLACK_CLIENT_ID=xoxb-xxxxx
SLACK_CLIENT_SECRET=xxxxx
SLACK_BOT_TOKEN=xoxb-xxxxx
SLACK_SIGNING_SECRET=xxxxx

# Eitje API
EITJE_API_URL=https://api.eitje.com/v1
EITJE_API_KEY=xxxxx

# Email (IMAP for labor & finance imports)
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EVENT_EMAIL=event@app.yourdomain.com
EVENT_EMAIL_PASSWORD=[app-password]
FINANCE_EMAIL=finances@app.yourdomain.com
FINANCE_EMAIL_PASSWORD=[app-password]

# AWS S3 (for file storage)
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_S3_BUCKET=unified-ops-files

# App
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
```

**1.3 Database Connection**
```typescript
// lib/mongodb.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
```

**1.4 Create Core Schema Files**
```
src/
├─ models/
│  ├─ Member.ts
│  ├─ Location.ts
│  ├─ Team.ts
│  ├─ Note.ts
│  ├─ Todo.ts
│  ├─ Decision.ts
│  ├─ Channel.ts
│  ├─ Message.ts
│  ├─ LaborRecord.ts
│  ├─ RevenueRecord.ts
│  ├─ FinancialSummary.ts
│  ├─ Event.ts
│  └─ index.ts
├─ types/
│  ├─ index.ts
│  ├─ member.ts
│  ├─ content.ts
│  └─ financial.ts
├─ lib/
│  └─ mongodb.ts
└─ app/
   ├─ api/
   │  ├─ auth/[...nextauth]/
   │  ├─ members/
   │  ├─ teams/
   │  └─ locations/
   └─ (authenticated)/
      ├─ dashboard/
      ├─ notes/
      ├─ todos/
      └─ channels/
```

### Week 2: Core Models Implementation

#### Tasks

**2.1 Member Model**
```typescript
// src/models/Member.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMember extends Document {
  // Identity
  name: string;
  email: string;
  slack_id: string;
  slack_username: string;
  slack_avatar: string;
  slack_real_name: string;
  
  // Organization
  location_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  secondary_locations: Array<{
    location_id: mongoose.Types.ObjectId;
    team_ids: mongoose.Types.ObjectId[];
    type: 'detached' | 'support';
  }>;
  
  // Roles & Permissions
  roles: Array<{
    role: 'kitchen_staff' | 'waitress' | 'manager' | 'overall_manager' | 'finance_manager';
    scope: 'self' | 'team' | 'location' | 'company';
    permissions: string[];
    grantedAt: Date;
  }>;
  
  // External Mappings
  eitje_id?: number;
  bork_id?: string;
  outlook_email?: string;
  
  // Aggregated Activity
  this_period: {
    hours_worked: number;
    revenue_generated: number;
    tasks_completed: number;
    tasks_assigned: number;
    notes_created: number;
    messages_sent: number;
    decisions_involved_in: number;
  };
  
  // Status
  current_location: mongoose.Types.ObjectId;
  current_team: mongoose.Types.ObjectId;
  is_active: boolean;
  last_seen: Date;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  last_synced_from_slack: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    slack_id: { type: String, required: true, unique: true },
    slack_username: { type: String },
    slack_avatar: { type: String },
    slack_real_name: { type: String },
    
    location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
    team_id: { type: Schema.Types.ObjectId, ref: 'Team' },
    secondary_locations: [{
      location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
      team_ids: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
      type: { type: String, enum: ['detached', 'support'] }
    }],
    
    roles: [{
      role: { type: String, enum: ['kitchen_staff', 'waitress', 'manager', 'overall_manager', 'finance_manager'] },
      scope: { type: String, enum: ['self', 'team', 'location', 'company'] },
      permissions: [String],
      grantedAt: { type: Date, default: Date.now }
    }],
    
    eitje_id: { type: Number },
    bork_id: { type: String },
    outlook_email: { type: String },
    
    this_period: {
      hours_worked: { type: Number, default: 0 },
      revenue_generated: { type: Number, default: 0 },
      tasks_completed: { type: Number, default: 0 },
      tasks_assigned: { type: Number, default: 0 },
      notes_created: { type: Number, default: 0 },
      messages_sent: { type: Number, default: 0 },
      decisions_involved_in: { type: Number, default: 0 }
    },
    
    current_location: { type: Schema.Types.ObjectId, ref: 'Location' },
    current_team: { type: Schema.Types.ObjectId, ref: 'Team' },
    is_active: { type: Boolean, default: true },
    last_seen: { type: Date, default: Date.now },
    
    last_synced_from_slack: { type: Date }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

MemberSchema.index({ slack_id: 1 });
MemberSchema.index({ email: 1 });
MemberSchema.index({ location_id: 1, team_id: 1 });

export const Member: Model<IMember> = 
  mongoose.models.Member || mongoose.model<IMember>('Member', MemberSchema);
```

**2.2 Location Model**
```typescript
// src/models/Location.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  hq_parent_id?: mongoose.Types.ObjectId;
  
  // Statistics (computed)
  total_members: number;
  active_members: number;
  
  // Period stats
  this_period: {
    total_hours: number;
    total_labor_cost: number;
    total_revenue: number;
    total_transactions: number;
    task_completion_rate: number;
    events_serviced: number;
    events_revenue: number;
  };
  
  created_at: Date;
  updated_at: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true },
    description: { type: String },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    hq_parent_id: { type: Schema.Types.ObjectId, ref: 'Location' },
    
    total_members: { type: Number, default: 0 },
    active_members: { type: Number, default: 0 },
    
    this_period: {
      total_hours: { type: Number, default: 0 },
      total_labor_cost: { type: Number, default: 0 },
      total_revenue: { type: Number, default: 0 },
      total_transactions: { type: Number, default: 0 },
      task_completion_rate: { type: Number, default: 0 },
      events_serviced: { type: Number, default: 0 },
      events_revenue: { type: Number, default: 0 }
    }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

LocationSchema.index({ city: 1 });

export const Location: Model<ILocation> = 
  mongoose.models.Location || mongoose.model<ILocation>('Location', LocationSchema);
```

**2.3 Team Model**
```typescript
// src/models/Team.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  description: string;
  type: 'kitchen' | 'service' | 'management' | 'other';
  location_id: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  
  // Period stats
  this_period: {
    total_hours: number;
    total_labor_cost: number;
    total_revenue: number;
    task_completion_rate: number;
    quality_score: number;
    events_serviced: number;
  };
  
  created_at: Date;
  updated_at: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['kitchen', 'service', 'management', 'other'] },
    location_id: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    
    this_period: {
      total_hours: { type: Number, default: 0 },
      total_labor_cost: { type: Number, default: 0 },
      total_revenue: { type: Number, default: 0 },
      task_completion_rate: { type: Number, default: 0 },
      quality_score: { type: Number, default: 0 },
      events_serviced: { type: Number, default: 0 }
    }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

TeamSchema.index({ location_id: 1 });

export const Team: Model<ITeam> = 
  mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);
```

**2.4 Note, Todo, Decision Models** (simplified here, full schema in separate files)
```typescript
// src/models/Note.ts
// src/models/Todo.ts
// src/models/Decision.ts
// (See detailed models in Phase 1 Week 3)
```

### Week 3: Content Models & Channels

**3.1 Note Model**
```typescript
// src/models/Note.ts
export interface INote extends Document {
  title: string;
  content: any; // Rich text/JSON
  created_by: mongoose.Types.ObjectId;
  location_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  scope: 'personal' | 'team' | 'location' | 'public';
  
  mentioned_members: mongoose.Types.ObjectId[];
  linked_todos: mongoose.Types.ObjectId[];
  linked_decisions: mongoose.Types.ObjectId[];
  
  comments: Array<{
    member_id: mongoose.Types.ObjectId;
    text: string;
    timestamp: Date;
    reactions: Record<string, number>;
  }>;
  
  tags: string[];
  views_by_member: Array<{ member_id: mongoose.Types.ObjectId; last_viewed: Date }>;
  
  created_at: Date;
  updated_at: Date;
}

// [Full schema implementation with indexes]
```

**3.2 Todo Model**
```typescript
// src/models/Todo.ts
export interface ITodo extends Document {
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'done';
  priority: 1 | 2 | 3 | 4 | 5;
  
  owner_id: mongoose.Types.ObjectId;
  assigned_to: mongoose.Types.ObjectId[];
  
  location_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  
  linked_note: mongoose.Types.ObjectId;
  linked_decision: mongoose.Types.ObjectId;
  linked_event: mongoose.Types.ObjectId;
  
  due_date: Date;
  estimated_hours: number;
  actual_hours: number;
  progress: number; // 0-100
  
  comments: Array<{
    member_id: mongoose.Types.ObjectId;
    text: string;
    timestamp: Date;
  }>;
  
  activity: Array<{
    member_id: mongoose.Types.ObjectId;
    action: 'created' | 'status_changed' | 'assigned' | 'commented';
    old_value: any;
    new_value: any;
    timestamp: Date;
  }>;
  
  created_at: Date;
  updated_at: Date;
}

// [Full schema implementation with indexes]
```

**3.3 Decision Model**
```typescript
// src/models/Decision.ts
export interface IDecision extends Document {
  title: string;
  description: string;
  decided_by: mongoose.Types.ObjectId;
  
  location_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  
  affects_members: mongoose.Types.ObjectId[];
  requires_input_from: mongoose.Types.ObjectId[];
  approved_by: mongoose.Types.ObjectId[];
  
  linked_note: mongoose.Types.ObjectId;
  linked_todos: mongoose.Types.ObjectId[];
  
  status: 'proposed' | 'approved' | 'in_effect' | 'changed' | 'archived';
  
  acknowledgements: Array<{
    member_id: mongoose.Types.ObjectId;
    acknowledged_at: Date;
    feedback: string;
  }>;
  
  comments: Array<{
    member_id: mongoose.Types.ObjectId;
    text: string;
    timestamp: Date;
  }>;
  
  created_at: Date;
  updated_at: Date;
}

// [Full schema implementation with indexes]
```

**3.4 Channel & Message Models**
```typescript
// src/models/Channel.ts
export interface IChannel extends Document {
  name: string;
  description: string;
  type: 'location' | 'team' | 'announcement' | 'project' | 'direct';
  
  location_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  
  members: mongoose.Types.ObjectId[];
  created_by: mongoose.Types.ObjectId;
  
  messages: IMessage[];
  pinned_messages: mongoose.Types.ObjectId[];
  
  channel_activity: {
    total_messages: number;
    last_message_at: Date;
    member_message_count: Record<string, number>;
  };
  
  created_at: Date;
  updated_at: Date;
}

export interface IMessage {
  _id: mongoose.Types.ObjectId;
  member_id: mongoose.Types.ObjectId;
  text: string;
  timestamp: Date;
  edited: Date;
  reactions: Record<string, mongoose.Types.ObjectId[]>;
  
  mentioned_members: mongoose.Types.ObjectId[];
  linked_todo: mongoose.Types.ObjectId;
  linked_note: mongoose.Types.ObjectId;
  
  thread: Array<{
    member_id: mongoose.Types.ObjectId;
    text: string;
    timestamp: Date;
    reactions: Record<string, number>;
  }>;
}

// [Full schema implementation with indexes]
```

### Week 4: Authentication & API Routes

**4.1 Slack OAuth Setup**
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import SlackProvider from 'next-auth/providers/slack';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb-adapter';

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    SlackProvider({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**4.2 Member API Routes**
```typescript
// src/app/api/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import { Member } from '@/models/Member';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const members = await Member.find({ is_active: true })
      .populate('location_id team_id')
      .lean();
    
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// src/app/api/members/[id]/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const member = await Member.findById(params.id)
      .populate('location_id team_id secondary_locations.location_id secondary_locations.team_ids');
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    
    return NextResponse.json(member);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

**4.3 Todo API Routes**
```typescript
// src/app/api/todos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import { Todo } from '@/models/Todo';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const team_id = searchParams.get('team_id');
    const location_id = searchParams.get('location_id');
    const status = searchParams.get('status');
    
    const query: any = {};
    if (team_id) query.team_id = team_id;
    if (location_id) query.location_id = location_id;
    if (status) query.status = status;
    
    const todos = await Todo.find(query)
      .populate('owner_id assigned_to linked_note')
      .sort({ due_date: 1 })
      .lean();
    
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    
    const body = await req.json();
    
    const todo = new Todo({
      ...body,
      owner_id: session.user.id,
      created_at: new Date(),
    });
    
    await todo.save();
    
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

**4.4 Channel API Routes**
```typescript
// src/app/api/channels/route.ts
// Similar pattern to todos

// src/app/api/channels/[id]/messages/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Get messages for channel
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Add message to channel
}
```

### Week 4 Deliverables
- ✅ MongoDB connection
- ✅ All core schemas defined
- ✅ Slack OAuth authentication
- ✅ REST API routes for CRUD operations
- ✅ Tests for core routes
- ✅ Deployed to Vercel staging

---

## Phase 2: Member-Centric Dashboards (Weeks 5-8)

### Goals
- Build role-based dashboard UI
- Implement member stats aggregation
- Create location & team views
- Build financial data upload interface
- Implement Eitje API read sync

### Week 5: Member Dashboard UI

**5.1 Dashboard Layout**
```typescript
// src/app/(authenticated)/dashboard/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MemberStatsCard from '@/components/dashboard/MemberStatsCard';
import AssignedTodosCard from '@/components/dashboard/AssignedTodosCard';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import MembersForMeSection from '@/components/dashboard/MembersForMeSection';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [member, setMember] = useState(null);
  const [todos, setTodos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      fetchMemberData();
    }
  }, [session]);

  async function fetchMemberData() {
    try {
      const [memberRes, todosRes, messagesRes] = await Promise.all([
        fetch(`/api/members/${session.user.id}`),
        fetch(`/api/todos?assigned_to=${session.user.id}`),
        fetch(`/api/messages?recipient=${session.user.id}&unread=true`),
      ]);

      setMember(await memberRes.json());
      setTodos(await todosRes.json());
      setMessages(await messagesRes.json());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {member?.name}</h1>
        <p className="text-muted-foreground">
          {member?.roles[0]?.role} • {member?.current_team?.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MemberStatsCard
          label="Hours Today"
          value={member?.this_period?.hours_worked}
          unit="h"
        />
        <MemberStatsCard
          label="Tasks Done"
          value={member?.this_period?.tasks_completed}
        />
        <MemberStatsCard
          label="Revenue"
          value={`€${member?.this_period?.revenue_generated}`}
        />
        <MemberStatsCard
          label="Rating"
          value="4.5"
          unit="/5"
        />
      </div>

      <Tabs defaultValue="for-me" className="w-full">
        <TabsList>
          <TabsTrigger value="for-me">For Me</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="for-me" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Assigned Todos</CardTitle>
              <CardDescription>Tasks assigned to me today</CardDescription>
            </CardHeader>
            <CardContent>
              <AssignedTodosCard todos={todos} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages for Me</CardTitle>
            </CardHeader>
            <CardContent>
              <MembersForMeSection messages={messages} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          {/* Team view */}
        </TabsContent>

        <TabsContent value="activity">
          <RecentActivityFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**5.2 Kitchen Staff Dashboard**
```typescript
// src/components/dashboard/KitchenStaffDashboard.tsx
export default function KitchenStaffDashboard({ member }) {
  return (
    <div className="space-y-6">
      {/* Current Shift Section */}
      <Card>
        <CardHeader>
          <CardTitle>Current Shift</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg font-semibold">Clocked in at 10:30</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shift Type</p>
              <p className="text-lg">Lunch Service</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Team</p>
              <p className="text-lg">Kitchen Brigade</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Todos */}
      <Card>
        <CardHeader>
          <CardTitle>My Tasks Today</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Todo list */}
        </CardContent>
      </Card>

      {/* Personal Stats */}
      <Card>
        <CardHeader>
          <CardTitle>My Stats</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Stats display */}
        </CardContent>
      </Card>
    </div>
  );
}
```

**5.3 Waitress Dashboard**
```typescript
// src/components/dashboard/WaitressDashboard.tsx
export default function WaitressDashboard({ member }) {
  return (
    <div className="space-y-6">
      {/* Shift & Revenue Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Performance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-semibold">Clocked in 11:00</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Revenue This Shift</p>
            <p className="text-2xl font-bold text-green-600">€342</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Ticket</p>
            <p className="text-lg">€34.20</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tables</p>
            <p className="text-lg">12 covers</p>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Task list */}
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Performance This Week</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Charts/stats */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Week 6: Team & Location Dashboards

**6.1 Team Manager Dashboard**
```typescript
// src/components/dashboard/TeamManagerDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TeamStatsOverview from '@/components/dashboard/TeamStatsOverview';
import TeamMembersTable from '@/components/dashboard/TeamMembersTable';
import TeamTodosProgress from '@/components/dashboard/TeamTodosProgress';

export default function TeamManagerDashboard({ teamId }) {
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  async function fetchTeamData() {
    const [teamRes, membersRes, todosRes] = await Promise.all([
      fetch(`/api/teams/${teamId}`),
      fetch(`/api/members?team_id=${teamId}`),
      fetch(`/api/todos?team_id=${teamId}`),
    ]);

    setTeam(await teamRes.json());
    setMembers(await membersRes.json());
    setTodos(await todosRes.json());
  }

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team?.this_period?.total_hours}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Labor Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{team?.this_period?.total_labor_cost}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team?.this_period?.task_completion_rate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team?.this_period?.quality_score}/5</div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMembersTable members={members} />
        </CardContent>
      </Card>

      {/* Todo Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Task Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamTodosProgress todos={todos} />
        </CardContent>
      </Card>
    </div>
  );
}
```

**6.2 Location Manager Dashboard**
```typescript
// src/components/dashboard/LocationManagerDashboard.tsx
export default function LocationManagerDashboard({ locationId }) {
  const [location, setLocation] = useState(null);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [financials, setFinancials] = useState(null);

  useEffect(() => {
    fetchLocationData();
  }, [locationId]);

  async function fetchLocationData() {
    const [locRes, teamsRes, membersRes, finRes] = await Promise.all([
      fetch(`/api/locations/${locationId}`),
      fetch(`/api/teams?location_id=${locationId}`),
      fetch(`/api/members?location_id=${locationId}`),
      fetch(`/api/financial-summaries?location_id=${locationId}`),
    ]);

    setLocation(await locRes.json());
    setTeams(await teamsRes.json());
    setMembers(await membersRes.json());
    setFinancials(await finRes.json());
  }

  return (
    <div className="space-y-6">
      {/* Location KPIs */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* Revenue, Labor Cost, Profit, Task Completion, Events */}
      </div>

      {/* Teams Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Teams at {location?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Teams grid/table */}
        </CardContent>
      </Card>

      {/* All Members */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Members table with filtering */}
        </CardContent>
      </Card>

      {/* Financial Summary */}
      {financials && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Financial data display */}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Week 7: Stats Aggregation & Financial Upload

**7.1 Member Stats Aggregation Service**
```typescript
// src/lib/services/MemberStatsService.ts
import { Member } from '@/models/Member';
import { LaborRecord } from '@/models/LaborRecord';
import { RevenueRecord } from '@/models/RevenueRecord';
import { Todo } from '@/models/Todo';
import { Note } from '@/models/Note';
import { Message } from '@/models/Message';

export async function recalculateMemberStats(memberId: string, period: string = 'week') {
  const startDate = getPeriodStartDate(period);
  
  // Get all labor records for member in period
  const laborRecords = await LaborRecord.find({
    member_id: memberId,
    date: { $gte: startDate }
  });
  
  const totalHours = laborRecords.reduce((sum, r) => sum + r.hours_final, 0);
  const totalCost = laborRecords.reduce((sum, r) => sum + r.cost_final, 0);
  
  // Get revenue records
  const revenueRecords = await RevenueRecord.find({
    member_id: memberId,
    date: { $gte: startDate }
  });
  
  const totalRevenue = revenueRecords.reduce((sum, r) => sum + r.amount, 0);
  
  // Get tasks completed
  const tasksCompleted = await Todo.countDocuments({
    assigned_to: memberId,
    status: 'done',
    updated_at: { $gte: startDate }
  });
  
  // Get tasks assigned
  const tasksAssigned = await Todo.countDocuments({
    owner_id: memberId,
    created_at: { $gte: startDate }
  });
  
  // Get notes created
  const notesCreated = await Note.countDocuments({
    created_by: memberId,
    created_at: { $gte: startDate }
  });
  
  // Get messages sent
  const messagesSent = await Message.countDocuments({
    member_id: memberId,
    timestamp: { $gte: startDate }
  });
  
  // Update member
  await Member.updateOne(
    { _id: memberId },
    {
      this_period: {
        hours_worked: totalHours,
        revenue_generated: totalRevenue,
        tasks_completed: tasksCompleted,
        tasks_assigned: tasksAssigned,
        notes_created: notesCreated,
        messages_sent: messagesSent,
        decisions_involved_in: 0 // TODO: count decisions
      }
    }
  );
}

function getPeriodStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'week':
      now.setDate(now.getDate() - now.getDay());
      return new Date(now.setHours(0, 0, 0, 0));
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(now.setHours(0, 0, 0, 0));
  }
}
```

**7.2 Team Stats Aggregation**
```typescript
// src/lib/services/TeamStatsService.ts
export async function recalculateTeamStats(teamId: string, period: string = 'week') {
  const startDate = getPeriodStartDate(period);
  
  // Get all team members
  const team = await Team.findById(teamId).populate('members');
  
  if (!team?.members) return;
  
  // Aggregate from members
  let totalHours = 0;
  let totalCost = 0;
  let totalRevenue = 0;
  let taskCompletion = 0;
  let qualityScore = 0;
  
  for (const member of team.members) {
    const laborRecords = await LaborRecord.find({
      member_id: member._id,
      date: { $gte: startDate }
    });
    
    totalHours += laborRecords.reduce((sum, r) => sum + r.hours_final, 0);
    totalCost += laborRecords.reduce((sum, r) => sum + r.cost_final, 0);
  }
  
  // Update team
  await Team.updateOne(
    { _id: teamId },
    {
      this_period: {
        total_hours: totalHours,
        total_labor_cost: totalCost,
        total_revenue: totalRevenue,
        task_completion_rate: taskCompletion,
        quality_score: qualityScore,
        events_serviced: 0
      }
    }
  );
}
```

**7.3 Financial Data Upload API**
```typescript
// src/app/api/financial-summaries/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseExcelFile } from '@/lib/services/ExcelParserService';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const locationId = formData.get('location_id') as string;
    const type = formData.get('type') as 'labor' | 'revenue' | 'pnl';
    
    const buffer = await file.arrayBuffer();
    const data = await parseExcelFile(buffer, type);
    
    await FinancialSummary.create({
      location_id: locationId,
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
      [type === 'labor' ? 'hours_file_data' : 
       type === 'revenue' ? 'revenue_file_data' : 
       'pnl_data']: data,
      uploaded_at: new Date()
    });
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

### Week 8: Eitje API Integration

**8.1 Eitje Sync Service**
```typescript
// src/lib/services/EitjeSyncService.ts
import axios from 'axios';
import { LaborRecord } from '@/models/LaborRecord';
import { Member } from '@/models/Member';

const eitjeClient = axios.create({
  baseURL: process.env.EITJE_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.EITJE_API_KEY}`
  }
});

export async function syncLabor(startDate?: Date, endDate?: Date) {
  try {
    const params: any = {};
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();
    
    const response = await eitjeClient.get('/shifts', { params });
    const shifts = response.data;
    
    for (const shift of shifts) {
      // Find member by eitje_id
      const member = await Member.findOne({ eitje_id: shift.user_id });
      
      if (!member) {
        console.warn(`Member not found for Eitje user ${shift.user_id}`);
        continue;
      }
      
      // Find or create labor record
      const existingRecord = await LaborRecord.findOne({
        member_id: member._id,
        date: new Date(shift.date),
        eitje_source: { shift_id: shift.id }
      });
      
      if (existingRecord) {
        // Update with new data
        existingRecord.eitje_source = {
          shift_id: shift.id,
          shift_start: new Date(shift.start_time),
          shift_end: new Date(shift.end_time),
          shift_type: shift.type,
          hours_worked: shift.hours_worked,
          break_minutes: shift.break_minutes,
          hourly_rate: shift.hourly_rate,
          total_cost: shift.total_cost,
          synced_at: new Date()
        };
        
        // Recalculate verification
        if (existingRecord.excel_source) {
          existingRecord.verification = calculateVerification(
            existingRecord.eitje_source,
            existingRecord.excel_source
          );
        } else {
          existingRecord.hours_final = shift.hours_worked;
          existingRecord.cost_final = shift.total_cost;
          existingRecord.status = 'verified';
        }
        
        await existingRecord.save();
      } else {
        // Create new record
        const newRecord = new LaborRecord({
          member_id: member._id,
          location_id: member.location_id,
          team_id: member.team_id,
          date: new Date(shift.date),
          eitje_source: {
            shift_id: shift.id,
            shift_start: new Date(shift.start_time),
            shift_end: new Date(shift.end_time),
            shift_type: shift.type,
            hours_worked: shift.hours_worked,
            break_minutes: shift.break_minutes,
            hourly_rate: shift.hourly_rate,
            total_cost: shift.total_cost,
            synced_at: new Date()
          },
          hours_final: shift.hours_worked,
          cost_final: shift.total_cost,
          status: 'pending_verification'
        });
        
        await newRecord.save();
      }
    }
    
    console.log(`Synced ${shifts.length} shifts from Eitje`);
    return { success: true, count: shifts.length };
  } catch (error) {
    console.error('Eitje sync error:', error);
    throw error;
  }
}

function calculateVerification(eitjeData: any, excelData: any) {
  const hoursDiff = Math.abs(eitjeData.hours_worked - excelData.hours_worked);
  const costDiff = Math.abs(eitjeData.total_cost - excelData.total_cost);
  
  return {
    has_eitje: true,
    has_excel: true,
    hours_match: hoursDiff < 0.1,
    hours_difference: hoursDiff,
    hours_accuracy: ((1 - (hoursDiff / eitjeData.hours_worked)) * 100),
    cost_match: costDiff < 1,
    cost_difference: costDiff,
    cost_accuracy: ((1 - (costDiff / eitjeData.total_cost)) * 100),
    requires_review: hoursDiff > 0.5 || costDiff > 5,
    verified_at: new Date()
  };
}

// Schedule to run every 6 hours
export async function setupEitjeSyncCron() {
  const CronJob = require('cron').CronJob;
  
  new CronJob('0 */6 * * *', async () => {
    console.log('Running scheduled Eitje sync...');
    try {
      await syncLabor();
    } catch (error) {
      console.error('Scheduled sync failed:', error);
    }
  }).start();
}
```

**8.2 Setup Cron on App Start**
```typescript
// src/app/layout.tsx
import { setupEitjeSyncCron } from '@/lib/services/EitjeSyncService';

// On app initialization
if (process.env.NODE_ENV === 'production') {
  setupEitjeSyncCron();
}
```

---

## Phase 3: Real-Time & External Integrations (Weeks 9-12)

### Goals
- Implement WebSocket real-time messaging
- Build email ingestion pipeline
- Implement dual labor verification
- Slack member sync
- Real-time notifications

### Week 9: WebSocket Setup & Real-Time Messaging

**9.1 Socket.io Server Setup**
```typescript
// src/lib/socket.ts
import { Server as HTTPServer } from 'http';
import { Socket, Server } from 'socket.io';

let io: Server;

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL,
      credentials: true
    }
  });

  io.use((socket, next) => {
    const session = socket.handshake.auth.session;
    if (!session) {
      return next(new Error('Authentication failed'));
    }
    socket.user = session.user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.user.id}`);
    
    socket.join(`user:${socket.user.id}`);
    socket.join(`location:${socket.user.current_location}`);
    socket.join(`team:${socket.user.current_team}`);

    // Message events
    socket.on('message:send', handleMessageSend);
    socket.on('message:edit', handleMessageEdit);
    socket.on('message:delete', handleMessageDelete);
    socket.on('message:react', handleMessageReaction);

    // Todo events
    socket.on('todo:status_change', handleTodoStatusChange);
    socket.on('todo:assign', handleTodoAssign);
    socket.on('todo:comment', handleTodoComment);

    // Decision events
    socket.on('decision:acknowledge', handleDecisionAcknowledge);

    // Typing indicator
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Handler functions
async function handleMessageSend(socket: Socket, data: any) {
  try {
    const message = await Message.create({
      channel_id: data.channel_id,
      member_id: socket.user.id,
      text: data.text,
      timestamp: new Date(),
      mentioned_members: data.mentioned_members || []
    });

    // Broadcast to channel
    getIO().to(`channel:${data.channel_id}`).emit('message:received', {
      message,
      channel_id: data.channel_id
    });

    // Notify mentioned members
    for (const memberId of message.mentioned_members) {
      getIO().to(`user:${memberId}`).emit('notification:mention', {
        type: 'message_mention',
        channel_id: data.channel_id,
        from_member: socket.user.name,
        message_preview: data.text.substring(0, 100)
      });
    }
  } catch (error) {
    socket.emit('error', { message: String(error) });
  }
}

async function handleTodoStatusChange(socket: Socket, data: any) {
  try {
    const todo = await Todo.findByIdAndUpdate(
      data.todo_id,
      {
        status: data.new_status,
        updated_at: new Date()
      },
      { new: true }
    ).populate('assigned_to owner_id');

    // Notify all watchers
    getIO().to(`location:${todo.location_id}`).emit('todo:updated', {
      todo,
      changed_by: socket.user.name,
      action: `status changed to ${data.new_status}`
    });
  } catch (error) {
    socket.emit('error', { message: String(error) });
  }
}

async function handleTypingStart(socket: Socket, data: any) {
  socket.to(`channel:${data.channel_id}`).emit('typing:active', {
    member_id: socket.user.id,
    member_name: socket.user.name
  });
}

async function handleTypingStop(socket: Socket, data: any) {
  socket.to(`channel:${data.channel_id}`).emit('typing:stopped', {
    member_id: socket.user.id
  });
}
```

**9.2 Real-Time Message Component**
```typescript
// src/components/channel/ChatInterface.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

export default function ChatInterface({ channelId }) {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!socket) return;

    // Load initial messages
    fetch(`/api/channels/${channelId}/messages`).then(res =>
      res.json().then(data => setMessages(data))
    );

    // Subscribe to real-time updates
    socket.emit('subscribe:channel', { channel_id: channelId });

    socket.on('message:received', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('typing:active', ({ member_name }) => {
      setTyping(prev => [...new Set([...prev, member_name])]);
    });

    socket.on('typing:stopped', ({ member_id }) => {
      setTyping(prev => prev.filter(id => id !== member_id));
    });

    return () => {
      socket.off('message:received');
      socket.off('typing:active');
      socket.off('typing:stopped');
    };
  }, [socket, channelId]);

  const handleSendMessage = (text: string, mentions: string[]) => {
    socket?.emit('message:send', {
      channel_id: channelId,
      text,
      mentioned_members: mentions
    });
  };

  const handleTyping = () => {
    socket?.emit('typing:start', { channel_id: channelId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('typing:stop', { channel_id: channelId });
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      {typing.length > 0 && <TypingIndicator members={typing} />}
      <MessageInput onSend={handleSendMessage} onType={handleTyping} />
    </div>
  );
}
```

### Week 10: Email Ingestion Pipeline

**10.1 Email Listener Service**
```typescript
// src/lib/services/EmailListenerService.ts
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { PDFExtractionService } from './PDFExtractionService';
import { ExcelParserService } from './ExcelParserService';

export class EmailListenerService {
  private eventImap: Imap;
  private financeImap: Imap;

  constructor() {
    this.eventImap = new Imap({
      user: process.env.EVENT_EMAIL,
      password: process.env.EVENT_EMAIL_PASSWORD,
      host: process.env.EMAIL_IMAP_HOST,
      port: parseInt(process.env.EMAIL_IMAP_PORT || '993'),
      tls: true
    });

    this.financeImap = new Imap({
      user: process.env.FINANCE_EMAIL,
      password: process.env.FINANCE_EMAIL_PASSWORD,
      host: process.env.EMAIL_IMAP_HOST,
      port: parseInt(process.env.EMAIL_IMAP_PORT || '993'),
      tls: true
    });
  }

  async start() {
    try {
      await this.connectImap(this.eventImap);
      await this.connectImap(this.financeImap);

      this.watchEventInbox();
      this.watchFinanceInbox();

      console.log('Email listeners started');
    } catch (error) {
      console.error('Failed to start email listeners:', error);
      throw error;
    }
  }

  private async connectImap(imap: Imap) {
    return new Promise((resolve, reject) => {
      imap.openBox('INBOX', false, (err) => {
        if (err) reject(err);
        else resolve(null);
      });
    });
  }

  private watchEventInbox() {
    this.eventImap.on('mail', async () => {
      const search = ['UNSEEN'];
      const emails = await this.fetchEmails(this.eventImap, search);

      for (const email of emails) {
        await this.processEventEmail(email);
      }
    });
  }

  private watchFinanceInbox() {
    this.financeImap.on('mail', async () => {
      const search = ['UNSEEN'];
      const emails = await this.fetchEmails(this.financeImap, search);

      for (const email of emails) {
        await this.processFinanceEmail(email);
      }
    });
  }

  private async fetchEmails(imap: Imap, search: string[]) {
    return new Promise((resolve, reject) => {
      imap.search(search, (err, results) => {
        if (err) reject(err);

        if (!results || results.length === 0) {
          resolve([]);
          return;
        }

        const f = imap.fetch(results, { bodies: '' });
        const emails: any[] = [];

        f.on('message', (msg) => {
          simpleParser(msg, async (err, parsed) => {
            if (err) reject(err);
            emails.push(parsed);
          });
        });

        f.on('error', reject);
        f.on('end', () => resolve(emails));
      });
    });
  }

  private async processEventEmail(email: any) {
    try {
      const fromEmail = email.from.text;
      const subject = email.subject;

      // Extract PDFs from attachments
      const pdfAttachments = email.attachments.filter(
        (att: any) => att.contentType === 'application/pdf'
      );

      for (const attachment of pdfAttachments) {
        // Extract event data from PDF
        const eventData = await PDFExtractionService.extractEventData(
          attachment.content,
          attachment.filename
        );

        // Create event
        const event = await Event.create({
          name: subject,
          client_name: eventData.client_name || 'From Email',
          guest_count: eventData.guest_count,
          date: eventData.date || new Date(),
          
          pdf_pasy_plan: {
            filename: attachment.filename,
            url: `s3://bucket/${attachment.filename}`,
            uploaded_at: new Date(),
            extracted_data: eventData
          },
          
          sections: eventData.sections || [],
          timeline: eventData.timeline || [],
          
          status: 'planning'
        });

        // Generate todos from event items
        const todos = [];
        for (const section of event.sections || []) {
          for (const item of section.items || []) {
            todos.push({
              title: `Prepare ${item.name}`,
              description: `${item.portion_count} portions, ${item.prep_time_minutes} min prep`,
              linked_event: event._id,
              status: 'pending'
            });
          }
        }
        
        await Todo.insertMany(todos);

        // Create channel for event
        const channel = await Channel.create({
          name: `event-${subject.toLowerCase().replace(/\s+/g, '-')}`,
          type: 'project',
          description: `Planning channel for ${subject}`,
          created_by: null // System
        });

        event.channel_id = channel._id;
        await event.save();

        // Send response email
        await this.sendReplyEmail(
          fromEmail,
          `Event "${subject}" created successfully!`,
          `Event has been created with ${todos.length} preparation tasks.`
        );
      }
    } catch (error) {
      console.error('Failed to process event email:', error);
    }
  }

  private async processFinanceEmail(email: any) {
    try {
      const excelAttachments = email.attachments.filter((att: any) =>
        att.contentType.includes('spreadsheet') ||
        att.filename.endsWith('.xlsx') ||
        att.filename.endsWith('.xls')
      );

      for (const attachment of excelAttachments) {
        // Determine file type
        const filename = attachment.filename.toLowerCase();
        let type: 'labor' | 'revenue' | 'pnl' = 'labor';
        
        if (filename.includes('revenue') || filename.includes('sales')) {
          type = 'revenue';
        } else if (filename.includes('pnl') || filename.includes('profit')) {
          type = 'pnl';
        }

        // Parse Excel
        const data = await ExcelParserService.parseExcelFile(
          attachment.content,
          type
        );

        // Find relevant location (extract from email or filename)
        const locationId = await this.extractLocationFromEmail(email);

        // Create financial summary
        await FinancialSummary.create({
          location_id: locationId,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          [type === 'labor' ? 'hours_file_data' : 
           type === 'revenue' ? 'revenue_file_data' : 
           'pnl_data']: data,
          uploaded_at: new Date()
        });

        console.log(`Processed ${type} data from ${attachment.filename}`);
      }
    } catch (error) {
      console.error('Failed to process finance email:', error);
    }
  }

  private async extractLocationFromEmail(email: any): Promise<string> {
    // Extract location from email subject or body
    // This is a simplified version - enhance based on your email format
    const { Subject: subject } = email.headers;
    
    // Example: "Labor Report - Amsterdam"
    if (subject.includes('Amsterdam')) return 'amsterdam-location-id';
    if (subject.includes('Rotterdam')) return 'rotterdam-location-id';
    if (subject.includes('Hague')) return 'hague-location-id';
    
    // Default to first location
    const firstLocation = await Location.findOne();
    return firstLocation?._id || '';
  }

  private async sendReplyEmail(to: string, subject: string, body: string) {
    // Implementation depends on your email provider
    // Example using nodemailer
    console.log(`Reply email sent to ${to}`);
  }
}

// Start on app initialization
export async function setupEmailListener() {
  const listener = new EmailListenerService();
  await listener.start();
}
```

**10.2 PDF Extraction Service**
```typescript
// src/lib/services/PDFExtractionService.ts
import PDFParser from 'pdf-parse';

export class PDFExtractionService {
  static async extractEventData(pdfBuffer: Buffer, filename: string) {
    try {
      const data = await PDFParser(pdfBuffer);
      const text = data.text;

      // Extract sections (starters, mains, desserts, etc.)
      const sections = this.extractSections(text);
      
      // Extract timeline
      const timeline = this.extractTimeline(text);
      
      // Extract guest count
      const guestCount = this.extractGuestCount(text);
      
      // Extract dietary restrictions
      const dietaryRestrictions = this.extractDietary(text);

      return {
        sections,
        timeline,
        guest_count: guestCount,
        dietary_restrictions: dietaryRestrictions,
        raw_text: text
      };
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw error;
    }
  }

  private static extractSections(text: string) {
    // Parse menu sections
    const sectionNames = ['Starters', 'Appetizers', 'Main Course', 'Main', 'Dessert', 'Sides'];
    const sections = [];

    for (const sectionName of sectionNames) {
      const regex = new RegExp(`${sectionName}[\\s\\S]*?(?=${sectionName}|$)`, 'gi');
      const matches = text.match(regex);

      if (matches) {
        sections.push({
          title: sectionName,
          items: this.extractItemsFromSection(matches[0])
        });
      }
    }

    return sections;
  }

  private static extractItemsFromSection(sectionText: string) {
    // Parse individual items from section
    const items = [];
    const lines = sectionText.split('\n');

    for (const line of lines) {
      if (line.trim() && !line.includes('Starters') && !line.includes('Main') && !line.includes('Dessert')) {
        const portions = this.extractPortions(line);
        const timing = this.extractTiming(line);

        if (portions || timing) {
          items.push({
            name: line.split(/\d+/)[0].trim(),
            portion_count: portions,
            prep_time_minutes: timing
          });
        }
      }
    }

    return items;
  }

  private static extractPortions(text: string): number | null {
    const match = text.match(/(\d+)\s*(?:portions?|pcs?|pieces?)/i);
    return match ? parseInt(match[1]) : null;
  }

  private static extractTiming(text: string): number | null {
    const match = text.match(/(\d+)\s*(?:min|minutes?)/i);
    return match ? parseInt(match[1]) : null;
  }

  private static extractGuestCount(text: string): number | null {
    const match = text.match(/(?:for\s+)?(\d+)\s*(?:guests?|people|pax|covers?)/i);
    return match ? parseInt(match[1]) : null;
  }

  private static extractDietary(text: string) {
    const dietary = [];
    
    if (text.match(/vegetarian/i)) dietary.push('vegetarian');
    if (text.match(/vegan/i)) dietary.push('vegan');
    if (text.match(/gluten.?free/i)) dietary.push('gluten-free');
    if (text.match(/dairy.?free/i)) dietary.push('dairy-free');
    if (text.match(/nut.?allergy/i)) dietary.push('nut-allergy');

    return dietary;
  }
}
```

### Week 11: Slack Member Sync & Verification

**11.1 Slack Member Sync**
```typescript
// src/lib/services/SlackSyncService.ts
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function syncSlackMembers() {
  try {
    const response = await slack.users.list();
    const slackUsers = response.members || [];

    for (const slackUser of slackUsers) {
      if (slackUser.is_bot || slackUser.deleted) continue;

      // Find or create member
      let member = await Member.findOne({ slack_id: slackUser.id });

      if (!member) {
        member = new Member({
          slack_id: slackUser.id,
          name: slackUser.real_name || slackUser.name,
          email: slackUser.profile?.email,
          slack_username: slackUser.name,
          slack_avatar: slackUser.profile?.image_192,
          slack_real_name: slackUser.real_name,
          is_active: !slackUser.deleted
        });
      } else {
        // Update existing
        member.slack_avatar = slackUser.profile?.image_192;
        member.slack_username = slackUser.name;
        member.slack_real_name = slackUser.real_name;
        member.is_active = !slackUser.deleted;
      }

      await member.save();
    }

    console.log(`Synced ${slackUsers.length} members from Slack`);
    return { success: true, count: slackUsers.length };
  } catch (error) {
    console.error('Slack sync error:', error);
    throw error;
  }
}

// Schedule to run daily
export function setupSlackSyncCron() {
  const CronJob = require('cron').CronJob;
  
  new CronJob('0 2 * * *', async () => {
    console.log('Running scheduled Slack sync...');
    try {
      await syncSlackMembers();
    } catch (error) {
      console.error('Scheduled Slack sync failed:', error);
    }
  }).start();
}
```

**11.2 Labor Data Verification Dashboard**
```typescript
// src/components/admin/LaborVerificationDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LaborVerificationDashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiscrepancies();
  }, []);

  async function fetchDiscrepancies() {
    const res = await fetch('/api/labor-records/discrepancies');
    const data = await res.json();
    setRecords(data);
    setLoading(false);
  }

  async function resolveDiscrepancy(recordId: string, sourceOfTruth: 'eitje' | 'excel') {
    const res = await fetch(`/api/labor-records/${recordId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ source_of_truth: sourceOfTruth })
    });

    if (res.ok) {
      setRecords(records.filter(r => r._id !== recordId));
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Labor Data Verification</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Discrepancies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {records.length > 0 ? 
                ((1 - (records.length / 1000)) * 100).toFixed(1) : 
                '100'}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discrepancies Requiring Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {records.map((record) => (
              <div key={record._id} className="border rounded-lg p-4">
                <div className="grid gap-2 md:grid-cols-5">
                  <div>
                    <p className="text-sm text-muted-foreground">Member</p>
                    <p className="font-semibold">{record.member_name}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p>{new Date(record.date).toLocaleDateString()}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Hours (API vs Excel)</p>
                    <div className="flex gap-2">
                      <span className="bg-blue-100 px-2 py-1 rounded">
                        {record.eitje_source.hours_worked}h (API)
                      </span>
                      <span className="bg-green-100 px-2 py-1 rounded">
                        {record.excel_source.hours_worked}h (Excel)
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Variance</p>
                    <Badge variant={
                      record.verification.hours_accuracy > 98 ? 'default' : 'destructive'
                    }>
                      {record.verification.hours_accuracy.toFixed(1)}% accurate
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Action</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveDiscrepancy(record._id, 'eitje')}
                      >
                        Accept API
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveDiscrepancy(record._id, 'excel')}
                      >
                        Accept Excel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Week 12: Notification System & Integration Testing

**12.1 Notification Service**
```typescript
// src/lib/services/NotificationService.ts
import { getIO } from '@/lib/socket';

export class NotificationService {
  static async notifyMember(memberId: string, notification: any) {
    const io = getIO();
    
    // Send real-time notification
    io.to(`user:${memberId}`).emit('notification:new', notification);
    
    // Save to database
    await Notification.create({
      member_id: memberId,
      ...notification,
      read: false
    });
  }

  static async notifyTeam(teamId: string, notification: any) {
    const io = getIO();
    
    // Get team members
    const team = await Team.findById(teamId).populate('members');
    
    for (const member of team?.members || []) {
      io.to(`user:${member._id}`).emit('notification:new', notification);
      
      await Notification.create({
        member_id: member._id,
        ...notification,
        read: false
      });
    }
  }

  static async notifyLocation(locationId: string, notification: any) {
    const io = getIO();
    
    // Get all members at location
    const members = await Member.find({ location_id: locationId });
    
    for (const member of members) {
      io.to(`user:${member._id}`).emit('notification:new', notification);
      
      await Notification.create({
        member_id: member._id,
        ...notification,
        read: false
      });
    }
  }
}
```

**12.2 Integration Testing**
```bash
# Create tests for:
# 1. Eitje API sync
# 2. Excel parsing
# 3. Email ingestion
# 4. WebSocket messaging
# 5. Slack integration
# 6. Data verification
```

---

## Phase 4: Events & Advanced Features (Weeks 13-16)

### Goals
- Full Events module implementation
- Event timeline & inventory tracking
- Performance metrics & reporting
- UI polish and optimization
- Production launch

### Week 13: Events Implementation

**13.1 Event Dashboard & Timeline**
```typescript
// src/components/events/EventDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import EventTimeline from '@/components/events/EventTimeline';
import EventInventory from '@/components/events/EventInventory';
import EventStaffing from '@/components/events/EventStaffing';

export default function EventDashboard({ eventId }) {
  const [event, setEvent] = useState(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}`).then(r => r.json()).then(setEvent);
  }, [eventId]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{event?.name}</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Guests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{event?.guest_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estimated Labor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{event?.estimated_labor_cost}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{event?.revenue}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Est. Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{event?.estimated_profit}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="staffing">Staffing</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <EventTimeline event={event} />
        </TabsContent>

        <TabsContent value="inventory">
          <EventInventory event={event} />
        </TabsContent>

        <TabsContent value="staffing">
          <EventStaffing event={event} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Week 14: Reporting & Analytics

**14.1 Overall Manager Dashboard**
```typescript
// src/app/(authenticated)/dashboard/company/page.tsx
export default function CompanyDashboard() {
  return (
    <div className="space-y-6">
      {/* Company-level KPIs */}
      {/* Location breakdown */}
      {/* Alerts and insights */}
      {/* Reports generation */}
    </div>
  );
}
```

**14.2 Export & Reporting Service**
```typescript
// src/lib/services/ReportingService.ts
export async function generateWeeklyReport(startDate: Date, endDate: Date) {
  // Generate PDF/Excel report with:
  // - Revenue by location
  // - Labor costs by team
  // - Events performance
  // - Staff performance metrics
}
```

### Week 15: UI Polish & Optimization

- Performance optimization
- Mobile responsiveness
- Accessibility improvements
- Error handling & user feedback

### Week 16: Testing & Launch

- End-to-end testing
- Load testing
- Security audit
- Production deployment
- User training

---

## Data Models

### Core Collections

```typescript
// Member
// Team
// Location
// Note
// Todo
// Decision
// Channel
// Message
// LaborRecord
// RevenueRecord
// FinancialSummary
// Event
// Notification
```

(Detailed schemas in Phase 1 section)

---

## API Endpoints

### Members
```
GET    /api/members
POST   /api/members
GET    /api/members/[id]
PATCH  /api/members/[id]
DELETE /api/members/[id]
GET    /api/members/[id]/dashboard
GET    /api/members/[id]/activity
```

### Todos
```
GET    /api/todos
POST   /api/todos
GET    /api/todos/[id]
PATCH  /api/todos/[id]
DELETE /api/todos/[id]
POST   /api/todos/[id]/comments
PATCH  /api/todos/[id]/status
```

### Channels
```
GET    /api/channels
POST   /api/channels
GET    /api/channels/[id]
GET    /api/channels/[id]/messages
POST   /api/channels/[id]/messages
PATCH  /api/messages/[messageId]
DELETE /api/messages/[messageId]
POST   /api/messages/[messageId]/reactions
```

### Teams
```
GET    /api/teams
POST   /api/teams
GET    /api/teams/[id]
PATCH  /api/teams/[id]
GET    /api/teams/[id]/stats
GET    /api/teams/[id]/members
```

### Locations
```
GET    /api/locations
POST   /api/locations
GET    /api/locations/[id]
PATCH  /api/locations/[id]
GET    /api/locations/[id]/dashboard
GET    /api/locations/[id]/financial-summary
POST   /api/locations/[id]/financial-summary/upload
```

### Labor & Finance
```
GET    /api/labor-records
POST   /api/labor-records
GET    /api/labor-records/discrepancies
POST   /api/labor-records/[id]/resolve
POST   /api/labor-sync/trigger
GET    /api/financial-summaries
POST   /api/financial-summaries/upload
```

### Events
```
GET    /api/events
POST   /api/events
GET    /api/events/[id]
PATCH  /api/events/[id]
GET    /api/events/[id]/timeline
POST   /api/events/[id]/timeline
GET    /api/events/[id]/inventory
POST   /api/events/[id]/staffing
```

---

## WebSocket Events

```
// Connection
socket.on('connect')
socket.on('disconnect')

// Messages
socket.emit('message:send', { channel_id, text, mentions })
socket.on('message:received', { message })
socket.emit('message:edit', { message_id, text })
socket.emit('message:delete', { message_id })
socket.on('message:updated')
socket.on('message:deleted')
socket.emit('message:react', { message_id, emoji })

// Typing
socket.emit('typing:start', { channel_id })
socket.emit('typing:stop', { channel_id })
socket.on('typing:active', { member_name })
socket.on('typing:stopped')

// Todos
socket.emit('todo:status_change', { todo_id, new_status })
socket.on('todo:updated')
socket.emit('todo:assign', { todo_id, member_ids })
socket.emit('todo:comment', { todo_id, text })

// Decisions
socket.emit('decision:acknowledge', { decision_id })
socket.on('decision:acknowledged')

// Events
socket.emit('event:status_update', { event_id, section_id, status })
socket.on('event:progress_update')

// Notifications
socket.on('notification:new')
socket.emit('notification:read', { notification_id })
```

---

## External Integrations

### 1. Slack OAuth
- Member sync
- Avatar sync
- Real-time member updates

### 2. Eitje API
- Labor hours sync (every 6 hours)
- Shift data retrieval
- Hourly rate data

### 3. Bork API (optional)
- Revenue data
- Sales transactions
- Waiter performance

### 4. Email (IMAP)
- Event PDFs from Pasy
- Financial Excel files
- Automated ingestion

### 5. AWS S3
- File storage (PDFs, Excel exports)
- Document management

---

## Deployment & Infrastructure

### Development
```
Local: Next.js dev server
Database: MongoDB Atlas dev instance
Auth: NextAuth local config
Email: Dev IMAP credentials
Slack: Dev workspace
```

### Staging
```
Vercel: Next.js deployment
MongoDB: Staging cluster
CDN: Vercel edge
SSL: Automatic
```

### Production
```
Vercel: Production deployment
MongoDB Atlas: Production cluster
Email: Production IMAP
Slack: Production workspace
Backups: Daily MongoDB backups
Monitoring: Sentry error tracking
Analytics: PostHog
```

### Environment Files

```env
# Production
VERCEL_URL=https://app.yourdomain.com
MONGODB_URI=prod-cluster-uri
SLACK_CLIENT_ID=prod-id
NEXTAUTH_SECRET=strong-secret
AWS_S3_BUCKET=prod-bucket
```

---

## Success Metrics

- **Adoption**: 100% of staff using platform within 2 weeks
- **Response Time**: <200ms for all core operations
- **Uptime**: 99.9% availability
- **Data Accuracy**: 99.5% labor data verification match
- **User Satisfaction**: >4.5/5 rating

---

## Post-Launch Roadmap

1. **Mobile App** (Weeks 17-20)
   - React Native cross-platform
   - Offline-first sync

2. **Advanced Analytics** (Weeks 21-24)
   - Predictive analytics
   - ML-based recommendations

3. **Multi-Location Expansion** (Weeks 25-28)
   - Cross-location reporting
   - Consolidated dashboards

4. **API Marketplace** (Weeks 29+)
   - Third-party integrations
   - Webhook extensibility

---

## Notes

- Adjust timelines based on team size and complexity
- Prioritize Phase 1 & 2 for MVP launch
- Collect user feedback after Phase 2
- Iterate based on real usage patterns
- Keep infrastructure costs low during development

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Next Review:** End of Phase 1 (Week 4)
