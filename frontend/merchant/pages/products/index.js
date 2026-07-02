// 商家端 - 商品管理（列表）
const app = getApp();

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    hasMore: true,
  },

  onLoad() {
    this.loadList();
  },

  onShow() {
    if (this.needRefresh) {
      this.needRefresh = false;
      this.setData({ page: 1, list: [], hasMore: true });
      this.loadList();
    }
  },

  async loadList() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/merchant/products',
        method: 'GET',
        needAuth: true,
        data: { page: this.data.page, limit: this.data.pageSize },
      });
      const raw = res.list || [];
      const list = raw.map(p => {
        let firstImg = p.cover_image;
        if (!firstImg && p.images) {
          if (Array.isArray(p.images)) firstImg = p.images[0];
          else if (typeof p.images === 'string') {
            try { const arr = JSON.parse(p.images); firstImg = arr && arr[0]; } catch (_) {}
          }
        }
        return {
          ...p,
          typeText: p.product_type === 'food' ? '美食' : '特产',
          statusText: p.status === 1 ? '上架' : '下架',
          coverUrl: app.fullImageUrl(firstImg) || '',
        };
      });
      this.setData({
        list: this.data.page === 1 ? list : [...this.data.list, ...list],
        total: res.total || 0,
        hasMore: list.length >= this.data.pageSize,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 }, () => this.loadList());
  },

  goPublish() {
    wx.navigateTo({ url: '/merchant/pages/products/edit' });
    this.needRefresh = true;
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/merchant/pages/products/edit?id=${id}` });
    this.needRefresh = true;
  },

  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const next = status === 1 ? 0 : 1;
    try {
      await app.request({
        url: `/api/merchant/products/${id}`,
        method: 'PUT',
        needAuth: true,
        data: { status: next },
      });
      wx.showToast({ title: next === 1 ? '已上架' : '已下架', icon: 'success' });
      this.setData({ page: 1, list: [], hasMore: true });
      this.loadList();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  deleteProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定删除该商品吗？',
      success: async res => {
        if (!res.confirm) return;
        try {
          await app.request({
            url: `/api/merchant/products/${id}`,
            method: 'DELETE',
            needAuth: true,
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.setData({ page: 1, list: [], hasMore: true });
          this.loadList();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      },
    });
  },
});
