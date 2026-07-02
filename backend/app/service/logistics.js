'use strict';

const Service = require('egg').Service;

class LogisticsService extends Service {
  normalizeAddressText(raw) {
    if (raw == null) return '';
    if (typeof raw === 'object') {
      const parts = [
        raw.provinceName || raw.province_name,
        raw.cityName || raw.city_name,
        raw.countyName || raw.county_name,
        raw.detailInfo || raw.detail_info,
      ].filter(Boolean);
      return parts.join('') || '';
    }
    const text = String(raw).trim();
    if (!text) return '';
    if (text[0] === '{' || text[0] === '[') {
      try {
        const parsed = JSON.parse(text);
        return this.normalizeAddressText(parsed);
      } catch (e) {
        return text;
      }
    }
    return text;
  }

  /**
   * 模拟轨迹的时间基准：必须与真实发货时刻一致，否则每次刷新把「发货时间」当成当前时间会永远在第一步。
   */
  resolveShipBaseTime(order, logisticsRow) {
    if (order && order.shipped_at) return new Date(order.shipped_at);
    if (order && order.ship_time) return new Date(order.ship_time);
    if (logisticsRow && logisticsRow.created_at) return new Date(logisticsRow.created_at);
    return new Date();
  }

  /**
   * 本地生成模拟物流轨迹（用于演示：不依赖真实快递单号/快递100）
   * 采用小时/天级别节奏，避免几分钟内完成签收导致不真实。
   * @param {Object} opts
   * @param {String} opts.fromAddress 发货地址（商家经营地址）
   * @param {String} opts.toAddress 收货地址
   * @param {Date}   opts.shipTime 发货时间
   */
  generateMockTraces(opts = {}) {
    const fromAddress = String(opts.fromAddress || '').trim();
    const toAddress = String(opts.toAddress || '').trim();
    const shipTime = opts.shipTime instanceof Date ? opts.shipTime : new Date();

    const now = new Date();
    const base = shipTime.getTime();

    // 更真实的节奏：从揽收到签收通常需要 2-3 天
    const hour = 60 * 60 * 1000;
    const steps = [
      { offsetMs: 0, status: '已揽收', location: fromAddress || '商家发货点', context: '商家已打包，快递员已揽收' },
      { offsetMs: 4 * hour, status: '运输中', location: fromAddress || '发货地', context: '快件已发出，正发往转运中心' },
      { offsetMs: 10 * hour, status: '运输中', location: '转运中心', context: '快件到达转运中心，正在分拣' },
      { offsetMs: 26 * hour, status: '运输中', location: '目的地城市', context: '快件已到达目的地，等待派送' },
      { offsetMs: 36 * hour, status: '派送中', location: toAddress || '收货地', context: '快件正在派送中，请保持电话畅通' },
      { offsetMs: 48 * hour, status: '已签收', location: toAddress || '收货地', context: '快件已签收，感谢使用本平台' },
    ];

    const visible = steps
      .map(s => ({
        time: new Date(base + s.offsetMs),
        status: s.status,
        location: s.location,
        context: s.context,
      }))
      .filter(s => s.time.getTime() <= now.getTime())
      .map(s => ({
        time: this.formatTraceTime(s.time),
        status: s.status,
        location: s.location,
        context: s.context,
      }))
      .reverse(); // 按时间倒序展示（最新在前）

    // 若发货时间在未来/时间过早导致为空，至少给一条“已揽收”
    if (visible.length === 0) {
      const t = new Date(base);
      visible.unshift({
        time: this.formatTraceTime(t),
        status: '已揽收',
        location: fromAddress || '商家发货点',
        context: '商家已打包，快递员已揽收',
      });
    }

    return visible;
  }

  formatTraceTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /**
   * 创建物流信息（发货）
   * @param {Number} orderId - 订单ID
   * @param {String} company - 快递公司
   * @param {String} companyCode - 快递公司编码
   * @param {String} trackingNo - 快递单号
   */
  async createLogistics(orderId, company, companyCode, trackingNo) {
    const { ctx, app } = this;

    // 检查订单
    const order = await ctx.model.Order.findByPk(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }

    // 权限检查
    if (order.merchant_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权操作此订单');
    }

    if (order.status !== 'paid') {
      throw new Error('订单状态不正确，无法发货');
    }

    // 检查是否已有物流信息
    const existLogistics = await ctx.model.Logistics.findOne({
      where: { order_id: orderId },
    });

    if (existLogistics) {
      throw new Error('该订单已发货');
    }

    // 创建物流记录
    const logistics = await ctx.model.Logistics.create({
      order_id: orderId,
      company,
      company_code: companyCode,
      tracking_no: trackingNo,
      status: '已发货',
      traces: '[]',
      last_update: new Date(),
    });

    await order.update({
      status: 'shipped',
      shipped_at: new Date(),
    });

    return logistics;
  }

