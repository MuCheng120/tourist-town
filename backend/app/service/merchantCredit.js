/**
 * 商户信用评级服务
 * 负责计算和管理商户信用等级
 */

const Service = require('egg').Service;

class MerchantCreditService extends Service {
  /**
   * 计算商户的平均评分（权重40%）
   * @param {Number} merchantId - 商户ID
   */
  async calculateAvgRating(merchantId) {
    const app = this.app;
    const { model } = this.ctx;

    try {
      // 获取该商户所有商品
      const products = await model.Product.findAll({
        where: { merchant_id: merchantId },
        attributes: ['id'],
      });

      if (products.length === 0) {
        return 5; // 新商户默认满分
      }

      const productIds = products.map(p => p.id);

      // 获取所有相关评论的评分
      const comments = await model.Comment.findAll({
        where: {
          post_type: 'scenic',
          status: 1, // 已通过的评论
        },
      });

      if (comments.length === 0) {
        return 5;
      }

      // 计算平均评分
      const totalScore = comments.reduce((sum, comment) => sum + (comment.score || 0), 0);
      const avgRating = totalScore / comments.length;

      // 转换为0-100分制（5星=100分）
      return (avgRating / 5) * 100;
    } catch (error) {
      app.logger.error('计算商户平均评分失败:', error);
      return 80; // 出错返回默认分数
    }
  }

  /**
   * 计算商户的订单完成率（权重60%）
   * @param {Number} merchantId - 商户ID
   */
  async calculateCompletionRate(merchantId) {
    const app = this.app;
    const { model } = this.ctx;

    try {
      // 统计该商户的所有订单
      const totalOrders = await model.Order.count({
        where: { merchant_id: merchantId },
      });

      if (totalOrders === 0) {
        return 1; // 无订单的商户默认100%完成率
      }

      // 统计已完成的订单（已完成、已核销、已发货且7天无维权）
      const completedOrders = await model.Order.count({
        where: {
          merchant_id: merchantId,
          status: ['completed', 'verified', 'shipped'],
        },
      });

      const completionRate = completedOrders / totalOrders;

      // 返回0-1的小数，乘以100转为分数
      return completionRate;
    } catch (error) {
      app.logger.error('计算商户订单完成率失败:', error);
      return 0.9; // 出错返回默认完成率
    }
  }

  /**
   * 综合计算信用评分
   * @param {Number} merchantId - 商户ID
   */
  async calculateCreditScore(merchantId) {
    const { config } = this;

    try {
      // 获取配置的权重
      const { ratingWeight = 0.4, completionWeight = 0.6 } = config.merchantCredit || {};

      // 计算平均评分
      const avgRating = await this.calculateAvgRating(merchantId);

      // 计算订单完成率
      const completionRate = await this.calculateCompletionRate(merchantId);

      // 综合评分 = 平均评分 * 40% + 完成率 * 100 * 60%
      const creditScore = avgRating * ratingWeight + completionRate * 100 * completionWeight;

      return Math.round(creditScore * 100) / 100; // 保留两位小数
    } catch (error) {
      this.ctx.logger.error('计算信用评分失败:', error);
      return 80;
    }
  }

  /**
   * 根据评分确定信用等级
   * @param {Number} creditScore - 信用评分
   */
  async determineCreditLevel(creditScore) {
    const { config } = this;
    const { levelThresholds = { S: 90, A: 80, B: 70, C: 60 } } = config.merchantCredit || {};

    if (creditScore >= levelThresholds.S) return 'S';
    if (creditScore >= levelThresholds.A) return 'A';
    if (creditScore >= levelThresholds.B) return 'B';
    return 'C';
  }

