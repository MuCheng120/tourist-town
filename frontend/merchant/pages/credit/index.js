// 商户端信用等级页面
const app = getApp()
const { formatDate: formatDateUtil } = require('../../../utils/date')

Page({
  data: {
    creditInfo: null,
    orderCompletionRateText: '--',
    lastLevelUpdateText: '--',
    violations: [],
    loading: true,
    levelColors: {
      'S': '#FFD700', // 金色
      'A': '#C0C0C0', // 银色
      'B': '#CD7F32', // 铜色
      'C': '#808080'  // 灰色
    },
    levelDescs: {
      'S': '卓越 - 首页推荐位 + 优先展示',
      'A': '优秀 - 首页推荐位',
      'B': '良好 - 正常展示',
      'C': '待提升 - 降权展示'
    }
  },

  onLoad() {
    this.loadCreditInfo()
    this.loadViolations()
  },

  /**
   * 加载信用信息（app.request 成功时 resolve 的是 res.data.data，即信用对象）
   * @param {{ silent?: boolean }} opts - silent 为 true 时不改 loading（用于手动刷新，避免整卡收起造成「卡住」感）
   */
  async loadCreditInfo(opts = {}) {
    const silent = !!(opts && opts.silent)
    try {
      const data = await app.request({
        url: '/api/merchant/my-credit',
        method: 'GET',
        needAuth: true,
      })

      const rate = data && data.order_completion_rate
      const rateText = rate != null ? (rate * 100).toFixed(1) + '%' : '--'
      const lastUpdate = data && (data.last_level_update || data.lastLevelUpdate)
      const lastLevelUpdateText = formatDateUtil(lastUpdate, '--')
      const patch = {
        creditInfo: data || null,
        orderCompletionRateText: rateText,
        lastLevelUpdateText,
      }
      if (!silent) {
        patch.loading = false
      }
      this.setData(patch)
    } catch (error) {
      console.error('加载信用信息失败:', error)
      if (!silent) {
        this.setData({ loading: false })
      }
      wx.showToast({
        title: (error && error.message) || '加载失败',
        icon: 'none'
      })
      if (silent) {
        throw error
      }
    }
  },

  // 加载违规记录（app.request 成功时 resolve 的是 res.data.data，即违规列表）
  async loadViolations() {
    try {
      const merchantId = wx.getStorageSync('userInfo').id
      const list = await app.request({
        url: `/api/merchant-credit/${merchantId}/violations`,
        method: 'GET',
        needAuth: true,
      })
      const raw = Array.isArray(list) ? list : []
      // 在 JS 中格式化处罚时间（WXML 无法调用 Page 方法）；兼容 created_at / createdAt
      const violations = raw.map(item => ({
        ...item,
        punishmentTime: formatDateUtil(item.created_at || item.createdAt, '--')
      }))
      this.setData({ violations })
    } catch (error) {
      console.error('加载违规记录失败:', error)
      this.setData({ violations: [] })
    }
  },

  // 刷新数据：不用页面 loading 收起卡片，改用微信 loading，并同步刷新违规列表
  async onRefresh() {
    wx.showLoading({ title: '刷新中', mask: true })
    try {
      await Promise.all([
        this.loadCreditInfo({ silent: true }),
        this.loadViolations(),
      ])
      wx.showToast({ title: '已更新', icon: 'success', duration: 1500 })
    } catch (e) {
      // 信用接口失败时 loadCreditInfo 已 toast 并 throw，此处不再弹窗
    } finally {
      wx.hideLoading()
    }
  },

  // 查看信用说明
  showCreditDesc() {
    wx.showModal({
      title: '信用等级说明',
      content: '信用等级基于游客评分（40%）和订单完成率（60%）综合计算。每天凌晨2点自动更新。\n\nS级：90-100分\nA级：80-89分\nB级：70-79分\nC级：60-69分',
      showCancel: false
    })
  }
})
