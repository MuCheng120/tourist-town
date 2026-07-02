// pages/community/publish.js
const app = getApp();

Page({
  data: {
    postId: null, // 编辑草稿时的攻略ID
    title: '',
    content: '',
    location: '',
    images: [],
    uploading: false,
    category: 'guide',
    categoryLabel: '综合',
    showCategoryPicker: false,
    categories: [
      { value: 'scenery', label: '景点' },
      { value: 'food', label: '美食' },
      { value: 'accommodation', label: '住宿' },
      { value: 'guide', label: '综合' },
    ],
  },

  onLoad(options) {
    // 如果从“我的攻略-草稿箱”点“编辑”进来，会带上 id，这里加载草稿内容
    if (options && options.id) {
      this.loadDraftForEdit(options.id);
    }
  },

  /**
   * 内部方法：内容变更时，按需开启离开前确认弹窗
   * 只在第一次变“有内容”时调用 enableAlertBeforeUnload
   */
  ensureLeaveConfirm() {
    if (this._leaveConfirmEnabled) return;
    if (typeof wx.enableAlertBeforeUnload === 'function') {
      wx.enableAlertBeforeUnload({
        message: '当前内容未保存，确定要离开吗？',
      });
      this._leaveConfirmEnabled = true;
    }
  },

  /**
   * 标题输入
   */
  onTitleInput(e) {
    this.setData({ title: e.detail });
    this.ensureLeaveConfirm();
  },

  /**
   * 内容输入
   */
  onContentInput(e) {
    this.setData({ content: e.detail });
    this.ensureLeaveConfirm();
  },

  /**
   * 位置输入
   */
  onLocationInput(e) {
    this.setData({ location: e.detail });
    this.ensureLeaveConfirm();
  },

  /**
   * 选择图片
   */
  chooseImage() {
    const remainCount = 9 - this.data.images.length;
    
    wx.chooseImage({
      count: remainCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = [...this.data.images, ...res.tempFilePaths];
        this.setData({ images: newImages });
        this.ensureLeaveConfirm();
      },
    });
  },

  /**
   * 删除图片
   */
  deleteImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = this.data.images.filter((_, i) => i !== index);
    this.setData({ images });
    if (images.length > 0 || this.data.title || this.data.content || this.data.location) {
      this.ensureLeaveConfirm();
    }
  },

  /**
   * 根据 ID 加载草稿用于编辑
   */
  async loadDraftForEdit(id) {
    try {
      const res = await app.request({
        url: `/api/posts/${id}`,
        needAuth: true,
      });

      const category = res.category || 'guide';
      const categoryItem = (this.data.categories || []).find(c => c.value === category);

      this.setData({
        postId: id,
        title: res.title || '',
        content: res.content || '',
        location: res.location || '',
        // 这里暂不回填图片，避免远程 URL 走 uploadFile 报错；后续如需支持图片编辑再单独处理
        category,
        categoryLabel: categoryItem ? categoryItem.label : this.data.categoryLabel,
      });
    } catch (error) {
      console.error('加载草稿失败:', error);
      wx.showToast({
        title: '加载草稿失败',
        icon: 'none',
      });
    }
  },

  /**
   * 保存为草稿后返回
   */
  async saveDraftThenBack() {
    this.setData({ uploading: true });
    wx.showLoading({ title: '保存中...' });
    try {
      const imageUrls = [];
      for (const imagePath of this.data.images) {
        const url = await this.uploadImage(imagePath);
        imageUrls.push(url);
      }

      const payload = {
        title: this.data.title || '未命名草稿',
        content: this.data.content || '',
        images: imageUrls,
        location: this.data.location || '',
        category: this.data.category || 'guide',
        status: 0, // 0 表示草稿
      };

      // 如果是从草稿箱编辑进来的，更新原有草稿；否则创建新草稿
      const { postId } = this.data;
      if (postId) {
        await app.request({
          url: `/api/posts/${postId}`,
          method: 'PUT',
          needAuth: true,
          data: payload,
        });
      } else {
        await app.request({
          url: '/api/posts',
          method: 'POST',
          needAuth: true,
          data: payload,
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '已保存到草稿箱', icon: 'success' });
      if (typeof wx.disableAlertBeforeUnload === 'function') {
        wx.disableAlertBeforeUnload();
      }
      setTimeout(() => wx.navigateBack(), 500);
    } catch (err) {
      console.error('保存草稿失败:', err);
      wx.hideLoading();
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ uploading: false });
    }
  },

  /**
   * 显示分类选择器
   */
  showCategoryPicker() {
    this.setData({ showCategoryPicker: true });
  },

  /**
   * 关闭分类选择器
   */
  onCloseCategoryPicker() {
    this.setData({ showCategoryPicker: false });
  },

  /**
   * 确认选择分类
   */
  onCategoryConfirm(e) {
    const { value, index } = e.detail;
    const category = this.data.categories[index];
    this.setData({
      category: category.value,
      categoryLabel: category.label,
      showCategoryPicker: false,
    });
  },

  /**
   * 提交发布
   */
  async submit() {
    // 验证
    if (!this.data.title.trim()) {
      wx.showToast({
        title: '请输入标题',
        icon: 'none',
      });
      return;
    }

    if (!this.data.content.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none',
      });
      return;
    }

    // 内容安全检查（仅在云能力可用时进行，避免本地未配置 wx.cloud 报错）
    try {
      if (
        wx.cloud &&
        wx.cloud.openapi &&
        wx.cloud.openapi.security &&
        wx.cloud.openapi.security.msgSecCheck
      ) {
        const secCheckRes = await wx.cloud.openapi.security.msgSecCheck({
          content: this.data.content,
        });

        if (secCheckRes.errCode !== 0) {
          wx.showToast({
            title: '内容包含违规信息',
            icon: 'none',
          });
          return;
        }
      }
    } catch (error) {
      console.error('内容安全检查失败:', error);
      // 本地未配置云能力时，不拦截发布，让后端再做一次检查
    }

    this.setData({ uploading: true });
    wx.showLoading({ title: '发布中...' });

    const { postId } = this.data;
    let imageUrls = [];

    try {
      // 上传图片
      imageUrls = [];
      for (const imagePath of this.data.images) {
        const url = await this.uploadImage(imagePath);
        imageUrls.push(url);
      }

      // 构造通用 payload
      const payload = {
        title: this.data.title,
        content: this.data.content,
        images: imageUrls,
        location: this.data.location,
        category: this.data.category,
      };

      let res;

      if (postId) {
        // 从草稿箱编辑发布：先更新草稿，再调用发布接口
        await app.request({
          url: `/api/posts/${postId}`,
          method: 'PUT',
          needAuth: true,
          data: payload,
        });

        res = await app.request({
          url: `/api/posts/${postId}/publish`,
          method: 'POST',
          needAuth: true,
        });
      } else {
        // 新发布：直接创建
        res = await app.request({
          url: '/api/posts',
          method: 'POST',
          needAuth: true,
          data: payload,
        });
      }

      // app.request 成功 resolve 就表示接口 2xx，这里 res 就是后端 data 本身（post 对象）
      if (res) {
        const post = res || {};
        const needManualAudit =
          post.status === 0 && post.audit_status === 0;

        wx.hideLoading();
        wx.showToast({
          title: needManualAudit
            ? '已提交审核，请等待管理员审核'
            : '发布成功',
          icon: 'success',
          duration: 1800,
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1800);
      }
    } catch (error) {
      console.error('发布失败:', error);
      wx.hideLoading();

      // 发布失败兜底逻辑：
      // - 新发布：自动保存为草稿
      // - 草稿箱编辑发布：不改变现有草稿，仅提示失败
      if (!postId) {
        try {
          const draftPayload = {
            title: this.data.title || '未命名草稿',
            content: this.data.content || '',
            images: imageUrls,
            location: this.data.location || '',
            category: this.data.category || 'guide',
            status: 0,
          };

          await app.request({
            url: '/api/posts',
            method: 'POST',
            needAuth: true,
            data: draftPayload,
          });

          wx.showToast({
            title: '发布失败，内容已保存到草稿箱',
            icon: 'none',
          });
        } catch (e2) {
          console.error('自动保存草稿失败:', e2);
          wx.showToast({
            title: '发布失败，请稍后重试',
            icon: 'none',
          });
        }
      } else {
        wx.showToast({
          title: '发布失败，请稍后重试',
          icon: 'none',
        });
      }
    } finally {
      this.setData({ uploading: false });
    }
  },

  /**
   * 上传单张图片（攻略模块，存储到 uploads/post/）
   */
  uploadImage(filePath) {
    const base = `${app.globalData.apiBaseUrl}/api/upload`;
    const url = `${base}?module=post`;
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url,
        filePath,
        name: 'file',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`,
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 200) {
              resolve(data.data.url);
            } else {
              reject(new Error(data.message));
            }
          } catch (error) {
            reject(error);
          }
        },
        fail: reject,
      });
    });
  },
});
