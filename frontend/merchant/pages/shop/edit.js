// 商户端 - 店铺基本信息编辑（简介、图片、联系方式、营业时间）
const app = getApp();

Page({
  data: {
    form: {
      business_name: '',
      description: '',
      shop_images: [],
      contact: '',
      address: '',
      latitude: null,
      longitude: null,
      business_hours: '',
      license_expiry: '',
      license_no: '',
      license_images: [],
    },
    displayImages: [],
    displayLicenseImages: [],
    shopImagesLen: 0,
    licenseImagesLen: 0,
    submitting: false,
  },

  onLoad() {
    this.loadShopInfo();
  },

  async loadShopInfo() {
    try {
      wx.showLoading({ title: '加载中...' });
      const info = await app.request({
        url: '/api/merchant/shop-info',
        method: 'GET',
        needAuth: true,
      });
      const shop_images = Array.isArray(info.shop_images) ? info.shop_images : [];
      const license_images = Array.isArray(info.license_images) ? info.license_images : [];
      const license_expiry = info.license_expiry ? (info.license_expiry.split && info.license_expiry.split('T')[0]) : '';
      this.setData({
        form: {
          business_name: info.business_name || '',
          description: info.description || '',
          shop_images,
          contact: info.contact || '',
          address: info.address || '',
          latitude: info.latitude != null ? Number(info.latitude) : null,
          longitude: info.longitude != null ? Number(info.longitude) : null,
          business_hours: info.business_hours || '',
          license_expiry,
          license_no: info.license_no || '',
          license_images,
        },
        displayImages: app.fullImageUrls(shop_images),
        displayLicenseImages: app.fullImageUrls(license_images),
        shopImagesLen: shop_images.length,
        licenseImagesLen: license_images.length,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = (e.detail && e.detail.value !== undefined) ? e.detail.value : (e.detail != null ? String(e.detail) : '');
    this.setData({ [`form.${field}`]: value });
  },

  /** 选择位置（地图选点，返回地址与经纬度） */
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        const address = [res.name, res.address].filter(Boolean).join(' ') || (res.address || res.name || '');
        if (address) {
          this.setData({
            'form.address': address,
            'form.latitude': res.latitude,
            'form.longitude': res.longitude,
          });
          wx.showToast({ title: '已选位置', icon: 'success' });
        }
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '选择位置失败或未授权', icon: 'none' });
        }
      },
    });
  },

  /** 当前定位：先获取位置再打开地图选点（地图会以当前位置为中心） */
  getLocationAddress() {
    wx.getLocation({
      type: 'gcj02',
      success: () => {
        wx.chooseLocation({
          success: (res) => {
            const address = [res.name, res.address].filter(Boolean).join(' ') || (res.address || res.name || '');
            if (address) {
              this.setData({
                'form.address': address,
                'form.latitude': res.latitude,
                'form.longitude': res.longitude,
              });
              wx.showToast({ title: '已选位置', icon: 'success' });
            }
          },
          fail: (err) => {
            if (err.errMsg && !err.errMsg.includes('cancel')) {
              wx.showToast({ title: '选择位置失败或未授权', icon: 'none' });
            }
          },
        });
      },
      fail: () => {
        wx.showToast({ title: '请授权位置信息后重试', icon: 'none' });
      },
    });
  },

  /** 选择店铺图片（多图） */
  chooseShopImages() {
    const max = 9;
    const current = (this.data.form.shop_images || []).length;
    const count = Math.min(max - current, 9);
    if (count <= 0) {
      wx.showToast({ title: '最多上传 9 张', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async res => {
        const paths = res.tempFilePaths || [];
        if (paths.length === 0) return;
        wx.showLoading({ title: '上传中...' });
        try {
          const urls = [];
          for (const path of paths) {
            const url = await app.uploadImage(path, 'merchant');
            urls.push(url);
          }
          const shop_images = [...(this.data.form.shop_images || []), ...urls].slice(0, 9);
          this.setData({
            'form.shop_images': shop_images,
            displayImages: app.fullImageUrls(shop_images),
            shopImagesLen: shop_images.length,
          });
        } catch (err) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  /** 删除某张店铺图片 */
  removeShopImage(e) {
    const index = e.currentTarget.dataset.index;
    const shop_images = (this.data.form.shop_images || []).filter((_, i) => i !== index);
    this.setData({
      'form.shop_images': shop_images,
      displayImages: app.fullImageUrls(shop_images),
      shopImagesLen: shop_images.length,
    });
  },

  /** 选择营业执照图片（多图，最多9张） */
  chooseLicenseImages() {
    const max = 9;
    const current = (this.data.form.license_images || []).length;
    const count = Math.min(max - current, 9);
    if (count <= 0) {
      wx.showToast({ title: '最多上传 9 张', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async res => {
        const paths = res.tempFilePaths || [];
        if (paths.length === 0) return;
        wx.showLoading({ title: '上传中...' });
        try {
          const urls = [];
          for (const path of paths) {
            const url = await app.uploadImage(path, 'merchant');
            urls.push(url);
          }
          const license_images = [...(this.data.form.license_images || []), ...urls].slice(0, 9);
          this.setData({
            'form.license_images': license_images,
            displayLicenseImages: app.fullImageUrls(license_images),
            licenseImagesLen: license_images.length,
          });
        } catch (err) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  removeLicenseImage(e) {
    const index = e.currentTarget.dataset.index;
    const license_images = (this.data.form.license_images || []).filter((_, i) => i !== index);
    this.setData({
      'form.license_images': license_images,
      displayLicenseImages: app.fullImageUrls(license_images),
      licenseImagesLen: license_images.length,
    });
  },

  /** 点击营业执照图片预览 */
  previewLicenseImage(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.displayLicenseImages || [];
    if (!urls.length || urls[index] == null) return;
    wx.previewImage({
      current: urls[index],
      urls,
    });
  },

  async submit() {
    const { form } = this.data;
    if (!form.business_name || !String(form.business_name).trim()) {
      wx.showToast({ title: '请填写店铺名称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await app.request({
        url: '/api/merchant/shop-info',
        method: 'PUT',
        needAuth: true,
        data: {
          business_name: String(form.business_name).trim(),
          description: (form.description || '').trim(),
          shop_images: Array.isArray(form.shop_images) ? form.shop_images : [],
          contact: (form.contact || '').trim(),
          address: (form.address || '').trim(),
          latitude: form.latitude != null ? form.latitude : undefined,
          longitude: form.longitude != null ? form.longitude : undefined,
          business_hours: (form.business_hours || '').trim(),
          license_expiry: (form.license_expiry || '').trim() || undefined,
          license_no: (form.license_no || '').trim() || undefined,
          license_images: Array.isArray(form.license_images) ? form.license_images : [],
        },
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
