#!/bin/bash

# Test aggregation endpoint
# Usage: ./test-aggregation.sh [force]

FORCE=${1:-true}
USE_TRIGGER=${2:-false}

echo "Testing aggregation endpoint..."
echo "Force: $FORCE, Use Trigger: $USE_TRIGGER"
echo ""

curl -X POST http://localhost:8080/api/aggregations/sync \
  -H "Content-Type: application/json" \
  -d "{\"force\": $FORCE, \"useTrigger\": $USE_TRIGGER}" \
  | jq '.'

echo ""
echo "Done!"