  /**
   * 更新商户信用等级
   * @param {Number} merchantId - 商户ID
   */
  async updateCreditLevel(merchantId) {
    const app = this.app;
    const { model } = this.ctx;

    try {
      // 1. 计算信用评分
      const creditScore = await this.calculateCreditScore(merchantId);

      // 2. 确定信用等级
      const creditLevel = await this.determineCreditLevel(creditScore);

      // 3. 计算订单完成率（用于展示）
      const completionRate = await this.calculateCompletionRate(merchantId);

      // 4. 更新商户扩展信息表
      const [merchantExt] = await model.MerchantExt.findOrCreate({
        where: { merchant_id: merchantId },
        defaults: {
          merchant_id: merchantId,
          credit_score: creditScore,
          credit_level: creditLevel,
          order_completion_rate: completionRate,
        },
      });

      // 更新数据
      await merchantExt.update({
        credit_score: creditScore,
        credit_level: creditLevel,
        order_completion_rate: completionRate,
        last_level_update: new Date(),
      });

      app.logger.info(`商户 ${merchantId} 信用等级已更新: ${creditLevel} (${creditScore}分)`);

      return {
        success: true,
        creditScore,
        creditLevel,
        completionRate,
      };
    } catch (error) {
      app.logger.error('更新商户信用等级失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量更新所有商户信用等级
   */
  async updateAllMerchantsCreditLevel() {
    const app = this.app;
    const { model } = this.ctx;

    try {
      // 获取所有商户
      const merchants = await model.User.findAll({
        where: { role: 'merchant' },
        attributes: ['id'],
      });

      const results = {
        total: merchants.length,
        success: 0,
        failed: 0,
      };

      // 逐个更新
      for (const merchant of merchants) {
        const result = await this.updateCreditLevel(merchant.id);
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
        }
      }

      app.logger.info(`批量更新商户信用等级完成: ${JSON.stringify(results)}`);

      return results;
    } catch (error) {
      app.logger.error('批量更新商户信用等级失败:', error);
      throw error;
    }
  }

  /**
   * 获取商户信用详情
   * @param {Number} merchantId - 商户ID
   */
  async getMerchantCreditDetail(merchantId) {
    const { ctx } = this;
    const { model } = ctx;

    try {
      const merchantExt = await model.MerchantExt.findOne({
        where: { merchant_id: merchantId },
      });

      if (!merchantExt) {
        // 如果不存在扩展信息，创建默认记录
        await this.updateCreditLevel(merchantId);
        return await this.getMerchantCreditDetail(merchantId);
      }

      return merchantExt;
    } catch (error) {
      this.ctx.logger.error('获取商户信用详情失败:', error);
      throw error;
    }
  }

  /**
   * 记录商户违规
   * @param {Number} merchantId - 商户ID
   * @param {Number} adminId - 管理员ID
   * @param {String} violationType - 违规类型
   * @param {String} reason - 违规原因
   */
  async recordViolation(merchantId, adminId, violationType, reason) {
    const { ctx } = this;
    const { model } = ctx;

    try {
      // 创建违规记录
      await model.ViolationLog.create({
        merchant_id: merchantId,
        admin_id: adminId,
        violation_type: violationType,
        reason,
        status: 'active',
      });

      // 更新商户违规次数
      const [merchantExt] = await model.MerchantExt.findOrCreate({
        where: { merchant_id: merchantId },
      });

      await merchantExt.increment('violation_count');

      // 根据违规类型更新商户状态
      let merchantStatus = 'normal';
      switch (violationType) {
        case 'warning':
          merchantStatus = 'normal';
          break;
        case 'limit':
          merchantStatus = 'limited';
          break;
        case 'suspend':
          merchantStatus = 'suspended';
          break;
        case 'revoke':
          merchantStatus = 'revoked';
          break;
      }

      await merchantExt.update({ status: merchantStatus });

      return { success: true };
    } catch (error) {
      this.ctx.logger.error('记录商户违规失败:', error);
      throw error;
    }
  }

  /**
   * 获取商户违规记录
   * @param {Number} merchantId - 商户ID
   */
  async getMerchantViolations(merchantId) {
    const { ctx } = this;
    const { model } = ctx;

    try {
      const violations = await model.ViolationLog.findAll({
        where: { merchant_id: merchantId },
        order: [['created_at', 'DESC']],
      });

      return violations;
    } catch (error) {
      this.ctx.logger.error('获取商户违规记录失败:', error);
      throw error;
    }
  }

  /**
   * 检查商户资质是否即将到期
   */
  async checkLicenseExpiry() {
    const app = this.app;
    const { model } = this.ctx;
    const results = {
      warningCount: 0,
      expiredCount: 0,
      suspendedCount: 0,
    };

    try {
      // 查找所有有资质到期时间的商户
      const merchantExts = await model.MerchantExt.findAll({
        where: {
          license_expiry: { [this.app.Sequelize.Op.ne]: null },
        },
      });

      const today = new Date();
      const warningDate = new Date();
      warningDate.setDate(today.getDate() + 30); // 30天后

      for (const merchantExt of merchantExts) {
        const expiryDate = new Date(merchantExt.license_expiry);

        // 资质已过期
        if (expiryDate < today) {
          await merchantExt.update({ status: 'suspended' });
          results.expiredCount++;

          // 下架该商户的所有商品
          await model.Product.update(
            { status: 0 },
            { where: { merchant_id: merchantExt.merchant_id } }
          );

          // 下架该商户的所有房型
          await model.RoomType.update(
            { status: 0 },
            { where: { merchant_id: merchantExt.merchant_id } }
          );

          app.logger.warn(`商户 ${merchantExt.merchant_id} 资质已过期，已暂停营业`);
        }
        // 资质30天内到期
        else if (expiryDate <= warningDate) {
          results.warningCount++;

          // 发送站内信提醒
          await this.sendLicenseExpiryWarning(merchantExt.merchant_id, expiryDate);
        }
      }

      return results;
    } catch (error) {
      app.logger.error('检查商户资质到期失败:', error);
      throw error;
    }
  }

  /**
   * 发送资质到期提醒站内信
   * @param {Number} merchantId - 商户ID
   * @param {Date} expiryDate - 到期日期
   */
  async sendLicenseExpiryWarning(merchantId, expiryDate) {
    const { ctx } = this;
    const { model } = ctx;

    try {
      const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      const dateStr = expiryDate.toISOString ? expiryDate.toISOString().split('T')[0] : String(expiryDate).slice(0, 10);
      const content = `您的营业执照将在 ${daysLeft} 天后到期（${dateStr}），请及时更新资质信息以免影响正常经营。`;

      await model.UserMessage.create({
        user_id: merchantId,
        title: '资质到期提醒',
        content,
        message_type: 'license_expiry',
        is_read: 0,
      });
    } catch (error) {
      this.ctx.logger.error('发送资质到期提醒站内信失败:', error);
    }
  }
}

module.exports = MerchantCreditService;
