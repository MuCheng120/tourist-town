// 管理员 - 商户管理：查看所有商户信息、店铺状态、经营情况，警告/暂停营业/注销
const app = getApp();

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    status: '',
    statusIndex: 0,
    statusOptions: [
      { label: '全部', value: '' },
      { label: '正常', value: 'active' },
      { label: '已封禁', value: 'banned' },
      { label: '已注销', value: 'cancelled' },
    ],
    loading: false,
    hasMore: true,
    // 操作弹窗
    actionModal: { show: false, merchantId: null, merchantName: '', action: '' },
    violationReason: '',
  },

  onLoad() {
    this.loadList();
  },

  onStatusPickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const status = this.data.statusOptions[i].value;
    this.setData({ statusIndex: i, status, page: 1, list: [] }, () => this.loadList());
  },

  async loadList(refresh = false) {
    if (this.data.loading) return;
    if (refresh) this.setData({ page: 1, list: [] });
    const page = refresh ? 1 : this.data.page;

    this.setData({ loading: true });
    try {
      const { pageSize, status } = this.data;
      const res = await app.request({
        url: '/api/admin/merchants',
        method: 'GET',
        needAuth: true,
        data: { page, pageSize, status: status || undefined },
      });
      // app.request 已经返回 data 字段，这里直接使用 res
      const data = res || {};
      console.log('merchants loadList api data =>', data);
      const rawList = Array.isArray(data.list) ? data.list : [];
      const list = rawList.map(m => ({
        ...m,
        avatar: m.avatar ? app.fullImageUrl(m.avatar) : '',
        created_at: m.created_at ? String(m.created_at).slice(0, 19).replace('T', ' ') : '',
        shopStatusText: this.shopStatusText(m.shop_status),
        accountStatusText: { active: '正常', banned: '已封禁', inactive: '未激活', cancelled: '已注销' }[m.status] || m.status,
        orderCompletionRate: m.order_completion_rate != null ? Math.round((m.order_completion_rate || 0) * 100) : '-',
        // 联系方式只显示一个：优先手机号，否则联系人或空
        displayContact: (m.phone || m.contact || '').trim() || null,
      }));
      const nextList = refresh ? list : [...this.data.list, ...list];
      this.setData({
        list: nextList,
        total: data.total || 0,
        hasMore: list.length >= pageSize,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  shopStatusText(s) {
    const map = { normal: '正常', suspended: '暂停营业', limited: '限流', revoked: '已注销' };
    return map[s] || s || '正常';
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 }, () => this.loadList());
  },

  onPullDownRefresh() {
    this.setData({ page: 1 }, () => this.loadList(true).then(() => wx.stopPullDownRefresh()));
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/admin/pages/merchants/detail?id=${id}` });
  },

  // 警告
  showWarn(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该商户';
    this.setData({
      actionModal: { show: true, merchantId: id, merchantName: name, action: 'warning' },
      violationReason: '',
    });
  },

  // 暂停营业
  showSuspend(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该商户';
    this.setData({
      actionModal: { show: true, merchantId: id, merchantName: name, action: 'suspend' },
      violationReason: '',
    });
  },

  // 注销账号
  showRevoke(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该商户';
    wx.showModal({
      title: '确认注销',
      content: `确定要注销商户「${name}」的账号吗？注销后该账号将无法登录。`,
      confirmText: '确认注销',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) this.doRevoke(id);
      },
    });
  },

  onReasonInput(e) {
    this.setData({ violationReason: e.detail || '' });
  },

  // 遮罩点击：仅点击空白处时关闭弹窗，避免影响输入框
  onActionMaskTap(e) {
    if (e.target === e.currentTarget) {
      this.closeActionModal();
    }
  },

  // 防止滑动穿透
  preventMove() {},

  closeActionModal() {
    this.setData({
      actionModal: { show: false, merchantId: null, merchantName: '', action: '' },
      violationReason: '',
    });
  },

  async confirmAction() {
    const { actionModal, violationReason } = this.data;
    if (!actionModal.merchantId) return;
    if ((actionModal.action === 'warning' || actionModal.action === 'suspend') && !violationReason.trim()) {
      wx.showToast({ title: '请填写原因', icon: 'none' });
      return;
    }

    if (actionModal.action === 'warning' || actionModal.action === 'suspend') {
      try {
        await app.request({
          url: '/api/merchant-credit/violation',
          method: 'POST',
          needAuth: true,
          data: {
            merchant_id: actionModal.merchantId,
            violation_type: actionModal.action,
            reason: violationReason.trim(),
          },
        });
        wx.showToast({ title: actionModal.action === 'warning' ? '已记录警告' : '已暂停营业', icon: 'success' });
        this.closeActionModal();
        this.loadList(true);
      } catch (e) {
        wx.showToast({ title: e.message || '操作失败', icon: 'none' });
      }
      return;
    }
    this.closeActionModal();
  },

  async doRevoke(merchantId) {
    try {
      await app.request({
        url: `/api/admin/users/${merchantId}/status`,
        method: 'PATCH',
        needAuth: true,
        data: { status: 'cancelled' },
      });
      wx.showToast({ title: '已注销', icon: 'success' });
      this.loadList(true);
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },
});
