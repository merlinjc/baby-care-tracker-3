/**
 * E2E API 测试客户端：基于 fetch 的轻量封装
 *
 * 设计动机：
 * - 后端 src/app.ts 直接 listen，不利于 supertest in-process 调用；
 * - 改用真实 HTTP 调用，复用 dev server，与 Playwright 共享一份后端实例。
 *
 * 使用前提：
 *   1. 已运行 `pnpm dev:server` 或 `pnpm test:e2e:up`
 *   2. 已运行 `pnpm db:seed:e2e`（或 :bulk）
 */

const BASE_URL = process.env.E2E_API_BASE_URL || 'http://localhost:3000';

export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  raw: unknown;
  setCookies: string[];
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  cookies?: string | null;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(options.headers || {}),
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.cookies) headers.cookie = options.cookies;

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // 兼容 set-cookie 多值
  const setCookies: string[] = [];
  // @ts-expect-error fetch headers raw access (Node 20+)
  if (typeof res.headers.getSetCookie === 'function') {
    setCookies.push(...res.headers.getSetCookie());
  } else {
    const sc = res.headers.get('set-cookie');
    if (sc) setCookies.push(sc);
  }

  let raw: unknown = null;
  const text = await res.text();
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = text;
  }

  const json = raw as { success?: boolean; data?: T; error?: { code: string; message: string } };
  return {
    status: res.status,
    ok: res.ok && (json?.success ?? false),
    data: json?.data,
    error: json?.error,
    raw,
    setCookies,
  };
}

// ============ 高频封装 ============

export interface AuthSession {
  userId: string;
  email: string;
  nickname: string;
  token: string;
  cookies: string;
}

/** 登录并返回完整会话（含 refresh cookie，便于 /auth/refresh 测试） */
export async function login(email: string, password: string): Promise<AuthSession> {
  const r = await apiRequest<{
    user: { id: string; email: string; nickname: string };
    accessToken: string;
  }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!r.ok || !r.data) {
    throw new Error(`login failed (${r.status}): ${JSON.stringify(r.error || r.raw)}`);
  }
  // 拼合 set-cookie 为 cookie 头
  const cookies = r.setCookies.map((c) => c.split(';')[0]).join('; ');
  return {
    userId: r.data.user.id,
    email: r.data.user.email,
    nickname: r.data.user.nickname,
    token: r.data.accessToken,
    cookies,
  };
}

/** 注册（用于 S05 限流场景） */
export async function register(args: {
  email?: string;
  phone?: string;
  password: string;
  nickname: string;
}): Promise<AuthSession> {
  const r = await apiRequest<{
    user: { id: string; email: string; nickname: string };
    accessToken: string;
  }>('/api/auth/register', { method: 'POST', body: args });
  if (!r.ok || !r.data) {
    throw new Error(`register failed (${r.status}): ${JSON.stringify(r.error || r.raw)}`);
  }
  const cookies = r.setCookies.map((c) => c.split(';')[0]).join('; ');
  return {
    userId: r.data.user.id,
    email: r.data.user.email,
    nickname: r.data.user.nickname,
    token: r.data.accessToken,
    cookies,
  };
}

/** 健康探针 — 启动测试前调用，未起服务则报错友好 */
export async function ensureServerUp(): Promise<void> {
  try {
    const r = await apiRequest('/api/health');
    if (!r.ok) {
      throw new Error(`/api/health returned ${r.status}`);
    }
  } catch (e) {
    throw new Error(
      `[E2E] backend not reachable at ${BASE_URL}. ` +
        `Run "pnpm dev:server" in another terminal first.\n  cause: ${(e as Error).message}`,
    );
  }
}
