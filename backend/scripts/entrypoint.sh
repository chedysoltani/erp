#!/bin/sh
set -e

echo "=== SIT ERP Backend Startup ==="

echo "Waiting for MySQL to be ready..."
MYSQL_READY=0
MAX_RETRIES=30
RETRY_COUNT=0

while [ $MYSQL_READY -eq 0 ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "MySQL is accepting connections!"
    MYSQL_READY=1
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "MySQL is unavailable (attempt $RETRY_COUNT/$MAX_RETRIES) - sleeping"
    sleep 2
  fi
done

if [ $MYSQL_READY -eq 0 ]; then
  echo "ERROR: MySQL failed to become ready after $MAX_RETRIES attempts"
  exit 1
fi

echo ""
echo "Checking application directory structure..."
echo "Contents of /app:"
ls -la /app/ || true
echo ""

echo "Starting Express application..."

if [ -f "./src/app.js" ]; then
    echo "Found app.js at: ./src/app.js"
    exec node src/app.js
elif [ -f "./app.js" ]; then
    echo "Found app.js at: ./app.js"
    exec node app.js
elif [ -f "./index.js" ]; then
    echo "Found index.js at: ./index.js"
    exec node index.js
else
    echo "ERROR: No main application file found!"
    echo "Directory tree:"
    find . -name "*.js" -not -path "*/node_modules/*" -type f | head -n 10 || true
    exit 1
fi
