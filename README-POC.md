# Daily Ops - POC Setup Guide

This is a Proof of Concept (POC) build of the Daily Ops application with local MongoDB.

## Prerequisites

- Node.js 18+ 
- Docker and Docker Compose (for local MongoDB)
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp env.example .env.local
```

The default MongoDB URI is already set for local development:
```
MONGODB_URI=mongodb://localhost:27017/daily-ops
```

### 3. Start MongoDB (Docker)

```bash
docker-compose up -d
```

This will start MongoDB on port 27017.

### 4. Run the Development Server

**Recommended (auto-kills port conflicts):**
```bash
npm run dev:clean
```

**Standard (may fail if port 8080 is in use):**
```bash
npm run dev
```

**If you need to manually kill port 8080:**
```bash
npm run dev:kill
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Testing the API

### Create a Location

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

### Create a Team

```bash
curl -X POST http://localhost:8080/api/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kitchen Team",
    "location_id": "<location_id_from_above>",
    "description": "Main kitchen staff"
  }'
```

### Create a Member

```bash
curl -X POST http://localhost:8080/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "location_id": "<location_id>",
    "team_id": "<team_id>",
    "roles": [{
      "role": "kitchen_staff",
      "scope": "team"
    }]
  }'
```

## Project Structure

```
app/
├── api/              # API routes
│   ├── members/      # Member CRUD
│   ├── teams/       # Team CRUD
│   └── locations/   # Location CRUD
├── components/      # React components
├── lib/            # Utilities (MongoDB connection)
├── models/         # Mongoose models
└── page.tsx        # Main dashboard

docker-compose.yml  # Local MongoDB setup
```

## MongoDB Connection

The app connects to MongoDB using the connection string in `.env.local`. The connection is cached globally to prevent multiple connections during development.

## Next Steps

- Add authentication (NextAuth)
- Implement Socket.io for real-time updates
- Add more models (Notes, Todos, Decisions)
- Build member-centric dashboards
- Add role-based access control

## Troubleshooting

### MongoDB Connection Error

1. Make sure Docker is running: `docker ps`
2. Check if MongoDB container is up: `docker-compose ps`
3. Verify MongoDB is accessible: `docker exec -it daily-ops-mongodb mongosh`

### Port Already in Use

The app is strictly configured to use port 8080. 

**Solution:** Use the `dev:clean` script which automatically kills any process on port 8080 before starting:

```bash
npm run dev:clean
```

Or manually kill the port:
```bash
npm run dev:kill
```

This prevents the `EADDRINUSE` error that occurs when a previous dev server instance is still running.

### Clear MongoDB Data

To reset the database:

```bash
docker-compose down -v
docker-compose up -d
```

This will remove all data and start fresh.
