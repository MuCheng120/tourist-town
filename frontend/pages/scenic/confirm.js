const app = getApp();
const { payOrderById } = require('../../utils/order-pay');
const { fetchAvailableCoupons, computeDiscount } = require('../../utils/order-coupon');

Page({
  data: {
    spotId: null,
    spotName: '',
    playDate: '',
    ticketType: 'adult',
    ticketName: '成人票',
    quantity: 1,
    total: '0',
    payTotal: '0',
    availableCoupons: [],
    selectedCouponId: null,
    discountAmount: 0,
    submitting: false,
    showPayPopup: false,
    currentOrderId: '',
  },

  onLoad(options) {
    const id = options.id;
    const playDate = options.playDate || '';
    const ticketType = options.ticketType || 'adult';
    const ticketName = decodeURIComponent(options.ticketName || '成人票');
    const quantity = parseInt(options.quantity, 10) || 1;
    const total = options.total || '0';
    const name = decodeURIComponent(options.name || '');
    if (!id || !playDate) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.setData({
      spotId: id,
      spotName: name,
      playDate,
      ticketType,
      ticketName,
      quantity,
      total: String(total),
      payTotal: String(total),
    });
    this.loadScenicCoupons(parseFloat(total) || 0);
  },

  async loadScenicCoupons(totalAmount) {
    if (!app.globalData.token) return;
    try {
      const list = await fetchAvailableCoupons(app, { totalAmount });
      this.setData({ availableCoupons: Array.isArray(list) ? list : [] });
    } catch (e) {
      this.setData({ availableCoupons: [] });
    }
  },

  onSelectCoupon(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.availableCoupons.find(c => String(c.id) === String(id));
    if (!coupon) return;
    const total = parseFloat(this.data.total) || 0;
    const { discountAmount, finalAmount } = computeDiscount(total, coupon);
    this.setData({
      selectedCouponId: coupon.id,
      discountAmount,
      payTotal: finalAmount.toFixed(2),
    });
  },

  onRemoveCoupon() {
    const total = parseFloat(this.data.total) || 0;
    this.setData({
      selectedCouponId: null,
      discountAmount: 0,
      payTotal: total.toFixed(2),
    });
  },

  async submitOrder() {
    if (!app.globalData.token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    const { spotId, playDate, quantity, total } = this.data;
    this.setData({ submitting: true });
    try {
      const order = await app.request({
        url: '/api/orders',
        method: 'POST',
        needAuth: true,
        data: {
          order_type: 'scenic',
          spot_id: spotId,
          play_date: playDate,
          quantity,
          total_price: parseFloat(total),
          user_coupon_id: this.data.selectedCouponId || undefined,
        },
      });
      const orderId = order && order.id;
      if (!orderId) {
        throw new Error('创建订单失败');
      }
      
      // 保存订单ID并显示支付密码弹窗
      this.setData({
        currentOrderId: orderId,
        showPayPopup: true,
        submitting: false
      });
    } catch (e) {
      this.setData({ submitting: false });
      wx.showToast({ title: (e && e.message) || '订单创建失败', icon: 'none' });
    }
  },

  onPaySuccess() {
    // 支付成功后更新订单状态
    const { currentOrderId } = this.data;
    
    // 实际调用支付接口
    app.request({
      url: `/api/orders/${currentOrderId}/pay`,
      method: 'POST',
      needAuth: true,
    }).then(() => {
      wx.showToast({ title: '支付成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/order/detail?id=${currentOrderId}` });
      }, 1500);
    }).catch(error => {
      wx.showToast({
        title: (error && error.message) || '支付失败',
        icon: 'none',
      });
    });
  },

  onPayClose() {
    // 关闭支付弹窗
    this.setData({ showPayPopup: false });
  },
});
