// merchant/pages/orders/index.js
const app = getApp();
const { formatTime } = require('../../../utils/date');

Page({
  data: {
    activeTab: '',
    orders: [],
    statusMap: {
      unpaid: '待付款',
      paid: '已支付',
      shipped: '已发货',
      verified: '已核销',
      completed: '已完成',
      cancelled: '已取消',
      refunding: '退款中',
      refunded: '已退款',
    },
    page: 1,
    hasMore: true,
    loading: false,
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    // 从详情页返回时刷新列表
    if (this.needRefresh) {
      this.setData({
        page: 1,
        orders: [],
        hasMore: true,
      });
      this.loadOrders();
      this.needRefresh = false;
    }
  },

  /**
   * 切换标签
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab,
      page: 1,
      orders: [],
      hasMore: true,
    }, () => {
      // 在 setData 完成后再请求，确保 loadOrders 读取到最新的 activeTab
      this.loadOrders();
    });
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/merchant/orders',
        method: 'GET',
        needAuth: true,
        data: {
          status: this.data.activeTab,
          page: this.data.page,
          limit: 10,
        },
      });

      const orders = res.list || [];
      
      // 处理订单数据，添加安全的字段并格式化时间；商品图用 cover_image 或 images[0]
      const processedOrders = orders.map(order => {
        const product = order.product || {};
        const user = order.user || {};
        const hasAddress = !!(order.address_info && String(order.address_info).trim());
        const statusText = this.getStatusText(order, hasAddress);
        const canShip = order.status === 'paid' && hasAddress;
        let images = product.images;
        if (typeof images === 'string') {
          try { images = JSON.parse(images); } catch (e) { images = []; }
        }
        const imagesArr = Array.isArray(images) ? images : [];
        const firstImage = product.cover_image || imagesArr[0] || '';
        return {
          ...order,
          created_at: formatTime(order.created_at),
          productImage: app.fullImageUrl(firstImage),
          productName: product.name || '未知商品',
          productPrice: product.price || 0,
          userName: user.nickname || '未知用户',
          statusText,
          canShip,
          // 商家只提交意见，最终由平台裁决
          merchantRefundDecided: !!(order.refund_reason || order.refund_reject_reason),
        };
      });

      this.setData({
        orders: [...this.data.orders, ...processedOrders],
        hasMore: orders.length >= 10,
        loading: false,
      });
    } catch (error) {
      console.error('加载订单失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  getStatusText(order, hasAddress) {
    if (!order || !order.status) return '未知';
    if (order.status === 'paid') {
      if (order.order_type === 'hotel') return '已支付';
      if (hasAddress) return '待发货';
      if (order.verification_code) return '待核销';
      return '已支付';
    }
    return this.data.statusMap[order.status] || order.status;
  },

  /**
   * 触底加载更多
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1,
      });
      this.loadOrders();
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({
      page: 1,
      orders: [],
      hasMore: true,
    });
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 去发货
   */
  shipOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/merchant/pages/ship/index?id=${orderId}`,
    });
    this.needRefresh = true;
  },

  /**
   * 查看订单详情（进入发货页可查看并发货）
   */
  navigateToDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/merchant/pages/ship/index?id=${orderId}`,
    });
  },

  /**
   * 商户同意退款
   */
  approveRefund(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确认同意该订单退款吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await app.request({
            url: `/api/merchant/orders/${id}/approve-refund`,
            method: 'POST',
            needAuth: true,
            data: {},
          });
          wx.showToast({ title: '已同意退款', icon: 'success' });
          // 刷新当前列表
          this.setData({
            page: 1,
            orders: [],
            hasMore: true,
          });
          this.loadOrders();
        } catch (err) {
          wx.showToast({ title: err.message || '操作失败', icon: 'none' });
        }
      },
    });
  },

  /**
   * 商户拒绝退款
   */
  rejectRefund(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确认拒绝该订单退款申请吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await app.request({
            url: `/api/merchant/orders/${id}/reject-refund`,
            method: 'POST',
            needAuth: true,
            data: {},
          });
          wx.showToast({ title: '已拒绝退款', icon: 'success' });
          this.setData({
            page: 1,
            orders: [],
            hasMore: true,
          });
          this.loadOrders();
        } catch (err) {
          wx.showToast({ title: err.message || '操作失败', icon: 'none' });
        }
      },
    });
  },

});
