const app = getApp();

const TAB_TO_AUDIT_STATUS = {
  approved: 1,
  rejected: 2,
};

Page({
  data: {
    // 与库里「已通过」商品居多一致；「待审核」首屏在全是 audit_status=1 时会空列表，易被误认为接口坏
    activeTab: 'approved',
    keyword: '',
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    hasMore: true,
  },

  onLoad() {
    this.reload();
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 }, () => this.loadList());
  },

  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh());
  },

  onTabChange(e) {
    const tab = e.detail.name;
    this.setData({ activeTab: tab }, () => this.reload());
  },

  onKeywordChange(e) {
    const value = (e && e.detail != null)
      ? (typeof e.detail === 'string' ? e.detail : e.detail.value)
      : '';
    this.setData({ keyword: value || '' });
  },

  onSearch() {
    this.reload();
  },

  async reload() {
    // setData 非同步：须等回调后再请求，否则会仍用上一次的 hasMore=false，切换「已通过」时列表一直为空
    await new Promise(resolve => {
      this.setData({ page: 1, list: [], hasMore: true, total: 0 }, resolve);
    });
    return this.loadList();
  },

  async loadList() {
    if (this.data.loading) return;
    // 仅「加载更多」受 hasMore 限制；第 1 页永远允许请求（与 reload 配合避免 Tab 切换被短路）
    if (this.data.page > 1 && !this.data.hasMore) return;
    this.setData({ loading: true });

    const tab = this.data.activeTab;
    const auditRaw = TAB_TO_AUDIT_STATUS[tab];
    if (auditRaw === undefined) {
      wx.showToast({ title: 'Tab 状态异常', icon: 'none' });
      this.setData({ loading: false });
      return;
    }
    // GET 序列化：避免 number 0 在个别环境下被省略，统一用字符串保证 audit_status 必传到后端
    const audit_status = String(auditRaw);
    let keyword = (this.data.keyword || '').trim();
    if (keyword === 'undefined' || keyword === 'null') keyword = '';

    try {
      const res = await app.request({
        url: '/api/admin/products',
        method: 'GET',
        needAuth: true,
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
          audit_status,
          ...(keyword ? { keyword } : {}),
        },
      });

      const raw = Array.isArray(res.list) ? res.list : [];
      const list = raw.map(p => {
        let firstImg = p.cover_image;
        if (!firstImg && p.images) {
          if (Array.isArray(p.images)) firstImg = p.images[0];
          else if (typeof p.images === 'string') {
            try { const arr = JSON.parse(p.images); firstImg = arr && arr[0]; } catch (_) {}
          }
        }
        return {
          ...p,
          coverUrl: app.fullImageUrl(firstImg) || '',
          merchantNickname: p.merchant ? p.merchant.nickname : '',
        };
      });

      this.setData({
        list: this.data.page === 1 ? list : [ ...this.data.list, ...list ],
        total: res.total || 0,
        hasMore: list.length >= this.data.pageSize,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async onRecommendChange(e) {
    const id = e.currentTarget.dataset.id;
    const checked = !!e.detail;
    try {
      await app.request({
        url: `/api/admin/products/${id}/recommend`,
        method: 'POST',
        needAuth: true,
        data: { is_recommend: checked },
      });
      wx.showToast({ title: checked ? '已推荐' : '已取消推荐', icon: 'success' });
      this.reload();
    } catch (err) {
      wx.showToast({ title: err.message || '设置失败', icon: 'none' });
      this.reload();
    }
  },
});