  /**
   * 查询物流轨迹
   * @param {Number} orderId - 订单ID
   */
  async getLogistics(orderId) {
    const { ctx, app } = this;

    const logistics = await ctx.model.Logistics.findOne({
      where: { order_id: orderId },
      include: [{
        model: ctx.model.Order,
        as: 'order',
      }],
    });

    if (!logistics) {
      throw new Error('物流信息不存在');
    }

    let traces = JSON.parse(logistics.traces || '[]');

    // 本地模拟：按更真实节奏推进，降低刷新频率避免状态跳变过快
    const cacheTime = 30 * 60 * 1000;
    const now = new Date();
    const lastUpdate = logistics.last_update ? new Date(logistics.last_update) : new Date(0);
    const diffTime = now - lastUpdate;

    if (diffTime > cacheTime || !Array.isArray(traces) || traces.length === 0) {
      const order = logistics.order;
      const toAddress = order ? this.normalizeAddressText(order.address_info) : '';

      // 发货地：优先取 merchant_ext.address（若无则给兜底文案）
      let fromAddress = '';
      if (order && order.merchant_id) {
        const ext = await ctx.model.MerchantExt.findOne({
          where: { merchant_id: order.merchant_id },
          attributes: [ 'address' ],
        });
        fromAddress = ext && ext.address ? String(ext.address).trim() : '';
      }

      traces = this.generateMockTraces({
        fromAddress,
        toAddress,
        shipTime: this.resolveShipBaseTime(order, logistics),
      });

      const latestStatus = traces[0] && traces[0].status ? traces[0].status : logistics.status;

      await logistics.update({
        traces: JSON.stringify(traces),
        status: latestStatus,
        last_update: new Date(),
      });

      if (latestStatus === '已签收') {
        this.scheduleOrderComplete(orderId);
      }
    }

    return {
      company: logistics.company,
      company_code: logistics.company_code,
      tracking_no: logistics.tracking_no,
      status: this.formatLogisticsStatusForDisplay(logistics.status),
      traces,
    };
  }

  /**
   * 翻译物流状态
   */
  translateStatus(state) {
    const key = state != null ? String(state) : '';
    const statusMap = {
      '0': '在途中',
      '1': '已发货',
      '2': '疑难',
      '3': '已签收',
      '4': '退签',
      '5': '同城派送中',
      '6': '退回',
    };
    return statusMap[key] || '未知';
  }

  /**
   * 接口/库里的原始状态转为用户可读中文（兼容历史英文、快递100数字码）
   */
  formatLogisticsStatusForDisplay(raw) {
    if (raw == null || raw === '') return '—';
    const s = String(raw).trim();
    if (/^\d+$/.test(s)) {
      return this.translateStatus(s);
    }
    const lower = s.toLowerCase();
    const english = {
      shipping: '已发货',
      shipped: '已发货',
      pending: '待揽收',
      transit: '在途中',
      in_transit: '在途中',
      pickup: '已揽收',
      delivering: '派送中',
      delivered: '已签收',
      signed: '已签收',
      exception: '疑难',
      failed: '疑难',
      returning: '退回',
      refused: '退签',
    };
    if (english[lower]) return english[lower];
    return s;
  }

  /**
   * 计划7天后自动完成订单
   * @param {Number} orderId - 订单ID
   */
  async scheduleOrderComplete(orderId) {
    const { app } = this;
    // 定时任务会每小时扫描已签收超过7天的订单并自动完成
    app.logger.info(`订单${orderId}已签收，7天后将自动完成`);
  }

  /**
   * 获取支持的快递公司列表
   */
  getExpressCompanies() {
    return [
      { code: 'shunfeng', name: '顺丰速运' },
      { code: 'yuantong', name: '圆通速递' },
      { code: 'ems', name: 'EMS' },
      { code: 'zhongtong', name: '中通快递' },
      { code: 'shentong', name: '申通快递' },
      { code: 'yunda', name: '韵达快递' },
      { code: 'jingdong', name: '京东快递' },
      { code: 'post', name: '邮政包裹' },
    ];
  }

  /**
   * 修改快递单号（管理员权限）
   * @param {Number} orderId - 订单ID
   * @param {String} trackingNo - 新的快递单号
   */
  async updateTrackingNo(orderId, trackingNo) {
    const { ctx } = this;

    // 权限检查
    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以修改快递单号');
    }

    const logistics = await ctx.model.Logistics.findOne({
      where: { order_id: orderId },
    });

    if (!logistics) {
      throw new Error('物流信息不存在');
    }

    const order = await ctx.model.Order.findByPk(orderId, { attributes: [ 'id', 'status' ] });
    if (!order) {
      throw new Error('订单不存在');
    }
    // 仅允许待收货订单改单号，避免已退款/已完成等状态出现不合理操作
    if (order.status !== 'shipped') {
      throw new Error('仅待收货订单可修改运单号');
    }

    await logistics.update({
      tracking_no: trackingNo,
      traces: '[]',
      last_update: new Date(),
    });

    // 重新订阅
    this.subscribeLogistics(logistics.company_code, trackingNo);

    return logistics;
  }
}

module.exports = LogisticsService;
