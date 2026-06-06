import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Delete all existing records in dependency order
  await prisma.agentHeartbeat.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.alertDetection.deleteMany();
  await prisma.watchRule.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.computerGroupMember.deleteMany();
  await prisma.computerGroup.deleteMany();
  await prisma.importedActivityData.deleteMany();
  await prisma.computer.deleteMany();
  await prisma.room.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.activityWatchInstance.deleteMany();
  await prisma.systemSetting.deleteMany();

  console.log('Cleared all existing data');

  const adminPassword = await bcrypt.hash('admin', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@qserveits.com',
      passwordHash: adminPassword,
      name: 'Administrator',
      role: 'admin',
      mustChangePassword: true,
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  const testRoom = await prisma.room.create({
    data: {
      id: 'room-test-lab',
      name: 'Test Lab',
      description: 'Local development and testing environment',
      location: 'Localhost',
    },
  });

  console.log(`Created room: ${testRoom.name}`);

  await prisma.computer.create({
    data: {
      id: 'comp-local',
      hostname: 'Localhost Test Machine',
      ipAddress: '127.0.0.1',
      macAddress: '00:00:00:00:00:01',
      roomId: testRoom.id,
      status: 'online',
      currentUser: process.env.USERNAME || 'admin',
    },
  });

  console.log('Created test computer: Localhost Test Machine');

  const categoryRules = [
    { pattern: 'code', category: 'Development', type: 'app', priority: 10 },
    { pattern: 'terminal', category: 'Development', type: 'app', priority: 9 },
    { pattern: 'visual studio', category: 'Development', type: 'app', priority: 8 },
    { pattern: 'idea', category: 'Development', type: 'app', priority: 8 },
    { pattern: 'chrome', category: 'Browsing', type: 'app', priority: 5 },
    { pattern: 'firefox', category: 'Browsing', type: 'app', priority: 5 },
    { pattern: 'edge', category: 'Browsing', type: 'app', priority: 5 },
    { pattern: 'slack', category: 'Communication', type: 'app', priority: 6 },
    { pattern: 'discord', category: 'Communication', type: 'app', priority: 6 },
    { pattern: 'teams', category: 'Communication', type: 'app', priority: 6 },
    { pattern: 'spotify', category: 'Entertainment', type: 'app', priority: 4 },
    { pattern: 'youtube', category: 'Entertainment', type: 'app', priority: 4 },
    { pattern: 'word', category: 'Productivity', type: 'app', priority: 7 },
    { pattern: 'excel', category: 'Productivity', type: 'app', priority: 7 },
    { pattern: 'photoshop', category: 'Design', type: 'app', priority: 6 },
    { pattern: 'figma', category: 'Design', type: 'app', priority: 6 },
  ];

  for (const rule of categoryRules) {
    await prisma.categoryRule.create({
      data: {
        id: `rule-${rule.pattern.toLowerCase().replace(/\s+/g, '-')}`,
        ...rule,
      },
    });
  }

  console.log(`Created ${categoryRules.length} category rules`);

  const instance = await prisma.activityWatchInstance.create({
    data: {
      id: 'aw-local',
      name: 'Local Workstation',
      hostname: 'DESKTOP-B23KJA4',
      apiUrl: 'http://localhost:5600/api',
      isActive: true,
    },
  });

  console.log(`Created AW instance: ${instance.name}`);

  const settings = [
    { key: 'veyon_cli_path', value: 'veyon-cli' },
    { key: 'activitywatch_poll_interval', value: '60' },
    { key: 'screen_refresh_interval', value: '10' },
    { key: 'session_timeout_minutes', value: '120' },
    { key: 'max_computers_per_room', value: '50' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.create({
      data: setting,
    });
  }

  console.log(`Created ${settings.length} system settings`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
