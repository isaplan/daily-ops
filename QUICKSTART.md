# Quick Start - Daily Ops POC

## ✅ What's Built

- **Next.js 15** with TypeScript and Tailwind CSS
- **MongoDB** models (Member, Team, Location)
- **API Routes** for CRUD operations
- **Dashboard UI** with real-time data fetching
- **Docker Compose** for local MongoDB

## 🚀 Start the POC

### 1. Start MongoDB

**Option A: Docker (if available)**
```bash
docker compose up -d
```

**Option B: Local MongoDB (already installed)**
```bash
# Check if MongoDB is running
brew services list | grep mongodb

# If not running, start it:
brew services start mongodb-community
# OR
mongod --dbpath /usr/local/var/mongodb
```

### 2. Start the App

```bash
npm run dev
```

### 3. Open Browser

Navigate to: **http://localhost:8080**

## 🧪 Test the API

### Create Sample Data

**1. Create a Location:**
```bash
curl -X POST http://localhost:8080/api/locations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Restaurant",
    "address": "123 Main St",
    "city": "Amsterdam",
    "country": "Netherlands"
  }'
```

**2. Get the Location ID from response, then create a Team:**
```bash
curl -X POST http://localhost:8080/api/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kitchen Team",
    "location_id": "PASTE_LOCATION_ID_HERE",
    "description": "Main kitchen staff"
  }'
```

**3. Create a Member:**
```bash
curl -X POST http://localhost:8080/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "location_id": "PASTE_LOCATION_ID_HERE",
    "team_id": "PASTE_TEAM_ID_HERE",
    "roles": [{
      "role": "kitchen_staff",
      "scope": "team"
    }]
  }'
```

**4. View in Browser:**
Refresh http://localhost:8080 to see the data!

## 📁 Project Structure

```
app/
├── api/              # API routes
│   ├── members/      # GET, POST /api/members
│   ├── teams/        # GET, POST /api/teams
│   └── locations/    # GET, POST /api/locations
├── components/       # React components
│   ├── MemberList.tsx
│   ├── TeamList.tsx
│   └── LocationList.tsx
├── lib/
│   └── mongodb.ts    # MongoDB connection
├── models/           # Mongoose models
│   ├── Member.ts
│   ├── Team.ts
│   └── Location.ts
└── page.tsx          # Main dashboard

docker-compose.yml    # MongoDB container
.env.local           # Environment variables
```

## 🔧 Environment Variables

The `.env.local` file is already configured with:
- `MONGODB_URI=mongodb://localhost:27017/daily-ops`
- `MONGODB_DB_NAME=daily-ops`

## 🐛 Troubleshooting

**MongoDB Connection Error:**
- Make sure MongoDB is running: `brew services list | grep mongodb`
- Check connection: `mongosh mongodb://localhost:27017/daily-ops`

**Port 8080 in use:**
- The app is strictly configured to use port 8080. Make sure nothing else is using this port.

**Clear database:**
```bash
mongosh mongodb://localhost:27017/daily-ops --eval "db.dropDatabase()"
```

## ✨ Next Steps

- Add authentication (NextAuth)
- Implement Socket.io for real-time updates
- Add Notes, Todos, Decisions models
- Build member-centric dashboards
- Add role-based access control
