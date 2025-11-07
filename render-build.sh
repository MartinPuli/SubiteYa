#!/usr/bin/env bash
# Render build script - Instala FFmpeg y dependencias

set -o errexit

echo "📦 Installing system dependencies..."

# Instalar FFmpeg desde los repositorios del sistema
if command -v apt-get &> /dev/null; then
    echo "🔧 Installing FFmpeg via apt-get..."
    apt-get update
    apt-get install -y ffmpeg
elif command -v yum &> /dev/null; then
    echo "🔧 Installing FFmpeg via yum..."
    yum install -y ffmpeg
else
    echo "⚠️  Package manager not found, FFmpeg might not be available"
fi

echo "✅ FFmpeg installed:"
ffmpeg -version || echo "❌ FFmpeg not found"

echo "📦 Installing Node dependencies..."
npm install

echo "🔨 Building project..."
npm run build

echo "✅ Build complete!"
