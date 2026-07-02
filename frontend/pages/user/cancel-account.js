// 注销账号：二次确认后提交，成功后清除登录态并跳转登录页
const app = getApp();

Page({
  data: {
    password: '',
    loading: false,
  },

  onPasswordChange(e) {
    this.setData({ password: (e.detail || e).value || '' });
  },

  async submit() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认注销',
      content: '注销后账号无法恢复，确定要继续吗？',
      confirmText: '确认注销',
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ loading: true });
        try {
          await app.request({
            url: '/api/user/cancel-account',
            method: 'POST',
            needAuth: true,
            data: { password: this.data.password },
          });
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          app.globalData.token = null;
          app.globalData.userInfo = null;
          wx.showToast({ title: '账号已注销', icon: 'success' });
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/login/index' });
          }, 1500);
        } catch (e) {
          this.setData({ loading: false });
          wx.showToast({ title: e.message || '注销失败', icon: 'none' });
        }
      },
    });
  },
});
