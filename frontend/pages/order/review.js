// pages/order/review.js - 订单评价页（方案A：按 post_type 区分表单，支持图片）
const app = getApp();

Page({
  data: {
    orderId: null,
    order: null,
    targetType: '', // hotel | scenic | product
    targetId: null,
    targetName: '',
    isFoodProduct: false, // 餐饮商品：味道/环境/服务三维
    score: 5,
    tasteScore: 5,
    hygieneScore: 5,
    environmentScore: 5,
    serviceScore: 5,
    facilityScore: 5,
    content: '',
    images: [], // 已选本地路径，提交前上传
    imageUrls: [], // 上传后的 URL，用于提交
    submitting: false,
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
      this.loadOrder();
    }
  },

  async loadOrder() {
    wx.showLoading({ title: '加载中...' });
    try {
      const order = await app.request({
        url: `/api/orders/${this.data.orderId}`,
        method: 'GET',
        needAuth: true,
      });
      let targetType = '';
      let targetId = null;
      let targetName = '';
      if (order.order_type === 'hotel' && order.room_type && order.room_type.hotel_id) {
        targetType = 'hotel';
        targetId = order.room_type.hotel_id;
        targetName = (order.room_type.hotel && order.room_type.hotel.name) ? order.room_type.hotel.name : '酒店';
      } else if (order.order_type === 'scenic' && order.spot_id) {
        targetType = 'scenic';
        targetId = order.spot_id;
        targetName = order.scenic_spot ? order.scenic_spot.name : '景点';
      } else if ((order.order_type === 'souvenir' || order.order_type === 'food') && order.product_id) {
        targetType = 'product';
        targetId = order.product_id;
        targetName = order.product ? order.product.name : '商品';
      }
      const isFoodProduct = targetType === 'product' && order.product && order.product.product_type === 'food';
      this.setData({
        order,
        targetType,
        targetId,
        targetName,
        isFoodProduct,
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onScoreChange(e) {
    this.setData({ score: e.detail });
  },
  onTasteScoreChange(e) {
    this.setData({ tasteScore: e.detail });
  },
  onHygieneScoreChange(e) {
    this.setData({ hygieneScore: e.detail });
  },
  onEnvironmentScoreChange(e) {
    this.setData({ environmentScore: e.detail });
  },
  onServiceScoreChange(e) {
    this.setData({ serviceScore: e.detail });
  },
  onFacilityScoreChange(e) {
    this.setData({ facilityScore: e.detail });
  },
  onContentInput(e) {
    this.setData({ content: (e.detail && e.detail.value != null) ? e.detail.value : e.detail });
  },

  onChooseImage() {
    const remain = 9 - this.data.images.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: remain,
      mediaType: [ 'image' ],
      sourceType: [ 'album', 'camera' ],
      success: res => {
        const newPaths = (res.tempFiles || []).map(f => f.tempFilePath).filter(Boolean);
        const images = [ ...this.data.images, ...newPaths ].slice(0, 9);
        this.setData({ images });
      },
    });
  },

  onDeleteImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = [ ...this.data.images ];
    images.splice(idx, 1);
    this.setData({ images });
  },

  async submitReview() {
    const { targetType, targetId, score, content, images, submitting } = this.data;
    if (!targetType || !targetId) {
      wx.showToast({ title: '暂不支持该订单类型评价', icon: 'none' });
      return;
    }
    if (submitting) return;
    this.setData({ submitting: true });
    try {
      let imageUrls = [];
      if (images && images.length > 0) {
        wx.showLoading({ title: '上传图片中...' });
        for (const path of images) {
          const url = await app.uploadImage(path, 'comment');
          imageUrls.push(url);
        }
        wx.hideLoading();
      }

      const baseData = { content: content || '满意', images: imageUrls };

      if (targetType === 'hotel') {
        await app.request({
          url: `/api/hotels/${targetId}/comments`,
          method: 'POST',
          needAuth: true,
          data: {
            ...baseData,
            hygiene_score: this.data.hygieneScore,
            environment_score: this.data.environmentScore,
            service_score: this.data.serviceScore,
            facility_score: this.data.facilityScore,
            order_id: this.data.orderId,
          },
        });
      } else if (targetType === 'scenic') {
        await app.request({
          url: `/api/scenic-spots/${targetId}/comments`,
          method: 'POST',
          needAuth: true,
          data: { ...baseData, score: this.data.score, order_id: this.data.orderId },
        });
      } else if (targetType === 'product') {
        const data = { ...baseData };
        if (this.data.isFoodProduct) {
          data.taste_score = this.data.tasteScore;
          data.environment_score = this.data.environmentScore;
          data.service_score = this.data.serviceScore;
        } else {
          data.score = this.data.score;
        }
        await app.request({
          url: `/api/products/${targetId}/comments`,
          method: 'POST',
          needAuth: true,
          data: {
            ...data,
            order_id: this.data.orderId,
          },
        });
      } else {
        wx.showToast({ title: '暂不支持该类型评价', icon: 'none' });
        this.setData({ submitting: false });
        return;
      }
      wx.showToast({ title: '评价成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
        // 通知订单列表刷新，确保待评价 tab 正确更新
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.route === 'pages/order/list') {
          prevPage.loadOrders && prevPage.loadOrders();
        }
      }, 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '评价失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
});
