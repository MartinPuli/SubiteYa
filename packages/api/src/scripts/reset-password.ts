/**
 * Reset user password
 * Usage: npx tsx src/scripts/reset-password.ts <email> <new-password>
 */

import { prisma } from '../lib/prisma';
import crypto from 'node:crypto';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error(
      '❌ Usage: npx tsx src/scripts/reset-password.ts <email> <new-password>'
    );
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }

  try {
    console.log(`🔍 Searching for user: ${email}\n`);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found:', user.name);
    console.log('🔄 Generating new password hash...');

    // Generate new salt and hash
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword, salt);

    console.log('💾 Updating database...');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        passwordSalt: salt,
        emailVerified: true, // Also verify email
      },
    });

    console.log('\n✅ Password reset successfully!');
    console.log('📧 Email:', email);
    console.log('🔑 New Password:', newPassword);
    console.log('✉️  Email verified: true');
    console.log(
      '\n⚠️  Please delete this from your terminal history for security.'
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
