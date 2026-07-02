// merchant/pages/ship/index.js
const app = getApp();

Page({
  data: {
    orderId: '',
    orderInfo: {},
    canShip: true, // 是否可以发货（仅 paid 状态可发货）
    statusTip: '', // 不可发货时的提示文案
    companies: [
      { code: 'sf', name: '顺丰速运' },
      { code: 'sto', name: '申通快递' },
      { code: 'yt', name: '圆通速递' },
      { code: 'yunda', name: '韵达快递' },
      { code: 'ems', name: 'EMS' },
      { code: 'zjs', name: '宅急送' },
      { code: 'tiantian', name: '天天快递' },
    ],
    companyIndex: 0,
    selectedCompany: null,
    trackingNo: '',
    submitting: false,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.loadOrderDetail();
    } else {
      wx.showToast({
        title: '订单ID不存在',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 加载订单详情
   */
  async loadOrderDetail() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const res = await app.request({
        url: `/api/merchant/orders/${this.data.orderId}`,
        method: 'GET',
        needAuth: true,
      });

      // 处理订单数据；收货人/电话/地址来自订单的 address_info（JSON）
      const product = res.product || {};
      let receiverName = '';
      let receiverPhone = '';
      let receiverAddress = '';
      if (res.address_info) {
        try {
          const addr = typeof res.address_info === 'string' ? JSON.parse(res.address_info) : res.address_info;
          receiverName = addr.receiverName || addr.receiver_name || '';
          receiverPhone = addr.receiverPhone || addr.receiver_phone || addr.telNumber || '';
          const parts = [ addr.provinceName, addr.cityName, addr.countyName, addr.detailInfo ].filter(Boolean);
          receiverAddress = parts.join('') || (addr.fullAddress || '');
        } catch (e) {
          console.warn('解析 address_info 失败', e);
        }
      }
      const orderInfo = {
        ...res,
        productName: product.name || '未知商品',
        receiverName,
        receiverPhone,
        receiverAddress,
      };

      // 仅 paid 且有收货地址（快递单）可填写物流发货；自提核销单无需发货
      const status = res.status || '';
      const hasAddress = !!(res.address_info && String(res.address_info).trim());
      const canShip = status === 'paid' && hasAddress;
      const statusTipMap = {
        verified: '此订单为核销类订单（餐饮券/门票等），用户到店核销即可，无需物流发货',
        shipped: '此订单已发货',
        completed: '此订单已完成',
        unpaid: '订单待付款，请用户完成支付后再发货',
        refunding: '订单退款中，无法发货',
        refunded: '订单已退款',
        cancelled: '订单已取消',
      };
      let statusTip = statusTipMap[status] || (canShip ? '' : '当前订单状态不支持发货操作');
      if (status === 'paid' && !hasAddress) {
        statusTip = '此订单为到店自提，用户出示核销码后核销即可，无需物流发货';
      }

      this.setData({
        orderInfo,
        canShip,
        statusTip,
        // 可发货时默认选中第一个快递公司
        selectedCompany: canShip ? this.data.companies[0] : null,
      });

      wx.hideLoading();
    } catch (error) {
      console.error('加载订单失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 选择快递公司
   */
  onCompanyChange(e) {
    const index = e.detail.value;
    this.setData({
      companyIndex: index,
      selectedCompany: this.data.companies[index],
    });
  },

  /**
   * 输入快递单号
   */
  onTrackingNoInput(e) {
    this.setData({
      trackingNo: e.detail.value,
    });
  },

  /**
   * 扫码获取快递单号
   */
  scanCode() {
    wx.scanCode({
      success: (res) => {
        console.log('扫码结果:', res);
        this.setData({
          trackingNo: res.result,
        });
        wx.showToast({
          title: '扫码成功',
          icon: 'success',
        });
      },
      fail: () => {
        wx.showToast({
          title: '扫码取消',
          icon: 'none',
        });
      },
    });
  },

  /**
   * 提交发货
   */
  async submitShip() {
    const { orderId, selectedCompany, trackingNo } = this.data;

    // 验证快递公司
    if (!selectedCompany) {
      wx.showToast({
        title: '请选择快递公司',
        icon: 'none',
      });
      return;
    }

    // 验证快递单号
    if (!trackingNo || trackingNo.trim() === '') {
      wx.showToast({
        title: '请输入快递单号',
        icon: 'none',
      });
      return;
    }

    // 简单验证快递单号格式（长度验证）
    if (trackingNo.length < 5) {
      wx.showToast({
        title: '快递单号格式不正确',
        icon: 'none',
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      await app.request({
        url: `/api/merchant/orders/${orderId}/ship`,
        method: 'POST',
        needAuth: true,
        data: {
          company: selectedCompany.code,
          trackingNo: trackingNo.trim(),
        },
      });

      wx.showToast({
        title: '发货成功',
        icon: 'success',
      });

      // 延迟返回列表页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('发货失败:', error);
      wx.showToast({
        title: error.message || '发货失败',
        icon: 'none',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
