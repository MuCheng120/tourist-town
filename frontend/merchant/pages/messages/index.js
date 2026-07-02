// merchant/pages/messages/index.js
const app = getApp();
const { formatTime } = require('../../../utils/date');

Page({
  data: {
    threads: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    replyContentMap: {},
  },

  onLoad() {
    this.loadComments(true);
  },

  onPullDownRefresh() {
    this.loadComments(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadComments(false);
    }
  },

  async loadComments(reset = false) {
    if (this.data.loading) return;
    const nextPage = reset ? 1 : this.data.page;

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/merchant/comments',
        method: 'GET',
        needAuth: true,
        data: {
          page: nextPage,
          pageSize: this.data.pageSize,
        },
      });

      const merchantId = (app.globalData.userInfo && app.globalData.userInfo.id) || wx.getStorageSync('userInfo')?.id;
      const list = (res.list || []).map(item => {
        const product = item.product || {};
        const user = item.user || {};
        const replies = (item.replies || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const messages = [
          {
            id: item.id,
            fromMerchant: user.id === merchantId,
            userName: user.nickname || '游客',
            avatar: app.fullImageUrl(user.avatar),
            content: item.content,
            created_at: formatTime(item.created_at),
          },
          ...replies.map(r => ({
            id: r.id,
            fromMerchant: r.user && r.user.id === merchantId,
            userName: (r.user && r.user.nickname) || '游客',
            avatar: app.fullImageUrl(r.user && r.user.avatar),
            content: r.content,
            created_at: formatTime(r.created_at),
          })),
        ];

        return {
          id: item.id,
          productId: product.id,
          productName: product.name || '未知商品',
          cover: app.fullImageUrl(product.cover_image),
          score: item.score || 0,
          created_at: formatTime(item.created_at),
          messages,
        };
      });

      this.setData({
        threads: reset ? list : [...this.data.threads, ...list],
        page: nextPage + 1,
        hasMore: (res.list || []).length >= this.data.pageSize,
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onReplyChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail != null && e.detail.value !== undefined ? e.detail.value : (e.detail || '');
    this.setData({
      [`replyContentMap.${id}`]: value,
    });
  },

  async sendReply(e) {
    const id = e.currentTarget.dataset.id;
    const content = (this.data.replyContentMap[id] || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '发送中...' });
      await app.request({
        url: `/api/merchant/comments/${id}/reply`,
        method: 'POST',
        needAuth: true,
        data: { content },
      });
      wx.showToast({ title: '回复成功', icon: 'success' });
      this.setData({
        [`replyContentMap.${id}`]: '',
        page: 1,
      });
      this.loadComments(true);
    } catch (err) {
      wx.showToast({ title: err.message || '回复失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

});

