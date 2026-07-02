// 管理端景点管理页面
const app = getApp()
const { formatDate: formatDateUtil } = require('../../../utils/date')

Page({
  data: {
    scenicSpots: [],
    loading: false,
    keyword: '',
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true
  },

  onLoad() {
    this.loadScenicSpots()
  },

  onShow() {
    const needRefresh = wx.getStorageSync('admin_scenic_need_refresh')
    if (needRefresh) {
      wx.removeStorageSync('admin_scenic_need_refresh')
      this.loadScenicSpots(true)
    }
  },

  // 加载景点列表
  async loadScenicSpots(refresh = false) {
    if (this.data.loading) return

    if (refresh) {
      this.setData({ page: 1, scenicSpots: [] })
    }

    this.setData({ loading: true })

    try {
      const res = await app.request({
        url: '/api/admin/scenic-spots',
        method: 'GET',
        needAuth: true,
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
          keyword: this.data.keyword
        }
      })

      const data = res.data || res
      const rawList = data.list || []
      const spots = rawList.map(s => ({
        ...s,
        cover_image: app.fullImageUrl(s.cover_image),
        created_at_text: formatDateUtil(s.createdAt || s.created_at, '--'),
      }))
      this.setData({
        scenicSpots: refresh ? spots : [...this.data.scenicSpots, ...spots],
        total: data.total != null ? data.total : 0,
        hasMore: spots.length === this.data.pageSize,
        loading: false
      })
    } catch (error) {
      console.error('加载景点列表失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 搜索景点
  onSearch(e) {
    this.setData({ keyword: e.detail.value })
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.loadScenicSpots(true)
    }, 500)
  },

  // 新增景点
  goToAdd() {
    wx.navigateTo({
      url: '/admin/pages/scenic/edit'
    })
  },

  // 编辑景点
  goToEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/admin/pages/scenic/edit?id=${id}`
    })
  },

  // 删除景点
  async deleteSpot(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name

    const res = await wx.showModal({
      title: '确认删除',
      content: `确定要删除景点"${name}"吗？`
    })

    if (!res.confirm) return

    try {
      const deleteRes = await app.request({
        url: `/api/scenic-spots/${id}`,
        method: 'DELETE',
        needAuth: true,
      })

      if (deleteRes.code === 200 || deleteRes.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        this.loadScenicSpots(true)
      }
    } catch (error) {
      console.error('删除景点失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    }
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 })
      this.loadScenicSpots()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadScenicSpots(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  formatDate(dateStr) {
    return formatDateUtil(dateStr, '--')
  }
})
