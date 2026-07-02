// admin/pages/audit/index.js
const app = getApp();
const { formatTime } = require('../../../utils/date');
const {
  showImpactConfirm,
  showFinalConfirm,
  saveActionError,
  clearActionError,
  showLastActionError,
} = require('../../utils/risky-action');

Page({
  data: {
    activeTab: 'merchant',
    merchantList: [],
    postList: [],
    commentList: [],
    productList: [],
    showRejectPopup: false,
    rejectMerchantId: null,
    rejectOpinion: '',
    rejectInputFocus: false,
    showPostRejectPopup: false,
    rejectPostId: null,
    rejectPostReason: '',
    showProductRejectPopup: false,
    rejectProductId: null,
    rejectProductReason: '',
    rejectTemplates: [
      '存在违规词',
      '内容信息不完整',
      '资质材料不清晰',
    ],
    lastActionError: null,
  },

  onLoad(options) {
    // 支持从工作台跳转时指定默认标签：merchant / post / comment
    const tabFromQuery = options && options.tab;
    const validTabs = ['merchant', 'post', 'comment', 'product'];
    const initialTab = validTabs.includes(tabFromQuery) ? tabFromQuery : 'merchant';

    this.setData({ activeTab: initialTab });

    if (initialTab === 'merchant') {
      this.loadMerchantList();
    } else if (initialTab === 'post') {
      this.loadPostList();
    } else if (initialTab === 'comment') {
      this.loadCommentList();
    } else if (initialTab === 'product') {
      this.loadProductList();
    }
  },

  /**
   * 切换标签
   */
  switchTab(e) {
    const tab = e.detail.name;
    this.setData({ activeTab: tab });

    // 根据标签加载对应数据
    if (tab === 'merchant') {
      this.loadMerchantList();
    } else if (tab === 'post') {
      this.loadPostList();
    } else if (tab === 'comment') {
      this.loadCommentList();
    } else if (tab === 'product') {
      this.loadProductList();
    }
  },

  /**
   * 加载待审核商户列表
   */
  async loadMerchantList() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const res = await app.request({
        url: '/api/user/merchant-applications',
        method: 'GET',
        needAuth: true,
        data: {
          status: 'pending',
        },
      });

      const list = (Array.isArray(res) ? res : (res.list || [])).map(item => {
        const ext = item.merchantExt || {};
        const licenseImages = Array.isArray(ext.license_images) ? ext.license_images : [];
        const qualificationRaw = Array.isArray(ext.qualification_images) ? ext.qualification_images : [];
        const full = u => (u && typeof u === 'string') ? app.fullImageUrl(u) : '';
        const qualificationFileList = qualificationRaw.map(u => {
          const url = full(u);
          const isImage = /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(url || '');
          return { url, isImage };
        }).filter(x => x.url);
        return {
          ...item,
          created_at: formatTime(item.created_at),
          avatar: app.fullImageUrl(item.avatar),
          license_images: licenseImages.map(full).filter(Boolean),
          qualification_file_list: qualificationFileList,
          license_no: ext.license_no,
          license_expiry: ext.license_expiry,
          address: ext.address,
          description: ext.description,
          idcard_front: ext.idcard_front ? app.fullImageUrl(ext.idcard_front) : null,
          idcard_back: ext.idcard_back ? app.fullImageUrl(ext.idcard_back) : null,
        };
      });

      this.setData({ merchantList: list });

      wx.hideLoading();
    } catch (error) {
      console.error('加载商户列表失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    }
  },

  /**
   * 加载待审核攻略列表
   */
  async loadPostList() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const res = await app.request({
        url: '/api/posts',
        method: 'GET',
        needAuth: true,
        data: {
          // 待审核：audit_status=0（待审核），且未发布 status=0
          audit_status: 0,
          status: 0,
          page: 1,
          pageSize: 50,
        },
      });

      const list = (res.list || []).map(item => ({
        ...item,
        created_at: formatTime(item.created_at),
        images: app.fullImageUrls(item.images || []),
        user: item.user ? { ...item.user, avatar: app.fullImageUrl(item.user.avatar) } : item.user,
      }));

      this.setData({ postList: list });
    } catch (error) {
      console.error('加载攻略列表失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 加载待审核评论列表
   */
  async loadCommentList() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const res = await app.request({
        url: '/api/comments/pending',
        method: 'GET',
        needAuth: true,
      });

      const list = (res.list || []).map(item => ({
        ...item,
        created_at: formatTime(item.created_at),
        user: item.user ? { ...item.user, avatar: app.fullImageUrl(item.user.avatar) } : item.user,
      }));

      this.setData({ commentList: list });
    } catch (error) {
      console.error('加载评论列表失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  async loadProductList() {
    try {
      wx.showLoading({ title: '加载中...' });
      const res = await app.request({
        url: '/api/admin/products',
        method: 'GET',
        needAuth: true,
        data: {
          audit_status: 0,
          page: 1,
          pageSize: 50,
        },
      });
      const list = ((res && res.list) || []).map(item => ({
        ...item,
        created_at: formatTime(item.created_at),
      }));
      this.setData({ productList: list });
    } catch (error) {
      console.error('加载商品审核列表失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 审核商户申请（通过直接确认，拒绝需填写审核意见）
   */
  async auditMerchant(e) {
    const { id, pass } = e.currentTarget.dataset;
    const isPass = pass === true || pass === 'true';

    if (isPass) {
      const impactConfirmed = await showImpactConfirm('通过商户申请', '该操作会开通商户权限，申请人可开始经营。');
      if (!impactConfirmed) return;
      const confirmed = await showFinalConfirm('通过商户申请');
      if (!confirmed) return;
      await this.submitAuditMerchant(id, true, null);
      return;
    }

    this.setData({
      showRejectPopup: true,
      rejectMerchantId: id,
      rejectOpinion: '',
      rejectInputFocus: true,
    });
  },

  /** 仅点击遮罩空白处时关闭，避免弹层内 catchtap 导致 textarea 无法输入 */
  onRejectMaskTap(e) {
    if (e.target === e.currentTarget) {
      this.closeRejectPopup();
    }
  },

  /** 防止触摸滑动穿透到下层页面 */
  preventMove() {},

  onRejectOpinionChange(e) {
    const value = (e && e.detail != null)
      ? (typeof e.detail === 'string' ? e.detail : e.detail.value)
      : '';
    this.setData({ rejectOpinion: value || '' });
  },

  quickFillRejectTemplate(e) {
    const { target } = e.currentTarget.dataset;
    const value = e.currentTarget.dataset.value || '';
    if (target === 'merchant') this.setData({ rejectOpinion: value });
    if (target === 'post') this.setData({ rejectPostReason: value });
    if (target === 'product') this.setData({ rejectProductReason: value });
  },

  closeRejectPopup() {
    this.setData({
      showRejectPopup: false,
      rejectMerchantId: null,
      rejectOpinion: '',
      rejectInputFocus: false,
    });
  },

  async confirmReject() {
    const opinion = (this.data.rejectOpinion || '').trim();
    if (!opinion) {
      wx.showToast({ title: '请填写审核意见', icon: 'none' });
      return;
    }
    const id = this.data.rejectMerchantId;
    const impactConfirmed = await showImpactConfirm('拒绝商户申请', '该操作会拒绝入驻申请，申请人将看到审核意见。');
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm('拒绝商户申请');
    if (!confirmed) return;
    this.closeRejectPopup();
    await this.submitAuditMerchant(id, false, opinion);
  },

  /**
   * 提交商户审核请求
   */
  async submitAuditMerchant(id, pass, auditOpinion) {
    try {
      wx.showLoading({ title: '处理中...' });
      await app.request({
        url: `/api/user/${id}/audit-merchant`,
        method: 'POST',
        needAuth: true,
        data: {
          pass,
          audit_opinion: auditOpinion || undefined,
        },
      });
      wx.hideLoading();
      wx.showToast({
        title: pass ? '通过成功' : '已拒绝',
        icon: 'success',
      });
      clearActionError(this, 'lastActionError');
      this.loadMerchantList();
    } catch (error) {
      console.error('审核失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '审核失败',
        icon: 'none',
      });
      saveActionError(this, pass ? '商户审核通过' : '商户审核拒绝', id, error, { auditOpinion }, 'lastActionError');
      throw error;
    }
  },

  /**
   * 审核攻略
   */
  async auditPost(e) {
    const { id, pass } = e.currentTarget.dataset;
    const isPass = pass === true || pass === 'true';

    if (isPass) {
      const impactConfirmed = await showImpactConfirm('通过攻略审核', '该操作会允许内容进入公开状态并对外可见。');
      if (!impactConfirmed) return;
      const confirmed = await showFinalConfirm('通过攻略审核');
      if (!confirmed) return;
      await this.submitAuditPost(id, 1, null);
      return;
    }

    // 拒绝：必须填写原因
    this.setData({
      showPostRejectPopup: true,
      rejectPostId: id,
      rejectPostReason: '',
    });
  },

  onPostRejectReasonChange(e) {
    const value = (e && e.detail != null)
      ? (typeof e.detail === 'string' ? e.detail : e.detail.value)
      : '';
    this.setData({ rejectPostReason: value || '' });
  },

  closePostRejectPopup() {
    this.setData({
      showPostRejectPopup: false,
      rejectPostId: null,
      rejectPostReason: '',
    });
  },

  async confirmPostReject() {
    const reason = (this.data.rejectPostReason || '').trim();
    if (!reason) {
      wx.showToast({ title: '请填写拒绝原因', icon: 'none' });
      return;
    }
    const id = this.data.rejectPostId;
    const impactConfirmed = await showImpactConfirm('拒绝攻略', '该操作会驳回当前攻略，发布者将收到拒绝原因。');
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm('拒绝攻略');
    if (!confirmed) return;
    this.closePostRejectPopup();
    await this.submitAuditPost(id, 2, reason);
  },

  async submitAuditPost(id, auditStatus, auditRemark) {
    try {
      wx.showLoading({ title: '处理中...' });

      await app.request({
        url: `/api/posts/${id}/audit`,
        method: 'POST',
        needAuth: true,
        data: {
          auditStatus,
          auditRemark: auditRemark || undefined,
        },
      });

      wx.showToast({
        title: auditStatus === 1 ? '通过成功' : '已拒绝',
        icon: 'success',
      });
      clearActionError(this, 'lastActionError');
      this.loadPostList();
    } catch (error) {
      console.error('审核失败:', error);
      wx.showToast({
        title: error.message || '审核失败',
        icon: 'none',
      });
      saveActionError(this, auditStatus === 1 ? '攻略审核通过' : '攻略审核拒绝', id, error, { auditRemark }, 'lastActionError');
      throw error;
    } finally {
      wx.hideLoading();
    }
  },

  async auditProduct(e) {
    const { id, pass } = e.currentTarget.dataset;
    const isPass = pass === true || pass === 'true';
    if (isPass) {
      const impactConfirmed = await showImpactConfirm('通过商品审核', '该操作会允许商品上架并进入销售流程。');
      if (!impactConfirmed) return;
      const confirmed = await showFinalConfirm('通过商品审核');
      if (!confirmed) return;
      await this.submitAuditProduct(id, 1, '');
      return;
    }
    this.setData({
      showProductRejectPopup: true,
      rejectProductId: id,
      rejectProductReason: '',
    });
  },

  onProductRejectReasonChange(e) {
    const value = (e && e.detail != null)
      ? (typeof e.detail === 'string' ? e.detail : e.detail.value)
      : '';
    this.setData({ rejectProductReason: value || '' });
  },

  closeProductRejectPopup() {
    this.setData({
      showProductRejectPopup: false,
      rejectProductId: null,
      rejectProductReason: '',
    });
  },

  async confirmProductReject() {
    const reason = (this.data.rejectProductReason || '').trim();
    if (!reason) {
      wx.showToast({ title: '请填写拒绝原因', icon: 'none' });
      return;
    }
    const id = this.data.rejectProductId;
    const impactConfirmed = await showImpactConfirm('拒绝商品', '该操作会驳回商品上架申请，商户将收到拒绝原因。');
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm('拒绝商品');
    if (!confirmed) return;
    this.closeProductRejectPopup();
    await this.submitAuditProduct(id, 2, reason);
  },

  async submitAuditProduct(id, auditStatus, auditRemark) {
    try {
      wx.showLoading({ title: '处理中...' });
      await app.request({
        url: `/api/admin/products/${id}/audit`,
        method: 'POST',
        needAuth: true,
        data: {
          audit_status: auditStatus,
          audit_remark: auditRemark || undefined,
        },
      });
      wx.showToast({
        title: auditStatus === 1 ? '通过成功' : '已拒绝',
        icon: 'success',
      });
      clearActionError(this, 'lastActionError');
      this.loadProductList();
    } catch (error) {
      console.error('审核商品失败:', error);
      wx.showToast({
        title: error.message || '审核失败',
        icon: 'none',
      });
      saveActionError(this, auditStatus === 1 ? '商品审核通过' : '商品审核拒绝', id, error, { auditRemark }, 'lastActionError');
      throw error;
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 查看攻略详情
   */
  viewPostDetail(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/community/detail?id=${postId}&readonly=1`,
    });
  },

  /**
   * 审核评论
   */
  async auditComment(e) {
    const { id, pass } = e.currentTarget.dataset;
    const action = pass ? '通过' : '拒绝';

    const impactConfirmed = await showImpactConfirm(`${action}评论`, pass ? '该评论将通过审核并在前台展示。' : '该评论将被拒绝并不会公开展示。');
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm(`${action}评论`);
    if (!confirmed) return;

    try {
      wx.showLoading({ title: '处理中...' });

      await app.request({
        url: `/api/comments/${id}/audit`,
        method: 'POST',
        needAuth: true,
        data: {
          // 后端需要 status：1通过 2拒绝
          status: pass ? 1 : 2,
        },
      });

      wx.showToast({
        title: `${action}成功`,
        icon: 'success',
      });
      clearActionError(this, 'lastActionError');

      // 刷新列表
      this.loadCommentList();
    } catch (error) {
      console.error('审核失败:', error);
      wx.showToast({
        title: error.message || '审核失败',
        icon: 'none',
      });
      saveActionError(this, pass ? '评论审核通过' : '评论审核拒绝', id, error, {}, 'lastActionError');
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    let urls = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current;
    if (urls.length && urls[0] && typeof urls[0] === 'object' && urls[0].url) {
      urls = urls.map(x => (x && x.url) ? x.url : x).filter(Boolean);
    } else {
      urls = Array.isArray(urls) ? urls.filter(Boolean) : [];
    }
    if (current && urls.length) {
      wx.previewImage({
        current: current,
        urls,
      });
    }
  },

  /** 资质文件中的图片预览（urls 为 qualification_file_list，需取 .url） */
  previewQualificationImage(e) {
    const list = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current;
    const urls = list.map(x => (x && x.url) ? x.url : x).filter(Boolean);
    if (current && urls.length) wx.previewImage({ current, urls });
  },

  /** 资质文件中的 PDF/文件：下载后打开或复制链接 */
  previewOrDownloadFile(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : (app.globalData.baseUrl || '') + (url.startsWith('/') ? url : '/' + url);
    wx.showLoading({ title: '加载中…' });
    wx.downloadFile({
      url: fullUrl,
      success(res) {
        wx.hideLoading();
        if (res.statusCode === 200 && res.tempFilePath) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fileType: (fullUrl || '').toLowerCase().includes('.pdf') ? 'pdf' : undefined,
            success() {
              wx.showToast({ title: '已打开', icon: 'success' });
            },
            fail(err) {
              wx.showToast({ title: err.errMsg || '打开失败', icon: 'none' });
            },
          });
        } else {
          wx.showToast({ title: '下载失败', icon: 'none' });
        }
      },
      fail() {
        wx.hideLoading();
        wx.setClipboardData({ data: fullUrl });
        wx.showToast({ title: '无法预览，链接已复制', icon: 'none' });
      },
    });
  },

  /**
   * 显示确认对话框
   */
  showConfirmDialog(message) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '提示',
        content: message,
        success: (res) => {
          resolve(res.confirm);
        },
        fail: () => {
          resolve(false);
        },
      });
    });
  },

  showLastActionError() {
    showLastActionError(this, 'lastActionError', '目标ID');
  },

});
