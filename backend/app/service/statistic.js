'use strict';

const Service = require('egg').Service;
const { Op, literal } = require('sequelize');

function normalizeRows(queryResult) {
  // 兼容不同 sequelize.query 返回形态：
  // 1) [rows, metadata]
  // 2) rows
  if (Array.isArray(queryResult) && queryResult.length === 2 && Array.isArray(queryResult[0])) {
    return queryResult[0];
  }
  return Array.isArray(queryResult) ? queryResult : [];
}

/** 仅游客端页面访问（与小程序主包 pages/ 一致，不含 admin/、merchant/ 子包） */
const PAGE_VIEWS_TOURIST_ONLY = `page_path LIKE 'pages/%'`;

class StatisticService extends Service {
  /**
   * 记录页面访问（用于统计PV/UV）
   */
  async recordPageView(userId, pagePath, ipAddress) {
    const { app } = this;
    await app.model.PageView.create({
      user_id: userId || null,
      page_path: pagePath,
      ip_address: ipAddress,
    });
  }

  /**
   * 获取统计数据（按日期范围）
   */
  async getStatistics({ startDate, endDate, groupBy = 'day' }) {
    const { app } = this;
    const sequelize = app.model;

    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    } else if (groupBy === 'year') {
      dateFormat = '%Y';
    } else if (groupBy === 'hour') {
      dateFormat = '%Y-%m-%d %H:00:00';
    }

    // PV/UV统计
    const pvuvStats = normalizeRows(await sequelize.query(`
      SELECT 
        DATE_FORMAT(created_at, '${dateFormat}') as date,
        COUNT(*) as page_views,
        COUNT(DISTINCT user_id) as unique_visitors
      FROM page_views
      WHERE created_at >= :startDate
        AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
        AND ${PAGE_VIEWS_TOURIST_ONLY}
      GROUP BY DATE_FORMAT(created_at, '${dateFormat}')
      ORDER BY date ASC
    `, {
      replacements: { startDate, endDate },
      type: sequelize.QueryTypes.SELECT,
    }));

    // GMV和订单统计
    const orderStats = normalizeRows(await sequelize.query(`
      SELECT 
        DATE_FORMAT(created_at, '${dateFormat}') as date,
        COUNT(*) as order_count,
        SUM(CASE WHEN status IN ('verified', 'completed') THEN total_amount ELSE 0 END) as gmv
      FROM orders
      WHERE created_at >= :startDate
        AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
      GROUP BY DATE_FORMAT(created_at, '${dateFormat}')
      ORDER BY date ASC
    `, {
      replacements: { startDate, endDate },
      type: sequelize.QueryTypes.SELECT,
    }));

    // 合并数据
    const mergedStats = {};
    
    pvuvStats.forEach(stat => {
      mergedStats[stat.date] = {
        date: stat.date,
        page_views: stat.page_views,
        unique_visitors: stat.unique_visitors,
        gmv: 0,
        order_count: 0,
      };
    });

    orderStats.forEach(stat => {
      if (mergedStats[stat.date]) {
        mergedStats[stat.date].gmv = parseFloat(stat.gmv) || 0;
        mergedStats[stat.date].order_count = stat.order_count;
      } else {
        mergedStats[stat.date] = {
          date: stat.date,
          page_views: 0,
          unique_visitors: 0,
          gmv: parseFloat(stat.gmv) || 0,
          order_count: stat.order_count,
        };
      }
    });

