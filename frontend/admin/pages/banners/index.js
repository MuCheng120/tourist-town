const app = getApp();

const LINK_TYPE_LABELS = {
  none: '无跳转',
  scenic: '景点',
  product: '商品',
  post: '帖子',
  url: '网页',
};

function decorateItem(item) {
  const linkType = item.linkType || item.link_type || 'none';
  return {
    ...item,
    linkType,
    sortOrder: item.sortOrder != null ? item.sortOrder : (item.sort_order != null ? item.sort_order : 0),
    status: item.status === 0 ? 0 : 1,
    linkTypeLabel: LINK_TYPE_LABELS[linkType] || linkType,
    imageDisplay: app.fullImageUrl(item.image) || '',
  };
}

Page({
  data: {
    list: [],
    page: 1,
    limit: 50,
    loading: false,
    hasMore: true,
    _skipNextShowRefresh: true,
  },

  onLoad() {
    this.reload();
  },

  onShow() {
    if (this.data._skipNextShowRefresh) {
      this.setData({ _skipNextShowRefresh: false });
      return;
    }
    this.reload();
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 }, () => this.loadList());
  },

  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh());
  },

  goAdd() {
    wx.navigateTo({ url: '/admin/pages/banners/edit' });
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/admin/pages/banners/edit?id=${id}` });
  },

  async reload() {
    await new Promise(resolve => {
      this.setData({ page: 1, list: [], hasMore: true }, resolve);
    });
    return this.loadList();
  },

  async loadList() {
    if (this.data.loading) return;
    if (this.data.page > 1 && !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/banners',
        method: 'GET',
        needAuth: true,
        data: {
          page: this.data.page,
          limit: this.data.limit,
        },
      });
      const rawList = Array.isArray(res.list) ? res.list : [];
      const list = rawList.map(decorateItem);
      this.setData({
        list: this.data.page === 1 ? list : [ ...this.data.list, ...list ],
        hasMore: list.length >= this.data.limit,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async onStatusChange(e) {
    const id = e.currentTarget.dataset.id;
    const wantOn = !!e.detail;
    try {
      await app.request({
        url: `/api/banners/${id}`,
        method: 'PUT',
        needAuth: true,
        data: { status: wantOn ? 1 : 0 },
      });
      wx.showToast({ title: wantOn ? '已展示' : '已隐藏', icon: 'success' });
      this.reload();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      this.reload();
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '确认删除',
      content: '删除后首页将不再展示该轮播',
      success: async res => {
        if (!res.confirm) return;
        try {
          await app.request({
            url: `/api/banners/${id}`,
            method: 'DELETE',
            needAuth: true,
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.reload();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      },
    });
  },
});
