// 管理员 - 优惠券管理
const app = getApp();
const { formatExpiryDate } = require('../../../utils/date');

Page({
  data: {
    tabs: ['平台券'],
    activeTab: 0,
    couponList: [],
    loading: false,
    showCreateDialog: false,
    formData: {
      title: '',
      value: '',
      min_spend: 0,
      total_count: '',
      expiry_date: '',
    },
  },

  onLoad() {
    this.loadCoupons();
  },

  // 切换标签
  onTabChange(e) {
    const { index } = e.currentTarget.dataset || {};
    this.setData({ activeTab: index });
    this.loadCoupons();
  },

  // 加载优惠券列表（管理员只管理平台券）
  async loadCoupons() {
    this.setData({ loading: true });

    try {
      const result = await app.request({
        url: '/api/coupons',
        method: 'GET',
        data: { type: 'platform' },
        needAuth: true,
      });

      const list = (result && result.list ? result.list : []).map(item => {
        const now = Date.now();
        const expiryMs = item.expiry_date ? new Date(item.expiry_date).getTime() : 0;
        const isExpired = !!expiryMs && expiryMs <= now;
        const effectiveStatus = isExpired ? 0 : Number(item.effective_status != null ? item.effective_status : item.status);
        return {
          ...item,
          isExpired,
          effectiveStatus,
          expiry_date_display: formatExpiryDate(item.expiry_date),
        };
      });
      this.setData({
        couponList: list,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    }
  },

  // 显示创建对话框
  showCreateModal() {
    this.setData({
      showCreateDialog: true,
      formData: {
        title: '',
        value: '',
        min_spend: 0,
        total_count: '',
        expiry_date: '',
      },
    });
  },

  // 隐藏创建对话框
  hideCreateModal() {
    this.setData({ showCreateDialog: false });
  },

  stopPropagation() {},

  // 表单输入
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({
      [`formData.${field}`]: value,
    });
  },

  // 选择过期日期
  onDateChange(e) {
    this.setData({
      'formData.expiry_date': e.detail.value,
    });
  },

  // 创建优惠券（仅平台券）
  async createCoupon() {
    const { formData } = this.data;

    // 表单验证
    if (!formData.title) {
      return wx.showToast({
        title: '请输入优惠券标题',
        icon: 'none',
      });
    }

    if (!formData.value || formData.value <= 0) {
      return wx.showToast({
        title: '请输入优惠金额',
        icon: 'none',
      });
    }

    if (!formData.total_count || formData.total_count <= 0) {
      return wx.showToast({
        title: '请输入发行数量',
        icon: 'none',
      });
    }

    if (!formData.expiry_date) {
      return wx.showToast({
        title: '请选择过期时间',
        icon: 'none',
      });
    }

    try {
      wx.showLoading({ title: '创建中...' });

      await app.request({
        url: '/api/coupons',
        method: 'POST',
        data: {
          title: formData.title,
          type: 'platform',
          value: parseFloat(formData.value),
          min_spend: parseFloat(formData.min_spend) || 0,
          total_count: parseInt(formData.total_count),
          expiry_date: formData.expiry_date + ' 23:59:59',
        },
        needAuth: true,
      });

      wx.hideLoading();
      wx.showToast({
        title: '创建成功',
        icon: 'success',
      });

      this.hideCreateModal();
      this.loadCoupons();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none',
      });
    }
  },

  // 更新优惠券状态
  async updateStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    if (Number(status) === 1) {
      const row = (this.data.couponList || []).find(c => String(c.id) === String(id));
      if (row && row.isExpired) {
        wx.showToast({ title: '已过期优惠券无法启用', icon: 'none' });
        return;
      }
    }
    const statusText = status === 1 ? '启用' : '禁用';

    try {
      const res = await wx.showModal({
        title: '确认操作',
        content: `确定要${statusText}该优惠券吗？`,
      });

      if (res.confirm) {
        await app.request({
          url: `/api/coupons/${id}/status`,
          method: 'PUT',
          data: { status },
          needAuth: true,
        });

        wx.showToast({
          title: '操作成功',
          icon: 'success',
        });

        this.loadCoupons();
      }
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'none',
      });
    }
  },

  // 查看详情
  viewDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/admin/pages/coupon/detail?id=${id}`,
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadCoupons().then(() => {
      wx.stopPullDownRefresh();
    });
  },
});
