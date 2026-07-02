'use strict';

const Service = require('egg').Service;
const { Op, QueryTypes } = require('sequelize');

/**
 * 入住区间内每一晚的日历 YYYY-MM-DD（左闭右开，与库存表、前端一致）
 */
function enumerateStayNightsYmd(checkInYmd, checkOutYmd) {
  const m1 = String(checkInYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = String(checkOutYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m1 || !m2) return [];
  const start = new Date(
    parseInt(m1[1], 10),
    parseInt(m1[2], 10) - 1,
    parseInt(m1[3], 10)
  );
  const end = new Date(
    parseInt(m2[1], 10),
    parseInt(m2[2], 10) - 1,
    parseInt(m2[3], 10)
  );
  if (!(start < end)) return [];
  const out = [];
  for (let cur = new Date(start.getTime()); cur < end; cur.setDate(cur.getDate() + 1)) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${mo}-${d}`);
  }
  return out;
}

/** 库存行 date 字段转 YYYY-MM-DD（兼容 Date / ISO 字符串） */
function normalizeStockRowDateKey(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m2 ? m2[1] : '';
}

class RoomTypeService extends Service {
  /**
   * 获取房型列表
   * 酒店由管理员维护，与商户无关（商户只管特产/美食）。
   * @param {Object} params - page, pageSize, admin_id, hotel_id, check_in, check_out
   * - hotel_id: 按酒店筛选，详情页传此参数
   * - admin_id: 后台管理用
   * - check_in/check_out: 传入时附带该日期区间内的库存
   */
  async getRoomTypeList(params) {
    const { ctx } = this;
    const {
      page = 1,
      pageSize = 10,
      admin_id,
      hotel_id,
      check_in: checkInRaw,
      check_out: checkOutRaw,
      include_offline,
    } = params;
    const check_in = checkInRaw != null ? String(checkInRaw).trim() : '';
    const check_out = checkOutRaw != null ? String(checkOutRaw).trim() : '';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
    const where = {};
    if (!include_offline) where.status = 1;

    if (admin_id) {
      where.admin_id = admin_id;
    }
    if (hotel_id != null && hotel_id !== '') {
      const hid = parseInt(hotel_id, 10);
      where.hotel_id = Number.isNaN(hid) ? hotel_id : hid;
    }

    const include = [
      { model: ctx.model.Admin, as: 'admin', attributes: [ 'id', 'nickname' ] },
    ];

    const { count, rows } = await ctx.model.RoomType.findAndCountAll({
      where,
      include,
      limit: pageSizeNum,
      offset: (pageNum - 1) * pageSizeNum,
      order: [[ 'created_at', 'DESC' ]],
    });

    let list = rows.map(r => r.toJSON());

    // 库存单独 SQL 查询再合并：避免 Sequelize DATE + Op.in 时区/类型绑定导致查不到行
    if (check_in && check_out && list.length) {
      const dates = enumerateStayNightsYmd(check_in, check_out);
      const safeDates = dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
      if (safeDates.length) {
        const roomIds = list
          .map(r => parseInt(r.id, 10))
          .filter(id => !Number.isNaN(id));
        if (roomIds.length) {
          const sequelize = ctx.model.RoomStock.sequelize;
          const idPh = roomIds.map(() => '?').join(',');
          const datePh = safeDates.map(() => '?').join(',');
          const sql =
            'SELECT id, room_type_id, DATE_FORMAT(`date`, \'%Y-%m-%d\') AS `date`, remained_count, created_at, updated_at ' +
            `FROM room_stocks WHERE room_type_id IN (${idPh}) ` +
            `AND DATE_FORMAT(\`date\`, '%Y-%m-%d') IN (${datePh})`;
          const stockRows = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
            replacements: [ ...roomIds, ...safeDates ],
          });
          const stocksByRoomId = {};
          for (const j of stockRows) {
            const rid = String(j.room_type_id);
            if (!stocksByRoomId[rid]) stocksByRoomId[rid] = [];
            stocksByRoomId[rid].push(j);
          }
          list = list.map(room => ({
            ...room,
            stocks: stocksByRoomId[String(room.id)] || [],
          }));
        }
      }
    }

    return {
      total: count,
      page: pageNum,
      pageSize: pageSizeNum,
      list,
    };
  }

  /**
   * 获取房型详情（含房型介绍、设施、政策服务）
   */
  async getRoomTypeDetail(id) {
    const { ctx } = this;
    const roomType = await ctx.model.RoomType.findByPk(id, {
      include: [{
        model: ctx.model.Admin,
        as: 'admin',
        attributes: [ 'id', 'nickname' ],
      }],
    });

    if (!roomType) {
      throw new Error('房型不存在');
    }

    const raw = roomType.toJSON();
    let breakfast_info = null;
    if (raw.breakfast_info) {
      try {
        breakfast_info = typeof raw.breakfast_info === 'string' ? JSON.parse(raw.breakfast_info) : raw.breakfast_info;
      } catch (e) {
        breakfast_info = { has_breakfast: false, note: raw.breakfast_info };
      }
    }
    let toiletries = [];
    if (raw.toiletries) {
      try {
        toiletries = typeof raw.toiletries === 'string' ? JSON.parse(raw.toiletries) : raw.toiletries;
        if (!Array.isArray(toiletries)) toiletries = [];
      } catch (e) {
        toiletries = [];
      }
    }
    return { ...raw, breakfast_info, toiletries };
  }

  /**
   * 查询房型库存
   * @param {Number} roomTypeId - 房型ID
   * @param {String} startDate - 开始日期
   * @param {String} endDate - 结束日期
   */
  async checkStock(roomTypeId, startDate, endDate) {
    const { ctx } = this;

    const dates = enumerateStayNightsYmd(startDate, endDate);
    if (dates.length === 0) {
      return {
        available: false,
        stockDate: null,
      };
    }

    const stocks = await ctx.model.RoomStock.findAll({
      where: {
        room_type_id: roomTypeId,
        date: { [Op.in]: dates },
      },
    });

    for (const date of dates) {
      const stock = stocks.find(s => normalizeStockRowDateKey(s.date) === date);
      if (!stock || Number(stock.remained_count) < 1) {
        return {
          available: false,
          stockDate: date,
        };
      }
    }

    return {
      available: true,
      stocks,
    };
  }

  /**
   * 按天批量写入库存（新建房型用；已存在日期则更新 remained_count）
   * @param {number} roomTypeId
   * @param {number} dailyCount 每日可售间数
   * @param {number} numDays 从今天起连续天数
   * @param {*} [transaction] Sequelize transaction
   */
  async seedRoomStocks(roomTypeId, dailyCount, numDays, transaction) {
    const { ctx } = this;
    const n = Math.max(0, parseInt(dailyCount, 10) || 0);
    const days = Math.min(400, Math.max(1, parseInt(numDays, 10) || 366));
    if (n <= 0) return;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      rows.push({
        room_type_id: roomTypeId,
        date: `${y}-${m}-${day}`,
        remained_count: n,
      });
    }

    const chunkSize = 120;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await ctx.model.RoomStock.bulkCreate(chunk, {
        transaction,
        updateOnDuplicate: [ 'remained_count', 'updated_at' ],
      });
    }
  }

  /**
   * 创建房型
   * @param {Object} data - 房型数据；可含 initial_daily_stock（每日默认可售间数，默认10；为0则不写库存表，需后续批量设置库存）
   */
  async createRoomType(data) {
    const { ctx } = this;
    const raw = { ...data };
    let initialDaily = raw.initial_daily_stock;
    delete raw.initial_daily_stock;

    if (initialDaily === undefined || initialDaily === null || initialDaily === '') {
      initialDaily = 10;
    } else {
      initialDaily = parseInt(initialDaily, 10);
      if (Number.isNaN(initialDaily)) initialDaily = 10;
    }

    const transaction = await ctx.model.transaction();
    try {
      const roomType = await ctx.model.RoomType.create(raw, { transaction });
      if (initialDaily > 0) {
        await this.seedRoomStocks(roomType.id, initialDaily, 366, transaction);
      }
      await transaction.commit();
      return roomType;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  /**
   * 更新房型
   * @param {Number} id - 房型ID
   * @param {Object} data - 更新数据
   */
  async updateRoomType(id, data) {
    const { ctx } = this;
    const roomType = await ctx.model.RoomType.findByPk(id);

    if (!roomType) {
      throw new Error('房型不存在');
    }

    // 权限检查 - 只有管理员可以修改
    if (roomType.admin_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权修改此房型');
    }

    const payload = { ...data };
    delete payload.initial_daily_stock;

    await roomType.update(payload);
    return roomType;
  }

  /**
   * 删除房型
   * @param {Number} id - 房型ID
   */
  async deleteRoomType(id) {
    const { ctx } = this;
    const roomType = await ctx.model.RoomType.findByPk(id);

    if (!roomType) {
      throw new Error('房型不存在');
    }

    // 权限检查 - 只有管理员可以删除
    if (roomType.admin_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权删除此房型');
    }

    await roomType.destroy();
    return { message: '删除成功' };
  }

  /**
   * 批量设置库存
   * @param {Number} roomTypeId - 房型ID
   * @param {Array} stockList - 库存列表 [{date, count}]
   */
  async batchSetStock(roomTypeId, stockList) {
    const { ctx } = this;
    const roomType = await ctx.model.RoomType.findByPk(roomTypeId);

    if (!roomType) {
      throw new Error('房型不存在');
    }

    // 权限检查 - 只有管理员可以操作
    if (roomType.admin_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权操作此房型');
    }

    // 批量更新或创建库存记录
    for (const stock of stockList) {
      await ctx.model.RoomStock.upsert({
        room_type_id: roomTypeId,
        date: stock.date,
        remained_count: stock.count,
      });
    }

    return { message: '库存设置成功' };
  }
}

module.exports = RoomTypeService;
