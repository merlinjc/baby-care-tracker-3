/**
 * 加入家庭组页面
 *
 * [v4.3.2 FR-A3] 加入成功后拉完整 familyInfo
 * 根因：familyService.joinFamily 云函数仅返回 { success, familyId, familyName }，
 * 旧代码把这个残缺对象整体写入 Storage → familyInfo._id / memberDetails / members
 * 全部 undefined → PermissionUtil.getUserRole 走 FR-6 默认 viewer 分支 →
 * 新用户加入后在下次 ensureUserReady 刷新前无法创建记录。
 *
 * 修复：joinFamily 成功后调用 getFamilyDetail 拉完整 family，
 * 完整对象写 Storage + globalData（FamilyContext 优先读 globalData）；
 * 同步把 userInfo.familyId 写本地（joinFamily 云函数已写云端 users，
 * 但本地 userInfo 在 ensureUserReady 缓存失效前仍是旧值）。
 *
 * 跨 Phase 说明：Phase 3 FR-1 将 getFamilyDetail 切为云函数路径后，
 * 本处调用点无需再改（透明升级）。
 */

const FamilyService = require('../../../services/family');
const StorageUtil = require('../../../utils/storage');
const ThemeManager = require('../../../utils/theme');
const shareBehavior = require('../../../behaviors/share-behavior');

Page({
  ...shareBehavior,
  data: {
    darkMode: false,
    inviteCode: '',
    loading: false
  },

  async onLoad() {
    this.setData({ darkMode: ThemeManager.isDark() });
    this._themeOff = ThemeManager.onThemeChange(() => this._applyTheme());
    
    // [v4.1] 登录守卫
    const app = getApp();
    const check = await app.ensureUserReady();
    if (!check.ready) {
      wx.reLaunch({ url: check.redirectUrl || '/pages/auth/auth' });
      return;
    }
  },

  /**
   * 输入邀请码
   */
  onInputCode(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() });
  },

  /**
   * 加入家庭
   */
  async onJoin() {
    const { inviteCode } = this.data;

    if (!inviteCode.trim()) {
      wx.showToast({
        title: '请输入邀请码',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      // [v4.3.2 FR-A14] 单例替换 new FamilyService() → getInstance()
      const familyService = FamilyService.getInstance();
      const userInfo = StorageUtil.getUserInfo();

      if (!userInfo || !userInfo._id) {
        wx.showToast({ title: '用户信息未找到，请重新登录', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      const joinResult = await familyService.joinFamily(inviteCode.trim(), userInfo._id);

      // joinFamily 云函数返回 { success, familyId, familyName }（残缺对象）
      if (!joinResult || !joinResult.success || !joinResult.familyId) {
        throw new Error((joinResult && joinResult.message) || '加入失败');
      }

      // [v4.3.2 FR-A3] 加入成功后拉完整 family 文档
      // Phase 1 基于直连实现；Phase 3 FR-1 切云函数路径后此调用点无需变更
      let familyToSave = null;
      try {
        const fullFamily = await familyService.getFamilyDetail(joinResult.familyId);
        if (fullFamily && fullFamily._id) {
          familyToSave = fullFamily;
        } else {
          console.warn('[family-join] getFamilyDetail 返回空，使用最小兜底对象');
        }
      } catch (detailErr) {
        console.warn('[family-join] getFamilyDetail 失败，使用最小兜底对象:', detailErr);
      }

      // 降级兜底：getFamilyDetail 失败时至少保证 { _id, name } 非空
      // 下次 ensureUserReady 缓存失效（5min）或主动 onShow 时会再拉一次完整数据
      if (!familyToSave) {
        familyToSave = {
          _id: joinResult.familyId,
          name: joinResult.familyName || ''
        };
      }

      // 1) 写入本地缓存
      StorageUtil.saveFamilyInfo(familyToSave);
      StorageUtil.set('_family_fetch_ts', Date.now());

      // 2) 同步到 globalData（FamilyContext 优先读 globalData，必须同步）
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.familyInfo = familyToSave;
        // 更新 familyRole：从完整 family.memberDetails 中找当前用户
        if (familyToSave.memberDetails && Array.isArray(familyToSave.memberDetails)) {
          const myDetail = familyToSave.memberDetails.find(m => m.userId === userInfo._id);
          if (myDetail && myDetail.role) {
            app.globalData.familyRole = myDetail.role;
          }
        }
      }

      // 3) 本地 userInfo.familyId 同步（云函数已写云端，但本地 userInfo 仍是旧值）
      const patchedUserInfo = {
        ...userInfo,
        familyId: joinResult.familyId,
        familyRole: (familyToSave.memberDetails || []).find(m => m.userId === userInfo._id)?.role
          || userInfo.familyRole
          || 'editor'
      };
      StorageUtil.saveUserInfo(patchedUserInfo);
      if (app && app.globalData) {
        app.globalData.userInfo = patchedUserInfo;
      }

      // 提示用户：getFamilyDetail 失败时告知需下拉刷新以获取完整信息
      if (!familyToSave.memberDetails) {
        wx.showToast({
          title: '加入成功，部分信息需下拉刷新',
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '加入成功',
          icon: 'success'
        });
      }

      // 跳转到宝宝创建页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/baby-create/baby-create?familyId=' + joinResult.familyId
        });
      }, 1000);
    } catch (error) {
      console.error('加入家庭失败:', error);
      wx.showToast({
        title: error.message || '加入失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyTheme() {
    const darkMode = ThemeManager.isDark();
    if (this.data.darkMode !== darkMode) this.setData({ darkMode });
  },
  onUnload() {
    if (this._themeOff) this._themeOff();
  },
});
