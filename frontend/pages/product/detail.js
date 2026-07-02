// pages/product/detail.js
const app = getApp();
const { payOrderById } = require('../../utils/order-pay');
const { fetchAvailableCoupons, computeDiscount } = require('../../utils/order-coupon');

Page({
  data: {
    productId: null,
    product: null,
    quantity: 1,
    showQuantityPopup: false,
    isFavorited: false,
    comments: [],
    foodAvailableCoupons: [],
    selectedFoodCouponId: null,
    foodDiscountAmount: 0,
    foodPayTotal: '0.00',
    showPayPopup: false,
    currentOrderId: '',
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: '商品不存在',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({ productId: options.id });
    this.loadProductDetail();
  },

  /**
   * 加载商品详情
   */
  async loadProductDetail() {
    wx.showLoading({ title: '加载中...' });

    try {
      const product = await app.request({
        url: `/api/products/${this.data.productId}`,
        method: 'GET',
      });

      const merchant = product.merchant || {};
      const ext = merchant.ext || {};
      const shopImages = Array.isArray(ext.shop_images) ? ext.shop_images : [];
      let deliveryMethodText = '';
      if (product.product_type === 'food') {
        deliveryMethodText = '仅堂食';
      } else {
        const dm = product.delivery_method || '';
        deliveryMethodText = (dm.indexOf('express') !== -1 && dm.indexOf('self_pickup') !== -1)
          ? '快递发货、到店自提'
          : (dm === 'self_pickup' ? '到店自提' : '快递发货');
      }

      const coverUrl = app.fullImageUrl(product.cover_image);
      const rawImages = product.images && Array.isArray(product.images) ? product.images : [];
      const imageList = rawImages.length > 0 ? rawImages : (product.cover_image ? [product.cover_image] : []);
      const processedProduct = {
        ...product,
        deliveryMethodText,
        merchantName: merchant.business_name || merchant.nickname || '暂无',
        merchantContact: merchant.phone || merchant.contact || '',
        merchantAddress: ext.address || '',
        merchantLatitude: ext.latitude != null ? Number(ext.latitude) : null,
        merchantLongitude: ext.longitude != null ? Number(ext.longitude) : null,
        merchantDesc: ext.description || '',
        merchantShopImages: app.fullImageUrls(shopImages),
        businessHours: ext.business_hours || '',
        cover_image: coverUrl,
        images: app.fullImageUrls(imageList),
      };

      this.setData({ product: processedProduct });
      this.loadCheckFavorite(this.data.productId);
      this.loadComments();
    } catch (error) {
      console.error('加载商品详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 加载商品评论（特产/餐饮共用）
   */
  async loadComments() {
    try {
      const res = await app.request({
        url: `/api/products/${this.data.productId}/comments`,
        method: 'GET',
        data: { page: 1, pageSize: 20 },
      });
      const rawList = (res && res.list) ? res.list : [];
      const list = rawList.map(c => ({
        ...c,
        user: c.user ? { ...c.user, avatar: app.fullImageUrl(c.user.avatar) } : c.user,
        images: Array.isArray(c.images) ? app.fullImageUrls(c.images) : [],
        replies: Array.isArray(c.replies) ? c.replies.map(r => ({
          ...r,
          user: r.user ? { ...r.user, avatar: r.user.avatar ? app.fullImageUrl(r.user.avatar) : r.user.avatar } : r.user,
          images: Array.isArray(r.images) ? app.fullImageUrls(r.images) : [],
        })) : [],
      }));
      this.setData({ comments: list });
    } catch (e) {
      this.setData({ comments: [] });
    }
  },

  /**
   * 查询当前商品是否已收藏
   */
  loadCheckFavorite(productId) {
    if (!productId || !app.globalData.token) {
      this.setData({ isFavorited: false });
      return;
    }
    app.request({
      url: '/api/favorites/check',
      method: 'GET',
      data: { target_type: 'product', target_id: productId },
      needAuth: true,
    }).then(res => {
      this.setData({ isFavorited: res.favorited === true });
    }).catch(() => {
      this.setData({ isFavorited: false });
    });
  },

  /**
   * 切换收藏
   */
  toggleFavorite() {
    const id = Number(this.data.productId);
    if (!id) return;
    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后收藏',
        confirmText: '去登录',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/index' }); },
      });
      return;
    }
    const isFavorited = this.data.isFavorited;
    if (isFavorited) {
      app.request({
        url: `/api/favorites/product/${id}`,
        method: 'DELETE',
        needAuth: true,
      }).then(() => {
        wx.showToast({ title: '已取消收藏', icon: 'none' });
        this.setData({ isFavorited: false });
      }).catch(() => wx.showToast({ title: '取消失败', icon: 'none' }));
    } else {
      app.request({
        url: '/api/favorites',
        method: 'POST',
        needAuth: true,
        data: { target_type: 'product', target_id: id },
      }).then(() => {
        wx.showToast({ title: '已收藏', icon: 'success' });
        this.setData({ isFavorited: true });
      }).catch(() => wx.showToast({ title: '收藏失败', icon: 'none' }));
    }
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({
      current: url,
      urls: this.data.product.images,
    });
  },

  /**
   * 预览评价图片
   */
  previewCommentImage(e) {
    const { current, urls } = e.currentTarget.dataset;
    wx.previewImage({
      current,
      urls: Array.isArray(urls) ? urls : [],
    });
  },

  /**
   * 联系客服：使用当前商品所属商家的联系方式（归商家管），可拨打；商家可在工作台消息里回复评价/留言
   */
  contactService() {
    const product = this.data.product;
    const phone = (product && product.merchantContact) ? String(product.merchantContact).trim() : '';
    if (!phone) {
      wx.showModal({
        title: '联系店铺',
        content: '该店铺暂未留联系方式。您可在下方「用户评价」中发表评价，商家会在工作台回复。',
        showCancel: false,
      });
      return;
    }
    wx.showModal({
      title: '联系店铺',
      content: `店铺联系方式：${phone}`,
      confirmText: '拨打',
      cancelText: '关闭',
      success: (r) => {
        if (r.confirm) {
          wx.makePhoneCall({ phoneNumber: phone });
        }
      },
    });
  },

  /**
   * 店铺地址：获取当前位置，计算距离，弹窗显示并可打开地图导航（方案 A：后端存店铺经纬度）
   */
  openAddressNavigation() {
    const product = this.data.product;
    const address = (product && product.merchantAddress) ? String(product.merchantAddress).trim() : '';
    if (!address) {
      wx.showToast({ title: '暂无店铺地址', icon: 'none' });
      return;
    }
    const shopLat = product.merchantLatitude != null ? Number(product.merchantLatitude) : null;
    const shopLng = product.merchantLongitude != null ? Number(product.merchantLongitude) : null;

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const userLat = res.latitude;
        const userLng = res.longitude;
        let content = `店铺地址：${address}`;
        let canNavigate = false;
        if (shopLat != null && shopLng != null) {
          const km = this._haversineKm(userLat, userLng, shopLat, shopLng);
          const distanceText = km < 0.1 ? `约 ${Math.round(km * 1000)} 米` : `约 ${km.toFixed(1)} km`;
          content += `\n距离您${distanceText}`;
          canNavigate = true;
        } else {
          content += '\n店铺暂未设置坐标，无法显示距离与导航';
        }
        wx.showModal({
          title: '店铺地址',
          content,
          confirmText: canNavigate ? '去导航' : '确定',
          cancelText: '关闭',
          success: (r) => {
            if (r.confirm && canNavigate) {
              wx.openLocation({
                latitude: shopLat,
                longitude: shopLng,
                name: product.merchantName || '店铺',
                address,
              });
            }
          },
        });
      },
      fail: () => {
        wx.showModal({
          title: '店铺地址',
          content: `店铺地址：${address}\n需要授权位置后才能显示距离与导航。`,
          showCancel: false,
        });
      },
    });
  },

  /** 两点经纬度求距离（公里），Haversine 公式 */
  _haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * 跳转到该商品所属店铺（商城页筛选该商家）
   */
  navigateToStore() {
    const product = this.data.product;
    if (!product || !product.merchant || !product.merchant.id) {
      wx.showToast({ title: '暂无店铺信息', icon: 'none' });
      return;
    }
    const merchantId = product.merchant.id;
    const encodedName = encodeURIComponent(product.merchantName || '');
    const encodedAddress = encodeURIComponent(product.merchantAddress || '');
    wx.navigateTo({
      url: `/pages/mall/merchant-detail?merchant_id=${merchantId}&merchant_name=${encodedName}&merchant_address=${encodedAddress}`,
    });
  },

  /**
   * 跳转到购物车
   */
  navigateToCart() {
    wx.navigateTo({
      url: '/pages/cart/index',
    });
  },

  /**
   * 加入购物车
   */
  async addToCart() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '加入购物车需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }

    // 美食商品不需要库存检查
    if (this.data.product.product_type !== 'food' && this.data.product.stock <= 0) {
      wx.showToast({
        title: '商品已售罄',
        icon: 'none',
      });
      return;
    }

    try {
      await app.request({
        url: '/api/shopping-cart',
        method: 'POST',
        needAuth: true,
        data: {
          product_id: this.data.productId,
          quantity: this.data.quantity,
        },
      });
      // app.request 成功时 resolve 的是 res.data.data，不是 { code, message }，能执行到这里即表示加入成功
      wx.showToast({
        title: '已加入购物车',
        icon: 'success',
      });
    } catch (error) {
      console.error('加入购物车失败:', error);
      wx.showToast({
        title: error.message || '加入失败',
        icon: 'none',
      });
    }
  },

  /**
   * 立即购买
   */
  /**
   * 拉取美食可用券。注意 van-stepper 在弹层打开时可能重复触发 change(相同数量)，
   * 若此处无条件清空已选券，会导致下单未带 user_coupon_id。
   * @param {{ resetSelection?: boolean }} opts resetSelection 默认 true；仅数量未变时不要清空
   */
  async loadFoodCoupons(opts = {}) {
    const resetSelection = opts.resetSelection !== false;
    const { product, quantity } = this.data;
    if (!product || product.product_type !== 'food') return;
    const totalAmount = Number(product.price) * quantity || 0;
    if (resetSelection) {
      this.setData({
        selectedFoodCouponId: null,
        foodDiscountAmount: 0,
        foodPayTotal: totalAmount.toFixed(2),
      });
    }
    if (!app.globalData.token) return;
    try {
      const list = await fetchAvailableCoupons(app, {
        totalAmount,
        merchantId: product.merchant_id,
      });
      const arr = Array.isArray(list) ? list : [];
      const patch = { foodAvailableCoupons: arr };
      if (!resetSelection && this.data.selectedFoodCouponId != null) {
        const sid = this.data.selectedFoodCouponId;
        const still = arr.find(c => String(c.id) === String(sid));
        if (!still) {
          patch.selectedFoodCouponId = null;
          patch.foodDiscountAmount = 0;
          patch.foodPayTotal = totalAmount.toFixed(2);
        } else {
          const { discountAmount, finalAmount } = computeDiscount(totalAmount, still);
          patch.foodDiscountAmount = discountAmount;
          patch.foodPayTotal = finalAmount.toFixed(2);
        }
      }
      this.setData(patch);
    } catch (e) {
      this.setData({ foodAvailableCoupons: [] });
    }
  },

  onSelectFoodCoupon(e) {
    const id = e.currentTarget.dataset.id;
    const coupon = this.data.foodAvailableCoupons.find(c => String(c.id) === String(id));
    if (!coupon || !this.data.product) return;
    const total = Number(this.data.product.price) * this.data.quantity || 0;
    const { discountAmount, finalAmount } = computeDiscount(total, coupon);
    this.setData({
      selectedFoodCouponId: coupon.id,
      foodDiscountAmount: discountAmount,
      foodPayTotal: finalAmount.toFixed(2),
    });
  },

  onRemoveFoodCoupon() {
    const { product, quantity } = this.data;
    if (!product) return;
    const total = Number(product.price) * quantity || 0;
    this.setData({
      selectedFoodCouponId: null,
      foodDiscountAmount: 0,
      foodPayTotal: total.toFixed(2),
    });
  },

  handleBuy() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '购买商品需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }

    // 美食商品不需要库存检查
    if (this.data.product.product_type !== 'food' && this.data.product.stock <= 0) {
      wx.showToast({
        title: '商品已售罄',
        icon: 'none',
      });
      return;
    }

    this.setData({ showQuantityPopup: true });
    if (this.data.product.product_type === 'food') {
      this.loadFoodCoupons();
    }
  },

  /**
   * 关闭数量选择弹窗
   */
  onCloseQuantityPopup() {
    this.setData({ showQuantityPopup: false });
  },

  /**
   * 数量改变
   */
  onQuantityChange(e) {
    const next = Number(e.detail);
    const prev = Number(this.data.quantity);
    if (next === prev) {
      return;
    }
    this.setData({ quantity: next });
    if (this.data.product && this.data.product.product_type === 'food' && this.data.showQuantityPopup) {
      this.loadFoodCoupons({ resetSelection: true });
    }
  },

  /**
   * 确认购买
   * 特产需选收货地址：跳转订单确认页；餐饮可直接下单
   */
  confirmBuy() {
    const { product, quantity } = this.data;
    const foodUserCouponId = product.product_type === 'food' ? this.data.selectedFoodCouponId : null;

    // 美食商品不需要库存检查
    if (product.product_type !== 'food' && quantity > product.stock) {
      wx.showToast({
        title: '库存不足',
        icon: 'none',
      });
      return;
    }

    this.setData({ showQuantityPopup: false });

    const isSouvenir = (product.product_type || 'souvenir') === 'souvenir';
    const totalAmount = (Number(product.price) * quantity).toFixed(2);

    if (isSouvenir) {
      // 特产需选收货方式/地址，走订单确认页（与购物车结算同一流程）
      const fakeCartItem = {
        id: 0,
        quantity,
        product: {
          ...product,
          cover_image: product.cover_image ? app.fullImageUrl(product.cover_image) : '',
          images: (product.images || []).map(u => app.fullImageUrl(u)),
        },
      };
      app.globalData.checkoutItems = [ fakeCartItem ];
      app.globalData.totalAmount = totalAmount;
      wx.navigateTo({ url: '/pages/order/confirm' });
      return;
    }

    // 餐饮：直接创建订单（无需地址）
    this.submitFoodOrder(product.id, quantity, foodUserCouponId);
  },

  async submitFoodOrder(productId, quantity, userCouponId) {
    try {
      const order = await app.request({
        url: '/api/orders',
        method: 'POST',
        needAuth: true,
        data: {
          order_type: 'food',
          product_id: productId,
          quantity,
          user_coupon_id: userCouponId != null && userCouponId !== '' ? userCouponId : undefined,
        },
      });
      
      // 保存订单ID并显示支付密码弹窗
      this.setData({
        currentOrderId: order.id,
        showPayPopup: true
      });
    } catch (error) {
      console.error('下单失败:', error);
      wx.showToast({ title: (error && error.message) || '订单创建失败', icon: 'none' });
    }
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: this.data.product?.name || '精选特产',
      path: `/pages/product/detail?id=${this.data.productId}`,
      imageUrl: this.data.product?.images?.[0] || '',
    };
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
