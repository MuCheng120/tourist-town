// app/service/merchant.js
const Service = require('egg').Service;
const { Op } = require('sequelize');

class MerchantService extends Service {
  /**
   * 获取商家工作台统计数据
   */
  async getStats(merchantId, timeRange = 'day') {
    const { app } = this;
    const now = new Date();
    let startTime;
    
    // 根据时间范围计算开始时间
    switch (timeRange) {
      case 'week':
        startTime = new Date(now);
        startTime.setDate(now.getDate() - 7);
        startTime.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startTime = new Date(now);
        startTime.setFullYear(now.getFullYear() - 1);
        startTime.setHours(0, 0, 0, 0);
        break;
      case 'day':
      default:
        startTime = new Date(now);
        startTime.setHours(0, 0, 0, 0);
        break;
    }
    
    const settledStatuses = [ 'paid', 'shipped', 'verified', 'completed' ];

    // 成交额：按支付时间统计，口径使用实付金额（兼容老单回退 total_amount）
    const amountRows = await app.model.Order.findAll({
      where: {
        merchant_id: merchantId,
        status: { [Op.in]: settledStatuses },
        paid_at: { [Op.gte]: startTime },
      },
      attributes: [ 'final_amount', 'total_amount' ],
      raw: true,
    }) || 0;
    const amount = (Array.isArray(amountRows) ? amountRows : []).reduce((sum, row) => {
      const v = row && row.final_amount != null ? row.final_amount : (row ? row.total_amount : 0);
      return sum + (parseFloat(v) || 0);
    }, 0);

    // 订单数：与成交额保持同一口径（按支付时间、已结算状态）
    const count = await app.model.Order.count({
      where: {
        merchant_id: merchantId,
        status: { [Op.in]: settledStatuses },
        paid_at: { [Op.gte]: startTime },
      },
    });

    // 待发货订单数
    const pendingShipment = await app.model.Order.count({
      where: {
        merchant_id: merchantId,
        status: 'paid',
        address_info: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
      },
    });

    // 待付款订单数（订单状态为 unpaid）
    const pendingPayment = await app.model.Order.count({
      where: {
        merchant_id: merchantId,
        status: 'unpaid',
      },
    });

    // 店铺/审核状态（P1：工作台展示「已认证」或「待审核」）
    const user = await app.model.User.findByPk(merchantId, {
      attributes: [ 'merchant_status' ],
    });
    const merchant_status = user ? (user.merchant_status || 'pending') : 'pending';

    return {
      amount: parseFloat(amount.toFixed(2)),
      count,
      pendingShipment,
      pendingPayment,
      merchant_status,
    };
  }

  /**
   * 获取商家订单列表
   */
  async getOrders(merchantId, options = {}) {
    const { app } = this;
    const { status, page = 1, limit = 10 } = options;

    const where = { merchant_id: merchantId };
    if (status === 'shipping_pending') {
      where.status = 'paid';
      where.address_info = { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] };
    } else if (status === 'verify_pending') {
      where.status = 'paid';
      where.address_info = { [Op.or]: [ null, '' ] };
    } else if (status) {
      where.status = status;
    }

