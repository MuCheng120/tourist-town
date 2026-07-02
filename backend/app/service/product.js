'use strict';

const Service = require('egg').Service;

class ProductService extends Service {
  async assertProductOrderEligibleForTopComment(userId, productId, orderIdRaw) {
    const { ctx } = this;
    const oid = Number(orderIdRaw);
    const pid = Number(productId);
    if (!oid || Number.isNaN(oid)) {
      throw new Error('请指定要评价的订单');
    }

    const order = await ctx.model.Order.findByPk(oid);
    if (!order) throw new Error('订单不存在');
    if (order.user_id !== userId) throw new Error('无权使用该订单评价');
    if (![ 'souvenir', 'food' ].includes(order.order_type)) throw new Error('订单类型不正确');
    if (Number(order.product_id) !== pid) throw new Error('订单与商品不匹配');
    if (![ 'completed', 'verified' ].includes(order.status)) {
      throw new Error('请先完成订单后再评论');
    }

    const dup = await ctx.model.Comment.findOne({
      where: {
        order_id: oid,
        parent_id: 0,
        post_type: 'product',
      },
      attributes: [ 'id' ],
    });
    if (dup) throw new Error('该订单已评价');
    return order;
  }
  /**
   * 获取商品列表
   * @param {Object} params - 查询参数
   */
  async getProductList(params) {
    const { ctx, app } = this;
    const { Op } = app.Sequelize;
    const rawPageSize = params.pageSize ?? params.limit ?? 10;
    const pageSize = Number(rawPageSize) || 10;
    const pageNum = Number(params.page || 1) || 1;
    const { merchant_id, is_recommend, category, product_type: productType, keyword, order_by: orderBy } = params;
    const where = { status: 1, audit_status: 1 };

    if (merchant_id) {
      where.merchant_id = merchant_id;
    }

    // 按商品类型筛选：food-餐饮券，souvenir-特产
    const type = String(productType || '').toLowerCase();
    if (type === 'food' || type === 'souvenir') {
      where.product_type = type;
    }

    // 按特产分类筛选（茶叶、干货、工艺品、食品等，仅特产使用）
    if (category && String(category).trim() !== '') {
      where.category = String(category).trim();
    }

    // 关键词搜索（商品名称）
    if (keyword && String(keyword).trim() !== '') {
      where.name = { [Op.like]: `%${String(keyword).trim()}%` };
    }

    // 处理推荐商品筛选
    if (is_recommend === 'true' || is_recommend === true) {
      where.is_recommend = 1;
    }

    // 排序：default 最新，sales/sales_desc 销量降序，sales_asc 销量升序，price_asc 价格升序，price_desc 价格降序
    let order = [[ 'created_at', 'DESC' ]];
    const ob = String(orderBy || '').toLowerCase();
    if (ob === 'sales' || ob === 'sales_desc') order = [[ 'sales_count', 'DESC' ]];
    else if (ob === 'sales_asc') order = [[ 'sales_count', 'ASC' ]];
    else if (ob === 'price_asc') order = [[ 'price', 'ASC' ]];
    else if (ob === 'price_desc') order = [[ 'price', 'DESC' ]];

    // 特产/商城只展示「已认证」商家的商品，待审核商家的商品不展示
    const { count, rows } = await ctx.model.Product.findAndCountAll({
      where,
      include: [{
        model: ctx.model.User,
        as: 'merchant',
        attributes: [ 'id', 'nickname' ],
        where: { merchant_status: 'approved' },
        required: true,
      }],
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
      order,
    });

    // 解析 images JSON 字段
    const parsedRows = rows.map(product => {
      const data = product.toJSON();
      if (data.images && typeof data.images === 'string') {
        try {
          data.images = JSON.parse(data.images);
        } catch (e) {
          data.images = [data.cover_image];
        }
      }
      return data;
    });

    return {
      total: count,
      page: pageNum,
      pageSize,
      list: parsedRows,
    };
  }

  /**
   * 获取商品详情
   * @param {Number} id - 商品ID
   */
  async getProductDetail(id) {
    const { ctx } = this;
    const product = await ctx.model.Product.findByPk(id, {
      include: [{
        model: ctx.model.User,
        as: 'merchant',
        attributes: [ 'id', 'nickname', 'avatar', 'business_name', 'contact', 'phone' ],
        include: [{
          model: ctx.model.MerchantExt,
          as: 'ext',
          attributes: [ 'description', 'address', 'latitude', 'longitude', 'shop_images', 'business_hours' ],
          required: false,
        }],
      }],
    });

    if (!product) {
      throw new Error('商品不存在');
    }

    // 解析 images JSON 字段
    const data = product.toJSON();
    if (data.images && typeof data.images === 'string') {
      try {
        data.images = JSON.parse(data.images);
      } catch (e) {
        data.images = [data.cover_image];
      }
    }
    if (data.usage_conditions && typeof data.usage_conditions === 'string') {
      try {
        data.usage_conditions = JSON.parse(data.usage_conditions);
      } catch (e) {
        data.usage_conditions = {};
      }
    }

    // 解析商户扩展中的店铺图片
    if (data.merchant && data.merchant.ext && data.merchant.ext.shop_images && typeof data.merchant.ext.shop_images === 'string') {
      try {
        data.merchant.ext.shop_images = JSON.parse(data.merchant.ext.shop_images || '[]');
      } catch (e) {
        data.merchant.ext.shop_images = [];
      }
    }
    
    return data;
  }

