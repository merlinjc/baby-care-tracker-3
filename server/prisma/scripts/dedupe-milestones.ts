/**
 * 一次性脚本：去除 MilestoneRecord 中 (babyId, name) 重复的记录。
 * 策略：每个 (babyId, name) 保留 createdAt 最早的一条，删除其余。
 *
 * 用法：
 *   tsx prisma/scripts/dedupe-milestones.ts        # dry-run
 *   tsx prisma/scripts/dedupe-milestones.ts --apply
 *
 * 之后再执行 `pnpm --filter @baby-care-tracker/server db:push` 让 unique 索引生效。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');

  const all = await prisma.milestoneRecord.findMany({
    orderBy: [{ babyId: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, babyId: true, name: true, createdAt: true },
  });

  const seen = new Map<string, string>(); // key = babyId|name → kept id
  const toDelete: string[] = [];

  for (const m of all) {
    const key = `${m.babyId}|${m.name}`;
    if (seen.has(key)) {
      toDelete.push(m.id);
    } else {
      seen.set(key, m.id);
    }
  }

  console.log(`扫描里程碑总数: ${all.length}`);
  console.log(`唯一 (babyId, name) 组合: ${seen.size}`);
  console.log(`将删除的重复记录: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('✅ 无重复，可直接执行 db push 加 unique 索引。');
    return;
  }

  if (!apply) {
    console.log('Dry-run，未删除任何记录。加 --apply 执行实际删除。');
    return;
  }

  const result = await prisma.milestoneRecord.deleteMany({
    where: { id: { in: toDelete } },
  });
  console.log(`✅ 已删除 ${result.count} 条重复记录。`);
  console.log('下一步：pnpm --filter @baby-care-tracker/server db:push');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
