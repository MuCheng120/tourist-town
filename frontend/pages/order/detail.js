const app = getApp();
import Dialog from '@vant/weapp/dialog/dialog';
const { formatTime } = require('../../utils/date.js');

/** 订单里嵌套的 logistics 可能含历史英文状态（如 shipping），与后端展示规则对齐 */
function logisticsStatusLabel(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) {
    const m = {
      '0': '在途中',
      '1': '已发货',
      '2': '疑难',
      '3': '已签收',
      '4': '退签',
      '5': '同城派送中',
      '6': '退回',
    };
    return m[s] || '未知';
  }
  const lower = s.toLowerCase();
  const eng = {
    shipping: '已发货',
    shipped: '已发货',
    pending: '待揽收',
    transit: '在途中',
    in_transit: '在途中',
    pickup: '已揽收',
    delivering: '派送中',
    delivered: '已签收',
    signed: '已签收',
    exception: '疑难',
    failed: '疑难',
    returning: '退回',
    refused: '退签',
  };
  if (eng[lower]) return eng[lower];
  return s;
}

Page({
  data: {
    orderId: null,
    order: null,
    statusText: '',
    statusDesc: '',
    /** 从管理端订单列表进入：只读查看，不展示用户侧操作（支付/退款/评价/删除等） */
    isAdminView: false,
    /** 从订单列表「查看物流」进入时为 logistics */
    initialTab: '',
    logisticsSummary: null,
    logisticsTraces: [],
    logisticsLoading: false,
    logisticsLoaded: false,
    showRefundPopup: false,
    refundReason: '',
    refundEvidenceImages: [],
    refundSubmitting: false,
  },

  onLoad(options) {
    const isAdminView = options.from === 'admin';
    const initialTab = options.tab || '';
    if (options.id) {
      this.setData({ orderId: options.id, isAdminView, initialTab });
      this.loadOrderDetail();
    }
  },

  onReady() {},

  onShareAppMessage() {
    return {
      title: '订单详情',
      path: `/pages/order/detail?id=${this.data.orderId}`,
    };
  },

  async loadOrderDetail() {
    wx.showLoading({ title: '加载中...' });

    try {
      const order = await app.request({
        url: `/api/orders/${this.data.orderId}`,
        method: 'GET',
        needAuth: true,
      });

      if (order.scenic_spot) {
        order.scenic_spot = { ...order.scenic_spot, cover_image: app.fullImageUrl(order.scenic_spot.cover_image) };
      }
      if (order.items && Array.isArray(order.items)) {
        order.items = order.items.map(it => {
          const p = it.product || {};
          return {
            ...it,
            product: {
              ...p,
              cover_image: app.fullImageUrl(p.cover_image),
              images: app.fullImageUrls(p.images || []),
            },
          };
        });
      }

      // 展示用：下单时间（使用 utils/date 转本地常规时间）、订单金额、收货信息
      order.createdAtText = formatTime(order.created_at || order.createdAt) || '';
      let amount = order.final_amount != null ? Number(order.final_amount) : (order.total_amount != null ? Number(order.total_amount) : 0);
      if ((!amount || !Number.isFinite(amount)) && order.product && order.quantity) {
        amount = Number(order.product.price || 0) * Number(order.quantity || 1);
      }
      order.finalAmountText = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
      order.paidAtText = formatTime(order.paid_at || order.paidAt) || '';
      if (order.address_info) {
        try {
          const addr = typeof order.address_info === 'string' ? JSON.parse(order.address_info) : order.address_info;
          order.addressDisplay = [ addr.receiverName, addr.receiverPhone, [ addr.provinceName, addr.cityName, addr.countyName, addr.detailInfo ].filter(Boolean).join('') ].filter(Boolean).join(' ');
        } catch (e) {
          order.addressDisplay = '';
        }
      } else {
        order.addressDisplay = '';
      }
      if (order.refund_evidence_images && typeof order.refund_evidence_images === 'string') {
        try {
          order.refund_evidence_images = JSON.parse(order.refund_evidence_images);
        } catch (e) {
          order.refund_evidence_images = [];
        }
      }
      order.refund_evidence_images = app.fullImageUrls(order.refund_evidence_images || []);

      order.showApplyRefundButton = this.computeShowApplyRefundButton(order);

      const preliminaryLogistics =
        order.logistics && order.logistics.tracking_no
          ? {
              company: order.logistics.company,
              company_code: order.logistics.company_code,
              tracking_no: order.logistics.tracking_no,
              status: logisticsStatusLabel(order.logistics.status),
            }
          : null;

      this.setData({
        order,
        statusText: this.getStatusText(order),
        statusDesc: this.getStatusDesc(order.status, order),
        logisticsLoaded: false,
        logisticsSummary: preliminaryLogistics,
        logisticsTraces: [],
      });

      // 生成可扫二维码（酒店无核销码；延迟确保 canvas 已渲染）
      if (
        order.order_type !== 'hotel' &&
        order.verification_code &&
        (order.status === 'paid' || order.status === 'verified' || order.status === 'completed')
      ) {
        setTimeout(() => this.generateQRCode(), 150);
      }

      if (this.shouldFetchLogistics(order)) {
        await this.loadLogistics();
      }
      if (this.data.initialTab === 'logistics') {
        setTimeout(() => this.scrollToLogisticsSection(), 500);
      }
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 是否展示「申请退款」：酒店/景点 已完成或已核验不展示；特产 仅已完成/已核验且 7 天内展示（其余状态沿用原规则）
   */
  computeShowApplyRefundButton(order) {
    if (!order || order.order_type === 'food') return false;
    if ([ 'unpaid', 'cancelled', 'refunding', 'refunded' ].includes(order.status)) return false;
    if (order.refund_applied_at) return false;

    const t = order.order_type;
    const s = order.status;

    if (t === 'hotel' || t === 'scenic') {
      if (s === 'completed' || s === 'verified') return false;
      return true;
    }

    if (t === 'souvenir') {
      if (s === 'completed' || s === 'verified') {
        return this.isSouvenirRefundWithinSevenDays(order);
      }
      return true;
    }

    return true;
  },

  isSouvenirRefundWithinSevenDays(order) {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    let anchor = null;
    if (order.status === 'verified') {
      anchor = order.verified_at || order.verifiedAt;
    } else if (order.status === 'completed') {
      anchor = order.completed_at || order.completedAt;
    }
    if (!anchor) return false;
    const ts = new Date(anchor).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= SEVEN_DAYS_MS;
  },

  getStatusText(order) {
    if (!order || !order.status) return '未知状态';
    const s = order.status;
    // 酒店订单不使用核销码；兼容历史数据中误带 verification_code 的情况
    if (s === 'paid' && order.order_type === 'hotel') {
      return '已支付';
    }
    if (s === 'paid' && order.verification_code) {
      if (order.address_info) {
        let hasAddr = false;
        try {
          const addr = typeof order.address_info === 'string' ? JSON.parse(order.address_info) : order.address_info;
          hasAddr = !!(addr && (addr.detailInfo || addr.detail_info || addr.receiverName));
        } catch (e) {
          hasAddr = String(order.address_info).trim().length > 2;
        }
        if (hasAddr) return '待发货';
      }
      return '待核销';
    }
    const statusMap = {
      unpaid: '待支付',
      paid: '已支付',
      shipped: '待收货',
      verified: '已核销',
      completed: '已完成',
      cancelled: '已取消',
      refunding: '退款中',
      refunded: '已退款',
    };
    return statusMap[s] || '未知状态';
  },

  /**
   * 根据订单状态和配送方式返回状态描述
   * 快递订单（有收货地址）不显示核销码，自提/到店核销才显示
   */
  getStatusDesc(status, order) {
    const baseDesc = {
      unpaid: '请尽快完成支付',
      paid: '请出示核销码', // 默认（门票/到店自提等）
      shipped: '商品配送中，请注意查收',
      verified: '已核销',
      completed: '订单已完成',
      cancelled: '订单已取消',
      refunding: '退款审核中',
      refunded: '已退款',
    };
    let desc = baseDesc[status] || '';
    if (status === 'paid' && order && order.order_type === 'hotel') {
      return '入住时请出示入住人有效证件，或向酒店报预留手机号办理入住';
    }
    // 已支付状态：有收货地址说明是快递，改为发货提示
    if (status === 'paid' && order && order.address_info) {
      desc = '商家将尽快发货，请耐心等待';
    }
    return desc;
  },

  shouldFetchLogistics(order) {
    if (!order || !order.logistics) return false;
    const no = order.logistics.tracking_no;
    return !!no && (order.status === 'shipped' || order.status === 'completed');
  },

  normalizeTraceItem(t) {
    if (!t || typeof t !== 'object') return { time: '', context: '', location: '' };
    const time = t.time || t.ftime || '';
    const context = t.context || t.remark || '';
    let location = t.location || t.areaName || '';
    if (typeof location === 'string') {
      const s = location.trim();
      if (s && (s.startsWith('{') || s.startsWith('['))) {
        try {
          const addr = JSON.parse(s);
          const parts = [
            addr.provinceName || addr.province_name,
            addr.cityName || addr.city_name,
            addr.countyName || addr.county_name,
            addr.detailInfo || addr.detail_info,
          ].filter(Boolean);
          location = parts.join('');
        } catch (e) {
          // 保留原值
        }
      }
    }
    return { time, context, location };
  },

  async loadLogistics() {
    if (!this.data.orderId) return;
    this.setData({ logisticsLoading: true });
    try {
      const data = await app.request({
        url: `/api/orders/${this.data.orderId}/logistics`,
        method: 'GET',
        needAuth: true,
      });
      const raw = (data && data.traces) || [];
      const traces = (Array.isArray(raw) ? raw : []).map(item => this.normalizeTraceItem(item));
      this.setData({
        logisticsSummary: data.logistics || null,
        logisticsTraces: traces,
        logisticsLoading: false,
        logisticsLoaded: true,
      });
    } catch (e) {
      const order = this.data.order;
      const fallback =
        order && order.logistics && order.logistics.tracking_no
          ? {
              company: order.logistics.company,
              company_code: order.logistics.company_code,
              tracking_no: order.logistics.tracking_no,
              status: logisticsStatusLabel(order.logistics.status),
            }
          : null;
      this.setData({
        logisticsLoading: false,
        logisticsLoaded: true,
        logisticsSummary: fallback,
        logisticsTraces: [],
      });
    }
  },

  scrollToLogisticsSection() {
    const query = wx.createSelectorQuery();
    query.select('#logistics-section').boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      const rect = res && res[0];
      const scroll = res && res[1];
      if (rect && scroll) {
        wx.pageScrollTo({
          scrollTop: scroll.scrollTop + rect.top - 24,
          duration: 280,
        });
      }
    });
  },

  onGoLogistics() {
    this.scrollToLogisticsSection();
  },

  copyTrackingNo() {
    const no = this.data.logisticsSummary && this.data.logisticsSummary.tracking_no;
    if (!no) return;
    wx.setClipboardData({
      data: String(no),
      success: () => wx.showToast({ title: '已复制单号', icon: 'success' }),
    });
  },

  async confirmReceipt() {
    const { order, orderId } = this.data;
    if (!order || order.status !== 'shipped') return;

    try {
      const res = await wx.showModal({
        title: '提示',
        content: '确定已收到商品吗？',
      });
      if (!res.confirm) return;

      await app.request({
        url: `/api/orders/${orderId}/complete`,
        method: 'POST',
        needAuth: true,
      });
      wx.showToast({ title: '确认成功', icon: 'success' });
      setTimeout(() => this.loadOrderDetail(), 500);
    } catch (error) {
      console.error('确认收货失败:', error);
    }
  },

  copyVerifyCode() {
    const { order } = this.data;
    if (!order || !order.verification_code) return;
    wx.setClipboardData({
      data: order.verification_code,
      success: () => {
        wx.showToast({ title: '复制成功', icon: 'success', duration: 2000 });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      },
    });
  },

  generateQRCode() {
    const { order } = this.data;
    if (!order || !order.verification_code) return;

    try {
      const drawQrcode = require('../../utils/weapp-qrcode');
      drawQrcode({
        canvasId: 'qrcode',
        text: order.verification_code,
        width: 200,
        height: 200,
      });
    } catch (error) {
      console.error('生成二维码失败', error);
    }
  },

  goToPay() {
    const { order } = this.data;
    const amt = order.finalAmountText || order.final_amount || order.total_amount || '0.00';

    Dialog.confirm({
      title: '模拟支付',
      message: `订单金额：¥${amt}\n\n确认支付？`,
    })
      .then(async () => {
        wx.showLoading({ title: '支付中...' });

        try {
          await app.request({
            url: `/api/orders/${order.id}/mock-pay`,
            method: 'POST',
            needAuth: true,
          });
          wx.hideLoading();
          wx.showToast({ title: '支付成功', icon: 'success' });
          setTimeout(() => this.loadOrderDetail(), 1500);
        } catch (error) {
          wx.showToast({
            title: (error && error.message) || '支付失败',
            icon: 'none',
          });
          wx.hideLoading();
        }
      })
      .catch(() => {
        // 取消支付
      });
  },

  cancelOrder() {
    Dialog.confirm({
      title: '取消订单',
      message: '确认要取消此订单吗？',
    })
      .then(async () => {
        wx.showLoading({ title: '取消中...' });

        try {
          await app.request({
            url: `/api/orders/${this.data.orderId}/cancel`,
            method: 'POST',
            needAuth: true,
          });
          wx.showToast({ title: '已取消', icon: 'success' });
          setTimeout(() => this.loadOrderDetail(), 1500);
        } catch (error) {
          wx.showToast({
            title: (error && error.message) || '取消失败',
            icon: 'none',
          });
        } finally {
          wx.hideLoading();
        }
      })
      .catch(() => {
        // 用户点击取消
      });
  },

  goReview() {
    wx.navigateTo({
      url: `/pages/order/review?orderId=${this.data.orderId}`,
    });
  },

  deleteOrder() {
    Dialog.confirm({
      title: '删除订单',
      message: '确定删除该订单记录吗？删除后不可恢复。',
    })
      .then(async () => {
        wx.showLoading({ title: '删除中...' });
        try {
          await app.request({
            url: `/api/orders/${this.data.orderId}`,
            method: 'DELETE',
            needAuth: true,
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1500);
        } catch (error) {
          wx.showToast({
            title: (error && error.message) || '删除失败',
            icon: 'none',
          });
        }
      })
      .catch(() => {});
  },

  applyRefund() {
    if (this.data.order && this.data.order.order_type === 'food') {
      wx.showToast({ title: '美食订单不支持退款', icon: 'none' });
      return;
    }
    this.setData({
      showRefundPopup: true,
      refundReason: '',
      refundEvidenceImages: [],
    });
  },

  closeRefundPopup() {
    if (this.data.refundSubmitting) return;
    this.setData({ showRefundPopup: false });
  },

  onRefundReasonInput(e) {
    this.setData({ refundReason: e.detail.value || '' });
  },

  chooseRefundEvidence() {
    const remain = 6 - this.data.refundEvidenceImages.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传6张', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remain,
      sizeType: [ 'compressed' ],
      sourceType: [ 'album', 'camera' ],
      success: async (res) => {
        const paths = res.tempFilePaths || [];
        if (!paths.length) return;
        wx.showLoading({ title: '上传中...' });
        try {
          const uploaded = [];
          for (const p of paths) {
            // 复用全局上传能力
            // eslint-disable-next-line no-await-in-loop
            const url = await app.uploadImage(p, 'common');
            uploaded.push(app.fullImageUrl(url));
          }
          this.setData({
            refundEvidenceImages: [ ...this.data.refundEvidenceImages, ...uploaded ].slice(0, 6),
          });
        } catch (err) {
          wx.showToast({ title: err.message || '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  removeRefundEvidence(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (Number.isNaN(idx)) return;
    const next = this.data.refundEvidenceImages.slice();
    next.splice(idx, 1);
    this.setData({ refundEvidenceImages: next });
  },

  previewRefundEvidence(e) {
    const current = e.currentTarget.dataset.current;
    const urls = (this.data.order && this.data.order.refund_evidence_images) || [];
    if (!current || !Array.isArray(urls) || urls.length === 0) return;
    wx.previewImage({
      current,
      urls,
    });
  },

  previewRefundApplyEvidence(e) {
    const current = e.currentTarget.dataset.current;
    const urls = this.data.refundEvidenceImages || [];
    if (!current || !Array.isArray(urls) || urls.length === 0) return;
    wx.previewImage({
      current,
      urls,
    });
  },

  async submitRefundApply() {
    const reason = (this.data.refundReason || '').trim();
    if (reason.length < 5) {
      wx.showToast({ title: '退款理由至少5个字', icon: 'none' });
      return;
    }
    this.setData({ refundSubmitting: true });
    wx.showLoading({ title: '提交中...' });
    try {
      await app.request({
        url: `/api/orders/${this.data.orderId}/refund`,
        method: 'POST',
        needAuth: true,
        data: {
          reason,
          evidence_images: this.data.refundEvidenceImages || [],
        },
      });
      wx.showToast({ title: '退款申请已提交', icon: 'success' });
      this.setData({ showRefundPopup: false });
      setTimeout(() => this.loadOrderDetail(), 500);
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '申请失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
      this.setData({ refundSubmitting: false });
    }
  },

  async adminApproveRefund() {
    if (!this.data.isAdminView || !this.data.order) return;
    const id = this.data.order.id;
    const res = await wx.showModal({
      title: '确认',
      content: '确认同意该订单退款？',
    });
    if (!res.confirm) return;
    try {
      wx.showLoading({ title: '处理中...' });
      await app.request({
        url: `/api/orders/${id}/approve-refund`,
        method: 'POST',
        needAuth: true,
        data: { reason: '管理员同意退款（平台最终裁决）' },
      });
      wx.showToast({ title: '已同意退款', icon: 'success' });
      setTimeout(() => this.loadOrderDetail(), 500);
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async adminRejectRefund() {
    if (!this.data.isAdminView || !this.data.order) return;
    const id = this.data.order.id;
    const res = await wx.showModal({
      title: '确认',
      content: '确认拒绝该订单退款？',
    });
    if (!res.confirm) return;
    try {
      wx.showLoading({ title: '处理中...' });
      await app.request({
        url: `/api/orders/${id}/reject-refund`,
        method: 'POST',
        needAuth: true,
        data: { reason: '管理员拒绝退款（平台最终裁决）' },
      });
      wx.showToast({ title: '已拒绝退款', icon: 'success' });
      setTimeout(() => this.loadOrderDetail(), 500);
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async adminCompleteHotel() {
    if (!this.data.isAdminView || !this.data.order) return;
    const id = this.data.order.id;
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
      setTimeout(() => this.loadOrderDetail(), 500);
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onPullDownRefresh() {
    this.loadOrderDetail().finally(() => wx.stopPullDownRefresh());
  },
});
