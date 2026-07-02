const app = getApp();

Page({
  data: {
    cartList: [],
    isEditMode: false,
    isAllSelected: false,
    selectedCount: 0,
    totalPrice: '0.00',
  },

  onLoad() {
    this.loadCartList();
  },

  onShow() {
    this.loadCartList();
  },

  /**
   * 加载购物车列表（未登录不请求接口，避免 401 触发全局退出登录）
   */
  async loadCartList() {
    if (!app.globalData.token) {
      this.setData({ cartList: [] });
      return;
    }
    try {
      const res = await app.request({
        url: '/api/shopping-cart',
        method: 'GET',
        needAuth: true,
      });

      const list = Array.isArray(res) ? res : (res.list || res.data || []);
      const cartList = list.map(item => {
        const product = item.product || {};
        let images = product.images;
        if (typeof images === 'string') {
          try { images = JSON.parse(images); } catch (e) { images = []; }
        }
        const imagesArr = Array.isArray(images) ? images : [];
        const imagesFull = app.fullImageUrls(imagesArr);
        const firstImage = app.fullImageUrl(product.cover_image || imagesArr[0] || '');
        return {
          ...item,
          product: { ...product, images: imagesFull, firstImage, cover_image: app.fullImageUrl(product.cover_image) },
          selected: false,
        };
      });

      this.setData({
        cartList,
      });
    } catch (error) {
      console.error('加载购物车失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    }
  },

  /**
   * 切换编辑模式
   */
  toggleEditMode() {
    const { isEditMode } = this.data;
    this.setData({
      isEditMode: !isEditMode,
      isAllSelected: false,
      selectedCount: 0,
    });

    // 清除所有选中状态
    const cartList = this.data.cartList.map(item => ({
      ...item,
      selected: false,
    }));
    this.setData({ cartList });
  },

  /**
   * 选择/取消选择商品（Vant checkbox 的 change 事件 detail 为布尔值，不是 { checked }）
   */
  onSelectItem(e) {
    const id = e.currentTarget.dataset.id;
    const checked = e.detail === true || e.detail === 'true' || (e.detail && e.detail.checked === true);

    const cartList = this.data.cartList.map(item => {
      if (item.id === id) {
        return { ...item, selected: checked };
      }
      return item;
    });

    this.setData({ cartList });

    // 更新全选状态和统计信息
    this.updateSelectStatus();
  },

  /**
   * 全选/取消全选（Vant checkbox 的 change 事件 detail 为布尔值）
   */
  onSelectAll(e) {
    const checked = e.detail === true || e.detail === 'true' || (e.detail && e.detail.checked === true);
    const cartList = this.data.cartList.map(item => ({
      ...item,
      selected: checked,
    }));

    this.setData({ cartList });
    this.updateSelectStatus();
  },

  /**
   * 更新选择状态
   */
  updateSelectStatus() {
    const { cartList } = this.data;
    const selectedItems = cartList.filter(item => item.selected);
    const isAllSelected = cartList.length > 0 && selectedItems.length === cartList.length;
    const selectedCount = selectedItems.length;

    // 计算总价（后端 price 可能为字符串，需转为数字避免 NaN）
    let totalPrice = 0;
    selectedItems.forEach(item => {
      const price = Number(item.product?.price) || 0;
      const qty = Number(item.quantity) || 0;
      totalPrice += price * qty;
    });

    this.setData({
      isAllSelected,
      selectedCount,
      totalPrice: (Number.isFinite(totalPrice) ? totalPrice : 0).toFixed(2),
    });
  },

  /**
   * 修改商品数量（Vant stepper 的 change 事件 detail 为新数量数值，不是 { value }）
   */
  async onQuantityChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = (e.detail && typeof e.detail === 'object' && 'value' in e.detail)
      ? e.detail.value
      : Number(e.detail);
    if (!Number.isInteger(value) || value < 1) return;

    try {
      await app.request({
        url: `/api/shopping-cart/${id}`,
        method: 'PUT',
        data: { quantity: value },
        needAuth: true,
      });
      // app.request 成功时 resolve 的是 res.data.data，能执行到这里即表示修改成功
      const cartList = this.data.cartList.map(item => {
        if (item.id === id) {
          return { ...item, quantity: value };
        }
        return item;
      });
      this.setData({ cartList });
      this.updateSelectStatus();
    } catch (error) {
      console.error('修改数量失败:', error);
      wx.showToast({
        title: '修改失败',
        icon: 'none',
      });
      this.loadCartList();
    }
  },

  /**
   * 批量删除
   */
  batchDelete() {
    const { cartList } = this.data;
    const selectedItems = cartList.filter(item => item.selected);

    if (selectedItems.length === 0) {
      wx.showToast({
        title: '请选择要删除的商品',
        icon: 'none',
      });
      return;
    }

    wx.showModal({
      title: '提示',
      content: `确定删除${selectedItems.length}件商品吗？`,
      success: async (res) => {
        if (res.confirm) {
          const ids = selectedItems.map(item => item.id);

          try {
            await app.request({
              url: '/api/shopping-cart/batch-remove',
              method: 'POST',
              data: { ids },
              needAuth: true,
            });
            // app.request 成功时 resolve 的是 res.data.data，批量删除接口无 data 字段故为 undefined，请求成功即表示删除成功
            wx.showToast({
              title: '删除成功',
              icon: 'success',
            });
            this.loadCartList();
          } catch (error) {
            console.error('删除失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none',
            });
          }
        }
      },
    });
  },

  /**
   * 结算
   */
  checkout() {
    const { cartList } = this.data;
    const selectedItems = cartList.filter(item => item.selected);

    if (selectedItems.length === 0) {
      wx.showToast({
        title: '请选择要结算的商品',
        icon: 'none',
      });
      return;
    }

    // 将选中的商品信息存储到全局数据，跳转到订单确认页
    app.globalData.checkoutItems = selectedItems;
    app.globalData.totalAmount = this.data.totalPrice;

    wx.navigateTo({
      url: '/pages/order/confirm',
    });
  },

  /**
   * 跳转到商品详情
   */
  goToProduct(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product/detail?id=${id}`,
    });
  },

  /**
   * 跳转到商城
   */
  goToMall() {
    wx.switchTab({
      url: '/pages/mall/index',
    });
  },
});
