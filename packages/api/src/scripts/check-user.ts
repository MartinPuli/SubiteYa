/**
 * Check user in database
 * Usage: npx tsx src/scripts/check-user.ts <email>
 */

import { prisma } from '../lib/prisma';

async function checkUser() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Usage: npx tsx src/scripts/check-user.ts <email>');
    process.exit(1);
  }

  try {
    console.log(`🔍 Searching for user: ${email}\n`);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tiktokConnections: true,
        videos: true,
        brandPatterns: true,
      },
    });

    if (!user) {
      console.log('❌ User not found');
      process.exit(0);
    }

    console.log('✅ User found!\n');
    console.log('👤 User Details:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Name:', user.name);
    console.log('  Role:', user.role);
    console.log('  Tier:', user.tier);
    console.log('  Email Verified:', user.emailVerified);
    console.log('  Created:', user.createdAt);
    console.log('  Updated:', user.updatedAt);
    console.log('');
    console.log('🔐 Auth Details:');
    console.log('  Password Hash:', user.passwordHash.substring(0, 20) + '...');
    console.log('  Password Salt:', user.passwordSalt.substring(0, 20) + '...');
    console.log(
      '  Email Verification Code:',
      user.emailVerificationCode || 'None'
    );
    console.log(
      '  Email Verification Exp:',
      user.emailVerificationExp || 'None'
    );
    console.log('  Password Reset Code:', user.passwordResetCode || 'None');
    console.log('  Password Reset Exp:', user.passwordResetExp || 'None');
    console.log('');
    console.log('📊 Resources:');
    console.log('  TikTok Connections:', user.tiktokConnections?.length || 0);
    console.log('  Videos:', user.videos?.length || 0);
    console.log('  Brand Patterns:', user.brandPatterns?.length || 0);
    console.log('');

    if (user.tiktokConnections && user.tiktokConnections.length > 0) {
      console.log('🎵 TikTok Connections:');
      user.tiktokConnections.forEach((conn, i) => {
        console.log(`  ${i + 1}. ${conn.displayName} (@${conn.openId})`);
        console.log(`     Created: ${conn.createdAt}`);
      });
      console.log('');
    }

    if (user.videos && user.videos.length > 0) {
      console.log('🎬 Recent Videos:');
      user.videos.slice(0, 5).forEach((video, i) => {
        console.log(
          `  ${i + 1}. Status: ${video.status}, Created: ${video.createdAt}`
        );
      });
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
