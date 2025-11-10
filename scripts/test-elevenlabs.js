#!/usr/bin/env node

/**
 * Script de prueba para verificar configuración de ElevenLabs
 * Uso: node scripts/test-elevenlabs.js
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: './packages/api/.env' });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

async function testElevenLabsConnection() {
  console.log('🧪 Probando conexión con ElevenLabs...\n');

  // Verificar API Key
  if (
    !ELEVENLABS_API_KEY ||
    ELEVENLABS_API_KEY === 'your_elevenlabs_api_key_here'
  ) {
    console.error('❌ ERROR: ELEVENLABS_API_KEY no configurada');
    console.log('\n📝 Pasos para configurar:');
    console.log('1. Ve a https://elevenlabs.io/app/settings/api-keys');
    console.log('2. Crea una API Key');
    console.log('3. Agrégala en packages/api/.env:');
    console.log('   ELEVENLABS_API_KEY=tu_api_key_aqui\n');
    process.exit(1);
  }

  console.log(
    '✅ API Key encontrada:',
    ELEVENLABS_API_KEY.substring(0, 8) + '...\n'
  );

  try {
    // Test 1: Listar voces
    console.log('📋 Test 1: Listando voces disponibles...');
    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!voicesResponse.ok) {
      const error = await voicesResponse.text();
      throw new Error(`HTTP ${voicesResponse.status}: ${error}`);
    }

    const voicesData = await voicesResponse.json();
    console.log(`✅ ${voicesData.voices.length} voces disponibles\n`);

    // Mostrar primeras 5 voces
    console.log('🎤 Primeras 5 voces:');
    voicesData.voices.slice(0, 5).forEach((voice, i) => {
      console.log(`   ${i + 1}. ${voice.name} (${voice.voice_id})`);
      console.log(`      Category: ${voice.category}`);
      if (voice.description) {
        console.log(
          `      Description: ${voice.description.substring(0, 60)}...`
        );
      }
    });

    // Test 2: Verificar límite de caracteres
    console.log('\n📊 Test 2: Verificando información de cuenta...');
    const userResponse = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!userResponse.ok) {
      console.warn(
        '⚠️ No se pudo obtener información de cuenta (puede ser normal)'
      );
    } else {
      const userData = await userResponse.json();

      if (userData.subscription) {
        const { character_count, character_limit, tier } =
          userData.subscription;
        const remaining = character_limit - character_count;
        const percentUsed = ((character_count / character_limit) * 100).toFixed(
          1
        );

        console.log(`✅ Plan: ${tier}`);
        console.log(
          `   Caracteres usados: ${character_count.toLocaleString()} / ${character_limit.toLocaleString()}`
        );
        console.log(
          `   Restantes: ${remaining.toLocaleString()} (${100 - parseFloat(percentUsed)}%)`
        );

        if (remaining < 1000) {
          console.warn(
            '⚠️ ADVERTENCIA: Te quedan pocos caracteres disponibles'
          );
        }
      }
    }

    // Test 3: Generar audio de prueba pequeño
    console.log('\n🔊 Test 3: Generando audio de prueba...');
    console.log('   Texto: "Hola, esta es una prueba"');

    const testVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel (ES)
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${testVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Hola, esta es una prueba',
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      throw new Error(`TTS failed: ${error}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log(`✅ Audio generado: ${audioBuffer.byteLength} bytes`);
    console.log('   (27 caracteres consumidos)');

    console.log('\n✅ TODAS LAS PRUEBAS PASARON');
    console.log('\n🎉 ElevenLabs está correctamente configurado');
    console.log('📝 Puedes usar los endpoints de /api/elevenlabs\n');
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.message.includes('401')) {
      console.log('\n🔑 Tu API Key parece ser inválida');
      console.log(
        '   Verifica en: https://elevenlabs.io/app/settings/api-keys'
      );
    } else if (error.message.includes('429')) {
      console.log('\n⏱️ Límite de rate alcanzado');
      console.log('   Espera un momento y vuelve a intentar');
    } else if (error.message.includes('quota')) {
      console.log('\n📊 Has alcanzado el límite de tu plan');
      console.log('   Considera actualizar en: https://elevenlabs.io/pricing');
    }

    process.exit(1);
  }
}

// Ejecutar tests
testElevenLabsConnection();
