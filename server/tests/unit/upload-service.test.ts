/**
 * upload.service 单元测试（v7.2 T-S1-INF-02）
 *
 * 覆盖范围：
 * - normalizeExt: ext 白名单、归一化（jpeg → jpg）、大小写、前导点
 * - validateContext: 各 kind 必填字段缺失、date 格式
 * - buildKey: 三种 kind 的 key 前缀正确，包含 userId / familyId / babyId / date
 * - buildPublicUrl: 默认 COS 域名 vs CDN 自定义域名
 * - isConfigured: 缺任一 COS_* 字段视为未配置
 * - createPresignedUpload: 缺配置时抛 503，配置就绪时正确组装 result（mock COS callback）
 *
 * 注意：测试使用 internal `_xxxForTest` helper 直接测纯函数，
 * 避免初始化 COS 实例（测试环境不需要也不应该建实例）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { uploadService } from '../../src/services/upload.service';
import { env } from '../../src/config/env';
import { ServiceUnavailableError, BadRequestError } from '../../src/types/errors';

// ============ 辅助：临时设置 / 还原 env 字段 ============
const ENV_KEYS = [
  'COS_SECRET_ID',
  'COS_SECRET_KEY',
  'COS_BUCKET',
  'COS_REGION',
  'COS_PUBLIC_BASE_URL',
] as const;

function snapshotEnv() {
  return ENV_KEYS.reduce(
    (acc, key) => {
      acc[key] = (env as Record<string, unknown>)[key];
      return acc;
    },
    {} as Record<string, unknown>,
  );
}

function restoreEnv(snap: Record<string, unknown>) {
  for (const key of ENV_KEYS) {
    (env as Record<string, unknown>)[key] = snap[key];
  }
}

function setCosConfigured() {
  (env as Record<string, unknown>).COS_SECRET_ID = 'AKIDtest';
  (env as Record<string, unknown>).COS_SECRET_KEY = 'fakesecret';
  (env as Record<string, unknown>).COS_BUCKET = 'test-bucket-1234';
  (env as Record<string, unknown>).COS_REGION = 'ap-shanghai';
  (env as Record<string, unknown>).COS_PUBLIC_BASE_URL = undefined;
}

function setCosUnconfigured() {
  for (const key of ENV_KEYS) {
    (env as Record<string, unknown>)[key] = undefined;
  }
}

describe('uploadService - 配置检查', () => {
  let snap: Record<string, unknown>;

  beforeEach(() => {
    snap = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(snap);
  });

  it('UPL-1: 全字段配置后 isConfigured 为 true', () => {
    setCosConfigured();
    expect(uploadService._isConfiguredForTest()).toBe(true);
  });

  it('UPL-2: 缺任一字段视为未配置', () => {
    setCosConfigured();
    (env as Record<string, unknown>).COS_BUCKET = undefined;
    expect(uploadService._isConfiguredForTest()).toBe(false);
  });

  it('UPL-3: 全空时未配置', () => {
    setCosUnconfigured();
    expect(uploadService._isConfiguredForTest()).toBe(false);
  });

  it('UPL-4: 未配置时 createPresignedUpload 抛 503 ServiceUnavailable', async () => {
    setCosUnconfigured();
    await expect(
      uploadService.createPresignedUpload('user-1', 'avatar', 'jpg'),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);

    await expect(
      uploadService.createPresignedUpload('user-1', 'avatar', 'jpg'),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'UPLOAD_NOT_CONFIGURED',
    });
  });
});

describe('uploadService - normalizeExt 白名单', () => {
  it('UPL-5: 白名单内 ext 直接归一化', () => {
    expect(uploadService._normalizeExtForTest('jpg')).toBe('jpg');
    expect(uploadService._normalizeExtForTest('png')).toBe('png');
    expect(uploadService._normalizeExtForTest('webp')).toBe('webp');
  });

  it('UPL-6: jpeg 统一归一化为 jpg', () => {
    expect(uploadService._normalizeExtForTest('jpeg')).toBe('jpg');
    expect(uploadService._normalizeExtForTest('JPEG')).toBe('jpg');
  });

  it('UPL-7: 支持前导点与大小写', () => {
    expect(uploadService._normalizeExtForTest('.JPG')).toBe('jpg');
    expect(uploadService._normalizeExtForTest('.PNG')).toBe('png');
  });

  it('UPL-8: 白名单外 ext 抛 BadRequestError UPLOAD_INVALID_EXT', () => {
    expect(() => uploadService._normalizeExtForTest('gif')).toThrow(BadRequestError);
    expect(() => uploadService._normalizeExtForTest('svg')).toThrow(/不支持的文件扩展名/);
    expect(() => uploadService._normalizeExtForTest('exe')).toThrow(BadRequestError);
  });
});

describe('uploadService - validateContext', () => {
  it('UPL-9: avatar 不需要任何上下文字段', () => {
    expect(() => uploadService._validateContextForTest('avatar', {})).not.toThrow();
  });

  it('UPL-10: baby-avatar 缺 familyId 或 babyId 时抛错', () => {
    expect(() =>
      uploadService._validateContextForTest('baby-avatar', { babyId: 'b1' }),
    ).toThrow(/缺少必填字段.*familyId/);
    expect(() =>
      uploadService._validateContextForTest('baby-avatar', { familyId: 'f1' }),
    ).toThrow(/缺少必填字段.*babyId/);
  });

  it('UPL-11: baby-avatar 全字段时通过', () => {
    expect(() =>
      uploadService._validateContextForTest('baby-avatar', {
        familyId: 'f1',
        babyId: 'b1',
      }),
    ).not.toThrow();
  });

  it('UPL-12: daily-checkin 必填 familyId / babyId / date', () => {
    expect(() =>
      uploadService._validateContextForTest('daily-checkin', {
        familyId: 'f1',
        babyId: 'b1',
      }),
    ).toThrow(/缺少必填字段.*date/);
  });

  it('UPL-13: date 格式必须为 YYYY-MM-DD', () => {
    expect(() =>
      uploadService._validateContextForTest('daily-checkin', {
        familyId: 'f1',
        babyId: 'b1',
        date: '2026-5-11', // 缺前导 0
      }),
    ).toThrow(/date 格式必须为 YYYY-MM-DD/);

    expect(() =>
      uploadService._validateContextForTest('daily-checkin', {
        familyId: 'f1',
        babyId: 'b1',
        date: '../../etc/passwd', // 安全：阻止 path traversal
      }),
    ).toThrow(/date 格式/);

    expect(() =>
      uploadService._validateContextForTest('daily-checkin', {
        familyId: 'f1',
        babyId: 'b1',
        date: '2026-05-11',
      }),
    ).not.toThrow();
  });
});

describe('uploadService - buildKey 路径策略', () => {
  it('UPL-14: avatar key = avatars/{userId}/{cuid}.{ext}', () => {
    const key = uploadService._buildKeyForTest('user-1', 'avatar', 'jpg', {});
    expect(key).toMatch(/^avatars\/user-1\/[a-f0-9]{32}\.jpg$/);
  });

  it('UPL-15: baby-avatar key 包含 familyId / babyId', () => {
    const key = uploadService._buildKeyForTest('user-1', 'baby-avatar', 'png', {
      familyId: 'fam-9',
      babyId: 'baby-3',
    });
    expect(key).toMatch(/^babies\/fam-9\/baby-3\/[a-f0-9]{32}\.png$/);
  });

  it('UPL-16: daily-checkin key 含 date 前缀，便于按日期检索', () => {
    const key = uploadService._buildKeyForTest('user-1', 'daily-checkin', 'webp', {
      familyId: 'fam-9',
      babyId: 'baby-3',
      date: '2026-05-11',
    });
    expect(key).toMatch(
      /^checkins\/fam-9\/baby-3\/2026-05-11-[a-f0-9]{32}\.webp$/,
    );
  });

  it('UPL-17: 同一组参数两次调用产生不同 key（cuid 防碰撞）', () => {
    const ctx = { familyId: 'f1', babyId: 'b1' };
    const k1 = uploadService._buildKeyForTest('user-1', 'baby-avatar', 'jpg', ctx);
    const k2 = uploadService._buildKeyForTest('user-1', 'baby-avatar', 'jpg', ctx);
    expect(k1).not.toBe(k2);
  });
});

describe('uploadService - buildPublicUrl', () => {
  let snap: Record<string, unknown>;

  beforeEach(() => {
    snap = snapshotEnv();
    setCosConfigured();
  });

  afterEach(() => {
    restoreEnv(snap);
  });

  it('UPL-18: 默认用 COS 域名 https://{bucket}.cos.{region}.myqcloud.com', () => {
    const url = uploadService._buildPublicUrlForTest('avatars/u1/abc.jpg');
    expect(url).toBe(
      'https://test-bucket-1234.cos.ap-shanghai.myqcloud.com/avatars/u1/abc.jpg',
    );
  });

  it('UPL-19: 配置 COS_PUBLIC_BASE_URL 时优先用 CDN', () => {
    (env as Record<string, unknown>).COS_PUBLIC_BASE_URL = 'https://cdn.example.com';
    const url = uploadService._buildPublicUrlForTest('avatars/u1/abc.jpg');
    expect(url).toBe('https://cdn.example.com/avatars/u1/abc.jpg');
  });

  it('UPL-20: COS_PUBLIC_BASE_URL 末尾斜杠不会双斜杠', () => {
    (env as Record<string, unknown>).COS_PUBLIC_BASE_URL = 'https://cdn.example.com/';
    const url = uploadService._buildPublicUrlForTest('avatars/u1/abc.jpg');
    expect(url).toBe('https://cdn.example.com/avatars/u1/abc.jpg');
  });
});

describe('uploadService - createPresignedUpload 端到端组装（mock COS）', () => {
  let snap: Record<string, unknown>;
  // 任意 mock：vitest 会重置；这里直接 stub COS getObjectUrl
  let cosMock: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    snap = snapshotEnv();
    setCosConfigured();
    // 清掉懒初始化的 cos 实例缓存
    (uploadService as unknown as { cos: unknown }).cos = null;
  });

  afterEach(() => {
    cosMock?.mockRestore();
    cosMock = null;
    (uploadService as unknown as { cos: unknown }).cos = null;
    restoreEnv(snap);
  });

  it('UPL-21: 配置就绪时返回 { uploadUrl, publicUrl, key, expiresAt }', async () => {
    // 触发懒初始化拿到 COS 实例，再 mock 它的 getObjectUrl
    const cosInstance = (uploadService as unknown as {
      getCos: () => { getObjectUrl: (params: unknown, cb: unknown) => void };
    }).getCos.call(uploadService);
    cosMock = vi
      .spyOn(cosInstance, 'getObjectUrl')
      .mockImplementation((_params: unknown, cb: unknown) => {
        (cb as (err: unknown, data: { Url: string }) => void)(null, {
          Url: 'https://test-bucket-1234.cos.ap-shanghai.myqcloud.com/SIGNED_URL',
        });
      });

    const result = await uploadService.createPresignedUpload('user-1', 'avatar', 'jpeg');

    expect(result.uploadUrl).toBe(
      'https://test-bucket-1234.cos.ap-shanghai.myqcloud.com/SIGNED_URL',
    );
    expect(result.publicUrl).toMatch(
      /^https:\/\/test-bucket-1234\.cos\.ap-shanghai\.myqcloud\.com\/avatars\/user-1\/[a-f0-9]{32}\.jpg$/,
    );
    expect(result.key).toMatch(/^avatars\/user-1\/[a-f0-9]{32}\.jpg$/);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('UPL-22: COS 回调返回 err 时 reject', async () => {
    const cosInstance = (uploadService as unknown as {
      getCos: () => { getObjectUrl: (params: unknown, cb: unknown) => void };
    }).getCos.call(uploadService);
    cosMock = vi
      .spyOn(cosInstance, 'getObjectUrl')
      .mockImplementation((_params: unknown, cb: unknown) => {
        (cb as (err: unknown, data: unknown) => void)(
          new Error('mock cos network error'),
          null,
        );
      });

    await expect(
      uploadService.createPresignedUpload('user-1', 'avatar', 'jpg'),
    ).rejects.toThrow(/mock cos network error/);
  });
});
