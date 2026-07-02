'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class CouponService extends Service {
  /**
   * 创建优惠券（管理员可发平台券或商家券）
   * type: 'platform' | 'shop'；商家券时必传 merchant_id
   */
  async create(data) {
    const { ctx } = this;
    const { title, type = 'platform', merchant_id, value, min_spend, total_count, expiry_date } = data;

    if (new Date(expiry_date) <= new Date()) {
      throw new Error('过期时间必须大于当前时间');
    }

    if (type === 'shop') {
      if (!merchant_id) throw new Error('商家券必须选择商户');
      const merchant = await ctx.model.User.findOne({
        where: { id: merchant_id, role: 'merchant' },
        attributes: [ 'id', 'business_name', 'nickname' ],
      });
      if (!merchant) throw new Error('所选商户不存在或非商家账号');
    }

    try {
      const coupon = await ctx.model.Coupon.create({
        title,
        type: type === 'shop' ? 'shop' : 'platform',
        merchant_id: type === 'shop' ? parseInt(merchant_id, 10) : null,
        value,
        min_spend: min_spend || 0,
        total_count,
        received_count: 0,
        used_count: 0,
        expiry_date: new Date(expiry_date),
        status: 1,
      });

      return { success: true, data: coupon };
    } catch (error) {
      this.logger.error('创建优惠券失败:', error);
      throw new Error(error.message || '创建优惠券失败');
    }
  }

  /**
   * 用户领取优惠券
   */
  async receive(couponId) {
    const user = this.ctx.state.user;
    if (!user || !user.id) {
      throw new Error('请先登录后再领取');
    }

    // 查询优惠券
    const coupon = await this.ctx.model.Coupon.findByPk(couponId);
    if (!coupon) {
      throw new Error('优惠券不存在');
    }

    if (coupon.status !== 1) {
      throw new Error('优惠券已失效');
    }

    // 检查是否已过期
    if (new Date() > new Date(coupon.expiry_date)) {
      throw new Error('优惠券已过期');
    }

    // 检查是否已领完
    if (coupon.received_count >= coupon.total_count) {
      throw new Error('优惠券已领完');
    }

    // 检查用户是否已领取
    const existUserCoupon = await this.ctx.model.UserCoupon.findOne({
      where: {
        user_id: user.id,
        coupon_id: couponId,
        status: 'unused',
      },
    });

    if (existUserCoupon) {
      throw new Error('您已领取过该优惠券');
    }

    try {
      // 使用事务
      const transaction = await this.ctx.model.transaction();

      // 创建用户优惠券
      await this.ctx.model.UserCoupon.create(
        {
          user_id: user.id,
          coupon_id: couponId,
          status: 'unused',
          received_at: new Date(),
        },
        { transaction }
      );

      // 增加领取数量
      await coupon.increment('received_count', { transaction });

      await transaction.commit();

      return { success: true, message: '领取成功' };
    } catch (error) {
      this.logger.error('领取优惠券失败:', error);
      throw new Error('领取优惠券失败');
    }
  }

  /**
   * 获取用户的优惠券列表
   */
  async getUserCoupons(userId, { status, page = 1, pageSize = 20 }) {
    const where = { user_id: userId };

    if (status && status !== 'all') {
      where.status = status;
    }

    const offset = (page - 1) * pageSize;

    const { count, rows } = await this.ctx.model.UserCoupon.findAndCountAll({
      where,
      include: [
        {
          model: this.ctx.model.Coupon,
          as: 'coupon',
          attributes: [
            'id',
            'title',
            'type',
            'value',
            'min_spend',
            'expiry_date',
            'merchant_id',
          ],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
    });

    // 检查是否过期
    const userCoupons = rows.map(uc => {
      const coupon = uc.coupon;
      if (coupon && new Date() > new Date(coupon.expiry_date) && uc.status === 'unused') {
        // 标记为过期
        uc.update({ status: 'expired' });
        return { ...uc.toJSON(), status: 'expired' };
      }
      return uc.toJSON();
    });

    return {
      list: userCoupons,
      total: count,
      page,
      pageSize,
    };
  }

  /**
   * 获取可用优惠券（下单时用）
   * 平台券全场可用；传入 merchantId 时同时返回该商户的店铺券
   */
  async getAvailableCoupons(userId, { totalAmount, merchantId }) {
    const { Op } = this.app.Sequelize;
    const couponWhere = {
      status: 1,
      expiry_date: { [Op.gt]: new Date() },
    };
    if (merchantId != null && merchantId !== '') {
      couponWhere[Op.or] = [
        { type: 'platform' },
        { type: 'shop', merchant_id: parseInt(merchantId, 10) },
      ];
    } else {
      couponWhere.type = 'platform';
    }

    const userCoupons = await this.ctx.model.UserCoupon.findAll({
      where: {
        user_id: userId,
        status: 'unused',
      },
      include: [
        {
          model: this.ctx.model.Coupon,
          as: 'coupon',
          where: couponWhere,
          required: true,
        },
      ],
    });

    const availableCoupons = userCoupons
      .filter(uc => totalAmount >= parseFloat(uc.coupon.min_spend || 0))
      .map(uc => ({
        id: uc.id,
        coupon_id: uc.coupon_id,
        title: uc.coupon.title,
        type: uc.coupon.type,
        value: uc.coupon.value,
        min_spend: uc.coupon.min_spend,
        expiry_date: uc.coupon.expiry_date,
        can_use: totalAmount >= parseFloat(uc.coupon.min_spend || 0),
      }));

    return availableCoupons;
  }

  /**
   * 使用优惠券（下单时调用）
   */
  async use(userCouponId, orderId) {
    const userCoupon = await this.ctx.model.UserCoupon.findByPk(userCouponId);

    if (!userCoupon) {
      throw new Error('优惠券不存在');
    }

    if (userCoupon.status !== 'unused') {
      throw new Error('优惠券已使用或已过期');
    }

    const coupon = await this.ctx.model.Coupon.findByPk(userCoupon.coupon_id);
    if (!coupon || coupon.status !== 1) {
      throw new Error('优惠券已失效');
    }

    try {
      const transaction = await this.ctx.model.transaction();

      // 更新用户优惠券状态
      await userCoupon.update(
        {
          status: 'used',
          order_id: orderId,
          used_at: new Date(),
        },
        { transaction }
      );

      // 增加使用次数
      await coupon.increment('used_count', { transaction });

      await transaction.commit();

      return {
        success: true,
        discount: coupon.value,
        message: '优惠券使用成功',
      };
    } catch (error) {
      this.logger.error('使用优惠券失败:', error);
      throw new Error('使用优惠券失败');
    }
  }

  /**
   * 领券中心：可领取的优惠券（有效、未过期、未领完）
   * @param {Object} opts - page, pageSize, type: 'platform' | 'shop'（不传或 platform 仅平台券，shop 仅店铺券）
   */
  async getCenterList({ page = 1, pageSize = 50, type = 'platform' } = {}) {
    const now = new Date();
    const where = {
      status: 1,
      expiry_date: { [Op.gt]: now },
    };
    if (type === 'shop') {
      where.type = 'shop';
    } else {
      where.type = 'platform';
    }

    const rows = await this.ctx.model.Coupon.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: type === 'shop' ? [{
        model: this.ctx.model.User,
        as: 'merchant',
        required: false,
        attributes: ['id', 'business_name', 'nickname'],
      }] : [],
    });
    const list = rows
      .map(r => r.toJSON())
      .filter(c => c.received_count < c.total_count)
      .map(c => {
        if (c.merchant) {
          c.merchant_name = c.merchant.business_name || c.merchant.nickname || `商户${c.merchant.id}`;
          delete c.merchant;
        }
        return c;
      });
    const total = list.length;
    const offset = (page - 1) * pageSize;
    const pagedList = list.slice(offset, offset + pageSize);
    return {
      list: pagedList,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 当前用户已领取的优惠券 ID 列表（用于领券中心标记「已领取」）
   */
  async getReceivedCouponIds(userId) {
    const rows = await this.ctx.model.UserCoupon.findAll({
      where: { user_id: userId },
      attributes: ['coupon_id'],
    });
    return rows.map(r => r.coupon_id);
  }

  /**
   * 获取优惠券列表（管理员用，支持按 type 筛选：platform / shop）
   */
  async getList({ type, status, page = 1, pageSize = 20 }) {
    const where = {};

    if (type === 'platform' || type === 'shop') {
      where.type = type;
    }

    if (status !== undefined && status !== '') {
      where.status = parseInt(status, 10);
    }

    const offset = (page - 1) * pageSize;

    const { count, rows } = await this.ctx.model.Coupon.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      include: [{
        model: this.ctx.model.User,
        as: 'merchant',
        required: false,
        attributes: ['id', 'business_name', 'nickname'],
      }],
    });

    const now = Date.now();
    const list = rows.map(r => {
      const j = r.toJSON();
      const expired = j.expiry_date && (new Date(j.expiry_date).getTime() <= now);
      j.effective_status = expired ? 0 : j.status;
      j.is_expired = !!expired;
      if (j.merchant) {
        j.merchant_name = j.merchant.business_name || j.merchant.nickname || `商户${j.merchant.id}`;
      } else {
        j.merchant_name = null;
      }
      delete j.merchant;
      return j;
    });

    return {
      list,
      total: count,
      page,
      pageSize,
    };
  }

  /**
   * 获取优惠券详情
   */
  async getDetail(couponId) {
    const coupon = await this.ctx.model.Coupon.findByPk(couponId);

    if (!coupon) {
      throw new Error('优惠券不存在');
    }

    // 获取使用统计数据
    const stats = {
      received_count: coupon.received_count,
      used_count: coupon.used_count,
      usage_rate: coupon.received_count > 0
        ? ((coupon.used_count / coupon.received_count) * 100).toFixed(2) + '%'
        : '0%',
    };

    return {
      ...coupon.toJSON(),
      stats,
    };
  }

  /**
   * 更新优惠券状态（管理员用）
   */
  async updateStatus(couponId, status) {
    const coupon = await this.ctx.model.Coupon.findByPk(couponId);

    if (!coupon) {
      throw new Error('优惠券不存在');
    }

    const s = parseInt(status, 10);
    const isExpired = coupon.expiry_date && new Date(coupon.expiry_date).getTime() <= Date.now();
    if (s === 1 && isExpired) {
      throw new Error('优惠券已过期，无法启用');
    }
    await coupon.update({ status: s });

    return { success: true, message: '更新成功' };
  }

  /**
   * 商家端：获取本商户的商家券列表
   */
  async getListForMerchant(merchantId, { status, page = 1, pageSize = 20 } = {}) {
    const where = { type: 'shop', merchant_id: merchantId };
    if (status !== undefined && status !== '') {
      where.status = parseInt(status, 10);
    }
    const offset = (page - 1) * pageSize;
    const { count, rows } = await this.ctx.model.Coupon.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
    });
    const now = Date.now();
    const list = rows.map(r => {
      const item = r.toJSON();
      const expired = item.expiry_date && (new Date(item.expiry_date).getTime() <= now);
      // effective_status：前端展示与操作使用，避免过期券仍显示“生效中”
      item.effective_status = expired ? 0 : item.status;
      item.is_expired = !!expired;
      return item;
    });
    return {
      list,
      total: count,
      page,
      pageSize,
    };
  }

  /**
   * 商家端：创建商家券（仅限 type=shop，merchant_id=当前商家）
   */
  async createForMerchant(merchantId, data) {
    const { title, value, min_spend, total_count, expiry_date } = data;

    if (new Date(expiry_date) <= new Date()) {
      throw new Error('过期时间必须大于当前时间');
    }

    const coupon = await this.ctx.model.Coupon.create({
      title,
      type: 'shop',
      merchant_id: merchantId,
      value,
      min_spend: min_spend || 0,
      total_count,
      received_count: 0,
      used_count: 0,
      expiry_date: new Date(expiry_date),
      status: 1,
    });

    return { success: true, data: coupon };
  }

  /**
   * 商家端：更新本商户某张券的状态（仅能操作自己的商家券）
   */
  async updateStatusForMerchant(merchantId, couponId, status) {
    const coupon = await this.ctx.model.Coupon.findOne({
      where: { id: couponId, type: 'shop', merchant_id: merchantId },
    });
    if (!coupon) {
      throw new Error('优惠券不存在或无权操作');
    }
    const s = parseInt(status, 10);
    const isExpired = coupon.expiry_date && new Date(coupon.expiry_date).getTime() <= Date.now();
    if (s === 1 && isExpired) {
      throw new Error('优惠券已过期，无法启用');
    }
    await coupon.update({ status: s });
    return { success: true, message: '更新成功' };
  }

  /**
   * 清理过期优惠券（定时任务用）
   */
  async cleanExpiredCoupons() {
    const now = new Date();

    // 查找过期的优惠券
    const expiredCoupons = await this.ctx.model.Coupon.findAll({
      where: {
        status: 1,
        expiry_date: { [Op.lt]: now },
      },
    });

    // 将这些优惠券的状态设置为失效
    for (const coupon of expiredCoupons) {
      await coupon.update({ status: 0 });

      // 将未使用的用户优惠券标记为过期
      await this.ctx.model.UserCoupon.update(
        { status: 'expired' },
        {
          where: {
            coupon_id: coupon.id,
            status: 'unused',
          },
        }
      );
    }

    this.logger.info(`清理了 ${expiredCoupons.length} 个过期优惠券`);
    return expiredCoupons.length;
  }

}

module.exports = CouponService;
