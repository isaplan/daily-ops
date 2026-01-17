# POC Setup Instructions

## MongoDB Setup Options

### Option 1: Docker (Recommended)

If you have Docker installed:

```bash
docker compose up -d
```

This will start MongoDB on port 27017.

### Option 2: Local MongoDB Installation

If you have MongoDB installed locally, make sure it's running:

```bash
# On macOS with Homebrew
brew services start mongodb-community

# Or start manually
mongod --dbpath /usr/local/var/mongodb
```

### Option 3: MongoDB Atlas (Cloud)

If you prefer cloud MongoDB, update `.env.local`:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/daily-ops
```

## Start the Application

1. **Install dependencies** (if not done):
   ```bash
   npm install
   ```

2. **Start the dev server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:8080](http://localhost:8080)

## Verify MongoDB Connection

The app will automatically connect to MongoDB when you:
- Visit the homepage (it will try to fetch data)
- Make API calls to `/api/members`, `/api/teams`, or `/api/locations`

If MongoDB is not running, you'll see connection errors in the browser console and terminal.

## Test the API

Once MongoDB is running, you can test the API:

### Create a Location
```bash
curl -X POST http://localhost:8080/api/locations \
  -H "Content-Type: application/json" \
  -d '{"name": "Main Restaurant", "city": "Amsterdam"}'
```

### Get All Locations
```bash
curl http://localhost:8080/api/locations
```

## Troubleshooting

### "MongoServerError: connect ECONNREFUSED"

This means MongoDB is not running. Start it using one of the options above.

### Port 8080 already in use

The app is strictly configured to use port 8080. Make sure nothing else is using this port, or stop the conflicting service.

### Clear MongoDB Data (Docker)

```bash
docker compose down -v
docker compose up -d
```
