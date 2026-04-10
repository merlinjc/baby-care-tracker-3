/**
 * 用户认证服务
 * 微信小程序天然免登录，通过云函数获取 openid
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

  /**
   * 获取用户 openid
   * 通过云函数获取，无需用户授权
   */
  async getOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      return res.result.openid;
    } catch (error) {
      console.error('获取 openid 失败:', error);
      throw error;
    }
  }

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
      await this.userCollection.doc(userId).update({
        data: {
          ...data,
          updatedAt: this.db.serverDate()
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
