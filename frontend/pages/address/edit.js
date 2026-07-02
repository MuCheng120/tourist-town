// 手动填写 / 编辑收货地址
const app = getApp();

Page({
  data: {
    id: '',
    isEdit: false,
    form: {
      userName: '',
      telNumber: '',
      provinceName: '',
      cityName: '',
      countyName: '',
      detailInfo: '',
      postalCode: '',
    },
    regionValue: [], // 省/市/区 选择器当前值，用于 picker value
    regionDisplay: '', // 用于展示的「省 市 区」文案
    submitting: false,
  },

  onLoad(options) {
    const id = options.id || '';
    this.setData({ id, isEdit: !!id });
    wx.setNavigationBarTitle({ title: id ? '编辑地址' : '新增地址' });
    if (id) this.loadDetail(id);
  },

  async loadDetail(id) {
    try {
      const data = await app.request({
        url: `/api/address/${id}`,
        method: 'GET',
        needAuth: true,
      });
      const provinceName = data.province_name || data.provinceName || '';
      const cityName = data.city_name || data.cityName || '';
      const countyName = data.county_name || data.countyName || '';
      this.setData({
        form: {
          userName: data.user_name || data.userName || '',
          telNumber: data.tel_number || data.telNumber || '',
          provinceName,
          cityName,
          countyName,
          detailInfo: data.detail_info || data.detailInfo || '',
          postalCode: data.postal_code || data.postalCode || '',
        },
        regionValue: provinceName && cityName && countyName ? [provinceName, cityName, countyName] : [],
        regionDisplay: [provinceName, cityName, countyName].filter(Boolean).join(' ') || '',
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = (e.detail && e.detail.value !== undefined) ? e.detail.value : (e.detail != null ? String(e.detail) : '');
    this.setData({ [`form.${field}`]: value });
  },

  onRegionChange(e) {
    const v = e.detail.value || [];
    const regionDisplay = [v[0], v[1], v[2]].filter(Boolean).join(' ');
    this.setData({
      'form.provinceName': v[0] || '',
      'form.cityName': v[1] || '',
      'form.countyName': v[2] || '',
      regionValue: v,
      regionDisplay,
    });
  },

  async submit() {
    const { form, id, isEdit } = this.data;
    const userName = (form.userName || '').trim();
    const telNumber = (form.telNumber || '').trim();
    const provinceName = (form.provinceName || '').trim();
    const cityName = (form.cityName || '').trim();
    const countyName = (form.countyName || '').trim();
    const detailInfo = (form.detailInfo || '').trim();

    if (!userName) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' });
      return;
    }
    if (!telNumber) {
      wx.showToast({ title: '请填写手机号', icon: 'none' });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(telNumber)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (!provinceName || !cityName || !countyName) {
      wx.showToast({ title: '请填写省/市/区', icon: 'none' });
      return;
    }
    if (!detailInfo) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }

    const payload = {
      userName,
      telNumber,
      provinceName,
      cityName,
      countyName,
      detailInfo,
      postalCode: (form.postalCode || '').trim() || undefined,
    };

    this.setData({ submitting: true });
    try {
      if (isEdit) {
        await app.request({
          url: `/api/address/${id}`,
          method: 'PUT',
          needAuth: true,
          data: payload,
        });
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await app.request({
          url: '/api/address/create',
          method: 'POST',
          needAuth: true,
          data: payload,
        });
        wx.showToast({ title: '添加成功', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
