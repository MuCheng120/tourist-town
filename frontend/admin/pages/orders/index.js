// 管理端 - 订单管理
const app = getApp();
const {
  showImpactConfirm,
  showFinalConfirm,
  saveActionError,
  clearActionError,
  showLastActionError,
} = require('../../utils/risky-action');

const STATUS_MAP = {
  unpaid: '待付款',
  paid: '待发货',
  shipped: '待收货',
  verified: '已核销',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
};

// 每个状态对应的标签类型（用于区分显示）
const STATUS_TAG_TYPE = {
  unpaid: 'danger',      // 待付款-红
  paid: 'warning',        // 待发货-橙
  shipped: 'primary',     // 待收货-蓝
  verified: 'primary',    // 已核销-蓝
  completed: 'success',   // 已完成-绿
  cancelled: 'default',  // 已取消-灰
  refunding: 'warning',  // 退款中-橙
  refunded: 'default',  // 已退款-灰
};

const TYPE_MAP = {
  scenic: '门票',
  food: '餐饮券',
  souvenir: '特产',
  hotel: '酒店',
};

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    status: '',
    orderNo: '',
    loading: false,
    hasMore: true,
    includeDeleted: false,
    statusIndex: 0,
    type: '',
    typeIndex: 0,
    statusOptions: [
      { label: '全部', value: '' },
      { label: '待付款', value: 'unpaid' },
      { label: '待发货', value: 'paid' },
      { label: '待核销', value: 'verify_pending' },
      { label: '待收货', value: 'shipped' },
      { label: '已核销', value: 'verified' },
      { label: '已完成', value: 'completed' },
      { label: '已取消', value: 'cancelled' },
      { label: '退款中', value: 'refunding' },
      { label: '已退款', value: 'refunded' },
    ],
    typeOptions: [
      { label: '全部', value: '' },
      { label: '美食', value: 'food' },
      { label: '特产', value: 'souvenir' },
      { label: '景点', value: 'scenic' },
      { label: '酒店', value: 'hotel' },
    ],
    lastActionError: null,
  },

  onLoad() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, list: [], hasMore: true });
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadList();
    }
  },

  onStatusPickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const status = this.data.statusOptions[i].value;
    this.setData({ statusIndex: i, status, page: 1, list: [], hasMore: true }, () => this.loadList());
  },

  onTypePickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const type = this.data.typeOptions[i].value;
    this.setData({ typeIndex: i, type, page: 1, list: [], hasMore: true }, () => this.loadList());
  },

  onSearchInput(e) {
    this.setData({ orderNo: e.detail || '' });
  },

  onSearch() {
    this.setData({ page: 1, list: [], hasMore: true }, () => this.loadList());
  },

  onIncludeDeletedChange(e) {
    this.setData({
      includeDeleted: !!(e.detail && e.detail.value),
      page: 1,
      list: [],
      hasMore: true,
    }, () => this.loadList());
  },

  async loadList(refresh) {
    if (this.data.loading) return;
    const page = refresh ? 1 : this.data.page;
    if (refresh) this.setData({ page: 1 });

    this.setData({ loading: true });

    try {
      const query = {
        page,
        pageSize: this.data.pageSize,
        includeDeleted: this.data.includeDeleted ? 1 : 0,
      };
      if (this.data.status === 'verify_pending') {
        query.verify_pending = 1;
      } else if (this.data.status) {
        query.status = this.data.status;
      }
      if (this.data.type) query.order_type = this.data.type;
      if (this.data.orderNo) query.order_no = this.data.orderNo;

      const res = await app.request({
        url: '/api/admin/orders',
        method: 'GET',
        needAuth: true,
        data: query,
      });

      const data = res.data || res;
      const rawList = data.list || [];
      const list = rawList.map(o => ({
        ...o,
        statusText: this.getStatusText(o),
        statusTagType: STATUS_TAG_TYPE[o.status] || 'default',
        statusClass: 'status-' + (o.status || ''),
        typeText: TYPE_MAP[o.order_type] || o.order_type,
        userNickname: (o.user && o.user.nickname) || `用户${o.user_id}`,
        created_at: o.created_at ? String(o.created_at).slice(0, 19).replace('T', ' ') : '',
        timelineText: this.getTimelineText(o),
        refundEvidenceCount: this.getRefundEvidenceCount(o),
      }));

      this.setData({
        list: page === 1 ? list : [...this.data.list, ...list],
        total: data.total != null ? data.total : 0,
        hasMore: rawList.length >= this.data.pageSize,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  getStatusText(order) {
    if (!order || !order.status) return '未知';
    // 门票订单已支付后应进入待核销，不是待发货
    if (order.status === 'paid' && order.order_type === 'scenic') {
      return '待核销';
    }
    if (order.status === 'paid' && order.order_type === 'hotel') {
      return '待入住';
    }
    return STATUS_MAP[order.status] || order.status;
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order/detail?id=${id}&from=admin`,
    });
  },

  noop() {},

  getTimelineText(order) {
    const parts = [];
    if (order.created_at) parts.push('创建');
    if (order.paid_at) parts.push('支付');
    if (order.ship_time || order.shipped_at) parts.push('发货');
    if (order.refund_applied_at) parts.push('退款申请');
    if (order.refund_time) parts.push('退款完成');
    if (order.complete_time || order.completed_at || order.verified_at) parts.push('完成');
    return parts.length ? parts.join(' -> ') : '-';
  },

  getRefundEvidenceCount(order) {
    const raw = order.refund_evidence_images;
    if (!raw) return 0;
    if (Array.isArray(raw)) return raw.length;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (e) {
      return 0;
    }
  },

  askForReason(title, placeholder) {
    return new Promise(resolve => {
      wx.showModal({
        title,
        editable: true,
        placeholderText: placeholder,
        success: res => {
          if (!res.confirm) {
            resolve(null);
            return;
          }
          const reason = (res.content || '').trim();
          if (!reason) {
            wx.showToast({ title: '请填写备注', icon: 'none' });
            resolve(null);
            return;
          }
          resolve(reason);
        },
        fail: () => resolve(null),
      });
    });
  },

  showLastActionError() {
    showLastActionError(this, 'lastActionError', '订单ID');
  },

  async runRiskyAction({ id, actionName, impactText, loadingText, reasonTitle, reasonPlaceholder, request, successText }) {
    const impactConfirmed = await showImpactConfirm(actionName, impactText);
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm(actionName);
    if (!confirmed) return;
    let reason = '';
    if (reasonTitle) {
      reason = await this.askForReason(reasonTitle, reasonPlaceholder);
      if (!reason) return;
    }
    try {
      wx.showLoading({ title: loadingText || '处理中...' });
      await request(reason);
      wx.showToast({ title: successText || '操作成功', icon: 'success' });
      this.setData({ page: 1, list: [], hasMore: true });
      clearActionError(this, 'lastActionError');
      this.loadList(true);
    } catch (err) {
      saveActionError(this, actionName, id, err, reason ? { reason } : {}, 'lastActionError');
      wx.showToast({ title: err.message || '操作失败，可查看失败记录', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async approveRefund(e) {
    const id = e.currentTarget.dataset.id;
    await this.runRiskyAction({
      id,
      actionName: '同意退款',
      impactText: '该操作将直接向用户退款，资金将原路退回，且通常不可撤销。',
      loadingText: '退款处理中...',
      reasonTitle: '同意退款',
      reasonPlaceholder: '请填写同意退款备注',
      request: reason => app.request({
        url: `/api/orders/${id}/approve-refund`,
        method: 'POST',
        needAuth: true,
        data: { reason },
      }),
      successText: '已同意退款',
    });
  },

  async rejectRefund(e) {
    const id = e.currentTarget.dataset.id;
    await this.runRiskyAction({
      id,
      actionName: '拒绝退款',
      impactText: '该操作会驳回用户退款申请，可能触发投诉。请确认订单证据充分。',
      loadingText: '提交中...',
      reasonTitle: '拒绝退款',
      reasonPlaceholder: '请填写拒绝退款原因',
      request: reason => app.request({
        url: `/api/orders/${id}/reject-refund`,
        method: 'POST',
        needAuth: true,
        data: { reason },
      }),
      successText: '已拒绝退款',
    });
  },

  async forceComplete(e) {
    const id = e.currentTarget.dataset.id;
    await this.runRiskyAction({
      id,
      actionName: '强制完成',
      impactText: '该操作会直接结束订单流程，可能影响售后与结算，请谨慎执行。',
      loadingText: '处理中...',
      reasonTitle: '强制完成',
      reasonPlaceholder: '请填写强制完成原因',
      request: reason => app.request({
        url: `/api/orders/${id}/force-complete`,
        method: 'POST',
        needAuth: true,
        data: { reason },
      }),
      successText: '已强制完成',
    });
  },

  async completeHotelStay(e) {
    const id = e.currentTarget.dataset.id;
    const res = await wx.showModal({
      title: '确认入住完成',
      content: '确认客人已办理入住？订单将变为「已完成」。',
    });
    if (!res.confirm) return;
    try {
      wx.showLoading({ title: '提交中...' });
      await app.request({
        url: `/api/admin/orders/${id}/complete-hotel`,
        method: 'POST',
        needAuth: true,
      });
      wx.showToast({ title: '操作成功', icon: 'success' });
      this.setData({ page: 1, list: [], hasMore: true });
      this.loadList(true);
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async updateTrackingNo(e) {
    const { id } = e.currentTarget.dataset;
    await this.runRiskyAction({
      id,
      actionName: '修改运单号',
      impactText: '该操作会覆盖原物流单号，影响物流追踪与用户通知。',
      loadingText: '提交中...',
      reasonTitle: '修改运单号',
      reasonPlaceholder: '请输入新的运单号',
      request: trackingNo => app.request({
        url: `/api/orders/${id}/logistics/tracking`,
        method: 'PUT',
        needAuth: true,
        data: { trackingNo },
      }),
      successText: '改单号成功',
    });
  },
});
