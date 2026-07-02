// merchant/pages/dashboard/index.js
const app = getApp();

Page({
  data: {
    timeRange: 'day',
    stats: {
      amount: 0,
      count: 0,
      pendingShipment: 0,
      pendingPayment: 0,
      merchant_status: '',
    },
    merchantStatusText: '',
    pendingOrders: [],
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
      const { timeRange } = this.data;
      // 加载统计数据
      const stats = await app.request({
        url: '/api/merchant/dashboard/stats',
        method: 'GET',
        needAuth: true,
        data: {
          timeRange,
        },
      });

      const merchantStatusText = { approved: '已认证', pending: '待审核', rejected: '未通过' }[stats.merchant_status] || stats.merchant_status || '待审核';
      this.setData({
        stats,
        merchantStatusText,
      });

      // 加载待发货订单（接口返回 { total, page, pageSize, list }）
      const orderRes = await app.request({
        url: '/api/merchant/orders',
        method: 'GET',
        needAuth: true,
        data: {
          status: 'shipping_pending',
          limit: 5,
        },
      });
      const rawList = (orderRes && orderRes.list) ? orderRes.list : [];

      // 处理订单数据：安全字段 + 时间格式化 + 商品首图（cover_image 或 images[0]）
      const processedOrders = rawList.map(order => {
        const product = order.product || {};
        let images = product.images;
        if (typeof images === 'string') {
          try { images = JSON.parse(images); } catch (e) { images = []; }
        }
        const imagesArr = Array.isArray(images) ? images : [];
        const firstImage = product.cover_image || imagesArr[0] || '';
        return {
          ...order,
          productImage: app.fullImageUrl(firstImage),
          productName: product.name || '未知商品',
          created_at: this.formatOrderTime(order.created_at),
        };
      });

      this.setData({ pendingOrders: processedOrders });
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

  /**
   * 导航到订单管理
   */
  navigateToOrders() {
    wx.navigateTo({
      url: '/merchant/pages/orders/index',
    });
  },

  /**
   * 导航到商品管理
   */
  navigateToProducts() {
    wx.navigateTo({ url: '/merchant/pages/products/index' });
  },

  /**
   * 导航到扫码核销
   */
  navigateToScan() {
    wx.navigateTo({
      url: '/merchant/pages/verify/index',
    });
  },

  /**
   * 优惠券管理
   */
  navigateToCoupon() {
    wx.navigateTo({ url: '/merchant/pages/coupon/index' });
  },

  /**
   * 信誉中心
   */
  navigateToCredit() {
    wx.navigateTo({ url: '/merchant/pages/credit/index' });
  },

  /**
   * 用户评价
   */
  navigateToMessages() {
    wx.navigateTo({ url: '/merchant/pages/messages/index' });
  },

  /**
   * 店铺设置（简介、图片、联系方式、营业时间）
   */
  navigateToShopEdit() {
    wx.navigateTo({ url: '/merchant/pages/shop/edit' });
  },

  /**
   * 格式化订单时间（工作台列表展示）
   */
  formatOrderTime(str) {
    if (!str) return '';
    const s = String(str).replace('T', ' ').slice(0, 19);
    return s;
  },

  /**
   * 导航到订单详情/发货页（商家端无独立详情页，进入发货页可查看并发货）
   */
  navigateToOrderDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/merchant/pages/ship/index?id=${id}`,
    });
  },

  /**
   * 去发货
   */
  shipOrder(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/merchant/pages/ship/index?id=${id}`,
    });
  },

  /**
   * 切换时间范围
   */
  switchTimeRange(e) {
    const { range } = e.currentTarget.dataset;
    this.setData({ timeRange: range });
    this.loadDashboardData();
  },

  /**
   * 退出登录：弹窗确认后清除登录态并跳转登录页
   */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: res => {
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
