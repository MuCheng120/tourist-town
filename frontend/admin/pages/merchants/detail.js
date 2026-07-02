// 管理员 - 商户完整信息（含资质、证照、文件）
const app = getApp();

Page({
  data: {
    id: null,
    detail: null,
    loading: true,
    error: '',
    // 解析后的图片/文件列表（已拼 fullUrl）
    licenseImages: [],
    qualificationFiles: [],
    idcardFront: '',
    idcardBack: '',
  },

  onLoad(options) {
    const id = options.id ? parseInt(options.id, 10) : null;
    if (!id) {
      this.setData({ loading: false, error: '缺少商户ID' });
      return;
    }
    this.setData({ id });
    this.loadDetail(id);
  },

  async loadDetail(id) {
    this.setData({ loading: true, error: '' });
    try {
      const res = await app.request({
        url: `/api/admin/merchants/${id}`,
        method: 'GET',
        needAuth: true,
      });
      const data = res.data || res;
      const baseUrl = app.globalData.baseUrl || '';
      const full = url => {
        if (!url || typeof url !== 'string') return '';
        if (url.startsWith('http')) return url;
        return baseUrl + (url.startsWith('/') ? url : '/' + url);
      };
      const licenseImages = (data.license_images || []).map(full).filter(Boolean);
      const qualificationFiles = (data.qualification_images || []).map(full).filter(Boolean);
      const detail = {
        ...data,
        avatar: data.avatar ? full(data.avatar) : '',
        created_at: data.created_at ? String(data.created_at).slice(0, 19).replace('T', ' ') : '',
        last_login_at: data.last_login_at ? String(data.last_login_at).slice(0, 19).replace('T', ' ') : '-',
        shopStatusText: { normal: '正常', suspended: '暂停营业', limited: '限流', revoked: '已注销' }[data.shop_status] || data.shop_status,
        accountStatusText: { active: '正常', banned: '已封禁', inactive: '未激活', cancelled: '已注销' }[data.status] || data.status,
        orderCompletionRate: data.order_completion_rate != null ? Math.round((data.order_completion_rate || 0) * 100) : '-',
      };
      this.setData({
        detail,
        licenseImages,
        qualificationFiles,
        idcardFront: data.idcard_front ? full(data.idcard_front) : '',
        idcardBack: data.idcard_back ? full(data.idcard_back) : '',
        loading: false,
      });
    } catch (e) {
      this.setData({
        loading: false,
        error: e.message || '加载失败',
      });
    }
  },

  /** 图片预览（营业执照、身份证等） */
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls || (url ? [url] : []);
    if (url && urls.length) wx.previewImage({ current: url, urls });
  },

  /**
   * 资质文件：图片则预览，PDF/其他则下载后打开预览；失败则复制链接
   */
  previewOrDownloadFile(e) {
    const url = e.currentTarget.dataset.url;
    const allUrls = e.currentTarget.dataset.urls || (url ? [url] : []);
    if (!url) return;

    const isImage = /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(url);
    if (isImage) {
      wx.previewImage({ current: url, urls: allUrls.length ? allUrls : [url] });
      return;
    }

    wx.showLoading({ title: '加载中…' });
    wx.downloadFile({
      url,
      success(res) {
        wx.hideLoading();
        if (res.statusCode === 200 && res.tempFilePath) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fileType: url.toLowerCase().includes('.pdf') ? 'pdf' : undefined,
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
      fail(err) {
        wx.hideLoading();
        wx.setClipboardData({ data: url });
        wx.showToast({ title: '无法预览，链接已复制', icon: 'none' });
      },
    });
  },

  /** 复制链接（备用） */
  copyFileLink(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.setClipboardData({ data: url });
    wx.showToast({ title: '链接已复制', icon: 'none' });
  },
});
