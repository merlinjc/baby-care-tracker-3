/**
 * upload.service 单元测试（v7.2 T-S1-INF-02 方案 B 服务端代理版）
 *
 * 覆盖范围：
 * - isConfigured: 缺任一 COS_* 字段视为未配置
 * - normalizeExt: ext 白名单、归一化（jpeg → jpg）、大小写、前导点
 * - validateContext: 各 kind 必填字段缺失、date 格式、path traversal 防御
 * - buildKey: 三种 kind 的 key 前缀正确
 * - isValidKey: 下载代理路径合法性校验
 * - putObject: 缺配置时抛 503，文件超大抛 400，配置就绪时正确组装 key（mock COS）
 *
 * 注意：测试使用 internal `_xxxForTest` helper 直接测纯函数，
 * 避免初始化 COS 实例（测试环境不需要也不应该建实例）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { uploadService } from '../../src/services/upload.service';
import { env } from '../../src/config/env';
import {
  ServiceUnavailableError,
  BadRequestError,
} from '../../src/types/errors';

// ============ 辅助：临时设置 / 还原 env 字段 ============
const ENV_KEYS = [
  'COS_SECRET_ID',
  'COS_SECRET_KEY',
  'COS_BUCKET',
  'COS_REGION',
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

  it('UPL-4: 未配置时 putObject 抛 503 ServiceUnavailable', async () => {
    setCosUnconfigured();
    await expect(
      uploadService.putObject('user-1', 'avatar', 'jpg', Buffer.from('x')),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);

    await expect(
      uploadService.putObject('user-1', 'avatar', 'jpg', Buffer.from('x')),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'UPLOAD_NOT_CONFIGURED',
    });
  });

  it('UPL-5: 未配置时 getObjectStream 抛 503', async () => {
    setCosUnconfigured();
    await expect(
      uploadService.getObjectStream('avatars/u1/abc.jpg'),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe('uploadService - normalizeExt 白名单', () => {
  it('UPL-6: 白名单内 ext 直接归一化', () => {
    expect(uploadService._normalizeExtForTest('jpg')).toBe('jpg');
    expect(uploadService._normalizeExtForTest('png')).toBe('png');
    expect(uploadService._normalizeExtForTest('webp')).toBe('webp');
  });

  it('UPL-7: jpeg 统一归一化为 jpg', () => {
    expect(uploadService._normalizeExtForTest('jpeg')).toBe('jpg');
    expect(uploadService._normalizeExtForTest('JPEG')).toBe('jpg');
  });

  it('UPL-8: 支持前导点与大小写', () => {
    expect(uploadService._normalizeExtForTest('.JPG')).toBe('jpg');
    expect(uploadService._normalizeExtForTest('.PNG')).toBe('png');
  });

  it('UPL-9: 白名单外 ext 抛 BadRequestError UPLOAD_INVALID_EXT', () => {
    expect(() => uploadService._normalizeExtForTest('gif')).toThrow(BadRequestError);
    expect(() => uploadService._normalizeExtForTest('svg')).toThrow(/不支持的文件扩展名/);
    expect(() => uploadService._normalizeExtForTest('exe')).toThrow(BadRequestError);
  });
});

describe('uploadService - validateContext', () => {
  it('UPL-10: avatar 不需要任何上下文字段', () => {
    expect(() => uploadService._validateContextForTest('avatar', {})).not.toThrow();
  });

  it('UPL-11: baby-avatar 缺 familyId 或 babyId 时抛错', () => {
    expect(() =>
      uploadService._validateContextForTest('baby-avatar', { babyId: 'b1' }),
    ).toThrow(/缺少必填字段.*familyId/);
    expect(() =>
      uploadService._validateContextForTest('baby-avatar', { familyId: 'f1' }),
    ).toThrow(/缺少必填字段.*babyId/);
  });

  it('UPL-12: baby-avatar 全字段时通过', () => {
    expect(() =>
      uploadService._validateContextForTest('baby-avatar', {
        familyId: 'f1',
        babyId: 'b1',
      }),
    ).not.toThrow();
  });

  it('UPL-13: daily-checkin 必填 familyId / babyId / date', () => {
    expect(() =>
      uploadService._validateContextForTest('daily-checkin', {
        familyId: 'f1',
        babyId: 'b1',
      }),
    ).toThrow(/缺少必填字段.*date/);
  });

  it('UPL-14: date 格式必须为 YYYY-MM-DD', () => {
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
        date: '2026-05-11',
      }),
    ).not.toThrow();
  });

  it('UPL-15: ctx 字段含 / 或 .. 视为非法（防 path traversal）', () => {
    expect(() =>
      uploadService._validateContextForTest('baby-avatar', {
        familyId: 'fam/../etc',
        babyId: 'b1',
      }),
    ).toThrow(/familyId 包含非法字符/);

    expect(() =>
      uploadService._validateContextForTest('baby-avatar', {
        familyId: 'f1',
        babyId: '../passwd',
      }),
    ).toThrow(/babyId 包含非法字符/);
  });
});

describe('uploadService - buildKey 路径策略', () => {
  it('UPL-16: avatar key = avatars/{userId}/{cuid}.{ext}', () => {
    const key = uploadService._buildKeyForTest('user-1', 'avatar', 'jpg', {});
    expect(key).toMatch(/^avatars\/user-1\/[a-f0-9]{32}\.jpg$/);
  });

  it('UPL-17: baby-avatar key 包含 familyId / babyId', () => {
    const key = uploadService._buildKeyForTest('user-1', 'baby-avatar', 'png', {
      familyId: 'fam-9',
      babyId: 'baby-3',
    });
    expect(key).toMatch(/^babies\/fam-9\/baby-3\/[a-f0-9]{32}\.png$/);
  });

  it('UPL-18: daily-checkin key 含 date 前缀，便于按日期检索', () => {
    const key = uploadService._buildKeyForTest('user-1', 'daily-checkin', 'webp', {
      familyId: 'fam-9',
      babyId: 'baby-3',
      date: '2026-05-11',
    });
    expect(key).toMatch(
      /^checkins\/fam-9\/baby-3\/2026-05-11-[a-f0-9]{32}\.webp$/,
    );
  });

  it('UPL-19: 同一组参数两次调用产生不同 key（cuid 防碰撞）', () => {
    const ctx = { familyId: 'f1', babyId: 'b1' };
    const k1 = uploadService._buildKeyForTest('user-1', 'baby-avatar', 'jpg', ctx);
    const k2 = uploadService._buildKeyForTest('user-1', 'baby-avatar', 'jpg', ctx);
    expect(k1).not.toBe(k2);
  });
});

describe('uploadService - isValidKey 下载路径校验', () => {
  it('UPL-20: 合法 key 通过', () => {
    expect(uploadService._isValidKeyForTest('avatars/u1/abc.jpg')).toBe(true);
    expect(uploadService._isValidKeyForTest('babies/f1/b1/abc.png')).toBe(true);
    expect(uploadService._isValidKeyForTest('checkins/f1/b1/2026-05-11-abc.webp')).toBe(true);
  });

  it('UPL-21: 非合法前缀拒绝', () => {
    expect(uploadService._isValidKeyForTest('etc/passwd')).toBe(false);
    expect(uploadService._isValidKeyForTest('/avatars/u1/abc.jpg')).toBe(false);
    expect(uploadService._isValidKeyForTest('')).toBe(false);
  });

  it('UPL-22: path traversal 拒绝', () => {
    expect(uploadService._isValidKeyForTest('avatars/../etc/passwd')).toBe(false);
    expect(uploadService._isValidKeyForTest('avatars\\u1\\abc.jpg')).toBe(false);
  });

  it('UPL-23: 控制字符拒绝', () => {
    expect(uploadService._isValidKeyForTest('avatars/u1/\x00.jpg')).toBe(false);
  });

  it('UPL-24: 过长 key 拒绝', () => {
    const long = 'avatars/u1/' + 'a'.repeat(300);
    expect(uploadService._isValidKeyForTest(long)).toBe(false);
  });
});

describe('uploadService - putObject 端到端组装（mock COS）', () => {
  let snap: Record<string, unknown>;

  beforeEach(() => {
    snap = snapshotEnv();
    setCosConfigured();
    // 清掉懒初始化的 cos 实例缓存
    (uploadService as unknown as { cos: unknown }).cos = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (uploadService as unknown as { cos: unknown }).cos = null;
    restoreEnv(snap);
  });

  it('UPL-25: 文件超过 COS_MAX_UPLOAD_BYTES 直接抛 400 UPLOAD_TOO_LARGE', async () => {
    const oversize = Buffer.alloc(env.COS_MAX_UPLOAD_BYTES + 1);
    await expect(
      uploadService.putObject('user-1', 'avatar', 'jpg', oversize),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'UPLOAD_TOO_LARGE',
    });
  });

  it('UPL-26: 配置就绪时调 cos.putObject 并返回 { key, size, contentType }', async () => {
    // 触发懒初始化拿到 COS 实例，再 mock 它的 putObject
    const cosInstance = (uploadService as unknown as {
      getCos: () => { putObject: (params: unknown) => Promise<unknown> };
    }).getCos.call(uploadService);

    const putSpy = vi
      .spyOn(cosInstance, 'putObject')
      .mockImplementation(async () => ({ statusCode: 200, ETag: 'mock-etag' }));

    const buf = Buffer.from('fake-image-bytes');
    const result = await uploadService.putObject('user-1', 'avatar', 'jpeg', buf);

    expect(result.key).toMatch(/^avatars\/user-1\/[a-f0-9]{32}\.jpg$/);
    expect(result.size).toBe(buf.length);
    expect(result.contentType).toBe('image/jpeg');
    expect(putSpy).toHaveBeenCalledOnce();

    const callArg = putSpy.mock.calls[0][0] as {
      Bucket: string;
      Region: string;
      Key: string;
      Body: Buffer;
      ContentType: string;
    };
    expect(callArg.Bucket).toBe('test-bucket-1234');
    expect(callArg.Region).toBe('ap-shanghai');
    expect(callArg.Key).toBe(result.key);
    expect(callArg.Body).toBe(buf);
    expect(callArg.ContentType).toBe('image/jpeg');
  });

  it('UPL-27: putObject 失败时抛出原始错误', async () => {
    const cosInstance = (uploadService as unknown as {
      getCos: () => { putObject: (params: unknown) => Promise<unknown> };
    }).getCos.call(uploadService);

    vi.spyOn(cosInstance, 'putObject').mockRejectedValue(
      new Error('mock cos network error'),
    );

    await expect(
      uploadService.putObject('user-1', 'avatar', 'jpg', Buffer.from('x')),
    ).rejects.toThrow(/mock cos network error/);
  });
});
