/**
 * Script para resetear contraseña de usuario
 * Uso: npx tsx scripts/reset-user-password.ts <email> <nueva-contraseña>
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
}

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email) {
    console.log('\n📋 Usuarios en la base de datos:');
    console.log('='.repeat(80));

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            videos: true,
            tiktokConnections: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos');
    } else {
      users.forEach((user, i) => {
        console.log(`\n${i + 1}. ${user.name} (${user.email})`);
        console.log(`   ID: ${user.id}`);
        console.log(
          `   Email verificado: ${user.emailVerified ? '✅ Sí' : '❌ No'}`
        );
        console.log(`   Videos: ${user._count.videos}`);
        console.log(`   Cuentas TikTok: ${user._count.tiktokConnections}`);
        console.log(`   Creado: ${user.createdAt.toLocaleString('es-AR')}`);
      });

      console.log('\n' + '='.repeat(80));
      console.log('\n💡 Para resetear contraseña:');
      console.log(
        '   npx tsx scripts/reset-user-password.ts <email> <nueva-contraseña>'
      );
      console.log('\n   Ejemplo:');
      console.log(
        '   npx tsx scripts/reset-user-password.ts user@example.com MiNuevaPass123'
      );
    }
    return;
  }

  if (!newPassword) {
    console.error('❌ Error: Debes proporcionar email y nueva contraseña');
    console.log('\n💡 Uso:');
    console.log(
      '   npx tsx scripts/reset-user-password.ts <email> <nueva-contraseña>'
    );
    console.log('\n   Ejemplo:');
    console.log(
      '   npx tsx scripts/reset-user-password.ts user@example.com MiNuevaPass123'
    );
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ Error: La contraseña debe tener al menos 8 caracteres');
    process.exit(1);
  }

  // Buscar usuario
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ Usuario con email "${email}" no encontrado`);
    process.exit(1);
  }

  console.log(`\n👤 Usuario encontrado: ${user.name} (${user.email})`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email verificado: ${user.emailVerified ? '✅ Sí' : '❌ No'}`);

  // Generar nuevo hash
  const salt = generateSalt();
  const hash = hashPassword(newPassword, salt);

  console.log('\n🔐 Actualizando contraseña...');

  // Actualizar en base de datos
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hash,
      passwordSalt: salt,
      passwordResetCode: null,
      passwordResetExp: null,
    },
  });

  // Crear evento de auditoría
  await prisma.auditEvent.create({
    data: {
      userId: user.id,
      type: 'user.password_reset_completed',
      detailsJson: {
        email,
        source: 'admin_script',
        note: 'Password reset via script',
      },
      ip: '127.0.0.1',
      userAgent: 'reset-user-password script',
    },
  });

  console.log('✅ Contraseña actualizada exitosamente');
  console.log(`\n📧 Email: ${email}`);
  console.log(`🔑 Nueva contraseña: ${newPassword}`);
  console.log('\n💡 Ahora puedes iniciar sesión con estas credenciales');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