  /**
   * 商户获取自己商品的评价列表（含回复），用于“用户评价”中心
   */
  async getMerchantProductComments(merchantId, { page = 1, pageSize = 10 } = {}) {
    const { ctx, app } = this;
    const offset = (page - 1) * pageSize;

    const { count, rows } = await ctx.model.Comment.findAndCountAll({
      where: {
        post_type: 'product',
        parent_id: 0,
        status: 1,
      },
      include: [
        {
          model: ctx.model.Product,
          as: 'product',
          attributes: [ 'id', 'name', 'cover_image', 'product_type' ],
          required: true,
          where: { merchant_id: merchantId },
        },
        {
          model: ctx.model.User,
          as: 'user',
          attributes: [ 'id', 'nickname', 'avatar' ],
        },
        {
          model: ctx.model.Comment,
          as: 'replies',
          required: false,
          where: { status: 1 },
          include: [
            {
              model: ctx.model.User,
              as: 'user',
              attributes: [ 'id', 'nickname', 'avatar' ],
            },
          ],
        },
      ],
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset,
    });

    // 转为普通对象，方便前端直接使用
    const list = rows.map(row => row.toJSON());
    return { total: count, page, pageSize, list };
  }

  /**
   * 商户回复商品评价
   */
  async replyToProductComment(merchantId, commentId, content) {
    const { ctx } = this;

    if (!content || !String(content).trim()) {
      throw new Error('回复内容不能为空');
    }

    const parent = await ctx.model.Comment.findByPk(commentId, {
      include: [{
        model: ctx.model.Product,
        as: 'product',
        attributes: [ 'id', 'merchant_id' ],
        required: false,
      }],
    });

    if (!parent) {
      throw new Error('评论不存在');
    }
    if (parent.post_type !== 'product') {
      throw new Error('只能回复商品评价');
    }
    if (!parent.product || parent.product.merchant_id !== merchantId) {
      throw new Error('无权回复该评价');
    }

    // 文本内容安全检查
    const securityResult = await ctx.service.security.checkText(content);
    if (!securityResult.pass) {
      throw new Error(securityResult.message);
    }

    const reply = await ctx.model.Comment.create({
      post_id: parent.post_id,
      post_type: 'product',
      user_id: merchantId,
      content: String(content).trim(),
      parent_id: parent.id,
      reply_to_user_id: parent.user_id,
      status: securityResult.needAudit ? 0 : 1,
    });

    return reply;
  }

  /**
   * 创建商品
   * @param {Object} data - 商品数据
   */
  async createProduct(data) {
    const { ctx } = this;
    const product = await ctx.model.Product.create(data);
    return product;
  }

  /**
   * 更新商品
   * @param {Number} id - 商品ID
   * @param {Object} data - 更新数据
   */
  async updateProduct(id, data) {
    const { ctx } = this;
    const product = await ctx.model.Product.findByPk(id);

    if (!product) {
      throw new Error('商品不存在');
    }

    // 权限检查
    if (product.merchant_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权修改此商品');
    }

    await product.update(data);
    return product;
  }

  /**
   * 删除商品
   * @param {Number} id - 商品ID
   */
  async deleteProduct(id) {
    const { ctx } = this;
    const product = await ctx.model.Product.findByPk(id);

    if (!product) {
      throw new Error('商品不存在');
    }

    // 权限检查
    if (product.merchant_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权删除此商品');
    }

    await product.destroy();
    return { message: '删除成功' };
  }

  /**
   * 更新库存
   * @param {Number} id - 商品ID
   * @param {Number} quantity - 变化数量
   */
  async updateStock(id, quantity) {
    const { ctx } = this;
    const product = await ctx.model.Product.findByPk(id);

    if (!product) {
      throw new Error('商品不存在');
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new Error('库存不足');
    }

    await product.update({ stock: newStock });
    return product;
  }

  /**
   * 获取商品评论列表（含餐饮多维度评分展示）
   */
  async getComments(productId, { page = 1, pageSize = 10 } = {}) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;
    const offset = (page - 1) * pageSize;

