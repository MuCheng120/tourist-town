'use strict';

const Controller = require('egg').Controller;

class LogisticsController extends Controller {
  /**
   * 发货（创建物流信息）
   */
  async ship() {
    const { ctx } = this;

    try {
      const logistics = await ctx.service.logistics.createLogistics(
        ctx.params.orderId,
        ctx.request.body.company,
        ctx.request.body.companyCode,
        ctx.request.body.trackingNo
      );
      
      // 发货成功后清除相关物流缓存
      if (logistics && logistics.tracking_no) {
        await ctx.service.cache.del(`logistics:${logistics.tracking_no}`);
      }
      
      ctx.body = {
        code: 200,
        message: '发货成功',
        data: logistics,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '发货失败',
      };
    }
  }

  /**
   * 查询物流轨迹（getLogistics 已负责 DB 更新与快递 100 拉取，此处直接返回结构化结果）
   */
  async query() {
    const { ctx } = this;

    try {
      const orderLogistics = await ctx.service.logistics.getLogistics(ctx.params.orderId);

      if (!orderLogistics || !orderLogistics.tracking_no) {
        ctx.body = {
          code: 404,
          message: '物流信息不存在',
        };
        return;
      }

      let traces = orderLogistics.traces;
      if (!Array.isArray(traces)) {
        traces = [];
      }

      ctx.body = {
        code: 200,
        message: '查询成功',
        data: {
          logistics: {
            company: orderLogistics.company,
            company_code: orderLogistics.company_code,
            tracking_no: orderLogistics.tracking_no,
            status: orderLogistics.status,
          },
          traces,
        },
      };
    } catch (error) {
      if (error.message === '物流信息不存在') {
        ctx.body = {
          code: 404,
          message: error.message,
        };
        return;
      }
      ctx.body = {
        code: 500,
        message: error.message || '查询失败',
      };
    }
  }

  /**
   * 获取快递公司列表
   */
  async getCompanies() {
    const { ctx } = this;

    try {
      const companies = ctx.service.logistics.getExpressCompanies();
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: companies,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 修改快递单号（管理员）
   */
  async updateTrackingNo() {
    const { ctx } = this;

    try {
      const logistics = await ctx.service.logistics.updateTrackingNo(
        ctx.params.orderId,
        ctx.request.body.trackingNo
      );
      
      // 修改成功后清除旧缓存
      if (logistics && logistics.tracking_no) {
        await ctx.service.cache.del(`logistics:${logistics.tracking_no}`);
      }
      
      ctx.body = {
        code: 200,
        message: '修改成功',
        data: logistics,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '修改失败',
      };
    }
  }
}

module.exports = LogisticsController;
