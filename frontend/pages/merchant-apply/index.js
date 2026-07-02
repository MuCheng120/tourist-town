// pages/merchant-apply/index.js
const app = getApp();

Page({
  data: {
    formData: {
      name: '',
      contact: '',
      phone: '',
      address: '',
      business_license: '',
      description: '',
      license_image: '',
      idcard_front: '',
      idcard_back: '',
      qualification_files: [],
    },
    displayLicenseImage: '',
    displayIdCardFrontImage: '',
    displayIdCardBackImage: '',
    qualificationFileList: [],
    // 资质文件可选类型：图片或 PDF（accept=file 时用 chooseMessageFile 选择）
    qualificationFileExtension: ['pdf', 'jpg', 'jpeg', 'png'],
    submitting: false,
    // 申请状态：none / pending / rejected，及审核意见、上次提交信息
    merchantStatus: 'none',
    auditOpinion: '',
    lastApplication: null,
    statusLoading: true,
    showForm: true, // 是否显示表单（被拒后可点重新提交再显示表单）
  },

  onLoad() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '商家入驻需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/index' });
          } else {
            wx.navigateBack({
              fail: () => wx.switchTab({ url: '/pages/user/index' }),
            });
          }
        },
      });
      return;
    }
    this.loadApplicationStatus();
  },

  onShow() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (token && !this.data.statusLoading && this.data.merchantStatus !== 'pending') {
      this.loadApplicationStatus();
    }
  },

  /**
   * 加载商户申请状态（含审核意见、上次提交信息）
   */
  async loadApplicationStatus() {
    this.setData({ statusLoading: true });
    try {
      const data = await app.request({
        url: '/api/user/merchant-application',
        method: 'GET',
        needAuth: true,
      });
      const merchantStatus = data.merchant_status || 'none';
      const auditOpinion = data.audit_opinion || '';
      const lastApplication = data.last_application || null;
      const showForm = merchantStatus !== 'rejected' || false;
      this.setData({
        merchantStatus,
        auditOpinion,
        lastApplication,
        showForm: merchantStatus === 'none' ? true : showForm,
        statusLoading: false,
      });
    } catch (e) {
      console.error('获取申请状态失败:', e);
      this.setData({
        merchantStatus: 'none',
        auditOpinion: '',
        lastApplication: null,
        showForm: true,
        statusLoading: false,
      });
    }
  },

  /**
   * 重新提交：预填上次提交信息并显示表单
   */
  goResubmit() {
    const last = this.data.lastApplication;
    if (!last) {
      this.setData({ showForm: true });
      return;
    }
    const licenseImages = last.license_images || [];
    const firstLicense = licenseImages[0];
    const idcardFront = last.idcard_front || '';
    const idcardBack = last.idcard_back || '';
    const qualificationImages = last.qualification_images || [];
    const qualificationFileList = qualificationImages.map(p => ({
      url: p.startsWith('http') ? p : app.fullImageUrl(p),
      path: p,
    }));
    const fullUrl = path => (path && (path.startsWith('http') ? path : app.fullImageUrl(path))) || '';
    this.setData({
      showForm: true,
      formData: {
        name: last.business_name || '',
        contact: last.contact || '',
        phone: this.data.formData.phone || '',
        address: last.address || '',
        business_license: last.license_no || '',
        description: last.description || '',
        license_image: firstLicense || '',
        idcard_front: idcardFront || '',
        idcard_back: idcardBack || '',
        qualification_files: qualificationImages,
      },
      displayLicenseImage: fullUrl(firstLicense),
      displayIdCardFrontImage: fullUrl(idcardFront),
      displayIdCardBackImage: fullUrl(idcardBack),
      qualificationFileList,
    });
  },

  /**
   * 表单字段改变
   */
  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail;
    
    this.setData({
      [`formData.${field}`]: value,
    });
  },

  /**
   * 上传营业执照（存到 merchant/images/）
   */
  uploadLicense() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });
        try {
          const url = await app.uploadImage(tempFilePath, 'merchant');
          this.setData({
            'formData.license_image': url,
            displayLicenseImage: app.fullImageUrl(url),
          });
          wx.showToast({ title: '上传成功', icon: 'success' });
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  /** 与注册页一致：将选中的文件归一为 { url } 并入列表 */
  addFilesToList(currentList, file) {
    const files = Array.isArray(file) ? file : [ file ];
    const normalized = files
      .map(f => {
        if (!f) return null;
        const url = f.url || f.path || f.tempFilePath || (typeof f === 'string' ? f : null);
        return url ? { url } : null;
      })
      .filter(Boolean);
    return currentList.concat(normalized);
  },

  /** 资质文件（选填，与注册页一致：van-uploader after-read） */
  onQualificationAfterRead(e) {
    const next = this.addFilesToList(this.data.qualificationFileList, e.detail.file).slice(0, 3);
    this.setData({ qualificationFileList: next });
  },

  onQualificationDelete(e) {
    const { index } = e.detail;
    const list = this.data.qualificationFileList.slice();
    list.splice(index, 1);
    this.setData({ qualificationFileList: list });
  },

  /**
   * 预览营业执照
   */
  previewLicense() {
    const url = this.data.displayLicenseImage || this.data.formData.license_image;
    if (!url) return;
    const full = url.startsWith('http') ? url : app.fullImageUrl(url);
    wx.previewImage({ current: full, urls: [full] });
  },

  /** 上传身份证正面（存 merchant/images/） */
  uploadIdCardFront() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });
        try {
          const url = await app.uploadImage(tempFilePath, 'merchant');
          this.setData({
            'formData.idcard_front': url,
            displayIdCardFrontImage: app.fullImageUrl(url),
          });
          wx.showToast({ title: '上传成功', icon: 'success' });
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  /** 上传身份证反面 */
  uploadIdCardBack() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });
        try {
          const url = await app.uploadImage(tempFilePath, 'merchant');
          this.setData({
            'formData.idcard_back': url,
            displayIdCardBackImage: app.fullImageUrl(url),
          });
          wx.showToast({ title: '上传成功', icon: 'success' });
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  previewIdCardFront() {
    const url = this.data.displayIdCardFrontImage || this.data.formData.idcard_front;
    if (!url) return;
    const full = url.startsWith('http') ? url : app.fullImageUrl(url);
    wx.previewImage({ current: full, urls: [full] });
  },

  previewIdCardBack() {
    const url = this.data.displayIdCardBackImage || this.data.formData.idcard_back;
    if (!url) return;
    const full = url.startsWith('http') ? url : app.fullImageUrl(url);
    wx.previewImage({ current: full, urls: [full] });
  },

  /**
   * 提交申请
   */
  async handleSubmit() {
    const { formData } = this.data;

    // 验证必填字段
    if (!formData.name) {
      wx.showToast({
        title: '请输入店铺名称',
        icon: 'none',
      });
      return;
    }

    if (!formData.contact) {
      wx.showToast({
        title: '请输入联系人',
        icon: 'none',
      });
      return;
    }
    // 联系人字段，允许填写姓名

    if (!formData.phone) {
      wx.showToast({
        title: '请输入联系电话',
        icon: 'none',
      });
      return;
    }

    // 验证联系人手机号
    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(formData.phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none',
      });
      return;
    }

    if (!formData.license_image) {
      wx.showToast({
        title: '请上传营业执照照片',
        icon: 'none',
      });
      return;
    }

    if (!formData.idcard_front) {
      wx.showToast({
        title: '请上传身份证正面',
        icon: 'none',
      });
      return;
    }

    if (!formData.idcard_back) {
      wx.showToast({
        title: '请上传身份证反面',
        icon: 'none',
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      // 资质文件（选填）上传到 merchant/files/
      let qualificationUrls = [];
      if (this.data.qualificationFileList && this.data.qualificationFileList.length > 0) {
        try {
          wx.showLoading({ title: '正在上传资质文件...', mask: true });
          for (const item of this.data.qualificationFileList) {
            const local = item.url || item.path || item.tempFilePath;
            if (!local) continue;
            // 已有服务器 path（重新提交预填）则直接使用
            if (item.path && (item.path.startsWith('/uploads/') || item.path.startsWith('/public/uploads/'))) {
              qualificationUrls.push(item.path);
              continue;
            }
            if (typeof local === 'string' && (local.startsWith('/uploads/') || local.startsWith('/public/uploads/'))) {
              qualificationUrls.push(local);
              continue;
            }
            const url = await app.uploadFile(local, 'merchant');
            qualificationUrls.push(url);
          }
          wx.hideLoading();
        } catch (uploadErr) {
          wx.hideLoading();
          console.error('资质文件上传失败:', uploadErr);
          wx.showToast({ title: '资质文件上传失败，请重试', icon: 'none' });
          this.setData({ submitting: false });
          return;
        }
      }

      const payload = {
        business_name: formData.name,
        contact: formData.contact,
        license_no: formData.business_license || null,
        license_expiry: null,
        license_images: formData.license_image ? [formData.license_image] : [],
        qualification_images: qualificationUrls,
        idcard_front: formData.idcard_front || null,
        idcard_back: formData.idcard_back || null,
        address: formData.address || null,
        description: formData.description || null,
      };

      await app.request({
        url: '/api/user/apply-merchant',
        method: 'POST',
        needAuth: true,
        data: payload,
      });

      this.loadApplicationStatus();
      wx.showModal({
        title: '提交成功',
        content: '您的申请已提交，我们将在1-3个工作日内审核',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        },
      });
    } catch (error) {
      console.error('提交申请失败:', error);
      const raw = (error && error.message) ? error.message : '';
      const isDbOrServer = /SQL|syntax|near\s*'|ER_|操作失败|请求失败/.test(raw);
      wx.showToast({
        title: isDbOrServer ? '提交失败，请稍后重试' : (raw || '提交失败'),
        icon: 'none',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
