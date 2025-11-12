/**
 * Script para vaciar completamente Redis/Upstash
 * Uso: npx tsx scripts/clear-redis.ts
 *
 * ADVERTENCIA: Esto eliminará TODOS los datos de Redis:
 * - Todas las colas (edit, upload)
 * - Todos los jobs (pendientes, completados, fallidos)
 * - Todas las claves y datos en memoria
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  console.log('🔴 VACIAR REDIS/UPSTASH');
  console.log('='.repeat(80));
  console.log(`📍 Conectando a: ${REDIS_URL.replace(/:[^:]*@/, ':****@')}`);

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  });

  try {
    // Verificar conexión
    await redis.ping();
    console.log('✅ Conectado a Redis');

    // Obtener información antes de limpiar
    const info = await redis.info('keyspace');
    console.log('\n📊 Estado ANTES de limpiar:');
    console.log(info);

    // Contar keys
    const keys = await redis.keys('*');
    console.log(`\n🔢 Total de keys: ${keys.length}`);

    if (keys.length === 0) {
      console.log('\n✅ Redis ya está vacío, no hay nada que eliminar');
      await redis.quit();
      return;
    }

    // Mostrar algunas keys de ejemplo
    console.log('\n📋 Ejemplos de keys (primeras 20):');
    keys.slice(0, 20).forEach((key, i) => {
      console.log(`   ${i + 1}. ${key}`);
    });
    if (keys.length > 20) {
      console.log(`   ... y ${keys.length - 20} más`);
    }

    // FLUSHDB - Elimina TODA la base de datos actual
    console.log('\n🗑️  Ejecutando FLUSHDB...');
    await redis.flushdb();
    console.log('✅ Base de datos vaciada exitosamente');

    // Verificar que está vacío
    const keysAfter = await redis.keys('*');
    console.log(`\n📊 Keys después de limpiar: ${keysAfter.length}`);

    if (keysAfter.length === 0) {
      console.log('✅ Redis completamente limpio');
    } else {
      console.log(`⚠️  Aún quedan ${keysAfter.length} keys`);
    }

    // Obtener info después
    const infoAfter = await redis.info('keyspace');
    console.log('\n📊 Estado DESPUÉS de limpiar:');
    console.log(infoAfter || 'Base de datos vacía');

    await redis.quit();
    console.log('\n✅ Script completado');
  } catch (error) {
    console.error('\n❌ Error:', error);
    await redis.quit();
    process.exit(1);
  }
}

main();
