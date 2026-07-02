'use strict';

const Controller = require('egg').Controller;

class StatisticController extends Controller {
  /**
   * 获取总体统计数据（今日、本月、总计）
   */
  async overview() {
    const { ctx } = this;

    const data = await ctx.service.statistic.getOverview();
    ctx.success(data, '获取统计概览成功');
  }

  /**
   * 获取详细统计数据
   */
  async statistics() {
    const { ctx } = this;
    const { startDate, endDate, groupBy } = ctx.query;

    if (!startDate || !endDate) {
      ctx.error('请提供日期范围', 400);
      return;
    }

    const data = await ctx.service.statistic.getStatistics({
      startDate,
      endDate,
      groupBy: groupBy || 'day',
    });
    ctx.success(data, '获取详细统计数据成功');
  }

  /**
   * 记录页面访问
   */
  async recordPageView() {
    const { ctx } = this;
    const { page_path, ip_address } = ctx.request.body;
    const userId = ctx.state.user ? ctx.state.user.id : null;
    const serverIp = ctx.ip;

    await ctx.service.statistic.recordPageView(userId, page_path, ip_address || serverIp);
    ctx.success(null, '记录成功');
  }

  /**
   * 获取商户排行榜
   */
  async merchantRanking() {
    const { ctx } = this;
    const { startDate, endDate, limit } = ctx.query;

    // 默认查询本月数据
    const today = new Date();
    const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const data = await ctx.service.statistic.getMerchantRanking({
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate,
      limit: parseInt(limit) || 10,
    });
    ctx.success(data, '获取商户排行榜成功');
  }

  /**
   * 报表数据（日报/周报/月报）：流量、消费、品类、商户经营，供图表展示
   */
  async report() {
    const { ctx } = this;
    const { type = 'daily' } = ctx.query;
    const allowed = [ 'daily', 'weekly', 'monthly', 'yearly' ];
    if (!allowed.includes(type)) {
      ctx.error('type 只能为 daily | weekly | monthly | yearly', 400);
      return;
    }
    const data = await ctx.service.statistic.getReportData(type);
    ctx.success(data, '获取报表成功');
  }

  /**
   * 获取商品销量排行
   */
  async productRanking() {
    const { ctx } = this;
    const { startDate, endDate, limit } = ctx.query;

    // 默认查询本月数据
    const today = new Date();
    const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const data = await ctx.service.statistic.getProductRanking({
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate,
      limit: parseInt(limit) || 10,
    });
    ctx.success(data, '获取商品销量排行成功');
  }
}

module.exports = StatisticController;