    const { count, rows } = await app.model.Order.findAndCountAll({
      where,
      include: [
        {
          model: app.model.Product,
          as: 'product',
          attributes: ['id', 'name', 'cover_image', 'images', 'price'],
        },
        {
          model: app.model.User,
          as: 'user',
          attributes: ['id', 'nickname', 'avatar'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return {
      total: count,
      page,
      pageSize: limit,
      list: rows,
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId, merchantId) {
    const { app } = this;

    const order = await app.model.Order.findOne({
      where: {
        id: orderId,
        merchant_id: merchantId,
      },
      include: [
        {
          model: app.model.Product,
          as: 'product',
          attributes: ['id', 'name', 'cover_image', 'images', 'price', 'description'],
        },
        {
          model: app.model.User,
          as: 'user',
          attributes: ['id', 'nickname', 'avatar', 'phone'],
        },
        {
          model: app.model.Logistics,
          as: 'logistics',
        },
      ],
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    return order;
  }

  /**
   * 发货
   */
  async shipOrder(orderId, merchantId, logisticsInfo) {
    const { app } = this;
    const { company: companyInput, trackingNo } = logisticsInfo;
    const companyName = String(companyInput || '').trim() || '—';
    const company_code = String(logisticsInfo.companyCode || '').trim().toLowerCase();

    // 开启事务
    const transaction = await app.model.transaction();

    try {
      // 先检查订单是否存在且归属本商户
      const order = await app.model.Order.findOne({
        where: {
          id: orderId,
          merchant_id: merchantId,
        },
        transaction,
      });

      if (!order) {
        throw new Error('订单不存在或无权操作');
      }

      if (order.status !== 'paid') {
        const statusTips = {
          unpaid: '待付款订单不可发货',
          shipped: '该订单已发货',
          verified: '该订单为核销类订单（餐饮/门票等），无需物流发货',
          completed: '订单已完成',
          cancelled: '订单已取消',
          refunding: '订单退款中',
          refunded: '订单已退款',
        };
        throw new Error(statusTips[order.status] || `订单状态为「${order.status}」，仅支持待发货(paid)订单`);
      }

      // 检查是否已有物流信息
      const existingLogistics = await app.model.Logistics.findOne({
        where: { order_id: orderId },
        transaction,
      });

      if (existingLogistics) {
        throw new Error('该订单已发货');
      }

      // company：展示名；company_code：快递100 查询用的 com（商户端传的可能是 sf/sto 等简码）
      await app.model.Logistics.create({
        order_id: orderId,
        company: companyName,
        company_code,
        tracking_no: trackingNo,
        status: '已发货',
        traces: JSON.stringify([]),
      }, { transaction });

      // 更新订单状态（shipped_at 供物流模拟按真实发货时间推进节点）
      await order.update({ status: 'shipped', shipped_at: new Date() }, { transaction });

      await transaction.commit();

      return { success: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 扫码核销
   */
  async verifyOrder(code, merchantId) {
    const { app } = this;

    // 根据核销码查找订单
    const order = await app.model.Order.findOne({
      where: {
        verification_code: code,
        merchant_id: merchantId,
      },
      include: [
        {
          model: app.model.Product,
          as: 'product',
        },
      ],
    });

    if (!order) {
      throw new Error('核销码不存在');
    }

    if (order.status === 'verified') {
      throw new Error('订单已核销');
    }

    if (order.status !== 'paid') {
      throw new Error('订单状态不正确');
    }

    // 更新订单状态为已核销
    await order.update({ status: 'verified', verified_at: new Date() });

    return {
      orderId: order.id,
      productName: order.product?.name,
      verifiedAt: order.verified_at,
    };
  }

  /**
   * 获取商家商品列表
   */
  async getProducts(merchantId, options = {}) {
    const { app } = this;
    const { page = 1, limit = 10 } = options;

    const { count, rows } = await app.model.Product.findAndCountAll({
      where: { merchant_id: merchantId },
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return {
      total: count,
      page,
      pageSize: limit,
      list: rows,
    };
  }

  /**
   * 获取单个商品（商家本人，用于编辑）
   */
  async getProduct(merchantId, productId) {
    const { app } = this;
    const product = await app.model.Product.findOne({
      where: { id: productId, merchant_id: merchantId },
    });
    if (!product) throw new Error('商品不存在');
    return product;
  }

  /** 商品创建/更新允许的字段（白名单） */
  _productAllowedFields() {
    return [
      'product_type', 'category', 'name', 'cover_image', 'images',
      'spec', 'price', 'original_price', 'description', 'stock',
      'usage_conditions', 'status', 'delivery_method', 'ship_time_desc',
    ];
  }

  /** 校验并过滤商品数据：按类型校验 美食-使用条件 / 特产-分类 */
  _sanitizeProductData(data, isUpdate = false) {
    const allowed = this._productAllowedFields();
    const out = {};
    for (const key of allowed) {
      if (data[key] !== undefined) out[key] = data[key];
    }
    if (out.product_type !== undefined && !['food', 'souvenir'].includes(out.product_type)) {
      throw new Error('商品类型需为 food(美食) 或 souvenir(特产)');
    }
    if (out.images !== undefined && typeof out.images !== 'string') {
      out.images = Array.isArray(out.images) ? JSON.stringify(out.images) : out.images;
    }
    if (out.spec !== undefined && out.spec != null) {
      out.spec = String(out.spec).trim().slice(0, 100);
    }
    if (out.delivery_method !== undefined && out.delivery_method != null) {
      const dm = String(out.delivery_method).trim();
      const valid = [ 'express', 'self_pickup', 'express,self_pickup', 'self_pickup,express' ];
      out.delivery_method = valid.includes(dm) ? dm.replace('self_pickup,express', 'express,self_pickup') : null;
    }
    if (out.ship_time_desc !== undefined && out.ship_time_desc != null) {
      out.ship_time_desc = String(out.ship_time_desc).trim().slice(0, 100);
    }
    if (out.price !== undefined) out.price = parseFloat(out.price) || 0;
    if (out.original_price !== undefined) out.original_price = parseFloat(out.original_price) || null;
    if (out.stock !== undefined) out.stock = parseInt(out.stock, 10) >= 0 ? parseInt(out.stock, 10) : 0;
    if (out.status !== undefined) out.status = out.status ? 1 : 0;
    return out;
  }

  /**
   * 创建商品
   */
  async createProduct(merchantId, productData) {
    const { app } = this;
    const data = this._sanitizeProductData(productData);
    if (!data.name || !String(data.name).trim()) throw new Error('请填写商品名称');
    if (data.price == null || data.price < 0) throw new Error('请填写有效价格');
    if (data.product_type === 'food') {
      // 美食：使用条件选填，不强制
    }
    if (data.product_type === 'souvenir') {
      // 特产：分类选填
    }
    // 新发布商品默认进入待审核，审核通过后由管理员发布（上架）
    const product = await app.model.Product.create({
      ...data,
      merchant_id: merchantId,
      status: 0,
      is_recommend: 0,
      audit_status: 0,
      audit_remark: null,
      audited_by: null,
      audited_at: null,
    });
    return product;
  }

  /**
   * 更新商品
   */
  async updateProduct(productId, merchantId, productData) {
    const { app } = this;
    const product = await app.model.Product.findOne({
      where: { id: productId, merchant_id: merchantId },
    });
    if (!product) throw new Error('商品不存在');
    const data = this._sanitizeProductData(productData, true);
    if (data.name !== undefined && !String(data.name).trim()) throw new Error('请填写商品名称');
    if (data.price !== undefined && data.price < 0) throw new Error('请填写有效价格');
    // 待审核/已拒绝商品：不允许上架/推荐，商家编辑后仍保持待审核（等待管理员重新审核）
    if (product.audit_status !== 1) {
      data.status = 0;
      data.is_recommend = 0;
      data.audit_status = 0;
      data.audit_remark = null;
      data.audited_by = null;
      data.audited_at = null;
    }
    await product.update(data);
    return product;
  }

  /**
   * 删除商品
   */
  async deleteProduct(productId, merchantId) {
    const { app } = this;

    const product = await app.model.Product.findOne({
      where: { id: productId, merchant_id: merchantId },
    });

    if (!product) {
      throw new Error('商品不存在');
    }

    await product.destroy();
  }

  /**
   * 获取房型列表
   */
  async getRoomTypes(merchantId) {
    const { app } = this;

    const roomTypes = await app.model.RoomType.findAll({
      where: { merchant_id: merchantId },
      order: [['created_at', 'DESC']],
    });

    return roomTypes;
  }

  /**
   * 创建房型
   */
  async createRoomType(merchantId, roomTypeData) {
    const { app } = this;

    const roomType = await app.model.RoomType.create({
      ...roomTypeData,
      merchant_id: merchantId,
    });

    return roomType;
  }

  /**
   * 更新库存
   */
  async updateStock(merchantId, roomTypeId, date, count) {
    const { app } = this;

    // 验证房型是否属于该商家
    const roomType = await app.model.RoomType.findOne({
      where: { id: roomTypeId, merchant_id: merchantId },
    });

    if (!roomType) {
      throw new Error('房型不存在');
    }

    // 查找或创建库存记录
    let stock = await app.model.RoomStock.findOne({
      where: { room_type_id: roomTypeId, date },
    });

    if (stock) {
      await stock.update({ remained_count: count });
    } else {
      stock = await app.model.RoomStock.create({
        room_type_id: roomTypeId,
        date,
        remained_count: count,
      });
    }

    return stock;
  }

  /**
   * 获取当前商户店铺基本信息（用于编辑页回显）
   */
  async getShopInfo(merchantId) {
    const { app } = this;

    const user = await app.model.User.findByPk(merchantId, {
      attributes: [ 'id', 'business_name', 'contact' ],
    });
    if (!user) throw new Error('商户不存在');

    let ext = await app.model.MerchantExt.findOne({
      where: { merchant_id: merchantId },
      attributes: [
        'description', 'address', 'latitude', 'longitude', 'shop_images', 'business_hours',
        'license_expiry', 'license_no', 'license_images', 'qualification_images',
        'idcard_front', 'idcard_back',
      ],
    });

    const parseImages = val => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val || '[]');
      } catch {
        return [];
      }
    };

    const shopImages = parseImages(ext && ext.shop_images);
    const licenseImages = parseImages(ext && ext.license_images);
    const qualificationImages = parseImages(ext && ext.qualification_images);

    return {
      business_name: user.business_name || '',
      contact: user.contact || '',
      description: (ext && ext.description) || '',
      address: (ext && ext.address) || '',
      latitude: ext && ext.latitude != null ? Number(ext.latitude) : null,
      longitude: ext && ext.longitude != null ? Number(ext.longitude) : null,
      shop_images: shopImages,
      business_hours: (ext && ext.business_hours) || '',
      license_expiry: ext && ext.license_expiry ? ext.license_expiry : '',
      license_no: (ext && ext.license_no) || '',
      license_images: licenseImages,
      qualification_images: qualificationImages,
      idcard_front: (ext && ext.idcard_front) || '',
      idcard_back: (ext && ext.idcard_back) || '',
    };
  }

  /**
   * 更新当前商户店铺基本信息
   */
  async updateShopInfo(merchantId, data) {
    const { app } = this;

    const user = await app.model.User.findByPk(merchantId);
    if (!user) throw new Error('商户不存在');

    if (data.business_name !== undefined) {
      user.business_name = data.business_name ? String(data.business_name).trim() : null;
    }
    if (data.contact !== undefined) {
      user.contact = data.contact ? String(data.contact).trim() : null;
    }
    await user.save();

    let ext = await app.model.MerchantExt.findOne({
      where: { merchant_id: merchantId },
    });
    if (!ext) {
      ext = await app.model.MerchantExt.create({
        merchant_id: merchantId,
      });
    }

    if (data.description !== undefined) {
      ext.description = data.description ? String(data.description).trim().slice(0, 500) : null;
    }
    if (data.address !== undefined) {
      ext.address = data.address ? String(data.address).trim().slice(0, 255) : null;
    }
    if (data.latitude !== undefined) {
      ext.latitude = (data.latitude !== null && data.latitude !== '') ? Number(data.latitude) : null;
    }
    if (data.longitude !== undefined) {
      ext.longitude = (data.longitude !== null && data.longitude !== '') ? Number(data.longitude) : null;
    }
    if (data.shop_images !== undefined) {
      const arr = Array.isArray(data.shop_images) ? data.shop_images : [];
      ext.shop_images = arr.length ? JSON.stringify(arr) : null;
    }
    if (data.business_hours !== undefined) {
      ext.business_hours = data.business_hours ? String(data.business_hours).trim().slice(0, 255) : null;
    }
    if (data.license_expiry !== undefined) {
      ext.license_expiry = data.license_expiry ? new Date(data.license_expiry) : null;
    }
    if (data.license_no !== undefined) {
      ext.license_no = data.license_no ? String(data.license_no).trim().slice(0, 64) : null;
    }
    if (data.license_images !== undefined) {
      const arr = Array.isArray(data.license_images) ? data.license_images : [];
      ext.license_images = arr.length ? JSON.stringify(arr) : null;
    }
    if (data.qualification_images !== undefined) {
      const arr = Array.isArray(data.qualification_images) ? data.qualification_images : [];
      ext.qualification_images = arr.length ? JSON.stringify(arr) : null;
    }
    if (data.idcard_front !== undefined) {
      ext.idcard_front = data.idcard_front ? String(data.idcard_front).trim().slice(0, 255) : null;
    }
    if (data.idcard_back !== undefined) {
      ext.idcard_back = data.idcard_back ? String(data.idcard_back).trim().slice(0, 255) : null;
    }
    await ext.save();

    return this.getShopInfo(merchantId);
  }

  /**
   * 商户同意退款（仅能操作自己的订单）
   * 说明：商户仅提交处理意见，最终裁决由管理员完成
   */
  async approveRefundByMerchant(orderId, merchantId, reason) {
    const { ctx, app } = this;

    const order = await app.model.Order.findOne({
      where: { id: orderId, merchant_id: merchantId },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'refunded' || order.status === 'cancelled') {
      throw new Error('订单已退款或取消');
    }

    if (order.status !== 'refunding') {
      throw new Error('订单状态不正确，需为退款中');
    }

    // 保持退款中，等待管理员最终裁决
    await order.update({
      status: 'refunding',
      refund_reason: reason || '商户同意退款（待平台最终审核）',
    });

    return order;
  }

  /**
   * 商户拒绝退款（仅能操作自己的订单）
   * 说明：商户仅提交处理意见，最终裁决由管理员完成
   */
  async rejectRefundByMerchant(orderId, merchantId, reason) {
    const { app } = this;

    const order = await app.model.Order.findOne({
      where: { id: orderId, merchant_id: merchantId },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 'refunding') {
      throw new Error('订单状态不正确，需为退款中');
    }

    // 保持退款中，等待管理员最终裁决
    await order.update({
      status: 'refunding',
      refund_reject_reason: reason || '商户拒绝退款（待平台最终审核）',
    });

    return order;
  }
}

module.exports = MerchantService;
