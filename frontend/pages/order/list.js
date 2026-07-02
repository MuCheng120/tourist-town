// pages/order/list.js
const app = getApp();

Page({
  data: {
    activeTab: '',
    activeType: '',
    typeOptions: [
      { label: '全部', value: '' },
      { label: '美食', value: 'food' },
      { label: '特产', value: 'souvenir' },
      { label: '景点', value: 'scenic' },
      { label: '酒店', value: 'hotel' },
    ],
    orders: [],
    loading: false,
    payingOrderId: '', // 正在支付的订单ID，用于防重复提交
    showPayPopup: false,
    payAmount: '0.00',
    currentPayOrderId: '',
  },

  onLoad(options) {
    // 如果从其他页面跳转过来，可能带有status参数（待付款前端可能传 pending，与 tab 统一为 unpaid）
    if (options.status) {
      const tab = options.status === 'pending' ? 'unpaid' : options.status;
      this.setData({ activeTab: tab });
    }
    if (options.type) {
      this.setData({ activeType: options.type });
    }
    this.loadOrders();
  },

  onShow() {
    // 页面显示时刷新订单列表
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 阻止按钮区点击冒泡到订单卡片，避免误跳详情 */
  stopPropagation() {},

  /**
   * 切换Tab
   */
  onTabChange(e) {
    const { name } = e.detail;
    this.setData({ activeTab: name });
    this.loadOrders();
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type || '';
    if (type === this.data.activeType) return;
    this.setData({ activeType: type });
    this.loadOrders();
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/orders',
        data: {
          status: this.data.activeTab || undefined,
          order_type: this.data.activeType || undefined,
        },
        needAuth: true,  // 需要认证
      });

      // app.request() 已经解析了响应，res 就是 data 对象 { total, page, pageSize, list }
      // 后端返回的订单是 order.product（单个）+ order.quantity，需转成列表用的 products 数组
      const rawList = Array.isArray(res.list) ? res.list : [];
      const orders = rawList.map(order => {
        const qty = Number(order.quantity) || 1;
        const payAmount = Number(order.final_amount != null ? order.final_amount : order.total_amount) || 0;
        const unitPaidPrice = (qty > 0 ? (payAmount / qty) : payAmount).toFixed(2);
        const rawProducts = Array.isArray(order.products) ? order.products : [];
        const hasBackendProducts = rawProducts.length > 0;
        let products;
        if (hasBackendProducts) {
          products = rawProducts.map(p => {
            const prod = p.product != null ? p.product : (p && typeof p === 'object' ? p : {});
            let imagesArr = prod.images;
            if (typeof imagesArr === 'string') {
              try { imagesArr = JSON.parse(imagesArr); } catch (e) { imagesArr = []; }
            }
            imagesArr = Array.isArray(imagesArr) ? imagesArr : [];
            let fullCover = app.fullImageUrl(prod.cover_image) || (imagesArr[0] ? app.fullImageUrl(imagesArr[0]) : '');
            if (!fullCover && p.room_type && p.room_type.hotel) {
              fullCover = app.fullImageUrl(p.room_type.hotel.cover_image) || '';
            }
            const fullImages = app.fullImageUrls(imagesArr);
            return {
              ...p,
              product: {
                ...prod,
                name: prod.name || (p.room_type && p.room_type.name) || '商品',
                cover_image: fullCover,
                images: fullImages,
              },
              // 列表价格统一展示「实付均摊单价」，兼容老数据回退 total_amount
              price: unitPaidPrice,
            };
          });
        } else if (order.product) {
          const p = order.product;
          products = [{
            product: {
              ...p,
              cover_image: app.fullImageUrl(p.cover_image),
              images: app.fullImageUrls(p.images || []),
            },
            quantity: qty,
            price: unitPaidPrice,
          }];
        } else {
          products = [];
        }
        return {
          ...order,
          products,
          statusText: this.getOrderStatusText(order, this.data.activeTab),
          orderTypeText: this.getOrderTypeText(order),
          orderTypeClass: this.getOrderTypeClass(order),
        };
      });
      this.setData({ orders });
    } catch (error) {
      console.error('加载订单失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 列表状态文案：已支付且已发核销码的为「待核销」，避免与实物「待发货」混淆
   */
  getOrderStatusText(order, activeTab) {
    const s = order && order.status;
    if (!s) return '未知';
    if (activeTab === 'to_review') return '待评价';
    if (s === 'paid' && order.order_type === 'hotel') {
      return '已支付';
    }
    if (s === 'paid' && order.verification_code) {
      if (order.address_info) {
        try {
          const addr = typeof order.address_info === 'string' ? JSON.parse(order.address_info) : order.address_info;
          if (addr && (addr.detailInfo || addr.detail_info || addr.receiverName)) {
            return '待发货';
          }
        } catch (e) {
          /* ignore */
        }
      }
      return '待核销';
    }
    const statusMap = {
      unpaid: '待付款',
      pending: '待付款',
      paid: '待发货',
      shipped: '待收货',
      verified: '已核销',
      completed: '已完成',
      cancelled: '已取消',
      refunding: '退款中',
      refunded: '已退款',
    };
    return statusMap[s] || '未知';
  },

  getOrderTypeText(order) {
    const t = order && order.order_type;
    const typeMap = {
      food: '美食',
      souvenir: '特产',
      scenic: '景点',
      hotel: '酒店',
    };
    return typeMap[t] || '其他';
  },

  getOrderTypeClass(order) {
    const t = order && order.order_type;
    const classMap = {
      food: 'type-food',
      souvenir: 'type-souvenir',
      scenic: 'type-scenic',
      hotel: 'type-hotel',
    };
    return classMap[t] || 'type-other';
  },

  /**
   * 已完成等：查看订单详情
   */
  goOrderDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/order/detail?id=${id}`,
    });
  },

  /**
   * 去评价（跳转评价页，根据订单类型进入酒店/商品/景点评价）
   */
  goReview(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/review?orderId=${id}`,
    });
  },

  /**
   * 跳转到订单详情
   */
  navigateToDetail(e) {
    // 阻止冒泡，避免与按钮点击冲突
    if (e.target.dataset.action) return;
    
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail?id=${id}`,
    });
  },

  /**
   * 取消订单
   */
  async cancelOrder(e) {
    const { id } = e.currentTarget.dataset;

    try {
      const res = await wx.showModal({
        title: '提示',
        content: '确定要取消这个订单吗？',
      });

      if (res.confirm) {
        await app.request({
          url: `/api/orders/${id}/cancel`,
          method: 'POST',
          needAuth: true,
        });
        wx.showToast({ title: '订单已取消', icon: 'success' });
        this.loadOrders();
      }
    } catch (error) {
      console.error('取消订单失败:', error);
      wx.showToast({
        title: (error && error.message) || '取消失败',
        icon: 'none',
      });
    }
  },

  /**
   * 删除订单记录（已取消/已完成/已退款）
   */
  async deleteOrder(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const { confirm } = await wx.showModal({
        title: '提示',
        content: '确定删除该订单记录吗？删除后不可恢复。',
      });
      if (!confirm) return;
      await app.request({
        url: `/api/orders/${id}`,
        method: 'DELETE',
        needAuth: true,
      });
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadOrders();
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '删除失败',
        icon: 'none',
      });
    }
  },

  /**
   * 支付订单（防重复提交）
   */
  payOrder(e) {
    const { id } = e.currentTarget.dataset;
    if (this.data.payingOrderId) return;
    
    // 查找订单信息，获取支付金额
    const order = this.data.orders.find(o => o.id === id);
    if (!order) return;
    
    const payAmount = order.final_amount || order.total_amount || '0';
    
    this.setData({
      currentPayOrderId: String(id),
      payAmount: String(payAmount),
      showPayPopup: true
    });
  },

  /**
   * 确认收货
   */
  async confirmReceipt(e) {
    const { id } = e.currentTarget.dataset;

    try {
      const res = await wx.showModal({
        title: '提示',
        content: '确定已收到商品吗？',
      });

      if (res.confirm) {
        await app.request({
          url: `/api/orders/${id}/complete`,
          method: 'POST',
          needAuth: true,
        });
        wx.showToast({ title: '确认成功', icon: 'success' });
        this.loadOrders();
      }
    } catch (error) {
      console.error('确认收货失败:', error);
      wx.showToast({
        title: (error && error.message) || '操作失败',
        icon: 'none',
      });
    }
  },

  /**
   * 查看物流
   */
  viewLogistics(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/detail?id=${id}&tab=logistics`,
    });
  },

  /**
   * 申请退款
   */
  async refundOrder(e) {
    const { id } = e.currentTarget.dataset;

    try {
      const res = await wx.showModal({
        title: '申请退款',
        content: '确定要申请退款吗？',
      });

      if (res.confirm) {
        await app.request({
          url: `/api/orders/${id}/refund`,
          method: 'POST',
          needAuth: true,
        });
        wx.showToast({ title: '退款申请已提交', icon: 'success' });
        this.loadOrders();
      }
    } catch (error) {
      console.error('申请退款失败:', error);
      wx.showToast({
        title: (error && error.message) || '申请失败',
        icon: 'none',
      });
    }
  },

  onPaySuccess() {
    // 支付成功后更新订单状态
    const { currentPayOrderId } = this.data;
    
    // 实际调用支付接口
    app.request({
      url: `/api/orders/${currentPayOrderId}/pay`,
      method: 'POST',
      needAuth: true,
    }).then(() => {
      wx.showToast({ title: '支付成功', icon: 'success' });
      setTimeout(() => {
        this.loadOrders();
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
