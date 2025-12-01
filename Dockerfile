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

# ===== BUILD STAGE: Instalar TODAS las dependencias del monorepo =====
# Copiar configuración del workspace root
COPY package*.json ./
COPY turbo.json ./

# Copiar todos los workspaces
COPY packages ./packages

# Instalar todas las dependencias (esto resuelve workspace:*)
RUN npm install --legacy-peer-deps

# Build solo del paquete API y sus dependencias internas
RUN npm run build --workspace=@subiteya/observability
RUN npm run build --workspace=@subiteya/shared  
RUN npm run build --workspace=@subiteya/api

# ===== PRODUCTION STAGE: Solo archivos necesarios para runtime =====
# Limpiar node_modules y reinstalar solo dependencias de producción
RUN rm -rf node_modules packages/*/node_modules
RUN npm install --workspace=@subiteya/api --workspace=@subiteya/observability --workspace=@subiteya/shared --omit=dev --legacy-peer-deps

# Exponer puerto
EXPOSE 3000

# Comando de inicio (sin migraciones automáticas)
CMD ["npm", "run", "start", "-w", "@subiteya/api"]
