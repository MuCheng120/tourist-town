// admin/pages/verify/index.js - 管理员扫码核销（景点门票等）
const app = getApp();
const { formatTimeWithSeconds } = require('../../../utils/date');

Page({
  data: {
    loading: false,
    code: '',
    verified: null,
    error: '',
  },

  scanCode() {
    const that = this;
    wx.scanCode({
      success(res) {
        that.verifyOrder(res.result);
      },
      fail(err) {
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({ title: '扫码失败', icon: 'none' });
        }
      },
    });
  },

  onCodeChange(e) {
    this.setData({ code: e.detail != null ? e.detail : '' });
  },

  manualVerify() {
    if (!this.data.code) {
      wx.showToast({ title: '请输入核销码', icon: 'none' });
      return;
    }
    this.verifyOrder(this.data.code.trim());
  },

  async verifyOrder(code) {
    this.setData({ loading: true, verified: null, error: '' });

    try {
      const res = await app.request({
        url: '/api/admin/verify',
        method: 'POST',
        needAuth: true,
        data: { code },
      });

      if (res && res.orderId) {
        this.setData({
          verified: {
            productName: res.productName,
            orderNo: res.orderNo,
            orderType: res.orderType,
            verifiedAt: formatTimeWithSeconds(res.verifiedAt),
          },
          code: '',
        });
        wx.showToast({ title: '核销成功', icon: 'success' });
      }
    } catch (error) {
      this.setData({
        error: error.message || '核销失败',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  reset() {
    this.setData({ verified: null, error: '', code: '' });
  },

});
