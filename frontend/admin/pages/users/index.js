// 管理员 - 用户管理（列表、封禁/解封）
const app = getApp();

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    role: '',
    status: '',
    loading: false,
    roleIndex: 0,
    statusIndex: 0,
    roleOptions: [
      { label: '全部', value: '' },
      { label: '游客', value: 'consumer' },
      { label: '商家', value: 'merchant' },
      { label: '管理员', value: 'admin' },
    ],
    statusOptions: [
      { label: '全部', value: '' },
      { label: '正常', value: 'active' },
      { label: '已封禁', value: 'banned' },
    ],
  },

  onLoad() {
    this.loadList();
  },

  onRolePickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const role = this.data.roleOptions[i].value;
    this.setData({ roleIndex: i, role, page: 1 }, () => this.loadList());
  },
  onStatusPickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const status = this.data.statusOptions[i].value;
    this.setData({ statusIndex: i, status, page: 1 }, () => this.loadList());
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const { page, pageSize, role, status } = this.data;
      const res = await app.request({
        url: '/api/admin/users',
        method: 'GET',
        needAuth: true,
        data: { page, pageSize, role, status },
      });
      const data = res.data || res;
      const list = (data.list || []).map(u => ({
        ...u,
        created_at: u.created_at ? String(u.created_at).slice(0, 19).replace('T', ' ') : '',
        roleText: { consumer: '游客', merchant: '商家', admin: '管理员' }[u.role] || u.role,
        statusText: { active: '正常', inactive: '未激活', banned: '已封禁' }[u.status] || u.status,
      }));
      this.setData({
        list,
        total: data.total || 0,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async setStatus(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const action = status === 'banned' ? '封禁' : '解封';
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认',
        content: `确定要${action}该用户吗？`,
        success: res => resolve(res.confirm),
      });
    });
    if (!confirm) return;
    try {
      await app.request({
        url: `/api/admin/users/${id}/status`,
        method: 'PATCH',
        needAuth: true,
        data: { status },
      });
      wx.showToast({ title: action + '成功', icon: 'success' });
      this.loadList();
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  // 设为管理员（仅支持设置/取消管理员权限）
  async setAdmin(e) {
    const id = e.currentTarget.dataset.id;
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '设为管理员',
        content: '确定将该用户设为管理员吗？',
        success: res => resolve(res.confirm),
      });
    });
    if (!confirm) return;
    try {
      await app.request({
        url: `/api/admin/users/${id}/role`,
        method: 'PATCH',
        needAuth: true,
        data: { role: 'admin' },
      });
      wx.showToast({ title: '已设为管理员', icon: 'success' });
      this.loadList();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  async revokeAdmin(e) {
    const id = e.currentTarget.dataset.id;
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '取消管理员',
        content: '确定取消该用户的管理员权限吗？',
        success: res => resolve(res.confirm),
      });
    });
    if (!confirm) return;
    try {
      await app.request({
        url: `/api/admin/users/${id}/role`,
        method: 'PATCH',
        needAuth: true,
        data: { role: 'consumer' },
      });
      wx.showToast({ title: '已取消管理员', icon: 'success' });
      this.loadList();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },
});
