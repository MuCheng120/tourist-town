const app = getApp();

Page({
  data: {
    list: [],
    loading: false,
    showForm: false,
    isEdit: false,
    editingId: null,
    form: {
      name: '',
      description: '',
      sort_order: '0',
    },
  },

  onLoad() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  noop() {},

  async loadList() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const list = await app.request({
        url: '/api/admin/tags',
        method: 'GET',
        needAuth: true,
      });
      this.setData({
        list: Array.isArray(list) ? list : [],
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' });
    }
  },

  openCreate() {
    this.setData({
      showForm: true,
      isEdit: false,
      editingId: null,
      form: { name: '', description: '', sort_order: '0' },
    });
  },

  openEdit(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.list.find(item => Number(item.id) === Number(id));
    if (!target) return;
    const sort = target.sort_order != null ? target.sort_order : target.sortOrder;
    this.setData({
      showForm: true,
      isEdit: true,
      editingId: target.id,
      form: {
        name: target.name || '',
        description: target.description || '',
        sort_order: String(sort != null ? sort : 0),
      },
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async submitForm() {
    const { name, description, sort_order: sortStr } = this.data.form;
    const trimmed = (name || '').trim();
    if (!trimmed) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' });
      return;
    }
    let sort_order = parseInt(String(sortStr).trim(), 10);
    if (Number.isNaN(sort_order) || sort_order < 0) sort_order = 0;

    const desc = (description || '').trim();
    const payload = {
      name: trimmed,
      description: desc || null,
      sort_order,
    };

    wx.showLoading({ title: '保存中', mask: true });
    try {
      if (this.data.isEdit && this.data.editingId != null) {
        await app.request({
          url: `/api/admin/tags/${this.data.editingId}`,
          method: 'PUT',
          needAuth: true,
          data: payload,
        });
      } else {
        await app.request({
          url: '/api/admin/tags',
          method: 'POST',
          needAuth: true,
          data: payload,
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showForm: false });
      await this.loadList();
    } catch (e) {
      wx.hideLoading();
    }
  },

  async remove(e) {
    const { id, name } = e.currentTarget.dataset;
    const label = (name && String(name).trim()) || '该标签';
    const modalRes = await wx.showModal({
      title: '确认删除',
      content: `将删除「${label}」，已从酒店、景点上解除关联，且不可恢复。确定继续吗？`,
    });
    if (!modalRes.confirm) return;
    wx.showLoading({ title: '删除中', mask: true });
    try {
      await app.request({
        url: `/api/admin/tags/${id}`,
        method: 'DELETE',
        needAuth: true,
      });
      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
      await this.loadList();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' });
    }
  },
});
