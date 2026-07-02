// admin/pages/posts/index.js
const app = getApp();
const { formatTime } = require('../../../utils/date');

Page({
  data: {
    tab: 'published', // published | pending | rejected | draft
    keyword: '',
    list: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
  },

  onLoad() {
    this.reload();
  },

  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadMore();
  },

  onTabChange(e) {
    const tab = e.detail.name;
    this.setData({ tab });
    this.reload();
  },

  onSearchChange(e) {
    this.setData({ keyword: (e.detail || '').trim() });
  },

  onSearch() {
    this.reload();
  },

  onClearSearch() {
    this.setData({ keyword: '' });
    this.reload();
  },

  async reload() {
    this.setData({ list: [], page: 1, hasMore: true });
    return this.loadMore(true);
  },

  buildQuery() {
    const { tab, keyword, page, pageSize } = this.data;
    const q = { page, pageSize };

    if (keyword) q.keyword = keyword;

    if (tab === 'published') {
      q.status = 1;
      q.audit_status = 1;
    } else if (tab === 'pending') {
      q.status = 0;
      q.audit_status = 0;
    } else if (tab === 'rejected') {
      q.status = 0;
      q.audit_status = 2;
    } else if (tab === 'draft') {
      q.status = 0;
      q.audit_status = 3;
    }

    return q;
  },

  async loadMore(isReload = false) {
    if (this.data.loading) return;
    if (!isReload && !this.data.hasMore) return;

    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/posts',
        method: 'GET',
        needAuth: true,
        data: this.buildQuery(),
      });

      const raw = res.list || [];
      const normalized = raw.map(item => ({
        ...item,
        created_at: formatTime(item.created_at),
        images: app.fullImageUrls(item.images || []),
        user: item.user ? { ...item.user, avatar: app.fullImageUrl(item.user.avatar) } : item.user,
      }));

      const nextList = isReload ? normalized : [ ...this.data.list, ...normalized ];
      const hasMore = (res.total || 0) > (this.data.page * this.data.pageSize);
      this.setData({
        list: nextList,
        hasMore,
        page: this.data.page + 1,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  viewPostDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/community/detail?id=${id}&readonly=1` });
  },

  deletePost(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要下架/删除该攻略吗？（软删除，前台将不可见）',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: '处理中...' });
          await app.request({
            url: `/api/posts/${id}`,
            method: 'DELETE',
            needAuth: true,
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.reload();
        } catch (err) {
          wx.showToast({ title: err.message || '操作失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },
});

