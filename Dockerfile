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

# Copiar archivos de configuración
COPY package*.json ./
COPY turbo.json ./

# Copiar workspace packages
COPY packages ./packages

# Instalar dependencias
RUN npm install

# Build del proyecto
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "run", "start:migrate", "-w", "@subiteya/api"]
