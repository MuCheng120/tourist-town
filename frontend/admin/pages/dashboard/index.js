// admin/pages/dashboard/index.js
const app = getApp();

Page({
  data: {
    contactPhone: '',
    stats: {
      totalGMV: 0,
      totalOrders: 0,
      totalUsers: 0,
      totalMerchants: 0,
      todayAmount: 0,
      todayOrders: 0,
      todayNewUsers: 0,
      todayConversion: 0,
      pendingMerchants: 0,
      pendingPosts: 0,
      pendingComments: 0,
    },
    notices: [],
    loading: false,
  },

  onLoad() {
    this.hideHomeButtonIfNeeded();
    this.loadDashboardData();
  },

  onShow() {
    this.hideHomeButtonIfNeeded();
    // 页面显示时刷新数据
    this.loadDashboardData();
  },

  hideHomeButtonIfNeeded() {
    if (typeof wx.hideHomeButton === 'function') {
      try {
        wx.hideHomeButton();
      } catch (e) {
        // 忽略不支持或调用时机导致的异常
      }
    }
  },

  /**
   * 加载工作台数据
   */
  async loadDashboardData() {
    this.setData({ loading: true });

    try {
      // 加载统计数据（使用统一封装）
      const overview = await app.request({
        url: '/api/statistics/overview',
        method: 'GET',
        needAuth: true,
      });

      this.setData({
        'stats.totalGMV': overview.total_gmv || 0,
        'stats.totalOrders': overview.total_orders || 0,
        'stats.totalUsers': overview.total_users || 0,
        'stats.totalMerchants': overview.total_merchants || 0,
        'stats.todayAmount': overview.today_gmv || 0,
        'stats.todayOrders': overview.today_orders || 0,
        'stats.todayNewUsers': overview.today_users || 0,
        'stats.todayConversion': overview.conversion_rate || 0,
      });

      // 加载待审核商户数量（接口返回 data 为数组）
      const pendingMerchantsRes = await app.request({
        url: '/api/user/merchant-applications',
        method: 'GET',
        needAuth: true,
        data: { status: 'pending' },
      });
      const pendingMerchantsList = Array.isArray(pendingMerchantsRes) ? pendingMerchantsRes : (pendingMerchantsRes?.list || pendingMerchantsRes?.data || []);
      this.setData({
        'stats.pendingMerchants': pendingMerchantsList.length,
      });

      // 加载待审核攻略数量
      try {
        const pendingPostsRes = await app.request({
          url: '/api/posts',
          method: 'GET',
          needAuth: true,
          data: { audit_status: 0, pageSize: 1 },
        });
        this.setData({
          'stats.pendingPosts': (pendingPostsRes && pendingPostsRes.total) ? pendingPostsRes.total : 0,
        });
      } catch (e) {
        console.error('加载待审核攻略数量失败:', e);
      }

      // 加载待审核评论数量（接口返回 data 为数组）
      const pendingCommentsRes = await app.request({
        url: '/api/comments/pending',
        method: 'GET',
        needAuth: true,
      });
      const pendingCommentsList = Array.isArray(pendingCommentsRes) ? pendingCommentsRes : (pendingCommentsRes?.list || pendingCommentsRes?.data || []);
      this.setData({
        'stats.pendingComments': pendingCommentsList.length,
      });

      // 加载系统设置（咨询电话）
      try {
        const settingsRes = await app.request({
          url: '/api/admin/settings',
          method: 'GET',
          needAuth: true,
        });
        const settings = settingsRes.data || settingsRes;
        this.setData({
          contactPhone: settings.contact_phone || '',
        });
      } catch (e) {
        console.error('加载系统设置失败:', e);
      }
    } catch (error) {
      console.error('加载工作台数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  onContactPhoneInput(e) {
    this.setData({ contactPhone: e.detail.value || '' });
  },

  async saveContactPhone() {
    const app = getApp();
    const { contactPhone } = this.data;
    try {
      await app.request({
        url: '/api/admin/settings',
        method: 'PUT',
        needAuth: true,
        data: { contact_phone: (contactPhone || '').trim() },
      });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  /**
   * 导航到审核中心
   */
  navigateToAudit() {
    wx.navigateTo({
      url: '/admin/pages/audit/index',
    });
  },

  /**
   * 导航到商户审核
   */
  navigateToMerchantAudit() {
    wx.navigateTo({
      url: '/admin/pages/audit/index?tab=merchant',
    });
  },

  /**
   * 导航到攻略审核
   */
  navigateToPostAudit() {
    wx.navigateTo({
      url: '/admin/pages/audit/index?tab=post',
    });
  },

  /**
   * 导航到评论审核
   */
  navigateToCommentAudit() {
    wx.navigateTo({
      url: '/admin/pages/audit/index?tab=comment',
    });
  },

  /**
   * 导航到用户管理
   */
  navigateToUsers() {
    wx.navigateTo({
      url: '/admin/pages/users/index',
    });
  },

  /**
   * 导航到商户管理
   */
  navigateToMerchants() {
    wx.navigateTo({
      url: '/admin/pages/merchants/index',
    });
  },

  /**
   * 导航到酒店管理
   */
  navigateToHotel() {
    wx.navigateTo({
      url: '/admin/pages/hotel/index',
    });
  },

  /**
   * 导航到商品管理
   */
  navigateToProducts() {
    wx.navigateTo({
      url: '/admin/pages/products/index',
    });
  },

  /**
   * 导航到首页轮播管理
   */
  navigateToBanners() {
    wx.navigateTo({
      url: '/admin/pages/banners/index',
    });
  },

  /**
   * 导航到订单管理
   */
  navigateToOrders() {
    wx.navigateTo({
      url: '/admin/pages/orders/index',
    });
  },

  /**
   * 导航到门票/订单核销
   */
  navigateToVerify() {
    wx.navigateTo({
      url: '/admin/pages/verify/index',
    });
  },

  /**
   * 导航到优惠券管理
   */
  navigateToCoupon() {
    wx.navigateTo({
      url: '/admin/pages/coupon/index',
    });
  },

  /**
   * 导航到公告管理
   */
  navigateToAnnouncements() {
    wx.navigateTo({
      url: '/admin/pages/announcements/index',
    });
  },

  /**
   * 导航到管理员管理
   */
  navigateToAdminUsers() {
    wx.navigateTo({
      url: '/admin/pages/admin-users/index',
    });
  },

  /**
   * 导航到信誉度管理
   */
  navigateToCredit() {
    wx.navigateTo({
      url: '/admin/pages/credit/index',
    });
  },

  /**
   * 导航到景点管理
   */
  navigateToScenic() {
    wx.navigateTo({
      url: '/admin/pages/scenic/index',
    });
  },

  /**
   * 导航到数据分析
   */
  navigateToDataAnalysis() {
    wx.navigateTo({
      url: '/admin/pages/analysis/index',
    });
  },

  /**
   * 导航到攻略管理
   */
  navigateToPostManage() {
    wx.navigateTo({
      url: '/admin/pages/posts/index',
    });
  },

  /**
   * 标签管理（酒店/景点共用）
   */
  navigateToTags() {
    wx.navigateTo({
      url: '/admin/pages/tags/index',
    });
  },

  /**
   * 退出登录：弹窗确认后清除登录态并返回登录页
   */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          app.globalData.token = null;
          app.globalData.userInfo = null;
          wx.showToast({ title: '已退出登录', icon: 'success' });
          wx.reLaunch({ url: '/pages/login/index' });
        }
      },
    });
  },
});
