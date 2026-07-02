const app = getApp();
const { formatTime } = require('../../../utils/date');

Page({
  data: {
    id: null,
    detail: null,
    violations: [],
    loading: false,
    resolvingId: null,
    resolveRemark: '',
    statusTextMap: {
      normal: '正常',
      warning: '警告',
      limited: '限流',
      suspended: '暂停营业',
      revoked: '已注销',
    },
    violationTypeMap: {
      warning: '警告',
      limit: '限流',
      suspend: '暂停营业',
      revoke: '注销',
    },
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this.setData({ id });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const [detail, violations] = await Promise.all([
        app.request({
          url: `/api/merchant-credit/${this.data.id}`,
          method: 'GET',
          needAuth: true,
        }),
        app.request({
          url: `/api/merchant-credit/${this.data.id}/violations`,
          method: 'GET',
          needAuth: true,
        }),
      ]);

      const normalizedViolations = (violations || []).map(item => ({
        ...item,
        typeText: this.data.violationTypeMap[item.violation_type] || item.violation_type,
        timeText: formatTime(item.created_at || item.createdAt) || (item.created_at || item.createdAt || '-'),
        resolvedTimeText: formatTime(item.resolved_at || item.resolvedAt) || (item.resolved_at || item.resolvedAt || '-'),
      }));

      this.setData({
        detail: detail ? {
          ...detail,
          merchant: detail.merchant || {},
        } : null,
        violations: normalizedViolations,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  async resolveViolation(e) {
    const { id, status } = e.currentTarget.dataset;
    if (status === 'resolved') {
      wx.showToast({ title: '该记录已解除', icon: 'none' });
      return;
    }
    const modalRes = await wx.showModal({
      title: '确认解除',
      content: '确定要解除该违规处罚吗？',
    });
    if (!modalRes.confirm) return;

    this.setData({ resolvingId: id });
    try {
      await app.request({
        url: `/api/merchant-credit/violation/${id}/resolve`,
        method: 'PUT',
        needAuth: true,
        data: {
          remark: (this.data.resolveRemark || '').trim(),
        },
      });
      wx.showToast({ title: '解除成功', icon: 'success' });
      this.setData({ resolveRemark: '' });
      this.loadData();
    } catch (e) {
      wx.showToast({ title: e.message || '解除失败', icon: 'none' });
    } finally {
      this.setData({ resolvingId: null });
    }
  },

  onResolveRemarkChange(e) {
    const value = (e && e.detail != null)
      ? (typeof e.detail === 'string' ? e.detail : e.detail.value)
      : '';
    this.setData({ resolveRemark: value || '' });
  },
});