const app = getApp();

Page({
  data: {
    list: [],
    loading: false,
    showCreate: false,
    form: {
      username: '',
      password: '',
      nickname: '',
    },
  },

  onLoad() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/admin/admins',
        method: 'GET',
        needAuth: true,
      });
      this.setData({
        list: Array.isArray(res) ? res : (res.list || []),
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  openCreate() {
    this.setData({
      showCreate: true,
      form: { username: '', password: '', nickname: '' },
    });
  },

  closeCreate() {
    this.setData({ showCreate: false });
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async createAdmin() {
    const { username, password, nickname } = this.data.form;
    if (!username || !password) {
      wx.showToast({ title: '用户名和密码必填', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '创建中...' });
    try {
      await app.request({
        url: '/api/admin/admins',
        method: 'POST',
        needAuth: true,
        data: {
          username: username.trim(),
          password,
          nickname: nickname.trim(),
        },
      });
      wx.hideLoading();
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showCreate: false });
      this.loadList();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '创建失败', icon: 'none' });
    }
  },

  noop() {},
});