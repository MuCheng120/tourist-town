const app = getApp();

Page({
  data: {
    list: [],
    loading: false,
    statusIndex: 0,
    statusOptions: [
      { label: '全部', value: '' },
      { label: '已发布', value: 1 },
      { label: '已下线', value: 0 },
    ],
    page: 1,
    limit: 20,
    hasMore: true,
    showForm: false,
    isEdit: false,
    editingId: null,
    form: {
      title: '',
      content: '',
      status: 1,
    },
  },

  onLoad() {
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadList();
    }
  },

  onStatusChange(e) {
    const statusIndex = Number(e.detail.value) || 0;
    this.setData({ statusIndex, page: 1, hasMore: true, list: [] });
    this.loadList(true);
  },

  async loadList(refresh = false) {
    if (this.data.loading) return;
    const page = refresh ? 1 : this.data.page;
    const currentStatus = this.data.statusOptions[this.data.statusIndex].value;
    this.setData({ loading: true });
    try {
      const data = {
        page,
        limit: this.data.limit,
      };
      if (currentStatus !== '') data.status = currentStatus;
      const res = await app.request({
        url: '/api/announcements',
        method: 'GET',
        needAuth: false,
        data,
      });
      const payload = res || {};
      const incoming = payload.list || [];
      this.setData({
        list: page === 1 ? incoming : [ ...this.data.list, ...incoming ],
        hasMore: incoming.length >= this.data.limit,
        page,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  openCreate() {
    this.setData({
      showForm: true,
      isEdit: false,
      editingId: null,
      form: { title: '', content: '', status: 1 },
    });
  },

  openEdit(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.list.find(item => Number(item.id) === Number(id));
    if (!target) return;
    this.setData({
      showForm: true,
      isEdit: true,
      editingId: target.id,
      form: {
        title: target.title || '',
        content: target.content || '',
        status: Number(target.status) === 0 ? 0 : 1,
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

  onFormStatusChange(e) {
    const status = Number(e.detail.value) ? 1 : 0;
    this.setData({ 'form.status': status });
  },

  async submitForm() {
    const { title, content, status } = this.data.form;
    if (!title || !title.trim()) {
      wx.showToast({ title: '请输入公告标题', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中...' });
    try {
      if (this.data.isEdit) {
        await app.request({
          url: `/api/announcements/${this.data.editingId}`,
          method: 'PUT',
          needAuth: true,
          data: { title: title.trim(), content: content || '', status },
        });
      } else {
        await app.request({
          url: '/api/announcements',
          method: 'POST',
          needAuth: true,
          data: { title: title.trim(), content: content || '', status },
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ showForm: false, page: 1, list: [], hasMore: true });
      this.loadList(true);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  async toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const nextStatus = Number(status) === 1 ? 0 : 1;
    const actionText = nextStatus === 1 ? '发布' : '下线';
    const modalRes = await wx.showModal({
      title: '确认操作',
      content: `确定要${actionText}该公告吗？`,
    });
    if (!modalRes.confirm) return;
    try {
      await app.request({
        url: `/api/announcements/${id}`,
        method: 'PUT',
        needAuth: true,
        data: { status: nextStatus },
      });
      wx.showToast({ title: '操作成功', icon: 'success' });
      this.setData({ page: 1, list: [], hasMore: true });
      this.loadList(true);
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  async remove(e) {
    const { id } = e.currentTarget.dataset;
    const modalRes = await wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定继续吗？',
    });
    if (!modalRes.confirm) return;
    try {
      await app.request({
        url: `/api/announcements/${id}`,
        method: 'DELETE',
        needAuth: true,
      });
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.setData({ page: 1, list: [], hasMore: true });
      this.loadList(true);
    } catch (e) {
      wx.showToast({ title: e.message || '删除失败', icon: 'none' });
    }
  },

  noop() {},
});
