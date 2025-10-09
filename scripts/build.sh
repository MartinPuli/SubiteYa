# Build script for Render
echo "🔨 Building SubiteYa API..."

# Navigate to API package
cd packages/api

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma Client
echo "🔄 Generating Prisma Client..."
npx prisma generate

# Build TypeScript
echo "🏗️ Building TypeScript..."
npm run build

echo "✅ Build complete!"
