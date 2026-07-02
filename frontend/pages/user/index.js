// pages/user/index.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    cardBackgroundUrl: '',
  },

  onLoad() {
    this.loadUserInfo(false);
  },

  onShow() {
    // 设置当前 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabBar();
    }

    // 页面显示时刷新用户信息，但不跳转
    this.loadUserInfo(false);
  },

  /**
   * 加载用户信息
   * @param {boolean} shouldRedirect - 是否根据角色跳转
   */
  async loadUserInfo(shouldRedirect = false) {
    // 检查是否有token
    const token = app.globalData.token || wx.getStorageSync('token');
    
    if (!token) {
      this.setData({ userInfo: null, cardBackgroundUrl: '' });
      return;
    }

    try {
      const userInfo = await app.request({
        url: '/api/user/info',
        method: 'GET',
        needAuth: true,  // 需要带上 token
      });
      const displayUserInfo = {
        ...userInfo,
        avatar: app.fullImageUrl(userInfo.avatar),
      };
      const cardBackgroundUrl = userInfo.background ? app.fullImageUrl(userInfo.background) : '';
      this.setData({ userInfo: displayUserInfo, cardBackgroundUrl });
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      
      // 根据参数决定是否跳转
      if (shouldRedirect) {
        this.redirectBasedOnRole(userInfo);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 如果是401错误，说明token无效，清除本地存储
      if (error.statusCode === 401) {
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
      }
      this.setData({ userInfo: null, cardBackgroundUrl: '' });
    }
  },

  /**
   * 跳转商家入驻/审核进度页（未登录先弹窗，与景点/商品一致）
   */
  navigateToMerchantApply() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '商家入驻需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }
    wx.navigateTo({ url: '/pages/merchant-apply/index' });
  },

  /**
   * 根据用户角色跳转到对应页面（商户/管理员使用 reLaunch 清空栈，避免返回混进用户端）
   */
  redirectBasedOnRole(userInfo) {
    const { role } = userInfo;
    
    if (role === 'merchant') {
      wx.reLaunch({ url: '/merchant/pages/dashboard/index' });
    } else if (role === 'admin') {
      wx.reLaunch({ url: '/admin/pages/dashboard/index' });
    }
    // 游客留在当前页面，不做跳转
  },

  /**
   * 跳转到登录页
   */
  handleLogin() {
    wx.navigateTo({
      url: '/pages/login/index',
    });
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('token');
          app.globalData.token = null;
          app.globalData.userInfo = null;

          this.setData({ userInfo: null, cardBackgroundUrl: '' });

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
          });
        }
      },
    });
  },

  /**
   * 未登录时提示并可选跳转登录；有 token 时先拉取 userInfo，再执行 callback（有 token 就执行，避免拉取失败时点不进去）
   */
  async requireLogin(callback) {
    if (this.data.userInfo) {
      callback();
      return;
    }
    const token = app.globalData.token || wx.getStorageSync('token');
    if (token) {
      wx.showLoading({ title: '加载中...' });
      await this.loadUserInfo(false);
      wx.hideLoading();
      // 有 token 就执行回调，让目标页自行处理 401；避免 loadUserInfo 失败时点击无反应
      callback();
      return;
    }
    wx.showModal({
      title: '提示',
      content: '请先登录',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/login/index' });
        }
      },
    });
  },

  /**
   * 导航到订单列表
   */
  navigateToOrders(e) {
    this.requireLogin(() => {
      const { status } = e.currentTarget.dataset;
      let url = '/pages/order/list';
      if (status) {
        url += `?status=${status}`;
      }
      wx.navigateTo({ url });
    });
  },

  /**
   * 导航到个人资料
   */
  navigateToProfile() {
    this.requireLogin(() => {
      wx.navigateTo({ url: '/pages/user/profile' });
    });
  },

  /**
   * 导航到收货地址
   */
  navigateToAddress() {
    this.requireLogin(() => {
      wx.navigateTo({
        url: '/pages/address/index',
      });
    });
  },

  /**
   * 导航到我的收藏
   */
  navigateToFavorites() {
    this.requireLogin(() => {
      wx.navigateTo({
        url: '/pages/favorite/index',
      });
    });
  },

  /**
   * 导航到领券中心（无需登录可查看，领取时再提示登录）
   */
  navigateToCouponCenter() {
    wx.navigateTo({ url: '/pages/coupon/center' });
  },

  /**
   * 导航到我的优惠券
   */
  navigateToMyCoupons() {
    this.requireLogin(() => {
      wx.navigateTo({ url: '/pages/coupon/index' });
    });
  },

  /**
   * 导航到我的攻略
   */
  navigateToMyPosts() {
    this.requireLogin(() => {
      wx.navigateTo({
        url: '/pages/community/my',
      });
    });
  },

  /**
   * 导航到商家工作台
   */
  navigateToMerchant() {
    wx.reLaunch({ url: '/merchant/pages/dashboard/index' });
  },

  /**
   * 导航到管理后台（reLaunch 清空页面栈，避免左上角返回回到用户端造成混淆）
   */
  navigateToAdmin() {
    wx.reLaunch({ url: '/admin/pages/dashboard/index' });
  },

  /**
   * 导航到注销账号页
   */
  navigateToCancelAccount() {
    this.requireLogin(() => {
      wx.navigateTo({ url: '/pages/user/cancel-account' });
    });
  },

  /**
   * 联系客服：弹窗显示管理员设置的联系号码，可选拨打
   */
  async showContactService() {
    try {
      const res = await app.request({
        url: '/api/settings/contact-phone',
        method: 'GET',
      });
      const phone = (res && res.contact_phone) ? String(res.contact_phone).trim() : '';
      if (!phone) {
        wx.showModal({
          title: '联系客服',
          content: '暂未设置客服电话',
          showCancel: false,
        });
        return;
      }
      wx.showModal({
        title: '联系客服',
        content: `客服电话：${phone}`,
        confirmText: '拨打',
        cancelText: '关闭',
        success: (r) => {
          if (r.confirm) {
            wx.makePhoneCall({ phoneNumber: phone });
          }
        },
      });
    } catch (e) {
      wx.showModal({
        title: '联系客服',
        content: '获取客服电话失败，请稍后再试',
        showCancel: false,
      });
    }
  },
});
