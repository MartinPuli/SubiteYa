#!/bin/bash
set -e

echo "🚀 Starting SubiteYa API with automatic migrations..."

# Change to the API directory
cd packages/api

echo "📦 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations completed successfully"

echo "🌟 Starting the server..."
cd ../..
node packages/api/dist/index.js
