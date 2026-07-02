// pages/notice/index.js
const app = getApp();
const { formatDate } = require('../../utils/date');

Page({
  data: {
    notices: [],
    showDetail: false,
    currentNotice: {},
  },

  onLoad() {
    this.loadNotices();
  },

  /**
   * 加载公告列表
   */
  async loadNotices() {
    wx.showLoading({ title: '加载中...' });

    try {
      const res = await app.request({
        url: '/api/announcements',
        method: 'GET',
      });

      // app.request 返回的是数据对象本身，这里约定为数组或 { list }
      const raw = Array.isArray(res) ? res : (res.list || res.data || []);
      const notices = raw.map(item => ({
        ...item,
        createdAt: formatDate(item.createdAt),
      }));
      this.setData({ notices });
    } catch (error) {
      console.error('加载公告失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 查看公告详情
   */
  viewNotice(e) {
    const { id } = e.currentTarget.dataset;
    const notice = this.data.notices.find(item => item.id === id);
    
    if (notice) {
      this.setData({
        currentNotice: notice,
        showDetail: true,
      });
    }
  },

  /**
   * 关闭详情弹窗
   */
  onCloseDetail() {
    this.setData({ showDetail: false });
  },

});
