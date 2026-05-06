import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create test user
  const passwordHash = await bcrypt.hash('Test1234', 10);
  const user = await prisma.user.create({
    data: {
      email: 'test@baby.care',
      nickname: '测试妈妈',
      avatar: null,
      passwordHash,
    },
  });
  console.log(`✅ Created user: ${user.nickname} (${user.email})`);

  // 2. Create second user
  const user2 = await prisma.user.create({
    data: {
      email: 'dad@baby.care',
      nickname: '测试爸爸',
      passwordHash: await bcrypt.hash('Test1234', 10),
    },
  });
  console.log(`✅ Created user: ${user2.nickname} (${user2.email})`);

  // 3. Create family
  const family = await prisma.family.create({
    data: {
      name: '小明的家',
      creatorId: user.id,
      inviteCode: 'BABY01',
      inviteCodeExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✅ Created family: ${family.name}`);

  // 4. Add users to family
  await prisma.familyMember.createMany({
    data: [
      { familyId: family.id, userId: user.id, role: 'admin', relation: '妈妈' },
      { familyId: family.id, userId: user2.id, role: 'editor', relation: '爸爸' },
    ],
  });

  // Update users' familyId
  await prisma.user.updateMany({
    where: { id: { in: [user.id, user2.id] } },
    data: { familyId: family.id },
  });
  console.log('✅ Added family members');

  // 5. Create baby
  const baby = await prisma.baby.create({
    data: {
      familyId: family.id,
      name: '小明',
      gender: 'male',
      birthDate: new Date('2025-06-15'),
    },
  });
  console.log(`✅ Created baby: ${baby.name}`);

  // 6. Create sample records
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Feeding records
  const feeding1 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'feeding',
      startTime: new Date(today.getTime() + 7 * 60 * 60 * 1000), // 7:00
      createdBy: user.id,
      feedingData: {
        create: { feedingType: 'breast', duration: 20, breastSide: 'left' },
      },
    },
  });

  const feeding2 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'feeding',
      startTime: new Date(today.getTime() + 11 * 60 * 60 * 1000), // 11:00
      createdBy: user2.id,
      feedingData: {
        create: { feedingType: 'formula', amount: 120 },
      },
    },
  });

  const feeding3 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'feeding',
      startTime: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 15:00
      createdBy: user.id,
      feedingData: {
        create: { feedingType: 'solid', amount: 50 },
      },
    },
  });

  // Sleep records
  const sleep1 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'sleep',
      startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      endTime: new Date(today.getTime() + 10.5 * 60 * 60 * 1000),
      createdBy: user.id,
      sleepData: {
        create: { sleepType: 'nap', duration: 90, location: '婴儿床' },
      },
    },
  });

  const sleep2 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'sleep',
      startTime: new Date(today.getTime() + 13 * 60 * 60 * 1000),
      endTime: new Date(today.getTime() + 15 * 60 * 60 * 1000),
      createdBy: user.id,
      sleepData: {
        create: { sleepType: 'nap', duration: 120, location: '婴儿床' },
      },
    },
  });

  // Diaper records
  const diaper1 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'diaper',
      startTime: new Date(today.getTime() + 8 * 60 * 60 * 1000),
      createdBy: user2.id,
      diaperData: {
        create: { diaperType: 'pee' },
      },
    },
  });

  const diaper2 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'diaper',
      startTime: new Date(today.getTime() + 12 * 60 * 60 * 1000),
      createdBy: user.id,
      diaperData: {
        create: { diaperType: 'both', consistency: 'soft', color: 'yellow' },
      },
    },
  });

  const diaper3 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'diaper',
      startTime: new Date(today.getTime() + 16 * 60 * 60 * 1000),
      createdBy: user.id,
      diaperData: {
        create: { diaperType: 'pee' },
      },
    },
  });

  // Temperature record
  const temp1 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'temperature',
      startTime: new Date(today.getTime() + 8.5 * 60 * 60 * 1000),
      createdBy: user.id,
      temperatureData: {
        create: { temperature: 36.5, method: 'axillary' },
      },
    },
  });

  // Growth record
  const growth1 = await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'growth',
      startTime: new Date(today.getTime() + 10 * 60 * 60 * 1000),
      createdBy: user.id,
      growthData: {
        create: { height: 70.5, weight: 8.2, headCircumference: 44.0 },
      },
    },
  });

  // Yesterday's records for trend data
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'feeding',
      startTime: new Date(yesterday.getTime() + 7 * 60 * 60 * 1000),
      createdBy: user.id,
      feedingData: { create: { feedingType: 'breast', duration: 25, breastSide: 'both' } },
    },
  });

  await prisma.record.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      recordType: 'sleep',
      startTime: new Date(yesterday.getTime() + 21 * 60 * 60 * 1000),
      endTime: new Date(yesterday.getTime() + 30 * 60 * 60 * 1000),
      createdBy: user.id,
      sleepData: { create: { sleepType: 'night', duration: 540 } },
    },
  });

  console.log(`✅ Created 13 sample records`);

  // 7. Create vaccine record
  const vaccine = await prisma.vaccineRecord.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      name: '乙肝疫苗',
      dose: '第2剂',
      vaccinatedDate: new Date('2025-07-15'),
      createdBy: user.id,
    },
  });
  console.log(`✅ Created vaccine record: ${vaccine.name}`);

  // 8. Create milestone record
  const milestone = await prisma.milestoneRecord.create({
    data: {
      babyId: baby.id,
      familyId: family.id,
      name: '第一次翻身',
      category: '运动',
      achievedDate: new Date('2025-09-20'),
      note: '从仰卧翻到俯卧',
      createdBy: user.id,
    },
  });
  console.log(`✅ Created milestone record: ${milestone.name}`);

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Test credentials:');
  console.log('   Email:    test@baby.care');
  console.log('   Password: Test1234');
  console.log('   Family:   小明的家');
  console.log('   Baby:     小明');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
