const app = getApp();

const LINK_TYPE_OPTIONS = [
  { label: '无跳转', value: 'none' },
  { label: '景点详情', value: 'scenic' },
  { label: '商品详情', value: 'product' },
  { label: '网页链接', value: 'url' },
];

/** 有跳转时在表单项下展示的说明（无跳转时不渲染该项） */
const LINK_VALUE_DESC = {
  scenic: '填写景点主键 ID（仅数字），与景点详情页链接中的 id 一致，可在「景点管理」中查看。',
  product: '填写商品主键 ID（仅数字），与商品详情页链接中的 id 一致，可在「商品管理」中查看。',
  url: '填写完整网址，须含 http:// 或 https://。微信内打开时，域名需在小程序后台配置为业务域名。',
};

const PLACEHOLDERS = {
  scenic: '例如 6',
  product: '例如 12',
  url: 'https://example.com/activity',
};

Page({
  data: {
    id: '',
    isEdit: false,
    linkTypeLabels: LINK_TYPE_OPTIONS.map(o => o.label),
    linkTypeIndex: 0,
    linkValueDesc: '',
    linkValuePlaceholder: '',
    form: {
      title: '',
      image: '',
      linkType: 'none',
      linkValue: '',
      sortOrder: '0',
      status: 1,
    },
    displayImage: '',
    submitting: false,
  },

  onLoad(options) {
    const id = options.id || '';
    this.setData({ id, isEdit: !!id });
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑轮播' });
      this.loadDetail(id);
    } else {
      wx.setNavigationBarTitle({ title: '新增轮播' });
    }
  },

  syncLinkTypeUi(linkType) {
    const idx = Math.max(0, LINK_TYPE_OPTIONS.findIndex(o => o.value === linkType));
    const v = LINK_TYPE_OPTIONS[idx].value;
    this.setData({
      linkTypeIndex: idx,
      linkValueDesc: LINK_VALUE_DESC[v] || '',
      linkValuePlaceholder: PLACEHOLDERS[v] || '',
    });
  },

  async loadDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const b = await app.request({
        url: `/api/banners/${id}`,
        method: 'GET',
        needAuth: true,
      });
      const linkType = b.linkType || b.link_type || 'none';
      this.syncLinkTypeUi(linkType);
      const sort = b.sortOrder != null ? b.sortOrder : (b.sort_order != null ? b.sort_order : 0);
      this.setData({
        form: {
          title: b.title || '',
          image: b.image || '',
          linkType,
          linkValue: b.linkValue != null ? String(b.linkValue) : (b.link_value != null ? String(b.link_value) : ''),
          sortOrder: String(sort),
          status: b.status === 0 ? 0 : 1,
        },
        displayImage: app.fullImageUrl(b.image) || '',
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      wx.hideLoading();
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`form.${field}`]: value });
  },

  onLinkTypeChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const opt = LINK_TYPE_OPTIONS[idx];
    if (!opt) return;
    this.setData({
      linkTypeIndex: idx,
      'form.linkType': opt.value,
      linkValueDesc: LINK_VALUE_DESC[opt.value] || '',
      linkValuePlaceholder: PLACEHOLDERS[opt.value] || '',
    });
    if (opt.value === 'none') {
      this.setData({ 'form.linkValue': '' });
    }
  },

  onStatusSwitch(e) {
    this.setData({ 'form.status': e.detail.value ? 1 : 0 });
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: [ 'compressed' ],
      sourceType: [ 'album', 'camera' ],
      success: async res => {
        const path = res.tempFilePaths[0];
        try {
          wx.showLoading({ title: '上传中...' });
          const url = await app.uploadImage(path, 'banner');
          wx.hideLoading();
          this.setData({
            'form.image': url,
            displayImage: app.fullImageUrl(url),
          });
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
    });
  },

  async submit() {
    const { form, id, isEdit } = this.data;
    if (!form.image || !String(form.image).trim()) {
      wx.showToast({ title: '请上传轮播图', icon: 'none' });
      return;
    }
    const linkType = form.linkType || 'none';
    const linkVal = (form.linkValue || '').trim();
    if (linkType !== 'none' && !linkVal) {
      wx.showToast({ title: '请填写跳转目标', icon: 'none' });
      return;
    }
    let sortOrder = parseInt(form.sortOrder, 10);
    if (isNaN(sortOrder) || sortOrder < 0) sortOrder = 0;

    const titleTrim = (form.title || '').trim();
    const payload = {
      title: titleTrim || undefined,
      image: String(form.image).trim(),
      linkType,
      linkValue: linkType === 'none' ? '' : linkVal,
      sortOrder,
      status: form.status === 0 ? 0 : 1,
    };

    this.setData({ submitting: true });
    try {
      if (isEdit) {
        await app.request({
          url: `/api/banners/${id}`,
          method: 'PUT',
          needAuth: true,
          data: payload,
        });
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await app.request({
          url: '/api/banners',
          method: 'POST',
          needAuth: true,
          data: {
            title: titleTrim || undefined,
            image: payload.image,
            linkType: payload.linkType,
            linkValue: linkType === 'none' ? undefined : linkVal,
            sortOrder: payload.sortOrder,
            status: payload.status,
          },
        });
        wx.showToast({ title: '创建成功', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
