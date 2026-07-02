// pages/community/detail.js
const app = getApp();

Page({
  data: {
    post: null,
    comments: [],
    commentText: '',
    commentCanSubmit: false, // 有内容时可点击发送
    replyingTo: null,
    loading: false,
    isFavorited: false,
    isOwnPost: false, // 是否为自己的攻略（自己的不显示收藏按钮）
    readonly: false, // 只读模式：隐藏评论区/输入框（供管理端查看）
    // 评论分页
    commentPage: 1,
    hasMoreComments: true,
    loadingComments: false,
    // 评论展开状态
    expandedComments: {},
  },

  onLoad(options) {
    const readonly = options && (options.readonly === '1' || options.readonly === 'true');
    this.setData({ readonly });
    if (options.id) {
      this.loadPost(options.id);
      if (!readonly) this.loadComments(options.id);
    }
  },

  /**
   * 将 ISO 时间格式化为常规显示（如 2026-03-05 17:41）
   */
  formatPostTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  },

  /**
   * 加载攻略详情
   */
  async loadPost(id) {
    try {
      const res = await app.request({
        url: `/api/posts/${id}`,
        needAuth: true, // 带 token 以便后端返回当前用户是否已点赞，保证点赞按钮颜色一致
      });

      const currentUserId = (app.globalData.userInfo && app.globalData.userInfo.id) || null;
      const postUserId = res.user_id != null ? res.user_id : (res.user && res.user.id);
      const isOwnPost = !!currentUserId && (postUserId === currentUserId || postUserId === Number(currentUserId));
      const rawTime = res.created_at || res.createdAt;
      const post = {
        ...res,
        images: app.fullImageUrls(res.images || []),
        user: res.user ? { ...res.user, avatar: app.fullImageUrl(res.user.avatar) } : res.user,
        createdAt: this.formatPostTime(rawTime),
      };
      this.setData({ post, isOwnPost });
      if (!isOwnPost) this.loadCheckFavorite(id);
    } catch (error) {
      console.error('加载攻略失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    }
  },

  /**
   * 将多级评论树扁平化为带 depth 的列表（深度优先）
   */
  flattenCommentTree(nodes, depth = 0) {
    const list = [];
    const walk = (arr, d) => {
      if (!Array.isArray(arr)) return;
      arr.forEach(node => {
        list.push({ ...node, depth: d });
        if (node.replies && node.replies.length) walk(node.replies, d + 1);
      });
    };
    walk(nodes, depth);
    return list;
  },

  /**
   * 加载评论列表（树形结构）
   */
  async loadComments(postId, isLoadMore = false) {
    if (isLoadMore) {
      this.setData({ loadingComments: true });
    } else {
      this.setData({ loading: true, commentPage: 1, hasMoreComments: true });
    }

    try {
      const page = isLoadMore ? this.data.commentPage + 1 : 1;
      const res = await app.request({
        url: `/api/posts/${postId}/comments`,
        data: {
          page,
          limit: 10
        }
      });

      const currentUserId = (app.globalData.userInfo && app.globalData.userInfo.id) || null;
      const rawList = Array.isArray(res) ? res : (res.list || res.data || []);
      
      // 处理评论数据，保留树形结构（递归处理）
      const processComments = (comments, depth = 0) => {
        return comments.map(c => {
          const commentUserId = c.user_id != null ? c.user_id : (c.user && c.user.id);
          const isOwn = !!currentUserId && (commentUserId === currentUserId || commentUserId === Number(currentUserId));
          const processedComment = {
            ...c,
            depth: depth,
            user: c.user ? { ...c.user, avatar: app.fullImageUrl(c.user.avatar) } : c.user,
            reply_to_user: c.reply_to_user ? { ...c.reply_to_user, avatar: app.fullImageUrl(c.reply_to_user.avatar) } : c.reply_to_user,
            images: app.fullImageUrls(c.images || []),
            createdAt: this.formatPostTime(c.created_at || c.createdAt),
            isOwn,
            isLiked: c.isLiked || false,
          };
          
          // 递归处理回复
          if (c.replies && c.replies.length > 0) {
            processedComment.replies = processComments(c.replies, depth + 1);
          }
          
          return processedComment;
        });
      };
      
      const list = processComments(rawList);

      if (isLoadMore) {
        this.setData({
          comments: [...this.data.comments, ...list],
          commentPage: page,
          hasMoreComments: list.length >= 10,
          loadingComments: false
        });
      } else {
        this.setData({
          comments: list,
          commentPage: 1,
          hasMoreComments: list.length >= 10,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载评论失败:', error);
      if (isLoadMore) {
        this.setData({ loadingComments: false });
      } else {
        this.setData({ loading: false });
      }
    }
  },

  /**
   * 查询当前攻略是否已收藏（自己的攻略不展示收藏状态）
   */
  loadCheckFavorite(postId) {
    if (this.data.isOwnPost) {
      this.setData({ isFavorited: false });
      return;
    }
    if (!postId || !app.globalData.token) {
      this.setData({ isFavorited: false });
      return;
    }
    app.request({
      url: '/api/favorites/check',
      method: 'GET',
      data: { target_type: 'post', target_id: postId },
      needAuth: true,
    }).then(res => {
      this.setData({ isFavorited: res.favorited === true });
    }).catch(() => {
      this.setData({ isFavorited: false });
    });
  },

  /**
   * 切换收藏状态（自己的攻略不可收藏）
   */
  toggleFavorite() {
    if (this.data.isOwnPost) {
      wx.showToast({ title: '不能收藏自己的攻略', icon: 'none' });
      return;
    }
    const post = this.data.post;
    if (!post || !post.id) return;
    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后收藏',
        confirmText: '去登录',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/index' }); },
      });
      return;
    }
    const isFavorited = this.data.isFavorited;
    if (isFavorited) {
      app.request({
        url: `/api/favorites/post/${post.id}`,
        method: 'DELETE',
        needAuth: true,
      }).then(() => {
        wx.showToast({ title: '已取消收藏', icon: 'none' });
        this.setData({ isFavorited: false });
      }).catch(() => wx.showToast({ title: '取消失败', icon: 'none' }));
    } else {
      app.request({
        url: '/api/favorites',
        method: 'POST',
        needAuth: true,
        data: { target_type: 'post', target_id: post.id },
      }).then(() => {
        wx.showToast({ title: '已收藏', icon: 'success' });
        this.setData({ isFavorited: true });
      }).catch(() => wx.showToast({ title: '收藏失败', icon: 'none' }));
    }
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({
      current: url,
      urls: this.data.post.images,
    });
  },

  /**
   * 切换点赞状态
   */
  async toggleLike() {
    if (!this.data.post) return;

    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '点赞攻略需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }

    try {
      const res = await app.request({
        url: `/api/posts/${this.data.post.id}/like`,
        method: 'POST',
        needAuth: true,
      });

      if (res) {
        const post = { ...this.data.post };
        post.isLiked = res.isLiked;
        post.likes_count = res.likes_count || 0;
        this.setData({ post });

        // 通知首页下次显示时刷新热门攻略点赞数
        app.globalData.needRefreshRecommendPosts = true;
      }
    } catch (error) {
      console.error('点赞失败:', error);
    }
  },

  /**
   * 评论输入
   */
  onCommentInput(e) {
    if (this.data.readonly) return;
    const text = e.detail || '';
    this.setData({
      commentText: text,
      commentCanSubmit: text.trim().length > 0,
    });
  },

  /**
   * 递归查找评论树中的评论对象
   */
  findCommentById(comments, id) {
    for (let comment of comments) {
      if (comment.id === id || comment.id === Number(id)) {
        return comment;
      }
      if (comment.replies && comment.replies.length > 0) {
        const found = this.findCommentById(comment.replies, id);
        if (found) return found;
      }
    }
    return null;
  },

  /**
   * 递归更新评论树中的评论状态
   */
  updateCommentInTree(comments, id, updater) {
    return comments.map(comment => {
      if (comment.id === id || comment.id === Number(id)) {
        return updater(comment);
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: this.updateCommentInTree(comment.replies, id, updater)
        };
      }
      return comment;
    });
  },

  /**
   * 回复评论
   */
  replyComment(e) {
    if (this.data.readonly) return;
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '回复评论需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }
    const id = e.currentTarget.dataset.id;
    const comment = this.findCommentById(this.data.comments, id);
    if (!comment) return;
    this.setData({
      replyingTo: comment,
      commentText: `@${comment.user.nickname} `,
      commentCanSubmit: true,
    });
  },

  /**
   * 点击自己的评论内容：在页面底部弹出操作菜单（复制 / 删除）
   */
  toggleCommentMenu(e) {
    if (this.data.readonly) return;
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showActionSheet({
      itemList: [ '复制', '删除' ],
      success(res) {
        if (res.tapIndex === 0) {
          that.copyCommentById(id);
        } else if (res.tapIndex === 1) {
          that.deleteCommentById(id);
        }
      },
    });
  },

  /**
   * 按 id 复制评论内容
   */
  copyCommentById(id) {
    const comment = this.findCommentById(this.data.comments, id);
    if (!comment || !comment.content) return;
    wx.setClipboardData({
      data: comment.content,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      },
    });
  },

  /**
   * 按 id 删除评论（先确认再请求）
   */
  async deleteCommentById(id) {
    const comment = this.findCommentById(this.data.comments, id);
    if (!comment) return;
    const that = this;
    return new Promise((resolve, reject) => {
      wx.showModal({
        title: '提示',
        content: '确定要删除这条评论吗？',
        success: async (res) => {
          if (!res.confirm) {
            resolve();
            return;
          }
          try {
            await app.request({
              url: `/api/comments/${comment.id}`,
              method: 'DELETE',
              needAuth: true,
            });
            wx.showToast({ title: '已删除', icon: 'success' });
            const postId = that.data.post && that.data.post.id;
            if (postId) that.loadComments(postId);
            const post = that.data.post;
            if (post && post.comments_count > 0) {
              that.setData({
                'post.comments_count': post.comments_count - 1,
              });
            }
            resolve();
          } catch (error) {
            console.error('删除评论失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
            reject(error);
          }
        },
      });
    });
  },

  /**
   * 提交评论
   */
  async submitComment() {
    if (this.data.readonly) return;
    if (!this.data.commentText.trim()) {
      wx.showToast({
        title: '请输入评论内容',
        icon: 'none',
      });
      return;
    }

    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '发表评论需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }

    try {
      const data = {
        post_id: this.data.post.id,
        content: this.data.commentText,
      };

      if (this.data.replyingTo) {
        data.parent_id = this.data.replyingTo.id;
      }

      const res = await app.request({
        url: '/api/comments',
        method: 'POST',
        needAuth: true,
        data,
      });

      if (res) {
        wx.showToast({
          title: '评论成功',
          icon: 'success',
        });

        // 清空输入
        this.setData({
          commentText: '',
          commentCanSubmit: false,
          replyingTo: null,
        });

        // 重新加载评论
        this.loadComments(this.data.post.id);
      }
    } catch (error) {
      console.error('评论失败:', error);
      wx.showToast({
        title: error.message || '评论失败',
        icon: 'none',
      });
    }
  },

  /**
   * 点赞评论
   */
  async likeComment(e) {
    if (this.data.readonly) return;
    const { id } = e.currentTarget.dataset;

    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '点赞评论需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }

    try {
      const res = await app.request({
        url: `/api/comments/${id}/like`,
        method: 'POST',
        needAuth: true,
      });

      if (res) {
        const comments = this.updateCommentInTree(this.data.comments, id, comment => ({
          ...comment,
          isLiked: !comment.isLiked,
          likes_count: comment.isLiked ? Math.max((comment.likes_count || 0) - 1, 0) : (comment.likes_count || 0) + 1,
        }));
        this.setData({ comments });
      }
    } catch (error) {
      console.error('点赞评论失败:', error);
    }
  },

  /**
   * 滑到底部加载更多评论
   */
  onReachBottom() {
    if (this.data.hasMoreComments && !this.data.loadingComments && this.data.post) {
      this.loadComments(this.data.post.id, true);
    }
  },

  /**
   * 切换评论展开/折叠状态
   */
  toggleCommentExpand(e) {
    const { id } = e.currentTarget.dataset;
    const expandedComments = { ...this.data.expandedComments };
    expandedComments[id] = !expandedComments[id];
    this.setData({ expandedComments });
  },
});
