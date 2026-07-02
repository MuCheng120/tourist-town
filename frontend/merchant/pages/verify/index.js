// merchant/pages/verify/index.js
const app = getApp();
const { formatTimeWithSeconds } = require('../../../utils/date');

Page({
  data: {
    loading: false,
    code: '',
    verified: null,
    error: '',
  },

  /**
   * 扫描核销码
   */
  scanCode() {
    const that = this;

    wx.scanCode({
      success(res) {
        console.log('扫码结果:', res.result);
        that.verifyOrder(res.result);
      },
      fail(err) {
        console.error('扫码失败:', err);
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({
            title: '扫码失败',
            icon: 'none',
          });
        }
      },
    });
  },

  /**
   * 手动输入核销码
   */
  onCodeChange(e) {
    this.setData({
      code: e.detail,
    });
  },

  /**
   * 手动确认核销
   */
  manualVerify() {
    if (!this.data.code) {
      wx.showToast({
        title: '请输入核销码',
        icon: 'none',
      });
      return;
    }

    this.verifyOrder(this.data.code);
  },

  /**
   * 核销订单
   */
  async verifyOrder(code) {
    this.setData({ 
      loading: true, 
      verified: null, 
      error: '' 
    });

    try {
      const res = await app.request({
        url: '/api/merchant/verify',
        method: 'POST',
        needAuth: true,
        data: { code },
      });

      // app.request 返回的数据对象本身，约定为 { productName, verifiedAt, ... }
      if (res) {
        this.setData({
          verified: {
            productName: res.productName,
            verifiedAt: formatTimeWithSeconds(res.verifiedAt),
          },
          code: '',
        });

        wx.showToast({
          title: '核销成功',
          icon: 'success',
        });
      }
    } catch (error) {
      console.error('核销失败:', error);
      this.setData({
        error: error.message || '核销失败',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 重置状态
   */
  reset() {
    this.setData({
      verified: null,
      error: '',
      code: '',
    });
  },

});
