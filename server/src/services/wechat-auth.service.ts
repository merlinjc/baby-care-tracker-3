import { env } from '../config/env';
import { authConfig } from '../config/auth';
import { ServiceUnavailableError, UnauthorizedError, ErrorCodes } from '../types/errors';
import jwt from 'jsonwebtoken';

/**
 * 微信开放平台 网站应用 OAuth2 登录 服务（方案预留）
 *
 * ⚠️ 当前实现为"骨架"：
 *  - 当 WECHAT_WEB_APP_ID / WECHAT_WEB_APP_SECRET 任一未配置时，loginByCode 直接抛
 *    WECHAT_NOT_CONFIGURED（HTTP 503），前端可据此提示「微信登录暂未开放」。
 *  - 配置齐全时，会走完 code → access_token → unionid 的网络流程，但 upsert User
 *    需要先在 prisma schema 上加 wechatUnionId 字段（详见下方 TODO 注释）。
 *
 * 接入步骤详见：docs/web-api-spec.md §2.7、docs/web-architecture.md §微信登录扩展。
 */

const WECHAT_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
const WECHAT_USERINFO_URL = 'https://api.weixin.qq.com/sns/userinfo';

interface WechatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatUserInfo {
  openid: string;
  nickname: string;
  headimgurl: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

class WechatAuthService {
  /** 微信登录配置是否齐全 */
  isConfigured(): boolean {
    return Boolean(env.WECHAT_WEB_APP_ID && env.WECHAT_WEB_APP_SECRET);
  }

  /**
   * 入口方法：用 OAuth code 兑换我方 JWT。
   * 返回结构与 login/register 对齐：{ user, accessToken, refreshToken }。
   *
   * 当前未启用：因为 prisma schema 还没加 wechatUnionId 字段，按合规方案落库不够稳定，
   * 故无论配置是否齐全，都先抛 WECHAT_NOT_CONFIGURED，让线上对照"已知未启用"状态接入。
   * schema + migrate 落地后，把下方 TODO 块替换为真正的 upsert 即可。
   */
  async loginByCode(code: string): Promise<{
    user: unknown;
    accessToken: string;
    refreshToken: string;
  }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableError(
        '微信登录暂未配置',
        ErrorCodes.WECHAT_NOT_CONFIGURED,
      );
    }

    // —— 以下为完整调用链示例，**当前阶段被 throw 阻断**，仅作为接入参考 —— //
    const tokenData = await this.fetchAccessToken(code);
    if (!tokenData.unionid) {
      throw new UnauthorizedError(
        '微信账号缺少 unionid，请联系管理员检查开放平台绑定关系',
        ErrorCodes.WECHAT_AUTH_FAILED,
      );
    }
    // 拉用户信息（昵称、头像）
    const userInfo = await this.fetchUserInfo(tokenData.access_token, tokenData.openid).catch(
      () => null,
    );

    // TODO(wechat-login-phase-2)：
    //   1) 在 prisma schema 加 User.wechatUnionId String? @unique + User.wechatOpenId String?
    //   2) 执行 prisma migrate dev --name add_wechat_union_id
    //   3) 把下面这段 throw 替换为：
    //        const user = await prisma.user.upsert({
    //          where: { wechatUnionId: tokenData.unionid },
    //          update: { wechatOpenId: tokenData.openid, ...(userInfo && { nickname: userInfo.nickname, avatar: userInfo.headimgurl }) },
    //          create: { wechatUnionId: tokenData.unionid, wechatOpenId: tokenData.openid, nickname: userInfo?.nickname ?? '微信用户', avatar: userInfo?.headimgurl ?? null },
    //        })
    //        const tokens = this.generateTokens(user.id)
    //        return { user: this.sanitizeUser(user), ...tokens }
    void userInfo;
    throw new ServiceUnavailableError(
      '微信登录需要补齐 User.wechatUnionId schema 后启用，详见 server/src/services/wechat-auth.service.ts TODO',
      ErrorCodes.WECHAT_NOT_CONFIGURED,
    );
  }

  // ============ 私有：HTTP 调用微信 OpenAPI ============

  private async fetchAccessToken(code: string): Promise<WechatTokenResponse> {
    const url = new URL(WECHAT_ACCESS_TOKEN_URL);
    url.searchParams.set('appid', env.WECHAT_WEB_APP_ID!);
    url.searchParams.set('secret', env.WECHAT_WEB_APP_SECRET!);
    url.searchParams.set('code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = (await res.json()) as WechatTokenResponse;

    if (data.errcode) {
      throw new UnauthorizedError(
        `微信授权失败：${data.errmsg ?? 'unknown'}`,
        ErrorCodes.WECHAT_AUTH_FAILED,
      );
    }
    return data;
  }

  private async fetchUserInfo(
    accessToken: string,
    openid: string,
  ): Promise<WechatUserInfo> {
    const url = new URL(WECHAT_USERINFO_URL);
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('openid', openid);
    url.searchParams.set('lang', 'zh_CN');

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = (await res.json()) as WechatUserInfo;

    if (data.errcode) {
      throw new Error(`微信 userinfo 失败：${data.errmsg ?? 'unknown'}`);
    }
    return data;
  }

  // ============ 私有：JWT 签名（与 AuthService 保持一致；schema 落地后启用 generateTokens） ============

  private generateTokens(userId: string): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(
      { userId },
      authConfig.jwtSecret,
      { expiresIn: authConfig.jwtExpiresIn } as jwt.SignOptions,
    );
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      authConfig.jwtSecret,
      { expiresIn: authConfig.jwtRefreshExpiresIn } as jwt.SignOptions,
    );
    return { accessToken, refreshToken };
  }
}

// 防止 noUnusedLocals 在 schema 落地前对 generateTokens 报警；阶段二启用 upsert 时此行可删
void (WechatAuthService.prototype as unknown as { generateTokens: unknown }).generateTokens;

export const wechatAuthService = new WechatAuthService();
