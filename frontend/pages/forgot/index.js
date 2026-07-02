// 找回密码：使用固定默认验证码重置密码
const app = getApp();

const DEFAULT_CODE = '123456';

Page({
  data: {
    phone: '',
    code: DEFAULT_CODE,  // 默认验证码，无需发送
    newPassword: '',
    loading: false,
    devCode: DEFAULT_CODE, // 页面提示用
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail || e.detail.value });
  },
  onCodeInput(e) {
    this.setData({ code: e.detail || e.detail.value });
  },
  onPasswordInput(e) {
    this.setData({ newPassword: e.detail || e.detail.value });
  },

  async resetPassword() {
    const { phone, code, newPassword } = this.data;
    const p = (phone || '').trim();
    const c = (code || '').trim();
    const pw = (newPassword || '').trim();
    if (!p || !c || !pw) {
      wx.showToast({ title: '请填写完整', icon: 'none' });
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"|,.<>/?])[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"|,.<>/?]{8,20}$/.test(pw)) {
      wx.showToast({ title: '密码须为 8-20 位，且同时包含字母、数字和特殊符号', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      await app.request({
        url: '/api/user/reset-password',
        method: 'POST',
        data: { phone: p, code: c, new_password: pw },
      });
      wx.showToast({ title: '密码已重置', icon: 'success' });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/index' });
      }, 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '重置失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  backToLogin() {
    wx.navigateBack();
  },
});
