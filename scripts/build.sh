# Build script for Render
echo "🔨 Building SubiteYa API..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma Client
echo "🔄 Generating Prisma Client..."
cd packages/api
npx prisma generate

# Build TypeScript
echo "🏗️ Building TypeScript..."
npm run build

echo "✅ Build complete!"