    const { count, rows } = await ctx.model.Comment.findAndCountAll({
      where: {
        post_id: productId,
        post_type: 'product',
        parent_id: 0,
        status: 1,
      },
      include: [
        { model: ctx.model.User, as: 'user', attributes: [ 'id', 'nickname', 'avatar' ] },
        {
          // 子回复（商家回复）：parent_id != 0
          model: ctx.model.Comment,
          as: 'replies',
          required: false,
          where: { status: 1 },
          include: [
            {
              model: ctx.model.User,
              as: 'user',
              attributes: [ 'id', 'nickname', 'avatar' ],
            },
          ],
        },
      ],
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset,
    });

    // 将子回复按时间升序排序，保证展开时展示更自然
    const list = rows.map(row => {
      const data = row.toJSON();
      if (Array.isArray(data.replies)) {
        data.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      return data;
    });

    return { total: count, page, pageSize, list };
  }

  /**
   * 添加商品评论（餐饮支持味道/环境/服务三维评分，支持图片）
   */
  async addComment(userId, productId, { content, images, score, taste_score, environment_score, service_score, parent_id, order_id }) {
    const { ctx } = this;
    const product = await ctx.model.Product.findByPk(productId);
    if (!product) throw new Error('商品不存在');
    const isTop = !parent_id || Number(parent_id) === 0;
    let orderIdToSave = null;
    if (isTop) {
      await this.assertProductOrderEligibleForTopComment(userId, productId, order_id);
      orderIdToSave = Number(order_id);
    }

    const securityResult = await ctx.service.security.checkText(content || '');
    const needAudit = securityResult.needAudit;

    let finalScore = score;
    const isFood = product.product_type === 'food';
    if (isFood && (taste_score != null || environment_score != null || service_score != null)) {
      const t = Number(taste_score) || 0;
      const e = Number(environment_score) || 0;
      const s = Number(service_score) || 0;
      if (t > 0 || e > 0 || s > 0) {
        const count = [ t, e, s ].filter(v => v > 0).length;
        finalScore = count > 0 ? Math.round(((t + e + s) / count) * 100) / 100 : (score || 0);
      }
    }
    if (finalScore == null) finalScore = 0;

    const comment = await ctx.model.Comment.create({
      post_id: productId,
      post_type: 'product',
      user_id: userId,
      order_id: orderIdToSave,
      content: content || '',
      images: images || [],
      score: finalScore,
      taste_score: isFood && taste_score != null ? Number(taste_score) : null,
      environment_score: isFood && environment_score != null ? Number(environment_score) : null,
      service_score: isFood && service_score != null ? Number(service_score) : null,
      parent_id: parent_id || 0,
      status: needAudit ? 0 : 1,
    });

    if (!needAudit) {
      await this.updateProductRating(productId);
    }
    return comment;
  }

  /**
   * 根据已通过审核的评论更新商品平均分（含餐饮三维）
   */
  async updateProductRating(productId) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;

    const comments = await ctx.model.Comment.findAll({
      where: {
        post_id: productId,
        post_type: 'product',
        status: 1,
        parent_id: 0,
      },
      attributes: [ 'score', 'taste_score', 'environment_score', 'service_score' ],
    });

    const n = comments.length;
    if (n === 0) {
      await ctx.model.Product.update(
        { overall_rating: 0, tasting_score: 0, environment_score: 0, service_score: 0, rating_count: 0 },
        { where: { id: productId } }
      );
      return;
    }

    const sumScore = comments.reduce((s, c) => s + (c.score || 0), 0);
    const sumTaste = comments.reduce((s, c) => s + (c.taste_score || 0), 0);
    const sumEnv = comments.reduce((s, c) => s + (c.environment_score || 0), 0);
    const sumSvc = comments.reduce((s, c) => s + (c.service_score || 0), 0);
    const tasteN = comments.filter(c => c.taste_score != null && c.taste_score > 0).length;
    const envN = comments.filter(c => c.environment_score != null && c.environment_score > 0).length;
    const svcN = comments.filter(c => c.service_score != null && c.service_score > 0).length;

