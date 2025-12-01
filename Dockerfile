# Dockerfile para Render con FFmpeg
FROM node:20-slim

# Instalar FFmpeg y dependencias del sistema
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verificar que FFmpeg esté instalado
RUN ffmpeg -version

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración del monorepo
COPY package*.json ./
COPY turbo.json ./

# Copiar todos los package.json de los workspaces primero (para aprovechar cache)
COPY packages/api/package*.json ./packages/api/
COPY packages/observability/package*.json ./packages/observability/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/

# Instalar dependencias (usando npm ci para builds reproducibles)
RUN npm ci --legacy-peer-deps

# Copiar el resto del código fuente
COPY packages ./packages

# Build del proyecto
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio (sin migraciones automáticas)
CMD ["npm", "run", "start", "-w", "@subiteya/api"]
