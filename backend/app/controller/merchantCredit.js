/**
 * 商户信用评级控制器
 */

const Controller = require('egg').Controller;

class MerchantCreditController extends Controller {
  /**
   * 获取商户信用详情
   * GET /api/merchant-credit/:id
   */
  async getDetail() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = parseInt(id);

    if (!Number.isInteger(merchantId) || merchantId <= 0) {
      ctx.body = {
        success: false,
        message: '无效的商户ID',
      };
      ctx.status = 400;
      return;
    }

    try {
      const credit = await service.merchantCredit.getMerchantCreditDetail(merchantId);

      ctx.body = {
        code: 200,
        success: true,
        data: credit,
      };
    } catch (error) {
      ctx.logger.error('获取商户信用详情失败:', error);
      ctx.body = {
        success: false,
        message: '获取商户信用详情失败',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 更新商户信用等级
   * PUT /api/merchant-credit/:id/update
   */
  async updateLevel() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = parseInt(id);

    if (!Number.isInteger(merchantId) || merchantId <= 0) {
      ctx.body = {
        success: false,
        message: '无效的商户ID',
      };
      ctx.status = 400;
      return;
    }

    try {
      const result = await service.merchantCredit.updateCreditLevel(merchantId);

      if (result.success) {
        ctx.body = {
          code: 200,
          success: true,
          message: '信用等级更新成功',
          data: result,
        };
      } else {
        ctx.body = {
          success: false,
          message: '信用等级更新失败',
          error: result.error,
        };
        ctx.status = 500;
      }
    } catch (error) {
      ctx.logger.error('更新商户信用等级失败:', error);
      ctx.body = {
        success: false,
        message: '更新商户信用等级失败',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 记录商户违规
   * POST /api/merchant-credit/violation
   */
  async recordViolation() {
    const { ctx, service } = this;
    const { merchant_id, violation_type, reason } = ctx.request.body;

    // 验证必需参数
    if (!merchant_id || !violation_type || !reason) {
      ctx.body = {
        success: false,
        message: '缺少必需参数',
      };
      ctx.status = 400;
      return;
    }

    // 验证违规类型
    const validTypes = ['warning', 'limit', 'suspend', 'revoke'];
    if (!validTypes.includes(violation_type)) {
      ctx.body = {
        success: false,
        message: '无效的违规类型',
      };
      ctx.status = 400;
      return;
    }

    try {
      // 获取当前管理员ID
      const adminId = ctx.state.user.id;

      const result = await service.merchantCredit.recordViolation(
        parseInt(merchant_id),
        adminId,
        violation_type,
        reason
      );

      // 与前端约定：返回 code: 200 时 app.request 才会 resolve，弹窗才会关闭并刷新列表
      ctx.body = {
        code: 200,
        success: true,
        message: '违规记录添加成功',
        data: result,
      };
    } catch (error) {
      ctx.logger.error('记录商户违规失败:', error);
      ctx.body = {
        success: false,
        message: '记录商户违规失败',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取商户违规记录列表
   * GET /api/merchant-credit/:id/violations
   */
  async getViolations() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = parseInt(id);

    if (!Number.isInteger(merchantId) || merchantId <= 0) {
      ctx.body = {
        code: 400,
        message: '无效的商户ID',
      };
      ctx.status = 400;
      return;
    }

    try {
      const violations = await service.merchantCredit.getMerchantViolations(merchantId);

      ctx.body = {
        code: 200,
        message: '获取成功',
        data: violations,
      };
    } catch (error) {
      ctx.logger.error('获取商户违规记录失败:', error);
      ctx.body = {
        code: 500,
        message: '获取商户违规记录失败',
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取所有商户信用等级列表（管理员）
   * GET /api/merchant-credit/list
   */
  async getList() {
    const { ctx } = this;
    const { model } = ctx;
    const { page = 1, pageSize = 20, level, status } = ctx.query;
    const { Op } = ctx.app.Sequelize;

    try {
      const where = {};
      const approvedMerchants = await model.User.findAll({
        where: { role: 'merchant', merchant_status: 'approved' },
        attributes: [ 'id' ],
      });
      const approvedIds = approvedMerchants.map(item => item.id);
      if (approvedIds.length === 0) {
        ctx.body = {
          code: 200,
          success: true,
          data: {
            list: [],
            total: 0,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
          },
        };
        return;
      }
      where.merchant_id = { [Op.in]: approvedIds };

      // 筛选条件
      if (level) {
        where.credit_level = level;
      }
      if (status) {
        where.status = status;
      }

      const offset = (page - 1) * pageSize;

      const { count, rows } = await model.MerchantExt.findAndCountAll({
        where,
        include: [
          {
            model: model.User,
            as: 'merchant',
            attributes: ['id', 'nickname', 'avatar', 'phone', 'business_name', 'contact', 'status'],
            where: { role: 'merchant', merchant_status: 'approved' },
            required: true,
          },
        ],
        limit: parseInt(pageSize),
        offset,
        order: [['credit_score', 'DESC']],
      });

      ctx.body = {
        code: 200,
        success: true,
        data: {
          list: rows,
          total: count,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
        },
      };
    } catch (error) {
      ctx.logger.error('获取商户信用列表失败:', error);
      ctx.body = {
        success: false,
        message: '获取商户信用列表失败',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 批量更新所有商户信用等级（管理员）
   * POST /api/merchant-credit/batch-update
   */
  async batchUpdate() {
    const { ctx, service } = this;

    try {
      const results = await service.merchantCredit.updateAllMerchantsCreditLevel();

      ctx.body = {
        code: 200,
        success: true,
        message: '批量更新完成',
        data: results,
      };
    } catch (error) {
      ctx.logger.error('批量更新商户信用等级失败:', error);
      ctx.body = {
        success: false,
        message: '批量更新商户信用等级失败',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 获取商户信用统计数据（管理员）
   * GET /api/merchant-credit/statistics
   */
  async getStatistics() {
    const { ctx } = this;
    const { model } = ctx;
    const { Sequelize } = ctx.app;
    const { Op } = ctx.app.Sequelize;

    try {
      const approvedMerchants = await model.User.findAll({
        where: { role: 'merchant', merchant_status: 'approved' },
        attributes: [ 'id' ],
      });
      const approvedIds = approvedMerchants.map(item => item.id);
      if (approvedIds.length === 0) {
        ctx.body = {
          code: 200,
          success: true,
          data: {
            levelStats: [],
            statusStats: [],
            avgScore: '0.00',
          },
        };
        return;
      }

      // 统计各等级商户数量
      const levelStats = await model.MerchantExt.findAll({
        where: { merchant_id: { [Op.in]: approvedIds } },
        attributes: [
          'credit_level',
          [Sequelize.fn('COUNT', Sequelize.col('merchant_id')), 'count'],
        ],
        group: ['credit_level'],
      });

      // 统计各状态商户数量
      const statusStats = await model.MerchantExt.findAll({
        where: { merchant_id: { [Op.in]: approvedIds } },
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('merchant_id')), 'count'],
        ],
        group: ['status'],
      });

      // 平均信用分
      const avgScore = await model.MerchantExt.findOne({
        where: { merchant_id: { [Op.in]: approvedIds } },
        attributes: [
          [Sequelize.fn('AVG', Sequelize.col('credit_score')), 'avg_score'],
        ],
      });

      ctx.body = {
        code: 200,
        success: true,
        data: {
          levelStats: levelStats.map(s => ({
            level: s.credit_level,
            count: parseInt(s.dataValues.count),
          })),
          statusStats: statusStats.map(s => ({
            status: s.status,
            count: parseInt(s.dataValues.count),
          })),
          avgScore: parseFloat(avgScore?.dataValues?.avg_score || 0).toFixed(2),
        },
      };
    } catch (error) {
      ctx.logger.error('获取商户信用统计失败:', error);
      ctx.body = {
        success: false,
        message: '获取商户信用统计失败',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 解除商户违规处罚
   * PUT /api/merchant-credit/violation/:id/resolve
   */
  async resolveViolation() {
    const { ctx } = this;
    const { model } = ctx;
    const { id } = ctx.params;

    try {
      const violation = await model.ViolationLog.findByPk(id);

      if (!violation) {
        ctx.body = {
          success: false,
          message: '违规记录不存在',
        };
        ctx.status = 404;
        return;
      }

      await violation.update({ status: 'resolved' });

      // 恢复商户状态为正常
      const merchantExt = await model.MerchantExt.findOne({
        where: { merchant_id: violation.merchant_id },
      });

      if (merchantExt) {
        await merchantExt.update({ status: 'normal' });
      }

      ctx.body = {
        code: 200,
        success: true,
        message: '违规处罚已解除',
      };
    } catch (error) {
      ctx.logger.error('解除商户违规处罚失败:', error);
      ctx.body = {
        success: false,
        message: '解除商户违规处罚失败',
        error: error.message,
      };
      ctx.status = 500;
    }
  }

  /**
   * 商户获取自己的信用等级
   * GET /api/merchant/my-credit
   */
  async getMyCredit() {
    const { ctx, service } = this;

    try {
      // 获取当前商户ID
      const merchantId = ctx.state.user.id;

      const credit = await service.merchantCredit.getMerchantCreditDetail(merchantId);

      ctx.body = {
        code: 200,
        message: '获取成功',
        data: credit,
      };
    } catch (error) {
      ctx.logger.error('获取商户信用详情失败:', error);
      ctx.body = {
        code: 500,
        message: '获取商户信用详情失败',
      };
      ctx.status = 500;
    }
  }
}

module.exports = MerchantCreditController;
