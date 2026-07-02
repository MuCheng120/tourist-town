// 酒店订单确认页：入住人信息 + 优惠券 + 下单
const app = getApp();
const { payOrderById } = require('../../utils/order-pay');
const { hotelRoomAndChildTotal } = require('../../utils/hotel-child-price');

Page({
  data: {
    orderInfo: null,
    availableCoupons: [],
    selectedCouponId: null,
    discountAmount: 0,
    finalAmount: 0,
    baseRoomAmount: 0,
    childSurcharge: 0,
    chargeableChildren: 0,
    submitting: false,
    contactName: '',
    contactPhone: '',
    adultCount: 1,
    childCount: 0,
    childAges: [],
    showPayPopup: false,
    currentOrderId: '',
  },

  onLoad(options) {
    const dataStr = options.data;
    if (!dataStr) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    let orderInfo;
    try {
      orderInfo = JSON.parse(decodeURIComponent(dataStr));
    } catch (e) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    const adultCount = orderInfo.adult_count != null ? orderInfo.adult_count : 1;
    const childCount = orderInfo.child_count != null ? orderInfo.child_count : 0;
    const childAges = Array.isArray(orderInfo.child_ages) ? orderInfo.child_ages : [];
    const b = hotelRoomAndChildTotal(orderInfo.price, orderInfo.night_count, childCount);
    this.setData({
      orderInfo: { ...orderInfo, total_price: b.total },
      finalAmount: b.total,
      adultCount,
      childCount,
      childAges,
      baseRoomAmount: b.base,
      childSurcharge: b.childSurcharge,
      chargeableChildren: b.chargeableChildren,
    });
    this.loadAvailableCoupons(b.total, orderInfo.merchant_id);
    this.fillGuestFromUser();
  },

  /** 儿童人数变化或需重算时：同步订单金额、优惠券门槛 */
  applyHotelPriceToPage() {
    const o = this.data.orderInfo;
    if (!o) return;
    const b = hotelRoomAndChildTotal(o.price, o.night_count, this.data.childCount);
    const total = b.total;
    let selectedCouponId = this.data.selectedCouponId;
    let disc = 0;
    if (selectedCouponId) {
      const coupon = (this.data.availableCoupons || []).find(c => String(c.id) === String(selectedCouponId));
      if (coupon && total >= parseFloat(coupon.min_spend || 0)) {
        disc = Math.min(Number(coupon.value) || 0, total);
      } else {
        selectedCouponId = null;
      }
    }
    this.setData({
      'orderInfo.total_price': total,
      baseRoomAmount: b.base,
      childSurcharge: b.childSurcharge,
      chargeableChildren: b.chargeableChildren,
      selectedCouponId,
      discountAmount: disc,
      finalAmount: Math.max(0, total - disc),
    });
    this.loadAvailableCoupons(total, o.merchant_id);
  },

  fillGuestFromUser() {
    const u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (u && u.real_name) {
      this.setData({ contactName: u.real_name || '' });
    }
  },

  /** van-field 的 change/input：e.detail 多为字符串/数字本身，而非 { value }（与 profile 页一致） */
  vanFieldDetailToString(e) {
    const d = e.detail;
    if (d == null) return '';
    if (typeof d === 'string' || typeof d === 'number') return String(d);
    if (typeof d === 'object' && d.value != null) return String(d.value);
    return '';
  },

  onContactNameChange(e) {
    this.setData({ contactName: this.vanFieldDetailToString(e) });
  },

  onContactPhoneChange(e) {
    const raw = this.vanFieldDetailToString(e).replace(/\D/g, '');
    this.setData({ contactPhone: raw.slice(0, 11) });
  },

  onAdultCountChange(e) {
    const v = (e.detail || e).value;
    this.setData({ adultCount: typeof v === 'number' ? v : parseInt(v, 10) || 1 });
  },

  onChildCountChange(e) {
    const v = (e.detail || e).value;
    const childCount = typeof v === 'number' ? v : parseInt(v, 10) || 0;
    this.setData({ childCount }, () => this.applyHotelPriceToPage());
  },

  async loadAvailableCoupons(totalAmount, merchantId) {
    if (!app.globalData.token) return;
    try {
      const data = { totalAmount };
      if (merchantId != null && merchantId !== '') data.merchantId = merchantId;
      const list = await app.request({
        url: '/api/coupons/available',
        method: 'GET',
        data,
        needAuth: true,
      });
      this.setData({
        availableCoupons: Array.isArray(list) ? list : [],
      });
    } catch (e) {
      this.setData({ availableCoupons: [] });
    }
  },

  onSelectCoupon(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.availableCoupons.find(c => String(c.id) === String(id));
    if (!coupon) return;
    const total = Number(this.data.orderInfo.total_price) || 0;
    const discount = Math.min(Number(coupon.value) || 0, total);
    this.setData({
      selectedCouponId: coupon.id,
      discountAmount: discount,
      finalAmount: Math.max(0, total - discount),
    });
  },

  onRemoveCoupon() {
    const total = Number(this.data.orderInfo.total_price) || 0;
    this.setData({
      selectedCouponId: null,
      discountAmount: 0,
      finalAmount: total,
    });
  },

  async submitOrder() {
    if (this.data.submitting) return;
    const { orderInfo, selectedCouponId, finalAmount, contactName, contactPhone, adultCount, childCount } = this.data;

    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }
    const name = (contactName || '').trim();
    const phone = (contactPhone || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写入住人真实姓名', icon: 'none' });
      return;
    }
    if (!phone) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const order = await app.request({
        url: '/api/orders',
        method: 'POST',
        needAuth: true,
        data: {
          order_type: 'hotel',
          room_type_id: orderInfo.room_type_id,
          check_in_date: orderInfo.check_in,
          check_out_date: orderInfo.check_out,
          contact_name: name,
          contact_phone: phone,
          adult_count: adultCount,
          child_count: childCount,
          child_ages: this.data.childAges || [],
          user_coupon_id: selectedCouponId || undefined,
        },
      });

      // 保存订单ID并显示支付密码弹窗
      this.setData({
        currentOrderId: order.id,
        showPayPopup: true,
        submitting: false
      });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({
        title: (error && error.message) || '订单创建失败',
        icon: 'none',
      });
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
        wx.redirectTo({
          url: `/pages/order/detail?id=${currentOrderId}`,
        });
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
