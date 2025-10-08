# Start script for Render
echo "🚀 Starting SubiteYa API..."

# Run migrations
echo "📊 Running database migrations..."
cd packages/api
npx prisma migrate deploy

# Start the server
echo "▶️ Starting server..."
npm start
