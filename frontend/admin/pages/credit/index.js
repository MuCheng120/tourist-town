// 管理端信用管理页面
const app = getApp()

Page({
  data: {
    activeTab: 'list',
    statistics: {
      levelStats: [],
      statusStats: [],
      avgScore: '0'
    },
    merchants: [],
    loading: false,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    filters: {
      level: '',
      status: '',
      violationStatus: ''
    },
    filterIndex: {
      level: 0,
      status: 0,
      violationStatus: 0
    },
    levelOptions: ['', 'S', 'A', 'B', 'C'],
    statusOptionLabels: ['全部', '正常', '警告', '限流', '暂停营业', '已注销'],
    statusOptions: ['', 'normal', 'warning', 'limited', 'suspended', 'revoked'],
    violationStatusOptionLabels: ['全部违规', '有生效处罚', '仅已解除', '无违规'],
    violationStatusOptions: ['', 'active', 'resolved', 'none'],
    levelColorMap: {
      S: '#ff4d4f',
      A: '#faad14',
      B: '#52c41a',
      C: '#1890ff'
    },
    statusTextMap: {
      normal: '正常',
      warning: '警告',
      limited: '限流',
      suspended: '暂停营业',
      revoked: '已注销'
    }
  },

  onLoad() {
    this.loadStatistics()
    this.loadMerchants()
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    
    if (tab === 'list') {
      this.loadMerchants(true)
    } else if (tab === 'statistics') {
      this.loadStatistics()
    }
  },

  // 加载统计数据
  async loadStatistics() {
    try {
      const data = await app.request({
        url: '/api/merchant-credit/statistics',
        method: 'GET',
        needAuth: true,
      })

      const fallback = {
        levelStats: [],
        statusStats: [],
        avgScore: '0'
      }
      const source = data || fallback
      const levelColorMap = this.data.levelColorMap || {}
      const statusTextMap = this.data.statusTextMap || {}
      const statusTotal = (source.statusStats || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0)
      const levelStats = (source.levelStats || []).map(item => ({
        ...item,
        levelColor: levelColorMap[item.level] || '#999'
      }))
      const statusStats = (source.statusStats || []).map(item => {
        const count = Number(item.count) || 0
        const percent = statusTotal > 0 ? Math.round((count / statusTotal) * 10000) / 100 : 0
        return {
          ...item,
          count,
          statusText: statusTextMap[item.status] || item.status || '未知',
          percent
        }
      })

      this.setData({
        statistics: {
          ...source,
          levelStats,
          statusStats,
          avgScore: source.avgScore || '0'
        }
      })
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  },

  // 加载商户列表
  async loadMerchants(refresh = false) {
    if (this.data.loading) return

    if (refresh) {
      this.setData({ page: 1, merchants: [] })
    }

    this.setData({ loading: true })

    try {
      const query = {
        page: this.data.page,
        pageSize: this.data.pageSize,
      }
      if (this.data.filters.level) query.level = this.data.filters.level
      if (this.data.filters.status) query.status = this.data.filters.status

      const data = await app.request({
        url: '/api/merchant-credit/list',
        method: 'GET',
        needAuth: true,
        data: query
      })

      const rawList = data.list || []
      const merchants = rawList.map(item => ({
        ...item,
        merchant: item.merchant ? { ...item.merchant, avatar: app.fullImageUrl(item.merchant.avatar) } : item.merchant,
        levelColor: (this.data.levelColorMap && this.data.levelColorMap[item.credit_level]) || '#999',
        statusText: (this.data.statusTextMap && this.data.statusTextMap[item.status]) || item.status,
        riskTag: this.getRiskTag(item)
      }))
      const violationStatus = this.data.filters.violationStatus
      const filteredMerchants = merchants.filter(item => {
        if (!violationStatus) return true
        const count = Number(item.violation_count) || 0
        if (violationStatus === 'none') return count === 0
        if (violationStatus === 'active') return count > 0 && item.status !== 'normal'
        if (violationStatus === 'resolved') return count > 0 && item.status === 'normal'
        return true
      })
      this.setData({
        merchants: refresh ? filteredMerchants : [...this.data.merchants, ...filteredMerchants],
        total: data.total || 0,
        hasMore: merchants.length === this.data.pageSize,
        loading: false
      })
    } catch (error) {
      console.error('加载商户列表失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 筛选条件变化
  onFilterChange(e) {
    const { field } = e.currentTarget.dataset
    const index = Number(e.detail.value) || 0
    const optionMap = {
      level: this.data.levelOptions,
      status: this.data.statusOptions,
      violationStatus: this.data.violationStatusOptions
    }
    const options = optionMap[field] || []
    const value = options[index] || ''
    this.setData({
      [`filters.${field}`]: value,
      [`filterIndex.${field}`]: index
    })
    this.loadMerchants(true)
  },

  // 查看商户详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/admin/pages/credit/detail?id=${id}`
    })
  },

  // 更新信用等级
  async updateCreditLevel(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name

    const res = await wx.showModal({
      title: '确认更新',
      content: `确定要更新商户"${name}"的信用等级吗？`
    })

    if (!res.confirm) return

    try {
      wx.showLoading({ title: '更新中...' })
      await app.request({
        url: `/api/merchant-credit/${id}/update`,
        method: 'PUT',
        needAuth: true,
      })
      wx.hideLoading()

      wx.showToast({
        title: '更新成功',
        icon: 'success'
      })
      this.loadMerchants(true)
    } catch (error) {
      wx.hideLoading()
      console.error('更新失败:', error)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  // 记录违规
  recordViolation(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    wx.navigateTo({
      url: `/admin/pages/credit/violate?id=${id}&name=${name}`
    })
  },

  // 批量更新所有商户
  async batchUpdate() {
    const res = await wx.showModal({
      title: '确认批量更新',
      content: '确定要批量更新所有商户的信用等级吗？此操作可能需要较长时间。'
    })

    if (!res.confirm) return

    try {
      wx.showLoading({ title: '更新中...' })
      await app.request({
        url: '/api/merchant-credit/batch-update',
        method: 'POST',
        needAuth: true,
      })
      wx.hideLoading()

      wx.showToast({
        title: '批量更新成功',
        icon: 'success'
      })
      this.loadMerchants(true)
      this.loadStatistics()
    } catch (error) {
      wx.hideLoading()
      console.error('批量更新失败:', error)
      wx.showToast({
        title: '批量更新失败',
        icon: 'none'
      })
    }
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading && this.data.activeTab === 'list') {
      this.setData({ page: this.data.page + 1 })
      this.loadMerchants()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    Promise.all([
      this.loadStatistics(),
      this.loadMerchants(true)
    ]).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 获取等级徽章颜色
  getLevelColor(level) {
    const colors = {
      'S': '#ff4d4f',
      'A': '#faad14',
      'B': '#52c41a',
      'C': '#1890ff'
    }
    return colors[level] || '#999'
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'normal': '正常',
      'warning': '警告',
      'limited': '限流',
      'suspended': '暂停营业',
      'revoked': '已注销'
    }
    return statusMap[status] || status
  },

  getRiskTag(item) {
    const violationCount = Number(item.violation_count) || 0
    if (item.status === 'suspended' || item.status === 'revoked') return '高风险'
    if (violationCount >= 3) return '高风险'
    if (violationCount > 0) return '关注'
    return ''
  }
})
