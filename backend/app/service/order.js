'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class OrderService extends Service {
  /**
   * 创建订单
   * @param {Object} data - 订单数据
   */
  /** 酒店订单取房型ID：优先 room_type_id，兼容旧数据中的 product_id */
  getHotelRoomTypeId(order) {
    return order.room_type_id != null ? order.room_type_id : order.product_id;
  }

  /**
   * 用户端订单列表卡片：统一产出 products（景点单带 scenic_spot，不能只有 product）
   */
  normalizeOrderListRow(row) {
    const j = row && row.toJSON ? row.toJSON() : { ...row };
    const qty = parseInt(j.quantity, 10) || 1;
    const payAmount = parseFloat(j.final_amount != null ? j.final_amount : j.total_amount) || 0;
    const unitPrice = (qty > 0 ? payAmount / qty : payAmount).toFixed(2);

    if (j.order_type === 'scenic') {
      const spot = j.scenic_spot;
      j.products = [{
        product: spot ? {
          id: spot.id,
          name: spot.name || '景点门票',
          cover_image: spot.cover_image,
          images: spot.images,
        } : { name: '景点门票', cover_image: '' },
        room_type: null,
        quantity: qty,
        price: unitPrice,
        play_date: j.play_date,
      }];
    } else {
      j.products = [{
        product: j.product || {},
        room_type: j.room_type || null,
        quantity: qty,
        check_in_date: j.check_in_date,
        check_out_date: j.check_out_date,
      }];
    }
    return j;
  }

  normalizeDateOnly(value) {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const datePart = trimmed.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  }

  async createOrder(data) {
    const { ctx, app } = this;

    const transaction = await ctx.model.transaction();

    try {
      const { product_id, room_type_id, spot_id, order_type, quantity, address_id, delivery_mode, receiver_name, receiver_phone, receiver_address, check_in_date, check_out_date, play_date, total_price, user_coupon_id, contact_name, contact_phone, adult_count, child_count, child_ages } = data;
      const resolvedUserCouponId = (() => {
        const v = user_coupon_id;
        if (v == null || v === '') return null;
        const n = parseInt(String(v), 10);
        return Number.isNaN(n) || n < 1 ? null : n;
      })();

      let product = null;
      let roomType = null;
      let merchant_id = null;
      let totalAmount = 0;

      // 景点订单处理
      if (order_type === 'scenic' && spot_id) {
        const playDateStr = this.normalizeDateOnly(play_date);
        if (!playDateStr) {
          throw new Error('请选择游玩日期');
        }
        const lockedRows = await ctx.model.query(`
          SELECT id, status, daily_capacity, price
          FROM scenic_spots
          WHERE id = :spotId
          FOR UPDATE
        `, {
          replacements: { spotId: spot_id },
          type: ctx.model.Sequelize.QueryTypes.SELECT,
          transaction,
        });
        const lockedSpot = Array.isArray(lockedRows) && lockedRows.length > 0 ? lockedRows[0] : null;
        if (!lockedSpot) {
          throw new Error('景点不存在');
        }
        if (lockedSpot.status !== 1) {
          throw new Error('景点暂不可用');
        }
        const qty = parseInt(quantity, 10) || 1;
        if (qty < 1 || qty > 10) {
          throw new Error('门票数量需在 1-10 张之间');
        }
        const capacity = lockedSpot.daily_capacity != null ? lockedSpot.daily_capacity : 100;
        const { fn, col } = ctx.model.Sequelize;
        const soldResult = await ctx.model.Order.findOne({
          where: {
            spot_id,
            play_date: playDateStr,
            status: { [Op.in]: [ 'paid', 'verified', 'completed' ] },
          },
          attributes: [[ fn('COALESCE', fn('SUM', col('quantity')), 0), 'total' ]],
          raw: true,
          transaction,
        });
        const sold = parseInt(soldResult && soldResult.total ? soldResult.total : 0, 10);
        if (sold + qty > capacity) {
          throw new Error(`该日期门票余量不足，剩余 ${capacity - sold} 张`);
        }
        merchant_id = 1; // 景点属于平台管理
        // 0 元票（如部分学生票）必须保留：勿用 ||，否则会把 0 当成假值退回 spot.price
        const fromClient = parseFloat(total_price);
        totalAmount = Number.isFinite(fromClient)
          ? Math.max(0, fromClient)
          : (parseFloat(lockedSpot.price) || 0) * qty;

        let discountAmount = 0;
        let orderCouponId = null;
        if (resolvedUserCouponId) {
          const userCoupon = await ctx.model.UserCoupon.findOne({
            where: { id: resolvedUserCouponId, user_id: ctx.state.user.id, status: 'unused' },
            transaction,
          });
          if (!userCoupon) throw new Error('优惠券无效或已使用');
          const coupon = await ctx.model.Coupon.findByPk(userCoupon.coupon_id, { transaction });
          if (!coupon) throw new Error('优惠券不存在');
          if (coupon.status !== 1) throw new Error('优惠券已失效');
          if (new Date() > new Date(coupon.expiry_date)) throw new Error('优惠券已过期');
          if (totalAmount < parseFloat(coupon.min_spend)) {
            throw new Error(`未满${coupon.min_spend}元不可使用该优惠券`);
          }
          if (coupon.type === 'shop') {
            if (coupon.merchant_id == null || Number(coupon.merchant_id) !== Number(merchant_id)) {
              throw new Error('该订单仅限使用平台券');
            }
          } else if (coupon.type !== 'platform') {
            throw new Error('优惠券类型无效');
          }
          discountAmount = Math.min(parseFloat(coupon.value), totalAmount);
          orderCouponId = resolvedUserCouponId;
        }
        const finalAmountScenic = Math.max(0, totalAmount - discountAmount);

        // 创建订单
        const orderNo = this.generateOrderNo();
        const verifyCode = this.generateVerifyCode();

        const order = await ctx.model.Order.create({
          order_no: orderNo,
          user_id: ctx.state.user.id,
          merchant_id,
          product_id: null,
          spot_id,
          order_type,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          final_amount: finalAmountScenic,
          quantity: qty,
          verification_code: verifyCode,
          play_date: playDateStr,
          coupon_id: orderCouponId,
          status: 'unpaid',
        }, { transaction });

        if (orderCouponId) {
          const uc = await ctx.model.UserCoupon.findByPk(orderCouponId, { transaction });
          if (uc) {
            await uc.update({ status: 'used', order_id: order.id, used_at: new Date() }, { transaction });
            await ctx.model.Coupon.increment('used_count', { where: { id: uc.coupon_id }, transaction });
          }
        }

        await transaction.commit();

        // 查询完整订单信息
        const result = await ctx.model.Order.findByPk(order.id, {
          include: [
            { model: ctx.model.ScenicSpot, as: 'scenic_spot' },
            { model: ctx.model.User, as: 'merchant', attributes: [ 'id', 'nickname', 'phone' ] },
          ],
        });

        return result;
      }

      // 酒店订单：使用 room_type_id，校验房型
      if (order_type === 'hotel') {
        const rid = room_type_id != null ? room_type_id : product_id;
        if (!rid) {
          throw new Error('请选择房型');
        }
        roomType = await ctx.model.RoomType.findByPk(rid, { transaction });
        if (!roomType) {
          throw new Error('房型不存在');
        }
        if (roomType.status !== 1) {
          throw new Error('房型暂不可用');
        }
        merchant_id = roomType.merchant_id;
      } else {
        // 商品订单：验证商品
        if (!product_id) {
          throw new Error('请选择商品');
        }
        product = await ctx.model.Product.findByPk(product_id, { transaction });
        if (!product) {
          throw new Error('商品不存在');
        }
        merchant_id = product.merchant_id;
        // 前端「立即购买」可能只传 type: 'product'，未传 order_type，用商品类型补全
        if (!order_type) {
          order_type = product.product_type || 'souvenir';
        }
      }

      // 特产订单按商品支持的发货方式校验：
      // - 传 address_id 视为快递发货
      // - 不传 address_id 视为到店自提
      if (order_type === 'souvenir') {
        const rawDeliveryMethod = product && product.delivery_method ? String(product.delivery_method) : '';
        const supportsExpress = !rawDeliveryMethod || rawDeliveryMethod.indexOf('express') !== -1;
        const supportsSelfPickup = !rawDeliveryMethod || rawDeliveryMethod.indexOf('self_pickup') !== -1;
        const requestedDeliveryMode = delivery_mode ? String(delivery_mode).trim() : '';
        if (requestedDeliveryMode && ![ 'express', 'self_pickup' ].includes(requestedDeliveryMode)) {
          throw new Error('无效的配送方式');
        }
        const useExpress = requestedDeliveryMode ? requestedDeliveryMode === 'express' : !!address_id;
        if (requestedDeliveryMode === 'express' && !address_id) {
          throw new Error('请选择收货地址');
        }
        if (requestedDeliveryMode === 'self_pickup' && address_id) {
          throw new Error('到店自提无需填写收货地址');
        }
        if (useExpress && !supportsExpress) {
          throw new Error('该商品不支持快递发货，请选择到店自提');
        }
        if (!useExpress && !supportsSelfPickup) {
          throw new Error('该商品仅支持快递发货，请选择收货地址');
        }
      }

      // 处理收货地址
      let finalReceiverName = receiver_name;
      let finalReceiverPhone = receiver_phone;
      let finalReceiverAddress = receiver_address;
      let finalAddressInfo = null;

      // 如果提供了address_id，从地址表获取（仅特产订单需要）
      if (address_id && order_type === 'souvenir') {
        const address = await ctx.model.Address.findByPk(address_id, { transaction });
        if (!address) {
          throw new Error('收货地址不存在');
        }
        if (address.user_id !== ctx.state.user.id) {
          throw new Error('无权使用此地址');
        }
        finalReceiverName = address.user_name;
        finalReceiverPhone = address.tel_number;
        finalReceiverAddress = `${address.province_name}${address.city_name}${address.county_name}${address.detail_info}`;
        
        // 保存完整的地址信息（JSON格式）
        finalAddressInfo = JSON.stringify({
          receiverName: finalReceiverName,
          receiverPhone: finalReceiverPhone,
          provinceName: address.province_name,
          cityName: address.city_name,
          countyName: address.county_name,
          detailInfo: address.detail_info,
          postalCode: address.postal_code,
        });
      }

      // 计算订单金额
      if (order_type === 'souvenir') {
        totalAmount = product.price * quantity;

        // 检查库存
        if (product.stock < quantity) {
          throw new Error('库存不足');
        }

        // 扣减库存
        await product.update({ stock: product.stock - quantity }, { transaction });
      } else if (order_type === 'food') {
        // 餐饮券订单
        totalAmount = product.price * quantity;
      } else if (order_type === 'hotel') {
        // 酒店订单：按房型价格与入住天数计算
        const days = Math.ceil((new Date(check_out_date) - new Date(check_in_date)) / (1000 * 60 * 60 * 24));
        if (days <= 0) {
          throw new Error('退房日期必须晚于入住日期');
        }

        const rtyId = roomType.id;
        const startDate = new Date(check_in_date);
        const endDate = new Date(check_out_date);
        const dates = [];
        let currentDate = startDate;
        while (currentDate < endDate) {
          dates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const stocks = await ctx.model.RoomStock.findAll({
          where: {
            room_type_id: rtyId,
            date: dates,
          },
          transaction,
        });

        const stockMap = {};
        for (const stock of stocks) {
          const key = stock.date instanceof Date ? stock.date.toISOString().split('T')[0] : String(stock.date);
          stockMap[key] = stock;
        }
        for (const date of dates) {
          const stock = stockMap[date];
          if (!stock || Number(stock.remained_count) < 1) {
            throw new Error('所选日期库存不足');
          }
        }

        for (const date of dates) {
          const stock = stockMap[date];
          await stock.update({ remained_count: stock.remained_count - 1 }, { transaction });
        }

        const roomNights = parseFloat(roomType.price) * days;
        const hotelCfg = app.config.hotel || {};
        const feePerNightRaw = parseFloat(hotelCfg.chargeableChildFeePerNight);
        const feePerNight = Number.isFinite(feePerNightRaw) ? Math.max(0, feePerNightRaw) : 0;
        const parsedChildForFee = parseInt(child_count, 10);
        const ccForFee = Number.isNaN(parsedChildForFee) || parsedChildForFee < 0 ? 0 : parsedChildForFee;
        const childSurcharge = ccForFee * feePerNight * days;
        totalAmount = roomNights + childSurcharge;
      }

      // 优惠券：校验并计算折扣（酒店仅支持平台券，商品支持平台券+店铺券）
      let discountAmount = 0;
      let orderCouponId = null;
      if (resolvedUserCouponId) {
        const userCoupon = await ctx.model.UserCoupon.findOne({
          where: { id: resolvedUserCouponId, user_id: ctx.state.user.id, status: 'unused' },
          transaction,
        });
        if (!userCoupon) throw new Error('优惠券无效或已使用');
        const coupon = await ctx.model.Coupon.findByPk(userCoupon.coupon_id, { transaction });
        if (!coupon) throw new Error('优惠券不存在');
        if (coupon.status !== 1) throw new Error('优惠券已失效');
        if (new Date() > new Date(coupon.expiry_date)) throw new Error('优惠券已过期');
        if (totalAmount < parseFloat(coupon.min_spend)) {
          throw new Error(`未满${coupon.min_spend}元不可使用该优惠券`);
        }
        if (coupon.type === 'shop') {
          if (coupon.merchant_id == null || Number(coupon.merchant_id) !== Number(merchant_id)) {
            throw new Error('该店铺券仅限本店使用');
          }
        } else if (coupon.type !== 'platform') {
          throw new Error('优惠券类型无效');
        }
        discountAmount = Math.min(parseFloat(coupon.value), totalAmount);
        orderCouponId = resolvedUserCouponId;
      }
      const finalAmount = Math.max(0, totalAmount - discountAmount);

      // 生成订单号；核销码仅「特产到店自提」和「景点门票」需要（景点在上一分支已生成）
      const orderNo = this.generateOrderNo();
      const needVerifyCode = order_type === 'souvenir' && !address_id;
      const verifyCode = needVerifyCode ? this.generateVerifyCode() : null;

      // 酒店订单：入住人信息（真实姓名、手机号、成人数、儿童数、儿童年龄）
      let finalContactName = contact_name;
      let finalContactPhone = contact_phone;
      let finalAdultCount = parseInt(adult_count, 10);
      let finalChildCount = parseInt(child_count, 10);
      let finalChildAges = null;
      if (order_type === 'hotel') {
        const user = await ctx.model.User.findByPk(ctx.state.user.id, { attributes: [ 'real_name', 'phone' ], transaction });
        if (!finalContactName && user && user.real_name) finalContactName = user.real_name;
        if (!finalContactPhone && user && user.phone) finalContactPhone = user.phone;
        if (!finalContactName || !String(finalContactName).trim()) {
          throw new Error('请填写入住人真实姓名');
        }
        if (!finalContactPhone || !String(finalContactPhone).trim()) {
          throw new Error('请填写入住人联系电话');
        }
        if (Number.isNaN(finalAdultCount) || finalAdultCount < 1) finalAdultCount = 1;
        if (Number.isNaN(finalChildCount) || finalChildCount < 0) finalChildCount = 0;
        if (child_ages != null && Array.isArray(child_ages) && child_ages.length > 0) {
          const ages = child_ages.slice(0, finalChildCount).filter(a => typeof a === 'number' && a >= 0 && a <= 17);
          if (ages.length > 0) finalChildAges = JSON.stringify(ages);
        }
      }

      // 创建订单（酒店用 room_type_id，商品用 product_id）
      const order = await ctx.model.Order.create({
        order_no: orderNo,
        user_id: ctx.state.user.id,
        merchant_id,
        product_id: order_type === 'hotel' ? null : product_id,
        room_type_id: order_type === 'hotel' ? roomType.id : null,
        order_type,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        quantity: quantity || 1,
        address_info: finalAddressInfo,
        verification_code: verifyCode,
        check_in_date: order_type === 'hotel' ? check_in_date : undefined,
        check_out_date: order_type === 'hotel' ? check_out_date : undefined,
        contact_name: order_type === 'hotel' ? finalContactName : undefined,
        contact_phone: order_type === 'hotel' ? finalContactPhone : undefined,
        adult_count: order_type === 'hotel' ? finalAdultCount : undefined,
        child_count: order_type === 'hotel' ? finalChildCount : undefined,
        child_ages: order_type === 'hotel' ? finalChildAges : undefined,
        coupon_id: orderCouponId,
        status: 'unpaid',
      }, { transaction });

      if (orderCouponId) {
        const uc = await ctx.model.UserCoupon.findByPk(orderCouponId, { transaction });
        if (uc) {
          await uc.update({ status: 'used', order_id: order.id, used_at: new Date() }, { transaction });
          await ctx.model.Coupon.increment('used_count', { where: { id: uc.coupon_id }, transaction });
        }
      }

      await transaction.commit();

      // 查询完整订单信息（含 product 或 room_type）
      const result = await ctx.model.Order.findByPk(order.id, {
        include: [
          { model: ctx.model.Product, as: 'product', required: false },
          { model: ctx.model.RoomType, as: 'room_type', required: false },
          { model: ctx.model.User, as: 'merchant', attributes: [ 'id', 'nickname', 'phone' ] },
        ],
      });

      return result;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * 获取订单列表
   * @param {Object} params - 查询参数
   */
  async getOrderList(params) {
    const { ctx } = this;
    const { page = 1, pageSize = 10, status, order_type } = params;
    const where = { user_id: ctx.state.user.id };

    // 前端「待付款」传 pending，后端存 unpaid
    let statusFilter = status;
    if (status === 'pending') statusFilter = 'unpaid';

    // 待评价：已完成/已核销且用户尚未评价的订单（需先查再过滤）
    if (statusFilter === 'to_review') {
      const result = await this._getToReviewOrderList(ctx.state.user.id, { page, pageSize });
      return result;
    }

    // 前端「待发货」对应 status=paid：酒店无发货；景点/特产自提有核销码，只应在「待核验」出现
    if (statusFilter === 'paid' && (order_type === 'hotel' || order_type === 'scenic')) {
      return { total: 0, page, pageSize, list: [] };
    }

    // 待核验：已支付且存在核销码（门票/到店核销类）
    if (statusFilter === 'verify_pending') {
      where.status = 'paid';
      where.verification_code = { [Op.ne]: null };
    } else if (statusFilter === 'completed') {
      // 兼容旧参数：已完成包含 completed 和 verified（已核销对用户而言也是完成态）
      where.status = { [Op.in]: [ 'completed', 'verified' ] };
    } else if (statusFilter && statusFilter !== 'undefined' && statusFilter !== undefined) {
      where.status = statusFilter;
    }

    if ([ 'food', 'souvenir', 'scenic', 'hotel' ].includes(order_type)) {
      where.order_type = order_type;
    } else if (statusFilter === 'paid') {
      where.order_type = { [Op.ne]: 'hotel' };
    }

    // 待发货：仅无核销码的已支付单（快递特产等）；有核销码的与「待核验」互斥
    if (statusFilter === 'paid') {
      where[Op.and] = [
        {
          [Op.or]: [
            { verification_code: null },
            { verification_code: '' },
          ],
        },
      ];
    }

    const { count, rows } = await ctx.model.Order.findAndCountAll({
      where,
      include: [
        { model: ctx.model.Product, as: 'product', required: false },
        {
          model: ctx.model.RoomType,
          as: 'room_type',
          required: false,
          include: [{ model: ctx.model.Hotel, as: 'hotel', attributes: [ 'id', 'name', 'cover_image' ] }],
        },
        { model: ctx.model.ScenicSpot, as: 'scenic_spot', required: false },
        { model: ctx.model.User, as: 'merchant', attributes: [ 'id', 'nickname' ] },
        { model: ctx.model.Logistics, as: 'logistics', required: false },
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [[ 'created_at', 'DESC' ]],
    });

    const list = rows.map(row => this.normalizeOrderListRow(row));

    return {
      total: count,
      page,
      pageSize,
      list,
    };
  }

  /**
   * 管理员：获取全部订单列表（不按 user_id 过滤）
   */
  async getOrderListAdmin(params) {
    const { ctx } = this;
    const { page = 1, pageSize = 20, status, order_no, includeDeleted, verify_pending, order_type } = params;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);
    const where = {};
    const showDeleted = includeDeleted === true || includeDeleted === 'true' || includeDeleted === 1 || includeDeleted === '1';
    if (verify_pending === true || verify_pending === 'true' || verify_pending === 1 || verify_pending === '1') {
      where.status = 'paid';
      where.verification_code = { [ctx.app.Sequelize.Op.ne]: null };
    } else if (status && status !== 'undefined') {
      where.status = status;
    }
    if (order_no && String(order_no).trim()) {
      where.order_no = { [ctx.app.Sequelize.Op.like]: `%${String(order_no).trim()}%` };
    }
    if ([ 'food', 'souvenir', 'scenic', 'hotel' ].includes(order_type)) {
      where.order_type = order_type;
    }

    const { count, rows } = await ctx.model.Order.findAndCountAll({
      where,
      // 默认只查未软删除；开启开关后包含软删除记录
      paranoid: !showDeleted,
      include: [
        { model: ctx.model.Product, as: 'product', required: false },
        { model: ctx.model.RoomType, as: 'room_type', required: false },
        { model: ctx.model.User, as: 'merchant', attributes: [ 'id', 'nickname' ], required: false },
        { model: ctx.model.Logistics, as: 'logistics', required: false },
        { model: ctx.model.User, as: 'user', attributes: [ 'id', 'nickname' ], required: false },
      ],
      limit: safePageSize,
      offset: (safePage - 1) * safePageSize,
      order: [[ 'created_at', 'DESC' ]],
    });

    const list = rows.map(row => {
      const j = row.toJSON ? row.toJSON() : { ...row };
      j.products = [ {
        product: j.product || {},
        room_type: j.room_type || null,
        quantity: j.quantity || 1,
        check_in_date: j.check_in_date,
        check_out_date: j.check_out_date,
      } ];
      return j;
    });

    return { total: count, page: safePage, pageSize: safePageSize, list };
  }

  /**
   * 待评价订单列表：status 为 completed 或 verified（已核销），且用户尚未对该订单对应内容（酒店/商品/景点）发表过评价
   */
  async _getToReviewOrderList(userId, { page = 1, pageSize = 10 }) {
    const { ctx } = this;

    const completed = await ctx.model.Order.findAll({
      where: { user_id: userId, status: { [Op.in]: [ 'completed', 'verified' ] } },
      include: [
        { model: ctx.model.Product, as: 'product', required: false },
        { model: ctx.model.RoomType, as: 'room_type', required: false, include: [ { model: ctx.model.Hotel, as: 'hotel', attributes: [ 'id', 'name', 'cover_image' ] } ] },
        { model: ctx.model.ScenicSpot, as: 'scenic_spot', required: false },
        { model: ctx.model.User, as: 'merchant', attributes: [ 'id', 'nickname' ] },
        { model: ctx.model.Logistics, as: 'logistics', required: false },
      ],
      order: [[ 'created_at', 'DESC' ]],
    });

    const reviewedKeys = new Set();
    const comments = await ctx.model.Comment.findAll({
      where: { user_id: userId, parent_id: 0 },
      attributes: [ 'post_id', 'post_type', 'order_id' ],
    });
    const reviewedScenicOrderIds = new Set(
      comments.filter(c => c.post_type === 'scenic' && c.order_id).map(c => c.order_id)
    );
    const legacyScenicSpotIds = new Set(
      comments.filter(c => c.post_type === 'scenic' && !c.order_id).map(c => Number(c.post_id))
    );
    comments.forEach(c => {
      if (c.post_type === 'scenic') return;
      reviewedKeys.add(`${c.post_type}:${c.post_id}`);
    });

    const toReview = completed.filter(o => {
      if (o.order_type === 'hotel' && o.room_type && o.room_type.hotel_id) {
        const key = `hotel:${o.room_type.hotel_id}`;
        return !reviewedKeys.has(key);
      }
      if ((o.order_type === 'souvenir' || o.order_type === 'food') && o.product_id) {
        const key = `product:${o.product_id}`;
        return !reviewedKeys.has(key);
      }
      if (o.order_type === 'scenic' && o.spot_id) {
        if (reviewedScenicOrderIds.has(o.id)) return false;
        if (legacyScenicSpotIds.has(Number(o.spot_id))) return false;
        return true;
      }
      return false;
    });

    const total = toReview.length;
    const start = (page - 1) * pageSize;
    const rows = toReview.slice(start, start + pageSize);
    const list = rows.map(o => this.normalizeOrderListRow(o));

    return { total, page, pageSize, list };
  }

  /**
   * 获取订单详情
   * @param {Number} id - 订单ID
   */
  async getOrderDetail(id) {
    const { ctx } = this;
    const order = await ctx.model.Order.findByPk(id, {
      include: [
        { model: ctx.model.Product, as: 'product', required: false },
        {
          model: ctx.model.RoomType,
          as: 'room_type',
          required: false,
          include: [ { model: ctx.model.Hotel, as: 'hotel', attributes: [ 'id', 'name' ] } ],
        },
        { model: ctx.model.User, as: 'merchant', attributes: [ 'id', 'nickname', 'phone' ] },
        { model: ctx.model.User, as: 'user', attributes: [ 'id', 'nickname', 'phone' ] },
        { model: ctx.model.Logistics, as: 'logistics' },
      ],
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    // 权限检查
    if (order.user_id !== ctx.state.user.id && order.merchant_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权查看此订单');
    }

    return order;
  }

  /**
   * 支付订单
   * @param {Number} id - 订单ID
   */
  async payOrder(id) {
    const { ctx } = this;
    const order = await ctx.model.Order.findByPk(id);

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.user_id !== ctx.state.user.id) {
      throw new Error('无权操作此订单');
    }

    if (order.status !== 'unpaid') {
      throw new Error('订单状态不正确');
    }

    // 这里应该调用微信支付接口
    // 为了演示，直接更新状态
    // 美食：到店直接付款即完成，不需要核销；支付成功直接记为已核销
    const isFood = order.order_type === 'food';
    await order.update({
      status: isFood ? 'verified' : 'paid',
      paid_at: new Date(),
      ...(isFood ? { verified_at: new Date() } : {}),
    });

    // 更新商品销量
    if (order.order_type === 'souvenir' || order.order_type === 'food') {
      await ctx.model.Product.increment('sales_count', {
        by: order.quantity,
        where: { id: order.product_id },
      });
    }
    // 门票订单：更新景点销量（已售门票数量）
    if (order.order_type === 'scenic' && order.spot_id) {
      await ctx.model.ScenicSpot.increment('sales_count', {
        by: order.quantity,
        where: { id: order.spot_id },
      });
    }

    return order;
  }

  /**
   * 取消订单
   * @param {Number} id - 订单ID
   */
  async cancelOrder(id) {
    const { ctx } = this;
    const transaction = await ctx.model.transaction();

    try {
      const order = await ctx.model.Order.findByPk(id, { transaction });

      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.user_id !== ctx.state.user.id) {
        throw new Error('无权操作此订单');
      }

      if (order.status !== 'unpaid') {
        throw new Error('只有未支付订单可以取消');
      }

      // 先改状态再恢复库存，避免重复取消时重复加库存
      const [ affected ] = await ctx.model.Order.update(
        { status: 'cancelled' },
        { where: { id, status: 'unpaid' }, transaction }
      );
      if (affected === 0) {
        throw new Error('订单状态已变更，无法取消');
      }

      // 仅取消时恢复库存（删除订单记录不会动库存）
      if (order.order_type === 'souvenir') {
        await ctx.model.Product.increment('stock', {
          by: order.quantity,
          where: { id: order.product_id },
          transaction,
        });
      } else if (order.order_type === 'hotel') {
        const rtyId = this.getHotelRoomTypeId(order);
        if (rtyId && order.check_in_date && order.check_out_date) {
          const startDate = new Date(order.check_in_date);
          const endDate = new Date(order.check_out_date);
          const dates = [];
          let currentDate = startDate;
          while (currentDate < endDate) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
          }
          for (const date of dates) {
            await ctx.model.RoomStock.increment('remained_count', {
              by: 1,
              where: { room_type_id: rtyId, date },
              transaction,
            });
          }
        }
      }

      await transaction.commit();
      return { message: '订单已取消' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 删除订单记录（仅软删除，不恢复、不扣减库存；库存已在取消/退款时处理）
   */
  async deleteOrder(id) {
    const { ctx } = this;
    const order = await ctx.model.Order.findByPk(id);
    if (!order) throw new Error('订单不存在');
    if (order.user_id !== ctx.state.user.id) throw new Error('无权操作此订单');
    const allowed = [ 'cancelled', 'completed', 'refunded' ];
    if (!allowed.includes(order.status)) {
      throw new Error('仅支持删除已取消、已完成或已退款的订单');
    }
    await order.destroy();
    return { message: '已删除' };
  }

  /**
   * 退款订单
   * @param {Number} id - 订单ID
   */
  async refundOrder(id, payload = {}) {
    const { ctx } = this;
    const order = await ctx.model.Order.findByPk(id);

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.user_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权操作此订单');
    }
    // 美食订单为到店核销/消费场景，不支持退款
    if (order.order_type === 'food') {
      throw new Error('美食订单不支持退款');
    }

    if (order.status === 'refunded' || order.status === 'cancelled') {
      throw new Error('订单已退款或取消');
    }
    // 一单仅允许提交一次退款申请（被拒后也不可重复提交）
    if (order.refund_applied_at) {
      throw new Error('该订单已提交过退款申请，不支持重复申请');
    }

    const reason = payload.reason ? String(payload.reason).trim() : '';
    if (!reason || reason.length < 5) {
      throw new Error('请填写至少5个字的退款原因');
    }
    const evidenceImages = Array.isArray(payload.evidence_images)
      ? payload.evidence_images.filter(Boolean).slice(0, 6)
      : [];

    // 酒店订单：检查是否在入住前24小时内
    if (order.order_type === 'hotel' && order.check_in_date) {
      const checkInTime = new Date(order.check_in_date);
      const now = new Date();
      const hoursUntilCheckIn = (checkInTime - now) / (1000 * 60 * 60);

      if (hoursUntilCheckIn < 24) {
        throw new Error('入住前24小时内不可退款');
      }
    }

    // 更新为退款中状态，等待管理员审核
    await order.update({
      status: 'refunding',
      refund_apply_reason: reason,
      refund_evidence_images: JSON.stringify(evidenceImages),
      refund_applied_at: new Date(),
    });

    return { message: '退款申请已提交，等待管理员审核' };
  }

  /**
   * 完成订单
   * @param {Number} id - 订单ID
   */
  async completeOrder(id) {
    const { ctx } = this;
    const order = await ctx.model.Order.findByPk(id);

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 'shipped') {
      throw new Error('订单状态不正确');
    }

    await order.update({
      status: 'completed',
      completed_at: new Date(),
    });

    return order;
  }

  /**
   * 管理员：酒店订单确认入住完成（用户到店办理后结单）
   */
  async completeHotelOrderByAdmin(id) {
    const { ctx } = this;
    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以操作');
    }
    const order = await ctx.model.Order.findByPk(id);
    if (!order) {
      throw new Error('订单不存在');
    }
    if (order.order_type !== 'hotel') {
      throw new Error('仅酒店订单支持确认入住完成');
    }
    if (order.status !== 'paid') {
      throw new Error('仅「已支付」状态的酒店订单可确认完成；当前状态不可操作');
    }
    await order.update({
      status: 'completed',
      completed_at: new Date(),
    });
    return order;
  }

  /**
   * 管理员批准退款（处理争议）
   * @param {Number} id - 订单ID
   * @param {String} reason - 批准原因
   */
  async approveRefund(id, reason) {
    const { ctx } = this;

    // 权限检查
    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以批准退款');
    }

    const order = await ctx.model.Order.findByPk(id);

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'refunded' || order.status === 'cancelled') {
      throw new Error('订单已退款或取消');
    }

    // 调用微信退款接口
    // 这里应该调用实际的退款API
    await order.update({
      status: 'refunded',
      refund_reason: reason,
      refund_time: new Date(),
    });

    // 恢复库存
    if (order.order_type === 'souvenir') {
      await ctx.model.Product.increment('stock', {
        by: order.quantity,
        where: { id: order.product_id },
      });
    } else if (order.order_type === 'hotel') {
      const rtyId = this.getHotelRoomTypeId(order);
      if (rtyId && order.check_in_date && order.check_out_date) {
        const startDate = new Date(order.check_in_date);
        const endDate = new Date(order.check_out_date);
        const dates = [];
        let currentDate = startDate;
        while (currentDate < endDate) {
          dates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        for (const date of dates) {
          await ctx.model.RoomStock.increment('remained_count', {
            by: 1,
            where: { room_type_id: rtyId, date },
          });
        }
      }
    }

    return order;
  }

  /**
   * 管理员拒绝退款
   * @param {Number} id - 订单ID
   * @param {String} reason - 拒绝原因
   */
  async rejectRefund(id, reason) {
    const { ctx } = this;

    // 权限检查
    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以拒绝退款');
    }

    const order = await ctx.model.Order.findByPk(id);

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 'refunding') {
      throw new Error('订单状态不正确');
    }

    await order.update({
      status: 'paid', // 恢复为已支付状态
      refund_reject_reason: reason,
    });

    return order;
  }

  /**
   * 管理员强制完成订单（强制核销）
   * @param {Number} id - 订单ID
   * @param {String} reason - 强制完成原因
   */
  async forceCompleteOrder(id, reason) {
    const { ctx } = this;

    // 权限检查
    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以强制完成订单');
    }

    const order = await ctx.model.Order.findByPk(id);

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error('订单已完成或取消');
    }
    // 强制完成仅保留给退款仲裁场景（refunding）
    if (order.status !== 'refunding') {
      throw new Error('仅退款中订单支持强制完成');
    }

    await order.update({
      status: 'completed',
      completed_at: new Date(),
      force_complete_reason: reason,
    });

    return order;
  }

  /**
   * 生成订单号
   */
  generateOrderNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    return `${year}${month}${day}${hour}${minute}${second}${random}`;
  }

  /**
   * 管理员按核销码核销（用于景点门票等，不限制商家）
   * @param {String} code - 核销码
   */
  async verifyByCode(code) {
    const { ctx } = this;

    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以执行核销');
    }

    const order = await ctx.model.Order.findOne({
      where: { verification_code: code },
      include: [
        { model: ctx.model.Product, as: 'product' },
        { model: ctx.model.ScenicSpot, as: 'scenic_spot' },
        { model: ctx.model.RoomType, as: 'room_type' },
      ],
    });

    if (!order) {
      throw new Error('核销码不存在');
    }
    if (order.status === 'verified') {
      throw new Error('订单已核销');
    }
    if (order.status !== 'paid') {
      throw new Error('订单状态不正确，仅支持已支付订单核销');
    }

    await order.update({
      status: 'verified',
      verified_at: new Date(),
    });

    let displayName = '';
    if (order.order_type === 'scenic' && order.scenic_spot) {
      displayName = order.scenic_spot.name;
    } else if (order.product) {
      displayName = order.product.name;
    } else if (order.room_type) {
      displayName = order.room_type.name;
    } else {
      displayName = '订单#' + order.order_no;
    }

    return {
      orderId: order.id,
      orderNo: order.order_no,
      orderType: order.order_type,
      productName: displayName,
      verifiedAt: order.verified_at,
    };
  }

  /**
   * 生成核销码（最多 12 位，与 orders.verification_code 字段长度一致）
   */
  generateVerifyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

module.exports = OrderService;
