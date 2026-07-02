const app = getApp();
const { formatExpiryDate, formatTime } = require('../../../utils/date');

Page({
  data: {
    id: null,
    detail: null,
    loading: false,
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this.setData({ id });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: `/api/coupons/${this.data.id}`,
        method: 'GET',
      });
      const detail = res || {};
      detail.expiry_date_display = formatExpiryDate(detail.expiry_date);
      detail.created_time_display = formatTime(detail.createdAt || detail.created_at);
      const typeTextMap = {
        platform: '平台券',
        shop: '店铺券',
      };
      detail.type_text = typeTextMap[detail.type] || detail.type || '-';
      this.setData({ detail, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },
});