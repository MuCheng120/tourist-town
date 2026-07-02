// 购物车结算确认页（类似酒店确认页）
const app = getApp();
const { payOrderById } = require('../../utils/order-pay');
const { fetchAvailableCoupons, computeDiscount } = require('../../utils/order-coupon');

Page({
  data: {
    items: [],
    totalAmount: '0.00',
    payTotal: '0.00',
    availableCoupons: [],
    selectedCouponId: null,
    discountAmount: 0,
    showCouponBlock: false,
    addressList: [],
    selectedAddress: null,
    needAddress: false,
    hasDeliveryChoice: false,
    showDeliverySection: false,
    supportsExpress: true,
    supportsSelfPickup: false,
    selectedDelivery: 'express',
    hasSouvenir: false,
    submitting: false,
    showPayPopup: false,
    createdOrderIds: [],
  },

  onLoad() {
    let items = app.globalData.checkoutItems || [];
    const totalAmount = app.globalData.totalAmount || '0';

    if (!items.length) {
      wx.showToast({ title: '请先选择要结算的商品', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    items = items.map(it => {
      const product = it.product || {};
      let images = product.images;
      if (typeof images === 'string') {
        try { images = JSON.parse(images); } catch (e) { images = []; }
      }
      const imagesArr = Array.isArray(images) ? images : [];
      const imagesFull = app.fullImageUrls(imagesArr);
      const cover = app.fullImageUrl(product.cover_image || imagesArr[0] || '');
      return {
        ...it,
        product: {
          ...product,
          images: imagesFull,
          cover_image: cover,
        },
      };
    });

    const hasSouvenir = items.some(it => it.product && it.product.product_type === 'souvenir');
    const dm = (it) => (it.product && it.product.delivery_method) ? String(it.product.delivery_method) : '';
    const supportsExpress = (item) => { const d = dm(item); return !d || d.indexOf('express') !== -1; };
    const supportsSelfPickup = (item) => { const d = dm(item); return !d || d.indexOf('self_pickup') !== -1; };
    const anySupportsExpress = hasSouvenir && items.some(supportsExpress);
    const anySupportsSelfPickup = hasSouvenir && items.some(supportsSelfPickup);
    const hasDeliveryChoice = anySupportsExpress && anySupportsSelfPickup;
    let selectedDelivery = 'express';
    if (anySupportsSelfPickup && !anySupportsExpress) selectedDelivery = 'self_pickup';
    const souvenirNeedsAddress = (delivery) => {
      if (!hasSouvenir) return false;
      if (delivery === 'express') return true;
      return items.some(it => it.product && it.product.product_type === 'souvenir' && !supportsSelfPickup(it));
    };
    const needAddress = souvenirNeedsAddress(selectedDelivery);

    this.setData({
      items,
      totalAmount: String(totalAmount),
      payTotal: String(totalAmount),
      needAddress,
      hasDeliveryChoice,
      showDeliverySection: hasSouvenir,
      supportsExpress: anySupportsExpress,
      supportsSelfPickup: anySupportsSelfPickup,
      selectedDelivery,
      hasSouvenir,
    });

    if (needAddress) {
      this.loadAddressList();
    }
    this.initCouponsForCart(items, totalAmount);
  },

  initCouponsForCart(items, totalAmount) {
    if (!Array.isArray(items) || items.length !== 1) {
      this.setData({ showCouponBlock: false });
      return;
    }
    const product = items[0].product || {};
    const mid = product.merchant_id;
    if (mid == null || mid === '') {
      this.setData({ showCouponBlock: false });
      return;
    }
    const totalNum = parseFloat(totalAmount) || 0;
    this.setData({ showCouponBlock: true });
    this.loadAvailableCoupons(totalNum, mid);
  },

  async loadAvailableCoupons(totalAmount, merchantId) {
    if (!app.globalData.token) return;
    try {
      const list = await fetchAvailableCoupons(app, { totalAmount, merchantId });
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
    const total = parseFloat(this.data.totalAmount) || 0;
    const { discountAmount, finalAmount } = computeDiscount(total, coupon);
    this.setData({
      selectedCouponId: coupon.id,
      discountAmount,
      payTotal: finalAmount.toFixed(2),
    });
  },

  onRemoveCoupon() {
    const total = parseFloat(this.data.totalAmount) || 0;
    this.setData({
      selectedCouponId: null,
      discountAmount: 0,
      payTotal: total.toFixed(2),
    });
  },

  onDeliveryChange(e) {
    const v = (e.detail && e.detail.value) || 'express';
    const souvenirNeedsAddress = (delivery) => {
      if (!this.data.hasSouvenir) return false;
      if (delivery === 'express') return true;
      return this.data.items.some(it => it.product && it.product.product_type === 'souvenir' && (it.product.delivery_method || '').indexOf('self_pickup') === -1);
    };
    const needAddress = souvenirNeedsAddress(v);
    this.setData({
      selectedDelivery: v,
      needAddress,
    });
    if (needAddress && this.data.addressList.length === 0) {
      this.loadAddressList();
    }
  },

  onShow() {
    if (this.data.needAddress && this.data.addressList.length === 0) {
      this.loadAddressList();
    }
  },

  async loadAddressList() {
    if (!app.globalData.token) return;
    try {
      const list = await app.request({
        url: '/api/address/list',
        method: 'GET',
        needAuth: true,
      });
      const arr = Array.isArray(list) ? list : (list.list || list.data || []);
      const defaultAddr = arr.find(a => a.is_default) || arr[0];
      this.setData({
        addressList: arr,
        selectedAddress: defaultAddr || null,
      });
    } catch (e) {
      this.setData({ addressList: [] });
    }
  },

  toAddressList() {
    wx.navigateTo({ url: '/pages/address/index?fromOrder=1' });
  },

  async submitOrder() {
    if (this.data.submitting) return;
    const { items, needAddress, selectedAddress } = this.data;

    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/index' }); },
      });
      return;
    }

    const selectedDelivery = this.data.selectedDelivery || 'express';
    if (needAddress && !selectedAddress) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }

    const cartIds = items.map(it => it.id);
    this.setData({ submitting: true });

    try {
      const createdOrderIds = [];
      const useCouponId = items.length === 1 && this.data.selectedCouponId ? this.data.selectedCouponId : undefined;
      let couponUsed = false;
      for (const item of items) {
        const product = item.product || {};
        const orderType = product.product_type === 'food' ? 'food' : 'souvenir';
        const supportsSelfPickup = (product.delivery_method || '').indexOf('self_pickup') !== -1;
        const useAddress = orderType === 'souvenir' && (selectedDelivery === 'express' || !supportsSelfPickup);
        const deliveryMode = orderType === 'souvenir'
          ? (useAddress ? 'express' : 'self_pickup')
          : undefined;
        const userCouponPayload = useCouponId && !couponUsed ? useCouponId : undefined;
        if (userCouponPayload) couponUsed = true;
        const order = await app.request({
          url: '/api/orders',
          method: 'POST',
          needAuth: true,
          data: {
            order_type: orderType,
            product_id: product.id,
            quantity: item.quantity,
            delivery_mode: deliveryMode,
            address_id: useAddress ? selectedAddress.id : undefined,
            user_coupon_id: userCouponPayload,
          },
        });
        if (order && order.id) createdOrderIds.push(order.id);
      }

      // 仅当来自购物车（有有效 cart id）时删除购物车项
      const realCartIds = cartIds.filter(id => id && Number(id) > 0);
      if (realCartIds.length > 0) {
        await app.request({
          url: '/api/shopping-cart/batch-remove',
          method: 'POST',
          needAuth: true,
          data: { ids: realCartIds },
        });
      }

      // 保存订单ID并显示支付密码弹窗
      this.setData({
        createdOrderIds,
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
    const { createdOrderIds } = this.data;
    
    // 实际调用支付接口
    this.setData({ submitting: true });
    
    Promise.all(createdOrderIds.map(oid => 
      app.request({
        url: `/api/orders/${oid}/pay`,
        method: 'POST',
        needAuth: true,
      })
    )).then(() => {
      wx.showToast({ title: '支付成功', icon: 'success' });
      setTimeout(() => {
        if (createdOrderIds.length === 1) {
          wx.redirectTo({ url: `/pages/order/detail?id=${createdOrderIds[0]}` });
        } else {
          wx.redirectTo({ url: '/pages/order/list' });
        }
      }, 1500);
    }).catch(error => {
      wx.showToast({
        title: (error && error.message) || '支付失败',
        icon: 'none',
      });
    }).finally(() => {
      this.setData({ submitting: false });
    });
  },

  onPayClose() {
    // 关闭支付弹窗
    this.setData({ showPayPopup: false });
  },
});