    await ctx.model.Product.update(
      {
        overall_rating: Math.round((sumScore / n) * 100) / 100,
        tasting_score: tasteN > 0 ? Math.round((sumTaste / tasteN) * 100) / 100 : 0,
        environment_score: envN > 0 ? Math.round((sumEnv / envN) * 100) / 100 : 0,
        service_score: svcN > 0 ? Math.round((sumSvc / svcN) * 100) / 100 : 0,
        rating_count: n,
      },
      { where: { id: productId } }
    );
  }

  /**
   * 管理员获取商品列表（含待审核/已拒绝）
   */
  async getAdminProductList(params) {
    const { ctx, app } = this;
    const { Op } = app.Sequelize;

    const rawPageSize = params.pageSize ?? params.limit ?? 10;
    const pageSize = Number(rawPageSize) || 10;
    const pageNum = Number(params.page || 1) || 1;

    const {
      merchant_id,
      product_type: productType,
      keyword,
      status,
      is_recommend,
      audit_status: auditStatusParam,
      order_by: orderBy,
    } = params;

    const where = {};

    if (merchant_id) where.merchant_id = Number(merchant_id) || merchant_id;

    const type = String(productType || '').toLowerCase();
    if (type === 'food' || type === 'souvenir') where.product_type = type;

    const kwRaw = keyword != null ? String(keyword).trim() : '';
    if (kwRaw && kwRaw !== 'undefined' && kwRaw !== 'null') {
      where.name = { [Op.like]: `%${kwRaw}%` };
    }

    if (status !== undefined && status !== '' && status !== null) {
      where.status = Number(status);
    }

    if (is_recommend === 'true' || is_recommend === true || is_recommend === '1' || is_recommend === 1) {
      where.is_recommend = 1;
    } else if (is_recommend === 'false' || is_recommend === false || is_recommend === '0' || is_recommend === 0) {
      where.is_recommend = 0;
    }

    // 只接受 0/1/2；非法或缺省时不加 audit 条件（避免 NaN 导致永远查不到）
    let auditNum = null;
    if (auditStatusParam !== undefined && auditStatusParam !== '' && auditStatusParam !== null) {
      const n = parseInt(String(auditStatusParam), 10);
      if (n === 0 || n === 1 || n === 2) auditNum = n;
    }
    if (auditNum !== null) where.audit_status = auditNum;

    let order = [[ 'created_at', 'DESC' ]];
    const ob = String(orderBy || '').toLowerCase();
    if (ob === 'sales') order = [[ 'sales_count', 'DESC' ]];
    else if (ob === 'price_asc') order = [[ 'price', 'ASC' ]];
    else if (ob === 'price_desc') order = [[ 'price', 'DESC' ]];

    // 不用 findAndCountAll + include（部分版本 distinct/col 组合会导致 count/rows 异常）；拆成 count + findAll 保证与库内数据一致
    const includeMerchant = [{
      model: ctx.model.User,
      as: 'merchant',
      attributes: [ 'id', 'nickname', 'merchant_status' ],
      required: false,
    }];
    const count = await ctx.model.Product.count({ where });
    const rows = await ctx.model.Product.findAll({
      where,
      include: includeMerchant,
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
      order,
    });

    const parsedRows = rows.map(product => {
      const data = product.toJSON();
      if (data.images && typeof data.images === 'string') {
        try {
          data.images = JSON.parse(data.images);
        } catch (e) {
          data.images = [data.cover_image];
        }
      }
      return data;
    });

    return {
      total: count,
      page: pageNum,
      pageSize,
      list: parsedRows,
    };
  }

  /**
   * 管理员审核商品：通过后自动上架；拒绝则下架并取消推荐
   */
  async auditProduct(productId, auditStatus, auditRemark, adminId) {
    const { ctx } = this;

    const id = Number(productId);
    const product = await ctx.model.Product.findByPk(id);
    if (!product) throw new Error('商品不存在');

    const statusNum = Number(auditStatus);
    if (![ 0, 1, 2 ].includes(statusNum)) throw new Error('auditStatus 需为 0/1/2');

    const remark = auditRemark != null ? String(auditRemark).trim().slice(0, 500) : null;

    const patch = {
      audit_status: statusNum,
      audit_remark: remark,
      audited_by: adminId || null,
      audited_at: new Date(),
    };

    if (statusNum === 1) {
      patch.status = 1;
    } else {
      patch.status = 0;
      patch.is_recommend = 0;
    }

    await product.update(patch);
    return product;
  }

  /**
   * 管理员设置首页推荐（仅允许“已审核通过 + 上架”的商品）
   */
  async setProductRecommend(productId, isRecommend, adminId) {
    const { ctx } = this;
    const id = Number(productId);
    const product = await ctx.model.Product.findByPk(id);
    if (!product) throw new Error('商品不存在');

    if (product.audit_status !== 1) throw new Error('商品未审核通过，不能推荐');
    if (product.status !== 1) throw new Error('商品未上架，不能推荐');

    const flag = (isRecommend === true || isRecommend === 'true' || isRecommend === 1 || isRecommend === '1') ? 1 : 0;
    await product.update({
      is_recommend: flag,
      audited_by: adminId || product.audited_by || null,
      audited_at: product.audited_at || new Date(),
    });
    return product;
  }
}

module.exports = ProductService;
