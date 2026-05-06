/**
 * 测试 fixture：调用 prisma/seed-e2e.ts --reset --json 生成数据并解析为对象
 * 在 beforeAll 中运行，确保测试隔离且 seed 与代码同步演进
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

export interface SeedSummary {
  password: string;
  accounts: Record<
    'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6',
    { id: string; email: string; nickname: string }
  >;
  families: {
    A: { id: string; inviteCode: string; name: string };
    B: { id: string; inviteCode: string; name: string };
  };
  babies: {
    A1: { id: string; name: string; familyId: string };
    A2: { id: string; name: string; familyId: string; bulkRecords: number };
    B1: { id: string; name: string; familyId: string };
  };
}

export function runSeed(opts: { bulk?: number } = {}): SeedSummary {
  const cwd = path.resolve(__dirname, '../..');
  const args = ['tsx', 'prisma/seed-e2e.ts', '--reset', '--json'];
  if (opts.bulk && opts.bulk > 0) args.push(`--bulk=${opts.bulk}`);
  const out = execSync(`pnpm exec ${args.join(' ')}`, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  // --json 模式下 stdout 仅 JSON
  return JSON.parse(out) as SeedSummary;
}
