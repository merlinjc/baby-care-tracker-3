/**
 * 用户认证服务
 *
 * 机制说明（v4.2+）：
 * - 微信小程序天然免登录：`wx.cloud.init({ traceUser: true })` 自动关联 openid。
 * - `users` 集合 ACL = PRIVATE：`where({})` 查询会被安全规则自动注入 `_openid` 过滤，
 *   新建 `add({ data })` 时 `_openid` 由 CloudBase 后端自动注入（PRIVATE ACL 写入约束）。
 * - 跨用户写入统一通过 `familyOperation` 云函数，服务端 `getWXContext().OPENID`
 *   作为不可伪造的身份源头（详见 `coding-conventions.md` §8）。
 * - `cloudfunctions/getOpenId` 保留用于 `traceUser` 依赖，客户端不再显式调用。
 */

let instance = null;

class AuthService {
  constructor() {
    if (instance) return instance;
    this.db = wx.cloud.database();
    this.userCollection = this.db.collection('users');
    instance = this;
  }

  static getInstance() {
    if (!instance) instance = new AuthService();
    return instance;
  }

  /** [v4.3.2 FR-A13] 重置单例（用于退出登录/家庭解散后清理） */
  static resetInstance() { instance = null; }

  /**
   * 获取或创建用户信息
   * @returns {Promise<Object>} 用户信息
   */
  async getUserInfo() {
    try {
      // 查询当前用户的记录
      // 注意：云开发会自动根据安全规则添加 _openid 过滤条件
      const userRes = await this.userCollection
        .where({})
        .limit(1)
        .get();

      if (userRes.data.length > 0) {
        return userRes.data[0];
      }

      // 创建新用户
      // 注意：不需要手动设置 _openid，系统会自动添加
      const newUser = {
        nickname: '',
        avatar: '',
        role: 'parent', // parent | family_member
        relation: '',
        relationText: '',
        createdAt: this.db.serverDate(),
        updatedAt: this.db.serverDate()
      };

      const createRes = await this.userCollection.add({
        data: newUser
      });

      return {
        _id: createRes._id,
        ...newUser
      };
    } catch (error) {
      console.error('获取用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {string} userId 用户 ID
   * @param {Object} data 更新数据
   */
  async updateUserInfo(userId, data) {
    try {
      // [v4.3.2 FR-7] 补 updatedAtTs 双时间戳，与其他集合写入对齐
      await this.userCollection.doc(userId).update({
        data: {
          ...data,
          updatedAt: this.db.serverDate(),
          updatedAtTs: Date.now()
        }
      });
    } catch (error) {
      console.error('更新用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 删除用户
   * @param {string} userId 用户 ID
   */
  async deleteUser(userId) {
    try {
      await this.userCollection.doc(userId).remove();
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  }
}

module.exports = AuthService;
