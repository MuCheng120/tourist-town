// 领券中心：查看并领取管理员发布的优惠券
const app = getApp();
const { formatExpiryDate } = require('../../utils/date');

Page({
  data: {
    activeTab: 'platform',
    list: [],
    receivedIds: [],
    loading: false,
    receivingId: null,
  },

  onLoad() {
    this.loadCenter();
  },

  onTabChange(e) {
    const tab = (e && e.currentTarget && e.currentTarget.dataset.tab) || 'platform';
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab, list: [] });
    this.loadCenter();
  },

  onShow() {
    // 从「我的优惠券」返回时刷新已领取状态
    this.loadReceivedIds();
  },

  onPullDownRefresh() {
    this.loadCenter().then(() => {
      this.loadReceivedIds();
    }).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 领券中心列表（无需登录）
  async loadCenter() {
    const type = this.data.activeTab || 'platform';
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/coupons/center',
        data: { page: 1, pageSize: 50, type },
      });
      const rawList = Array.isArray(res && res.list) ? res.list : [];
      const receivedIds = this.data.receivedIds || [];
      const list = rawList.filter(item => item && item.id != null).map(item => ({
        ...item,
        received: receivedIds.includes(item.id),
        expiry_date_display: formatExpiryDate(item.expiry_date),
      }));
      this.setData({ list, loading: false });
      this.loadReceivedIds();
    } catch (e) {
      this.setData({ list: [], loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  // 已领取的优惠券 ID（登录后用于显示「已领取」）
  async loadReceivedIds() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      this.setData({ receivedIds: [] });
      return;
    }
    try {
      const res = await app.request({
        url: '/api/coupons/received-ids',
        needAuth: true,
      });
      const receivedIds = Array.isArray(res && res.couponIds) ? res.couponIds : [];
      this.setData({ receivedIds });
      // 更新列表中每张券的 received 状态
      const currentList = this.data.list || [];
      const list = currentList.filter(item => item && item.id != null).map(item => ({
        ...item,
        received: receivedIds.includes(item.id),
        expiry_date_display: formatExpiryDate(item.expiry_date),
      }));
      this.setData({ list });
    } catch (e) {
      this.setData({ receivedIds: [] });
    }
  },

  // 领取
  async onReceive(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.list.find(c => c.id === id);
    if (item && item.received) return;

    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再领取优惠券',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }

    this.setData({ receivingId: id });
    try {
      await app.request({
        url: `/api/coupons/${id}/receive`,
        method: 'POST',
        needAuth: true,
      });
      wx.showToast({ title: '领取成功', icon: 'success' });
      const receivedIds = [ ...this.data.receivedIds, id ];
      const list = this.data.list.map(c => ({
        ...c,
        received: c.id === id ? true : c.received,
        received_count: c.id === id ? (c.received_count || 0) + 1 : c.received_count,
        expiry_date_display: formatExpiryDate(c.expiry_date),
      }));
      this.setData({ receivedIds, list, receivingId: null });
    } catch (err) {
      this.setData({ receivingId: null });
      wx.showToast({ title: err.message || '领取失败', icon: 'none' });
    }
  },

  // 去「我的优惠券」
  goMyCoupons() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后查看我的优惠券',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }
    wx.navigateTo({ url: '/pages/coupon/index' });
  },
});
