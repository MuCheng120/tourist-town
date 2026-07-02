// 管理端 - 数据分析（游客流量、消费数据、商户经营，折线/柱状/饼图，日报/周报/月报）
const app = getApp();

/** 路径片段 → 中文（完整路径未收录时按段拼装） */
const ROUTE_SEGMENT_CN = {
  scenic: '景点',
  hotel: '酒店',
  order: '订单',
  orders: '订单',
  mall: '特产商城',
  product: '商品',
  products: '商品',
  coupon: '优惠券',
  user: '用户',
  users: '用户',
  merchant: '商户',
  merchants: '商户',
  dashboard: '工作台',
  audit: '内容审核',
  posts: '攻略',
  banners: '轮播图',
  announcements: '公告',
  analysis: '数据分析',
  verify: '核销',
  credit: '信用',
  violate: '违规',
  ship: '发货',
  shop: '店铺',
  messages: '消息',
  'room-types': '房型',
  'admin-users': '管理员',
  'merchant-apply': '商家入驻',
  forgot: '忘记密码',
  register: '注册',
  login: '登录',
  profile: '个人资料',
  center: '中心',
  list: '列表',
  detail: '详情',
  edit: '编辑',
  confirm: '确认',
  review: '评价',
  publish: '发布',
  my: '我的',
  footprint: '足迹',
  favorite: '收藏',
  address: '地址',
  cart: '购物车',
  notice: '公告',
  community: '攻略社区',
  webview: '网页',
  'cancel-account': '注销账号',
  calendar: '日历',
  'facility-policy': '设施政策',
  'room-detail': '房型',
};

/** 小程序页面路径 → 中文名（与 app.json、行为日志 page_path 一致） */
const PAGE_TITLE_MAP = {
  'pages/index/index': '首页',
  'pages/scenic/index': '景点列表',
  'pages/scenic/detail': '景点详情',
  'pages/scenic/confirm': '门票确认',
  'pages/mall/index': '特产商城',
  'pages/product/detail': '商品详情',
  'pages/hotel/index': '酒店列表',
  'pages/hotel/detail': '酒店详情',
  'pages/hotel/calendar': '酒店日历',
  'pages/hotel/room-detail': '房型详情',
  'pages/hotel/confirm': '酒店下单',
  'pages/hotel/facility-policy': '设施政策',
  'pages/community/index': '旅游攻略',
  'pages/community/detail': '攻略详情',
  'pages/community/publish': '发布攻略',
  'pages/community/my': '我的攻略',
  'pages/order/list': '订单列表',
  'pages/order/detail': '订单详情',
  'pages/order/confirm': '订单确认',
  'pages/order/review': '订单评价',
  'pages/coupon/index': '我的优惠券',
  'pages/coupon/center': '领券中心',
  'pages/cart/index': '购物车',
  'pages/favorite/index': '我的收藏',
  'pages/address/index': '收货地址',
  'pages/address/edit': '编辑收货地址',
  'pages/notice/index': '系统公告',
  'pages/user/index': '我的',
  'pages/user/profile': '个人资料',
  'pages/user/cancel-account': '注销账号',
  'pages/login/index': '登录',
  'pages/forgot/index': '忘记密码',
  'pages/register/index': '注册',
  'pages/footprint/index': '我的足迹',
  'pages/merchant-apply/index': '商家入驻',
  'pages/webview/index': '内置网页',
  'admin/pages/dashboard/index': '管理后台·工作台',
  'admin/pages/audit/index': '管理后台·内容审核',
  'admin/pages/posts/index': '管理后台·攻略管理',
  'admin/pages/merchants/index': '管理后台·商户列表',
  'admin/pages/merchants/detail': '管理后台·商户详情',
  'admin/pages/users/index': '管理后台·用户管理',
  'admin/pages/coupon/index': '管理后台·优惠券',
  'admin/pages/coupon/detail': '管理后台·优惠券详情',
  'admin/pages/hotel/index': '管理后台·酒店管理',
  'admin/pages/hotel/edit': '管理后台·编辑酒店',
  'admin/pages/hotel/room-types': '管理后台·酒店房型',
  'admin/pages/products/index': '管理后台·商品管理',
  'admin/pages/banners/index': '管理后台·轮播图',
  'admin/pages/banners/edit': '管理后台·编辑轮播',
  'admin/pages/scenic/index': '管理后台·景点管理',
  'admin/pages/scenic/edit': '管理后台·编辑景点',
  'admin/pages/orders/index': '管理后台·订单管理',
  'admin/pages/verify/index': '管理后台·核销管理',
  'admin/pages/credit/index': '管理后台·信用管理',
  'admin/pages/credit/detail': '管理后台·信用详情',
  'admin/pages/credit/violate': '管理后台·违规处理',
  'admin/pages/announcements/index': '管理后台·公告管理',
  'admin/pages/admin-users/index': '管理后台·管理员账号',
  'admin/pages/analysis/index': '管理后台·数据分析',
  'merchant/pages/dashboard/index': '商家端·工作台',
  'merchant/pages/orders/index': '商家端·订单',
  'merchant/pages/ship/index': '商家端·发货',
  'merchant/pages/verify/index': '商家端·核销',
  'merchant/pages/shop/edit': '商家端·编辑店铺',
  'merchant/pages/messages/index': '商家端·消息',
  'merchant/pages/coupon/index': '商家端·优惠券',
  'merchant/pages/credit/index': '商家端·信用',
  'merchant/pages/products/index': '商家端·商品',
  'merchant/pages/products/edit': '商家端·编辑商品',
};