    return Object.values(mergedStats);
  }

  /**
   * 获取总体统计数据（今日、本月、总计）
   */
  async getOverview() {
    const { app } = this;
    const sequelize = app.model;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString().split('T')[0];

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString().split('T')[0] + ' 23:59:59';

    // 订单有效口径（口径A）：
    // 仅统计支付后状态，且排除软删除
    const VALID_ORDER_STATUS_SQL = `'paid','shipped','verified','completed','refunding','refunded'`;

    // 今日统计
    const [ todayStats ] = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM page_views WHERE DATE(created_at) = CURDATE() AND ${PAGE_VIEWS_TOURIST_ONLY}) as pv,
        (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE DATE(created_at) = CURDATE() AND ${PAGE_VIEWS_TOURIST_ONLY}) as uv,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL AND status IN ('verified', 'completed')) as gmv,
        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL AND status IN (${VALID_ORDER_STATUS_SQL})) as orders
    `);

    // 本月统计
    const [ monthStats ] = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM page_views WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND ${PAGE_VIEWS_TOURIST_ONLY}) as pv,
        (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND ${PAGE_VIEWS_TOURIST_ONLY}) as uv,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND deleted_at IS NULL AND status IN ('verified', 'completed')) as gmv,
        (SELECT COUNT(*) FROM orders WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND deleted_at IS NULL AND status IN (${VALID_ORDER_STATUS_SQL})) as orders
    `);

    // 总计统计
    const [ totalStats ] = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM page_views WHERE ${PAGE_VIEWS_TOURIST_ONLY}) as pv,
        (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE ${PAGE_VIEWS_TOURIST_ONLY}) as uv,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE deleted_at IS NULL AND status IN ('verified', 'completed')) as gmv,
        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL AND status IN (${VALID_ORDER_STATUS_SQL})) as orders
    `);

    // 用户与商户数量、今日新增用户（与工作台展示一致）
    const [ userStats ] = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_users,
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'merchant') as total_merchants,
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND DATE(created_at) = CURDATE()) as today_users
    `);

    // 核心质量指标所需字段：
    // - refunded_orders: 已退款订单数（全量）
    // - verified_orders: 已核销订单数（全量）
    // - repurchase_users: 复购用户数（历史内支付成功订单>=2 的用户）
    const [ qualityStats ] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL AND status = 'refunded') as refunded_orders,
        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL AND status = 'verified') as verified_orders,
        (
          SELECT COUNT(*)
          FROM (
            SELECT user_id
            FROM orders
            WHERE deleted_at IS NULL AND status IN (${VALID_ORDER_STATUS_SQL})
            GROUP BY user_id
            HAVING COUNT(*) >= 2
          ) t
        ) as repurchase_users
    `);
    const totalUsers = Number(userStats[0].total_users) || 0;
    const totalMerchants = Number(userStats[0].total_merchants) || 0;
    const todayUsers = Number(userStats[0].today_users) || 0;
    const refundedOrders = Number(qualityStats[0].refunded_orders) || 0;
    const verifiedOrders = Number(qualityStats[0].verified_orders) || 0;
    const repurchaseUsers = Number(qualityStats[0].repurchase_users) || 0;
    const todayGmv = parseFloat(todayStats[0].gmv) || 0;
    const todayOrders = Number(todayStats[0].orders) || 0;
    const todayUv = Number(todayStats[0].uv) || 0;
    const conversionRate = todayUv > 0 ? Math.round((todayOrders / todayUv) * 10000) / 100 : 0;

    return {
      today: {
        pv: todayStats[0].pv || 0,
        uv: todayUv,
        gmv: todayGmv,
        orders: todayOrders,
      },
      month: {
        pv: monthStats[0].pv || 0,
        uv: monthStats[0].uv || 0,
        gmv: parseFloat(monthStats[0].gmv) || 0,
        orders: monthStats[0].orders || 0,
      },
      total: {
        pv: totalStats[0].pv || 0,
        uv: totalStats[0].uv || 0,
        gmv: parseFloat(totalStats[0].gmv) || 0,
        orders: totalStats[0].orders || 0,
      },
      // 工作台所需字段
      total_gmv: parseFloat(totalStats[0].gmv) || 0,
      total_orders: Number(totalStats[0].orders) || 0,
      total_users: totalUsers,
      total_merchants: totalMerchants,
      today_gmv: todayGmv,
      today_orders: todayOrders,
      today_users: todayUsers,
      conversion_rate: conversionRate,
      // 核心质量指标字段（供管理端分析页直接计算）
      refunded_orders: refundedOrders,
      verified_orders: verifiedOrders,
      repurchase_users: repurchaseUsers,
    };
  }

  /**
   * 商户排行榜（按成交额）
   */
  async getMerchantRanking({ startDate, endDate, limit = 10 }) {
    const { app } = this;
    const sequelize = app.model;
    const safeLimit = Number(limit) || 10;

    const rankings = normalizeRows(await sequelize.query(`
      SELECT 
        u.id,
        u.nickname,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_amount
      FROM users u
      LEFT JOIN orders o ON u.id = o.merchant_id 
        AND o.created_at >= :startDate 
        AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
        AND o.status IN ('verified', 'completed')
      WHERE u.role = 'merchant'
      GROUP BY u.id, u.nickname
      ORDER BY total_amount DESC
      LIMIT :limit
    `, {
      replacements: { startDate, endDate, limit: safeLimit },
      type: sequelize.QueryTypes.SELECT,
    }));

    return rankings;
  }

  /**
   * 商品销量排行
   */
  async getProductRanking({ startDate, endDate, limit = 10 }) {
    const { app } = this;
    const sequelize = app.model;
    const safeLimit = Number(limit) || 10;

    const rankings = normalizeRows(await sequelize.query(`
      SELECT 
        p.id,
        p.name,
        p.images,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.quantity), 0) as total_quantity,
        COALESCE(SUM(o.total_amount), 0) as total_amount
      FROM products p
      INNER JOIN orders o ON p.id = o.product_id 
        AND o.created_at >= :startDate 
        AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
        AND o.status IN ('verified', 'completed')
        AND o.order_type IN ('food', 'souvenir')
      GROUP BY p.id, p.name, p.images
      ORDER BY total_quantity DESC
      LIMIT :limit
    `, {
      replacements: { startDate, endDate, limit: safeLimit },
      type: sequelize.QueryTypes.SELECT,
    }));

    return rankings.map(item => {
      let images = [];
      if (item.images) {
        try {
          images = JSON.parse(item.images);
        } catch (_) {
          images = [];
        }
      }
      const totalQuantity = Number(item.total_quantity) || 0;
      const orderCount = Number(item.order_count) || 0;
      return {
        ...item,
        images,
        order_count: orderCount,
        total_quantity: totalQuantity,
        // 向前兼容前端常用字段名
        sales_count: totalQuantity,
      };
    });
  }

  /**
   * 按订单类型统计消费品类（用于饼图）
   */
  async getCategoryStats({ startDate, endDate }) {
    const { ctx, app } = this;
    const sequelize = app.model;

    const rows = normalizeRows(await sequelize.query(`
      SELECT 
        order_type as name,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM orders
      WHERE created_at >= :startDate 
        AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
        AND status IN ('verified', 'completed')
      GROUP BY order_type
      ORDER BY total_amount DESC
    `, {
      replacements: { startDate, endDate },
      type: sequelize.QueryTypes.SELECT,
    }));

    const typeLabel = { scenic: '门票', food: '餐饮券', souvenir: '特产', hotel: '酒店' };
    return rows.map(r => ({
      name: typeLabel[r.name] || r.name,
      value: Math.round(parseFloat(r.total_amount) || 0),
      order_count: r.order_count,
    }));
  }

  /**
   * 获取景点门票经营数据
   */
  async getScenicStats({ startDate, endDate, groupBy = 'day' }) {
    const { app } = this;
    const sequelize = app.model;
    
    try {
      let dateFormat = '%Y-%m-%d';
      if (groupBy === 'month') {
        dateFormat = '%Y-%m';
      } else if (groupBy === 'year') {
        dateFormat = '%Y';
      }

      const rows = normalizeRows(await sequelize.query(`
        SELECT 
          DATE_FORMAT(o.created_at, '${dateFormat}') as date,
          s.id as scenic_id,
          s.name as scenic_name,
          COUNT(*) as order_count,
          COALESCE(SUM(o.total_amount), 0) as total_amount
        FROM orders o
        INNER JOIN scenic_spots s ON o.spot_id = s.id
        WHERE o.created_at >= :startDate 
          AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
          AND o.status IN ('verified', 'completed')
          AND o.order_type = 'scenic'
        GROUP BY date, s.id, s.name
        ORDER BY date ASC, total_amount DESC
      `, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      }));

      return rows;
    } catch (e) {
      app.logger.warn('getScenicStats failed', e.message);
      return [];
    }
  }

  /**
   * 获取酒店经营数据
   */
  async getHotelStats({ startDate, endDate, groupBy = 'day' }) {
    const { app } = this;
    const sequelize = app.model;
    
    try {
      let dateFormat = '%Y-%m-%d';
      if (groupBy === 'month') {
        dateFormat = '%Y-%m';
      } else if (groupBy === 'year') {
        dateFormat = '%Y';
      }

      const rows = normalizeRows(await sequelize.query(`
        SELECT 
          DATE_FORMAT(o.created_at, '${dateFormat}') as date,
          h.id as hotel_id,
          h.name as hotel_name,
          COUNT(*) as order_count,
          COALESCE(SUM(o.total_amount), 0) as total_amount
        FROM orders o
        INNER JOIN room_types rt ON o.room_type_id = rt.id
        INNER JOIN hotels h ON rt.hotel_id = h.id
        WHERE o.created_at >= :startDate 
          AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
          AND o.status IN ('verified', 'completed')
          AND o.order_type = 'hotel'
        GROUP BY date, h.id, h.name
        ORDER BY date ASC, total_amount DESC
      `, {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      }));

      return rows;
    } catch (e) {
      app.logger.warn('getHotelStats failed', e.message);
      return [];
    }
  }

  /**
   * 获取停留时长统计（按日聚合，来自 user_behavior_logs）
   */
  async getStayDurationStats({ startDate, endDate, groupBy = 'day' }) {
    const { app } = this;
    const sequelize = app.model;
    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    } else if (groupBy === 'year') {
      dateFormat = '%Y';
    }

    const rows = normalizeRows(await sequelize.query(`
      SELECT 
        DATE_FORMAT(created_at, '${dateFormat}') as date,
        COUNT(*) as sessions,
        COALESCE(AVG(stay_duration), 0) as avg_stay_seconds
      FROM user_behavior_logs
      WHERE created_at >= :startDate 
        AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
        AND action_type = 'view'
        AND page_path LIKE 'pages/%'
      GROUP BY DATE_FORMAT(created_at, '${dateFormat}')
      ORDER BY date ASC
    `, {
      replacements: { startDate, endDate },
      type: sequelize.QueryTypes.SELECT,
    }));

    return rows || [];
  }

  /**
   * 报表数据：日报(type=daily) / 周报(weekly) / 月报(monthly)
   * 返回流量、消费、品类、商户经营数据，供前端图表展示
   */
  async getReportData(type = 'daily') {
    const { app } = this;
    const sequelize = app.model;
    const today = new Date();
    let startDate, endDate, groupBy;

    if (type === 'daily') {
      // 最近 7 天，按日
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      groupBy = 'day';
    } else if (type === 'weekly') {
      // 最近 4 周，按周
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7 * 4);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      groupBy = 'day'; // 仍按日取，前端可按周聚合或展示每日
    } else if (type === 'monthly') {
      // 月报：最近 6 个月，按月
      endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1, 0, 0, 0);
      groupBy = 'month';
    } else if (type === 'yearly') {
      // 年报：最近 2 年，按年
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
      startDate = new Date(today.getFullYear() - 1, 0, 1, 0, 0, 0);
      groupBy = 'year';
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const [ trafficSeries, categoryPie, merchantRanking, scenicStats, hotelStats ] = await Promise.all([
      this.getStatistics({ startDate: startStr, endDate: endStr, groupBy }),
      this.getCategoryStats({ startDate: startStr, endDate: endStr }),
      this.getMerchantRankingWithReviewRate({ startDate: startStr, endDate: endStr, limit: 10 }),
      this.getScenicStats({ startDate: startStr, endDate: endStr, groupBy }),
      this.getHotelStats({ startDate: startStr, endDate: endStr, groupBy }),
    ]);

    let stayStats = [];
    try {
      stayStats = await this.getStayDurationStats({ startDate: startStr, endDate: endStr, groupBy });
    } catch (e) {
      app.logger.warn('getStayDurationStats failed', e.message);
    }

    // 确保即使没有数据也返回有效的数组
    const trafficDates = trafficSeries.map(s => s.date);
    
    return {
      type,
      dateRange: { start: startStr, end: endStr },
      traffic: {
        dates: trafficDates,
        page_views: trafficSeries.map(s => s.page_views || 0),
        unique_visitors: trafficSeries.map(s => s.unique_visitors || 0),
        avg_stay_seconds: trafficSeries.map((s, i) => {
          const d = stayStats.find(t => t.date === s.date);
          return d ? Math.round(parseFloat(d.avg_stay_seconds) || 0) : 0;
        }),
      },
      consumption: {
        dates: trafficDates,
        gmv: trafficSeries.map(s => parseFloat(s.gmv) || 0),
        order_count: trafficSeries.map(s => s.order_count || 0),
      },
      category: categoryPie,
      merchants: merchantRanking,
      scenic: scenicStats,
      hotel: hotelStats,
    };
  }

  /**
   * 商户排行（含订单量、成交额、好评率）
   */
  async getMerchantRankingWithReviewRate({ startDate, endDate, limit = 10 }) {
    const { app } = this;
    const sequelize = app.model;

    const rankings = normalizeRows(await sequelize.query(`
      SELECT 
        u.id,
        u.nickname,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_amount
      FROM users u
      LEFT JOIN orders o ON u.id = o.merchant_id 
        AND o.created_at >= :startDate 
        AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
        AND o.status IN ('verified', 'completed')
      WHERE u.role = 'merchant'
      GROUP BY u.id, u.nickname
      ORDER BY total_amount DESC
      LIMIT :limit
    `, {
      replacements: { startDate, endDate, limit },
      type: sequelize.QueryTypes.SELECT,
    }));

    const ids = rankings.map(r => r.id).filter(Boolean);
    let reviewRates = {};
    if (ids.length > 0) {
      try {
        const idList = ids.join(',');
        const reviewRows = normalizeRows(await sequelize.query(`
          SELECT 
            p.merchant_id as merchant_id,
            COUNT(*) as total,
            SUM(CASE WHEN c.score >= 4 THEN 1 ELSE 0 END) as good_count
          FROM comments c
          INNER JOIN products p ON c.post_id = p.id AND c.post_type = 'product'
          WHERE p.merchant_id IN (${idList}) AND c.status = 1
          GROUP BY p.merchant_id
        `, {
          type: sequelize.QueryTypes.SELECT,
        }));
        (reviewRows || []).forEach(r => {
          const total = Number(r.total) || 0;
          reviewRates[r.merchant_id] = total > 0 ? Math.round((Number(r.good_count) || 0) / total * 10000) / 100 : null;
        });
      } catch (e) {
        app.logger.warn('merchant review rate query failed', e.message);
      }
    }

    return rankings.map(r => ({
      id: r.id,
      nickname: r.nickname,
      order_count: Number(r.order_count) || 0,
      total_amount: parseFloat(r.total_amount) || 0,
      good_review_rate: reviewRates[r.id] != null ? reviewRates[r.id] : null,
    }));
  }
}

module.exports = StatisticService;
