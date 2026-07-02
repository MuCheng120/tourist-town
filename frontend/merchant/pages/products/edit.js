// 商家端 - 发布/编辑商品（美食 or 特产，按类型展示使用条件/分类）
const app = getApp();

const CATEGORY_OPTIONS = [
  { label: '茶叶', value: '茶叶' },
  { label: '干货', value: '干货' },
  { label: '工艺品', value: '工艺品' },
  { label: '食品', value: '食品' },
  { label: '其他', value: '其他' },
];

Page({
  data: {
    id: '',
    isEdit: false,
    typeOptions: [
      { label: '美食', value: 'food' },
      { label: '特产', value: 'souvenir' },
    ],
    typeIndex: 0,
    categoryOptions: CATEGORY_OPTIONS,
    categoryIndex: 0,
    form: {
      product_type: 'food',
      name: '',
      cover_image: '',
      images: [],
      spec: '',
      price: '',
      original_price: '',
      description: '',
      stock: '0',
      status: 1,
      usage_conditions: '',
      category: '',
      delivery_method: 'express',
      ship_time_desc: '',
    },
    deliveryExpress: true,
    deliverySelfPickup: false,
    displayCover: '',
    submitting: false,
  },

  onLoad(options) {
    const id = options.id || '';
    this.setData({ id, isEdit: !!id });
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑商品' });
      this.loadProduct(id);
    } else {
      wx.setNavigationBarTitle({ title: '发布商品' });
    }
  },

  async loadProduct(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const p = await app.request({
        url: `/api/merchant/products/${id}`,
        method: 'GET',
        needAuth: true,
      });
      let images = p.images;
      if (typeof images === 'string') {
        try {
          images = JSON.parse(images) || [];
        } catch (_) {
          images = [];
        }
      }
      if (!Array.isArray(images)) images = [];
      const typeIndex = p.product_type === 'souvenir' ? 1 : 0;
      const categoryIndex = Math.max(0, this.data.categoryOptions.findIndex(c => c.value === (p.category || '')));
      this.setData({
        form: {
          product_type: p.product_type || 'food',
          name: p.name || '',
          cover_image: p.cover_image || '',
          images,
          spec: p.spec || '',
          price: p.price != null ? String(p.price) : '',
          original_price: p.original_price != null ? String(p.original_price) : '',
          description: p.description || '',
          stock: p.stock != null ? String(p.stock) : '0',
          status: p.status === 1 ? 1 : 0,
          usage_conditions: p.usage_conditions || '',
          category: p.category || '',
          delivery_method: p.delivery_method || 'express',
          ship_time_desc: p.ship_time_desc || '',
        },
        deliveryExpress: (p.delivery_method || '').indexOf('express') !== -1,
        deliverySelfPickup: (p.delivery_method || '').indexOf('self_pickup') !== -1,
        typeIndex,
        categoryIndex,
        displayCover: app.fullImageUrl(p.cover_image || images[0]),
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      wx.hideLoading();
    }
  },

  onTypeChange(e) {
    const i = parseInt(e.detail.value, 10);
    const value = this.data.typeOptions[i].value;
    this.setData({
      typeIndex: i,
      'form.product_type': value,
    });
  },

  onCategoryChange(e) {
    const i = parseInt(e.detail.value, 10);
    const value = this.data.categoryOptions[i].value;
    this.setData({
      categoryIndex: i,
      'form.category': value,
    });
  },

  onStatusChange(e) {
    const i = parseInt(e.detail.value, 10);
    this.setData({ 'form.status': i === 0 ? 1 : 0 });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`form.${field}`]: value });
  },

  onDeliveryChange(e) {
    const vals = e.detail.value || [];
    const delivery_method = vals.length === 0 ? 'express' : vals.sort().join(',');
    this.setData({
      'form.delivery_method': delivery_method,
      deliveryExpress: vals.indexOf('express') !== -1,
      deliverySelfPickup: vals.indexOf('self_pickup') !== -1,
    });
  },

  chooseCover() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async res => {
        const path = res.tempFilePaths[0];
        try {
          const url = await app.uploadImage(path, 'product');
          this.setData({
            'form.cover_image': url,
            displayCover: app.fullImageUrl(url),
          });
        } catch (err) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
    });
  },

  async submit() {
    const { form, id, isEdit } = this.data;
    const product_type = form.product_type || 'food';
    if (!form.name || !String(form.name).trim()) {
      wx.showToast({ title: '请填写商品名称', icon: 'none' });
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) {
      wx.showToast({ title: '请填写有效价格', icon: 'none' });
      return;
    }
    if (product_type === 'food') {
      // 美食：使用条件选填
    }
    if (product_type === 'souvenir') {
      // 特产：分类选填
    }
    const payload = {
      product_type,
      name: String(form.name).trim(),
      cover_image: form.cover_image || null,
      images: Array.isArray(form.images) ? form.images : [],
      spec: form.spec || '',
      price,
      original_price: form.original_price !== '' ? parseFloat(form.original_price) : null,
      description: form.description || '',
      stock: product_type === 'food' ? 0 : (parseInt(form.stock, 10) >= 0 ? parseInt(form.stock, 10) : 0),
      status: form.status ? 1 : 0,
      usage_conditions: product_type === 'food' ? (form.usage_conditions || '') : '',
      category: product_type === 'souvenir' ? (form.category || '') : '',
      delivery_method: form.delivery_method || 'express',
      ship_time_desc: form.ship_time_desc || '',
    };
    this.setData({ submitting: true });
    try {
      if (isEdit) {
        await app.request({
          url: `/api/merchant/products/${id}`,
          method: 'PUT',
          needAuth: true,
          data: payload,
        });
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await app.request({
          url: '/api/merchant/products',
          method: 'POST',
          needAuth: true,
          data: payload,
        });
        wx.showToast({ title: '发布成功', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
