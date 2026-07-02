// pages/community/my.js
const app = getApp();

Page({
  data: {
    activeTab: 0,
    tabs: ['已发布', '草稿', '审核中', '未通过'],
    posts: [],
    loading: false,
    hasMore: true,
  },

  onLoad() {
    this.loadMyPosts();
  },

  onShow() {
    // 页面显示时刷新
    if (this.data.posts.length > 0) {
      this.loadMyPosts();
    }
  },

  onPullDownRefresh() {
    this.setData({
      posts: [],
      hasMore: true,
    });
    this.loadMyPosts().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMorePosts();
    }
  },

  /**
   * 切换标签
   */
  onTabChange(e) {
    const index = e.detail.index;
    this.setData({
      activeTab: index,
      posts: [],
      hasMore: true,
    });
    this.loadMyPosts();
  },

  /**
   * 加载我的攻略
   */
  async loadMyPosts() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const tab = this.data.activeTab;
      const status = tab === 0 ? 'published' : 'draft';
      // 方案B：草稿箱按 audit_status 分 Tab
      // 3 草稿未提交；0 审核中；2 未通过；已发布单独走 status=published
      const auditStatus =
        tab === 1 ? 3 :
        tab === 2 ? 0 :
        tab === 3 ? 2 :
        undefined;
      
      const res = await app.request({
        url: '/api/posts/my',
        method: 'GET',
        needAuth: true,  // 需要带上 token
        data: {
          status,
          ...(auditStatus !== undefined ? { audit_status: auditStatus } : {}),
          page: 1,
          pageSize: 10,
        },
      });

      const rawList = res.list || [];
      const posts = rawList.map(p => ({ ...p, images: app.fullImageUrls(p.images || []) }));
      this.setData({
        posts,
        hasMore: res.hasMore || false,
      });
    } catch (error) {
      console.error('加载攻略失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载更多
   */
  async loadMorePosts() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const tab = this.data.activeTab;
      const status = tab === 0 ? 'published' : 'draft';
      const auditStatus =
        tab === 1 ? 3 :
        tab === 2 ? 0 :
        tab === 3 ? 2 :
        undefined;
      const page = Math.floor(this.data.posts.length / 10) + 1;
      
      const res = await app.request({
        url: '/api/posts/my',
        method: 'GET',
        needAuth: true,  // 需要带上 token
        data: {
          status,
          ...(auditStatus !== undefined ? { audit_status: auditStatus } : {}),
          page,
          pageSize: 10,
        },
      });

      // app.request() 已经解析了响应，res 是 { list, hasMore }
      this.setData({
        posts: [...this.data.posts, ...(res.list || [])],
        hasMore: res.hasMore || false,
      });
    } catch (error) {
      console.error('加载更多失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 去发布：跳转到发布攻略页
   */
  goPublish() {
    wx.navigateTo({ url: '/pages/community/publish' });
  },

  /**
   * 查看攻略详情
   */
  viewPost(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/community/detail?id=${id}`,
    });
  },

  /**
   * 编辑攻略（仅草稿）
   */
  editPost(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/community/publish?id=${id}`,
    });
  },

  /**
   * 隐藏攻略（已发布后在攻略列表不可见）
   */
  async hidePost(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await app.request({
        url: `/api/posts/${id}/hide`,
        method: 'POST',
        needAuth: true,
      });
      wx.showToast({ title: '已隐藏', icon: 'success' });
      app.globalData.needRefreshRecommendPosts = true;
      app.globalData.needRefreshCommunityPosts = true;
      this.loadMyPosts();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  /**
   * 解除隐藏
   */
  async unhidePost(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await app.request({
        url: `/api/posts/${id}/unhide`,
        method: 'POST',
        needAuth: true,
      });
      wx.showToast({ title: '已解除隐藏', icon: 'success' });
      app.globalData.needRefreshRecommendPosts = true;
      app.globalData.needRefreshCommunityPosts = true;
      this.loadMyPosts();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  /**
   * 删除攻略
   */
  deletePost(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '提示',
      content: '确定要删除这篇攻略吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.request({
              url: `/api/posts/${id}`,
              method: 'DELETE',
            });

            wx.showToast({
              title: '删除成功',
              icon: 'success',
            });

            // 刷新列表
            this.loadMyPosts();
          } catch (error) {
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none',
            });
          }
        }
      },
    });
  },

  /**
   * 发布草稿
   */
  async publishDraft(e) {
    const { id } = e.currentTarget.dataset;
    
    try {
      const post = await app.request({
        url: `/api/posts/${id}/publish`,
        method: 'POST',
      });

      wx.showToast({
        title: (post && post.status === 1 && post.audit_status === 1) ? '已发布' : '已提交审核',
        icon: 'success',
      });

      // 刷新列表
      this.loadMyPosts();
    } catch (error) {
      wx.showToast({
        title: error.message || '发布失败',
        icon: 'none',
      });
    }
  },
});