function resolvePageTitle(page_path) {
  const p = String(page_path || '').trim().replace(/^\//, '');
  if (!p) return '未知页面';
  if (PAGE_TITLE_MAP[p]) return PAGE_TITLE_MAP[p];

  let prefix = '';
  let rest = p;
  if (p.startsWith('admin/pages/')) {
    prefix = '管理后台';
    rest = p.slice('admin/pages/'.length);
  } else if (p.startsWith('merchant/pages/')) {
    prefix = '商家端';
    rest = p.slice('merchant/pages/'.length);
  } else if (p.startsWith('pages/')) {
    rest = p.slice('pages/'.length);
  }

  const segs = rest.split('/').filter(Boolean).filter(s => s !== 'index');
  const parts = segs.map(s => ROUTE_SEGMENT_CN[s] || s);
  const tail = parts.length ? parts.join('·') : '首页';
  return prefix ? `${prefix}·${tail}` : tail;
}

let echarts = null;
try {
  // 官方推荐接入：使用 ec-canvas 同目录的 echarts.js（小程序兼容构建）
  echarts = require('../../../components/ec-canvas/echarts');
} catch (e) {
  console.warn('ec-canvas/echarts.js not found, charts will be disabled');
}

Page({
  data: {
    loading: true,
    reportType: 'daily', // daily | weekly | monthly | yearly
    detailType: 'merchant', // merchant | scenic | hotel
    overview: null,
    report: null,
    behaviorLoading: false,
    behaviorStats: null,
    behaviorPageList: [],
    behaviorEmpty: true,
    echarts,
    ecTraffic: null,
    ecCategory: null,
    ecScenic: null,
    ecHotel: null,
    ecBehaviorTrend: null,
    ecBehaviorPageStay: null,
    ecMerchant: null,
    chartAvailable: !!echarts,
    qualityMetrics: {
      refundRate: 0,
      verifyRate: 0,
      repurchaseRate: 0,
    },
  },

  onLoad() {
    this.loadOverview();
    this.loadReport(this.data.reportType);
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadOverview(),
      this.loadReport(this.data.reportType),
    ]).then(() => wx.stopPullDownRefresh());
  },

  async loadOverview() {
    try {
      const overview = await app.request({ url: '/api/statistics/overview', method: 'GET', needAuth: true });
      this.setData({ overview: overview || {} }, () => this.computeQualityMetrics());
    } catch (e) {
      this.setData({ overview: {} }, () => this.computeQualityMetrics());
    }
  },

  onReportTabChange(e) {
    const type = e.detail.name;
    if (type === this.data.reportType) return;
    this.setData({
      reportType: type,
      report: null,
      behaviorStats: null,
      ecTraffic: null,
      ecCategory: null,
      ecScenic: null,
      ecHotel: null,
      ecMerchant: null,
      ecBehaviorTrend: null,
      ecBehaviorPageStay: null,
      behaviorPageList: [],
      behaviorEmpty: true,
      chartAvailable: !!echarts,
      loading: true,
    });
    this.loadReport(type);
  },

  onDetailTabChange(e) {
    const type = e.detail.name;
    if (type === this.data.detailType) return;
    this.setData({
      detailType: type,
    });
  },



  async loadReport(type) {
    this.setData({ loading: true });
    try {
      const report = await app.request({
        url: '/api/statistics/report',
        method: 'GET',
        needAuth: true,
        data: { type },
      });
      if (!report) {
        this.setData({ report: null, loading: false });
        return;
      }
      this.setData({
        report,
        loading: false,
        chartAvailable: !!echarts,
        ecTraffic: { onInit: (canvas, width, height, dpr) => this.initTrafficChart(canvas, width, height, dpr, report) },
        ecCategory: { onInit: (canvas, width, height, dpr) => this.initCategoryChart(canvas, width, height, dpr, report) },
        ecScenic: { onInit: (canvas, width, height, dpr) => this.initScenicChart(canvas, width, height, dpr, report) },
        ecHotel: { onInit: (canvas, width, height, dpr) => this.initHotelChart(canvas, width, height, dpr, report) },
        ecMerchant: { onInit: (canvas, width, height, dpr) => this.initMerchantChart(canvas, width, height, dpr, report) },
      }, () => this.computeQualityMetrics());

      // 额外加载：用户行为统计（来自 user_behavior_logs 的聚合）
      if (report.dateRange && report.dateRange.start && report.dateRange.end) {
        await this.loadBehaviorStats(report.dateRange.start, report.dateRange.end);
      } else {
        this.setData({
          behaviorStats: null,
          ecBehaviorTrend: null,
          ecBehaviorPageStay: null,
          behaviorPageList: [],
          behaviorEmpty: true,
        });
      }
    } catch (e) {
      console.error('加载报表失败', e);
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ report: null, loading: false });
    }
  },



  computeQualityMetrics() {
    const overview = this.data.overview || {};
    const report = this.data.report || {};
    const todayOrders = Number(overview.today_orders || (overview.today && overview.today.orders) || 0);
    const totalOrders = Number(overview.total_orders || (overview.total && overview.total.orders) || 0);
    const refunded = Number(overview.refunded_orders || overview.refund_orders || 0);
    const verified = Number(overview.verified_orders || 0);
    const repayUsers = Number(overview.repurchase_users || 0);
    const totalUsers = Number(overview.total_users || 0);
    const reportRefund = Number(report.refund_count || 0);
    const baseOrders = totalOrders || todayOrders || 0;
    const refundNumerator = refunded || reportRefund;
    this.setData({
      qualityMetrics: {
        refundRate: baseOrders > 0 ? Math.round((refundNumerator / baseOrders) * 10000) / 100 : 0,
        verifyRate: baseOrders > 0 ? Math.round((verified / baseOrders) * 10000) / 100 : 0,
        repurchaseRate: totalUsers > 0 ? Math.round((repayUsers / totalUsers) * 10000) / 100 : 0,
      },
    });
  },

  async loadBehaviorStats(startDate, endDate) {
    this.setData({ behaviorLoading: true });
    try {
      const res = await app.request({
        url: '/api/behavior/statistics',
        method: 'GET',
        needAuth: true,
        data: { startDate, endDate, groupBy: 'day', pageLimit: 20 },
      });

      const stats = Array.isArray(res) ? res : (res.actionTrends || []);
      const pageRaw = Array.isArray(res) ? [] : (res.pageStats || []);
      const prepared = this.prepareBehaviorData(stats);
      const behaviorPageList = this.prepareBehaviorPageList(pageRaw);
      const behaviorEmpty =
        !(prepared.dates && prepared.dates.length) &&
        !behaviorPageList.length;

      this.setData({
        behaviorStats: prepared,
        behaviorPageList,
        behaviorEmpty,
        behaviorLoading: false,
        ecBehaviorTrend: { onInit: (canvas, width, height, dpr) => this.initBehaviorTrendChart(canvas, width, height, dpr, prepared) },
        ecBehaviorPageStay: { onInit: (canvas, width, height, dpr) => this.initBehaviorPageStayChart(canvas, width, height, dpr, behaviorPageList) },
      });
    } catch (e) {
      console.warn('加载用户行为统计失败', e);
      this.setData({
        behaviorStats: null,
        behaviorLoading: false,
        ecBehaviorTrend: null,
        ecBehaviorPageStay: null,
        behaviorPageList: [],
        behaviorEmpty: true,
      });
    }
  },

  prepareBehaviorData(stats) {
    // 输入：[{date,target_type,action_type,count}]（后端已按天聚合）
    const dateSet = new Set();
    const actionTotals = new Map();
    const dateActionCount = new Map(); // date -> Map(action -> count)

    for (const row of stats) {
      const date = row.date || '';
      const action = row.action_type || 'unknown';
      const cnt = parseInt(row.count, 10) || 0;
      if (!date) continue;

      dateSet.add(date);

      actionTotals.set(action, (actionTotals.get(action) || 0) + cnt);

      if (!dateActionCount.has(date)) dateActionCount.set(date, new Map());
      const m = dateActionCount.get(date);
      m.set(action, (m.get(action) || 0) + cnt);
    }

    const dates = Array.from(dateSet).sort();
    const allActions = Array.from(actionTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([a]) => a);

    // 趋势图最多展示前 5 个行为类型，避免过度拥挤
    const trendActions = allActions.slice(0, 5);
    const seriesByAction = trendActions.map(action => ({
      action,
      data: dates.map(d => (dateActionCount.get(d)?.get(action) || 0)),
      total: actionTotals.get(action) || 0,
    }));

    return { dates, seriesByAction };
  },

  prepareBehaviorPageList(rows) {
    return (rows || []).map(r => {
      const page_path = r.page_path || '';
      const pageTitle = resolvePageTitle(page_path);
      const enter_count = parseInt(r.enter_count, 10) || 0;
      const stay_samples = parseInt(r.stay_samples, 10) || 0;
      const avg_stay_seconds = parseInt(r.avg_stay_seconds, 10) || 0;
      const total_stay_seconds = parseInt(r.total_stay_seconds, 10) || 0;
      return {
        page_path,
        pageTitle,
        enter_count,
        stay_samples,
        avg_stay_seconds,
        total_stay_seconds,
        avgStayText: stay_samples > 0 ? `${avg_stay_seconds} 秒` : '—',
        totalStayText:
          total_stay_seconds > 0
            ? (total_stay_seconds < 60 ? `${total_stay_seconds} 秒` : `${Math.round(total_stay_seconds / 60)} 分`)
            : '—',
      };
    });
  },

  initChart(canvas, width, height, dpr, option) {
    if (!echarts) return null;
    try {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      canvas.setChart(chart);
      chart.setOption(option);
      return chart;
    } catch (err) {
      console.warn('echarts init failed in mini program', err);
      // 某些构建的 echarts 在小程序环境会触发 addEventListener 报错，自动降级为文本展示
      if (this.data.chartAvailable) {
        this.setData({
          chartAvailable: false,
          echarts: null,
          ecTraffic: null,
          ecConsumption: null,
          ecCategory: null,
          ecMerchant: null,
          ecBehaviorTrend: null,
          ecBehaviorPageStay: null,
        });
      }
      return null;
    }
  },

  initTrafficChart(canvas, width, height, dpr, report) {
    const t = report.traffic || {};
    const dates = (t.dates || []).map(d => (String(d).length > 10 ? d.slice(0, 10) : d));
    const option = {
      title: { text: '游客流量（仅游客端）', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      legend: { data: ['访问量(PV)', '访客数(UV)', '平均停留(秒)'], top: 28, textStyle: { fontSize: 11 } },
      grid: { left: 40, right: 24, bottom: 32, top: 56, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, rotate: dates.length > 7 ? 30 : 0 } },
      yAxis: [
        { type: 'value', name: 'PV/UV', axisLabel: { fontSize: 10 } },
        { type: 'value', name: '秒', axisLabel: { fontSize: 10 } },
      ],
      series: [
        { name: '访问量(PV)', type: 'line', data: t.page_views || [], smooth: true, itemStyle: { color: '#1989fa' } },
        { name: '访客数(UV)', type: 'line', data: t.unique_visitors || [], smooth: true, itemStyle: { color: '#07c160' } },
        { name: '平均停留(秒)', type: 'line', yAxisIndex: 1, data: t.avg_stay_seconds || [], smooth: true, itemStyle: { color: '#ff976a' } },
      ],
    };
    return this.initChart(canvas, width, height, dpr, option);
  },



  initCategoryChart(canvas, width, height, dpr, report) {
    const list = report.category || [];
    if (!list.length) {
      return this.initChart(canvas, width, height, dpr, { title: { text: '消费品类', left: 'center' }, series: [{ type: 'pie', radius: '60%', data: [{ name: '暂无', value: 1 }] }] });
    }
    const option = {
      title: { text: '消费品类（成交额）', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item', confine: true },
      legend: { orient: 'horizontal', bottom: 8, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '48%'],
        data: list.map(i => ({ name: i.name, value: i.value })),
        label: { fontSize: 11 },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
        },
      }],
    };
    return this.initChart(canvas, width, height, dpr, option);
  },



  initBehaviorTrendChart(canvas, width, height, dpr, prepared) {
    const dates = (prepared?.dates || []).map(d => (String(d).length > 10 ? d.slice(0, 10) : d));
    const seriesByAction = prepared?.seriesByAction || [];
    const legends = seriesByAction.map(s => s.action);

    const palette = [ '#1989fa', '#07c160', '#ff976a', '#ee0a24', '#7232dd' ];
    const series = seriesByAction.map((s, idx) => ({
      name: s.action,
      type: 'line',
      data: s.data || [],
      smooth: true,
      itemStyle: { color: palette[idx % palette.length] },
    }));

    const option = {
      title: { text: '用户行为趋势', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      legend: { data: legends, top: 28, textStyle: { fontSize: 11 } },
      grid: { left: 40, right: 18, bottom: 32, top: 56, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, rotate: dates.length > 7 ? 30 : 0 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: series.length ? series : [{ name: '暂无', type: 'line', data: [] }],
    };
    return this.initChart(canvas, width, height, dpr, option);
  },

  /** 各页面平均停留时间（秒），仅包含有停留样本的页面 */
  initBehaviorPageStayChart(canvas, width, height, dpr, pageList) {
    const withStay = (pageList || []).filter(p => p.stay_samples > 0 && p.avg_stay_seconds > 0);
    const sorted = [...withStay].sort((a, b) => b.avg_stay_seconds - a.avg_stay_seconds).slice(0, 10);
    const names = sorted.map(p => (p.pageTitle.length > 10 ? p.pageTitle.slice(0, 10) + '…' : p.pageTitle));
    const values = sorted.map(p => p.avg_stay_seconds);

    const option = {
      title: { text: '页面平均停留（秒）', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 24, bottom: 8, top: 56, containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      yAxis: {
        type: 'category',
        data: names.length ? names : [ '暂无' ],
        axisLabel: { fontSize: 10 },
        inverse: true,
      },
      series: [{
        type: 'bar',
        data: values.length ? values : [ 0 ],
        itemStyle: { color: '#7232dd' },
        label: { show: true, position: 'right', fontSize: 10 },
      }],
    };
    return this.initChart(canvas, width, height, dpr, option);
  },

  initScenicChart(canvas, width, height, dpr, report) {
    const scenicData = report.scenic || [];
    // 按景点分组，计算总成交额
    const scenicMap = {};
    scenicData.forEach(item => {
      if (!scenicMap[item.scenic_id]) {
        scenicMap[item.scenic_id] = {
          name: item.scenic_name,
          value: 0
        };
      }
      scenicMap[item.scenic_id].value += parseFloat(item.total_amount) || 0;
    });
    const data = Object.values(scenicMap).sort((a, b) => b.value - a.value).slice(0, 8);
    const names = data.map(item => item.name.slice(0, 6));
    const values = data.map(item => item.value);

    const option = {
      title: { text: '门票经营（成交额）', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: 56, right: 24, bottom: 40, top: 40, containLabel: true },
      xAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, rotate: 25 } },
      yAxis: { type: 'value', name: '元', axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: values, itemStyle: { color: '#07c160' } }],
    };
    return this.initChart(canvas, width, height, dpr, option);
  },

  initHotelChart(canvas, width, height, dpr, report) {
    const hotelData = report.hotel || [];
    // 按酒店分组，计算总成交额
    const hotelMap = {};
    hotelData.forEach(item => {
      if (!hotelMap[item.hotel_id]) {
        hotelMap[item.hotel_id] = {
          name: item.hotel_name,
          value: 0
        };
      }
      hotelMap[item.hotel_id].value += parseFloat(item.total_amount) || 0;
    });
    const data = Object.values(hotelMap).sort((a, b) => b.value - a.value).slice(0, 8);
    const names = data.map(item => item.name.slice(0, 6));
    const values = data.map(item => item.value);

    const option = {
      title: { text: '酒店经营（成交额）', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: 56, right: 24, bottom: 40, top: 40, containLabel: true },
      xAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, rotate: 25 } },
      yAxis: { type: 'value', name: '元', axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: values, itemStyle: { color: '#1989fa' } }],
    };
    return this.initChart(canvas, width, height, dpr, option);
  },

  initMerchantChart(canvas, width, height, dpr, report) {
    const merchantData = report.merchants || [];
    // 按商户分组，计算总成交额
    const data = merchantData.slice(0, 8).sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
    const names = data.map(item => (item.nickname || '商户').slice(0, 6));
    const values = data.map(item => item.total_amount || 0);

    const option = {
      title: { text: '商户经营（成交额）', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { 
        trigger: 'axis', 
        confine: true,
        formatter: (params) => {
          const p = params[0];
          const merchant = data[params[0].dataIndex];
          return `${p.name}<br/>${p.marker} ${p.seriesName}: ¥${p.value}<br/>订单量: ${merchant.order_count || 0}`;
        }
      },
      grid: { left: 56, right: 24, bottom: 40, top: 40, containLabel: true },
      xAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, rotate: 25 } },
      yAxis: { type: 'value', name: '元', axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: values, itemStyle: { color: '#f7ba2a' } }],
    };
    return this.initChart(canvas, width, height, dpr, option);
  },
});
