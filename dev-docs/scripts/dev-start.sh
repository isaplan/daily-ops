#!/bin/bash

# Kill any process using port 8080
echo "Checking for processes on port 8080..."
PORT_PID=$(lsof -ti:8080 2>/dev/null)

if [ ! -z "$PORT_PID" ]; then
  echo "Killing process $PORT_PID on port 8080..."
  kill -9 $PORT_PID 2>/dev/null
  sleep 1
  echo "Port 8080 is now free."
else
  echo "Port 8080 is already free."
fi

# Start the dev server
echo "Starting Next.js dev server..."
npm run dev
