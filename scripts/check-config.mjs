#!/usr/bin/env node

/**
 * Script de verificación de configuración
 * Verifica que todas las variables de entorno necesarias estén configuradas
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

config();

const checks = {
  '📄 Archivo .env existe': () => existsSync(resolve(process.cwd(), '.env')),
  '🔑 JWT_SECRET configurado': () => !!process.env.JWT_SECRET && process.env.JWT_SECRET !== 'your-jwt-secret-change-this-in-production',
  '🔐 ENCRYPTION_KEY configurado': () => {
    const key = process.env.ENCRYPTION_KEY;
    return !!key && key.length === 32 && key !== 'change-this-32-character-key!!';
  },
  '🗄️ DB_URL configurado': () => {
    const url = process.env.DB_URL;
    return !!url && 
           url.startsWith('postgresql://') && 
           !url.includes('[YOUR-PASSWORD]');
  },
  '🌐 APP_BASE_URL configurado': () => !!process.env.APP_BASE_URL,
};

console.log('\n🔍 Verificando configuración de SubiteYa...\n');

let allPassed = true;
const results = [];

for (const [name, check] of Object.entries(checks)) {
  try {
    const passed = check();
    results.push({ name, passed });
    if (!passed) allPassed = false;
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    allPassed = false;
  }
}

// Mostrar resultados
results.forEach(({ name, passed, error }) => {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
});

console.log('');

if (allPassed) {
  console.log('🎉 ¡Todo configurado correctamente!\n');
  console.log('Siguiente paso:');
  console.log('  cd packages/api');
  console.log('  npx prisma generate');
  console.log('  npx prisma migrate dev --name init');
  console.log('  cd ../..');
  console.log('  npm run dev\n');
  process.exit(0);
} else {
  console.log('⚠️  Faltan algunas configuraciones.\n');
  console.log('Por favor:');
  console.log('1. Revisa el archivo .env');
  console.log('2. Sigue la guía: SUPABASE_QUICKSTART.md');
  console.log('3. Ejecuta este script nuevamente: npm run check:config\n');
  process.exit(1);
}
