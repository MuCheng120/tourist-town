'use strict';

const Service = require('egg').Service;
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/password');

class UserService extends Service {
  /**
   * 检查用户名是否存在
   * @param {String} username - 用户名
   */
  async checkUsernameExists(username) {
    const { ctx } = this;
    const user = await ctx.model.User.findOne({
      where: { username },
    });
    return !!user;
  }

  /**
   * 用户注册
   * @param {Object} userData - 用户数据
   */
  async register(userData) {
    const { ctx, app } = this;
    const { username, phone, gender, age, password, business_name, contact } = userData;

    // 是否为注册即申请商家（填写了完整的商家资料）
    const isMerchantApply = !!(business_name && contact);

    // 检查用户名是否已存在
    const existingUsername = await ctx.model.User.findOne({
      where: { username },
    });
    if (existingUsername) {
      throw new Error('用户名已被注册');
    }

    // 检查手机号是否已存在
    const existingPhone = await ctx.model.User.findOne({
      where: { phone },
    });
    if (existingPhone) {
      throw new Error('手机号已被注册');
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（年龄选填，可在个人资料中填写）
    const user = await ctx.model.User.create({
      username,
      phone,
      // 统一将通过接口注册的用户设置为普通游客角色
      role: 'consumer',
      gender,
      age: age != null && age !== '' ? age : null,
      password: hashedPassword,
      nickname: username, // 默认昵称为用户名
       // 注册时如果填写商家资料，则进入待审核状态
      merchant_status: isMerchantApply ? 'pending' : 'none',
      business_name: isMerchantApply ? business_name : null,
      contact: isMerchantApply ? contact : null,
      status: 'active',
    });

    // 生成JWT token
    const token = app.jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
    }, app.config.jwt.secret, { expiresIn: '7d' });

    return {
      token,
      userInfo: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  /**
   * 账号密码登录（支持用户名或手机号）
   * @param {String} account - 账号（用户名或手机号）
   * @param {String} password - 密码
   */
  async accountLogin(account, password) {
    const { ctx, app } = this;

    // 查找用户（支持用户名或手机号）
    const user = await ctx.model.User.findOne({
      where: {
        [ctx.model.Sequelize.Op.or]: [
          { username: account },
          { phone: account },
        ],
      },
    });

    if (!user) {
      throw new Error('账号或密码错误');
    }

    // 检查是否设置了密码
    if (!user.password) {
      throw new Error('该账号未设置密码，请使用微信登录');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('账号或密码错误');
    }

    // 检查用户状态
    if (user.status === 'banned') {
      throw new Error('账号已被封禁');
    }
    if (user.status === 'cancelled') {
      throw new Error('该账号已注销');
    }

    // 生成JWT token
    const token = app.jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
    }, app.config.jwt.secret, { expiresIn: '7d' });

    return {
      token,
      userInfo: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  /**
   * 微信登录
   * @param {String} code - 微信登录code
   */
  async wechatLogin(code) {
    const { ctx, app } = this;
    const { appId, appSecret } = app.config.wechat;

    try {
      // 开发环境：使用固定的测试用户
      if (app.config.env === 'local' || app.config.env === 'unittest') {
        console.log('[开发模式] 使用固定测试用户登录');
        
        // 使用数据库中已有的游客用户 (id=2)
        let user = await ctx.model.User.findByPk(2);
        
        // 如果没有找到，尝试通过 openid 查找
        if (!user) {
          user = await ctx.model.User.findOne({
            where: { openid: 'o8oX44jiGkNeA3ded2J0M_v9HtJ8' },
          });
        }
        
        // 如果还是找不到，创建一个默认测试用户
        if (!user) {
          user = await ctx.model.User.create({
            openid: 'o8oX44jiGkNeA3ded2J0M_v9HtJ8',
            nickname: '游客',
            role: 'consumer',
            status: 'active',
          });
          console.log('[开发模式] 创建默认测试用户');
        } else {
          console.log('[开发模式] 使用已有测试用户:', user.nickname);
        }

        if (user.status === 'banned') throw new Error('账号已被封禁');
        if (user.status === 'cancelled') throw new Error('该账号已注销');

        // 生成JWT token
        const token = app.jwt.sign({
          id: user.id,
          openid: user.openid,
          role: user.role,
        }, app.config.jwt.secret, { expiresIn: '7d' });

        return {
          token,
          userInfo: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            role: user.role,
          },
        };
      }

      // 生产环境：调用真实的微信接口
      const wxResponse = await ctx.curl('https://api.weixin.qq.com/sns/jscode2session', {
        method: 'GET',
        dataType: 'json',
        data: {
          appid: appId,
          secret: appSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
      });

      if (!wxResponse.data.openid) {
        throw new Error('微信登录失败');
      }

      const { openid, session_key } = wxResponse.data;

      // 查找或创建用户
      let user = await ctx.model.User.findOne({
        where: { openid },
      });

      if (!user) {
        user = await ctx.model.User.create({
          openid,
          nickname: '游客',
          role: 'consumer',
          status: 'active',
        });
      }

      // 检查用户状态
      if (user.status === 'banned') {
        throw new Error('账号已被封禁');
      }
      if (user.status === 'cancelled') {
        throw new Error('该账号已注销');
      }

      // 生成JWT token
      const token = app.jwt.sign({
        id: user.id,
        openid: user.openid,
        role: user.role,
      }, app.config.jwt.secret, { expiresIn: '7d' });

      return {
        token,
        userInfo: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          role: user.role,
        },
      };
    } catch (error) {
      ctx.logger.error('微信登录错误:', error);
      throw error;
    }
  }

  /**
   * 手机号脱敏：138****1234
   */
  maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * 获取用户信息（C 端：脱敏手机号、不返回密码）
   * @param {Number} userId - 用户ID
   */
  async getUserInfo(userId) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(userId, {
      attributes: { exclude: [ 'openid', 'password' ] },
    });

    if (!user) {
      throw new Error('用户不存在');
    }
    if (user.status === 'cancelled') {
      throw new Error('该账号已注销');
    }

    const raw = user.toJSON();
    raw.phone = this.maskPhone(raw.phone);
    return raw;
  }

  /** 个人资料允许修改的字段 */
  getProfileUpdateWhitelist() {
    return [ 'nickname', 'avatar', 'background', 'gender', 'age', 'real_name' ];
  }

  /**
   * 更新用户信息（仅允许昵称、头像、背景、性别、年龄）
   * @param {Number} userId - 用户ID
   * @param {Object} data - 更新数据
   */
  async updateUserInfo(userId, data) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(userId);

    if (!user) {
      throw new Error('用户不存在');
    }

    const whitelist = this.getProfileUpdateWhitelist();
    const payload = {};
    for (const key of whitelist) {
      if (data[key] !== undefined) payload[key] = data[key];
    }
    if (Object.keys(payload).length === 0) {
      throw new Error('没有可更新的字段');
    }
    await user.update(payload);
    const updated = await ctx.model.User.findByPk(userId, {
      attributes: { exclude: [ 'openid', 'password' ] },
    });
    const raw = updated.toJSON();
    raw.phone = this.maskPhone(raw.phone);
    return raw;
  }

  /**
   * 注销账号：置为已注销并脱敏个人敏感信息，订单/评论等保留仅做匿名展示
   * @param {Number} userId - 当前用户ID（JWT）
   * @param {String} [password] - 可选，账号密码登录用户需验证密码
   */
  async cancelAccount(userId, password) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    if (user.status === 'cancelled') {
      throw new Error('该账号已注销');
    }
    if (user.role === 'admin') {
      throw new Error('管理员账号不支持自助注销');
    }

    // 账号密码用户：校验密码
    if (user.password) {
      if (!password) {
        throw new Error('请输入当前密码以确认注销');
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        throw new Error('密码错误');
      }
    }

    const suffix = `_cancelled_${userId}_${Date.now()}`;
    await user.update({
      status: 'cancelled',
      nickname: `已注销用户${suffix}`,
      avatar: null,
      background: null,
      phone: user.phone ? `cancelled${suffix}` : null,
      openid: user.openid ? `cancelled${suffix}` : null,
      password: null,
      username: user.username ? `cancelled${suffix}` : null,
    });
    return { success: true };
  }

  /**
   * 申请成为商家
   * @param {Number} userId - 用户ID
   * @param {Object} data - 申请数据
   */
  async applyMerchant(userId, data) {
    const { ctx } = this;
    const {
      business_name,
      contact,
      license_no,
      license_expiry,
      license_images,
      qualification_images,
      idcard_front,
      idcard_back,
      address,
      description,
    } = data;
    const user = await ctx.model.User.findByPk(userId);

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.role === 'merchant') {
      throw new Error('您已经是商家');
    }

    if (user.merchant_status === 'pending') {
      throw new Error('您的申请正在审核中');
    }

    // 更新用户状态为待审核（重新提交时清空之前的审核意见）
    try {
      await user.update({
        merchant_status: 'pending',
        business_name,
        contact,
        audit_opinion: null,
      });
    } catch (e) {
      ctx.logger.error('applyMerchant user.update 失败:', e.message, e.original?.message || '', e.stack);
      throw e;
    }

    // 记录商户资质信息到扩展表（可用于管理员审核）
    const now = new Date();
    const extPayload = {
      merchant_id: userId,
      license_expiry: license_expiry ? new Date(license_expiry) : null,
      license_no: license_no || null,
      license_images: Array.isArray(license_images) ? JSON.stringify(license_images) : (license_images || null),
      qualification_images: Array.isArray(qualification_images) ? JSON.stringify(qualification_images) : (qualification_images || null),
      idcard_front: idcard_front || null,
      idcard_back: idcard_back || null,
      address: address || null,
      description: description || null,
      created_at: now,
      updated_at: now,
    };

    try {
      const existingExt = await ctx.model.MerchantExt.findOne({ where: { merchant_id: userId } });
      if (existingExt) {
        await existingExt.update({ ...extPayload, created_at: existingExt.created_at || existingExt.createdAt || now });
      } else {
        await ctx.model.MerchantExt.create(extPayload);
      }
    } catch (e) {
      ctx.logger.error('applyMerchant MerchantExt create/update 失败:', e.message, e.original?.message || '', e.stack);
      throw e;
    }

    return user;
  }

  /**
   * 获取待审核的商户申请列表
   * @param {String} status - 审核状态
   */
  async getPendingMerchants(status) {
    const { ctx } = this;
    const where = {};
    
    if (status) {
      where.merchant_status = status;
    }

    const list = await ctx.model.User.findAll({
      where,
      attributes: [ 'id', 'openid', 'nickname', 'avatar', 'merchant_status', 'business_name', 'contact', 'audit_opinion', 'created_at' ],
      order: [[ 'created_at', 'DESC' ]],
    });

    const parseJsonArray = v => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    };

    const ids = list.map(u => u.id);
    const exts = await ctx.model.MerchantExt.findAll({
      where: { merchant_id: ids },
    });
    const extMap = new Map(exts.map(ext => [ ext.merchant_id, ext ]));

    const enriched = list.map(u => {
      const json = u.toJSON();
      const ext = extMap.get(u.id);
      if (ext) {
        const extJson = ext.toJSON();
        extJson.license_images = parseJsonArray(extJson.license_images);
        extJson.qualification_images = parseJsonArray(extJson.qualification_images);
        json.merchantExt = extJson;
      } else {
        json.merchantExt = null;
      }
      return json;
    });

    return { list: enriched };
  }

  /**
   * 获取当前用户的商户申请状态及上次提交信息（用于游客端展示审核意见、重新提交预填）
   * @param {Number} userId - 当前用户ID
   */
  async getMerchantApplicationStatus(userId) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(userId, {
      attributes: [ 'id', 'merchant_status', 'business_name', 'contact', 'audit_opinion' ],
    });
    if (!user) throw new Error('用户不存在');

    const result = {
      merchant_status: user.merchant_status,
      audit_opinion: user.audit_opinion || null,
      last_application: null,
    };

    const ext = await ctx.model.MerchantExt.findOne({
      where: { merchant_id: userId },
    });
    if (ext) {
      const parseJsonArray = v => {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
      };
      result.last_application = {
        business_name: user.business_name,
        contact: user.contact,
        license_no: ext.license_no,
        license_expiry: ext.license_expiry ? (ext.license_expiry instanceof Date ? ext.license_expiry.toISOString().slice(0, 10) : ext.license_expiry) : null,
        license_images: parseJsonArray(ext.license_images),
        qualification_images: parseJsonArray(ext.qualification_images),
        idcard_front: ext.idcard_front,
        idcard_back: ext.idcard_back,
        address: ext.address,
        description: ext.description,
      };
    } else if (user.business_name || user.contact) {
      result.last_application = {
        business_name: user.business_name,
        contact: user.contact,
        license_no: null,
        license_expiry: null,
        license_images: [],
        qualification_images: [],
        idcard_front: null,
        idcard_back: null,
        address: null,
        description: null,
      };
    }

    return result;
  }

  /**
   * 审核商户申请
   * @param {Number} userId - 用户ID
   * @param {Boolean} pass - 是否通过
   * @param {String} [auditOpinion] - 不通过时的审核意见
   */
  async auditMerchant(userId, pass, auditOpinion) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(userId);

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.merchant_status !== 'pending') {
      throw new Error('该申请不是待审核状态');
    }

    if (pass) {
      await user.update({
        role: 'merchant',
        merchant_status: 'approved',
        audit_opinion: null,
      });
    } else {
      await user.update({
        merchant_status: 'rejected',
        audit_opinion: auditOpinion || null,
      });
    }

    return user;
  }

  /**
   * 管理员登录
   * @param {String} username - 管理员用户名
   * @param {String} password - 管理员密码
   */
  async adminLogin(username, password) {
    const { ctx, app } = this;

    const adminUsername = (app.config.admin && app.config.admin.username) || 'admin';
    const configPassword = (app.config.admin && app.config.admin.password) || '';

    let admin = await ctx.model.Admin.findOne({
      where: { username: (username || '').trim() },
    });

    if (!admin) {
      const count = await ctx.model.Admin.count();
      if (count === 0 && username === adminUsername && password === configPassword) {
        const hashedPassword = await bcrypt.hash(password, 10);
        admin = await ctx.model.Admin.create({
          username: adminUsername,
          password: hashedPassword,
          nickname: '系统管理员',
          status: 'active',
        });
        ctx.logger.info('[管理员登录] 已创建首个管理员', { username: admin.username });
      } else {
        throw new Error('管理员用户名或密码错误');
      }
    } else {
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) throw new Error('管理员用户名或密码错误');
    }

    if (admin.status !== 'active') {
      throw new Error('管理员账号已停用或封禁');
    }

    const token = app.jwt.sign(
      { id: admin.id, role: 'admin' },
      app.config.jwt.secret,
      { expiresIn: '7d' }
    );

    ctx.logger.info('[管理员登录] 登录成功', { adminId: admin.id, username: admin.username });

    return {
      token,
      userInfo: {
        id: admin.id,
        nickname: admin.nickname || admin.username,
        avatar: null,
        role: 'admin',
      },
    };
  }

  /**
   * 管理员：用户列表（分页、按角色/状态筛选）
   */
  async listForAdmin({ page = 1, pageSize = 20, role, status } = {}) {
    const { ctx } = this;
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    const offset = (page - 1) * pageSize;
    const { count, rows } = await ctx.model.User.findAndCountAll({
      where,
      attributes: [ 'id', 'username', 'nickname', 'phone', 'avatar', 'role', 'status', 'merchant_status', 'business_name', 'last_login_at', 'created_at' ],
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset,
    });
    return { total: count, page, pageSize, list: rows };
  }

  /**
   * 管理员：商户列表（含店铺状态、经营情况）
   */
  async listMerchantsForAdmin({ page = 1, pageSize = 20, status } = {}) {
    const { ctx } = this;
    const where = { role: 'merchant' };

    // 只在状态是合法值时才加过滤，避免前端传入 'undefined' 等非法值导致查不到数据
    const validStatuses = [ 'active', 'inactive', 'banned', 'cancelled' ];
    const s = (status || '').toString().trim();
    if (validStatuses.includes(s)) {
      where.status = s;
    }
    const offset = (page - 1) * pageSize;
    const { count, rows } = await ctx.model.User.findAndCountAll({
      where,
      attributes: [ 'id', 'username', 'nickname', 'phone', 'avatar', 'status', 'merchant_status', 'business_name', 'contact', 'last_login_at', 'created_at' ],
      include: [{
        model: ctx.model.MerchantExt,
        as: 'ext',
        required: false,
        attributes: [ 'credit_level', 'credit_score', 'order_completion_rate', 'violation_count', 'status' ],
      }],
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset,
    });
    const list = rows.map(r => {
      const j = r.toJSON();
      j.shop_status = j.ext ? j.ext.status : 'normal';
      j.credit_level = j.ext ? j.ext.credit_level : null;
      j.credit_score = j.ext ? j.ext.credit_score : null;
      j.order_completion_rate = j.ext ? j.ext.order_completion_rate : null;
      j.violation_count = j.ext ? j.ext.violation_count : 0;
      delete j.ext;
      return j;
    });
    return { total: count, page, pageSize, list };
  }

  /**
   * 管理员：单个商户完整信息（含资质、营业执照、身份证、资质文件等）
   */
  async getMerchantDetailForAdmin(merchantId) {
    const { ctx } = this;
    const user = await ctx.model.User.findOne({
      where: { id: merchantId, role: 'merchant' },
      attributes: [ 'id', 'username', 'nickname', 'phone', 'avatar', 'status', 'merchant_status', 'business_name', 'contact', 'last_login_at', 'created_at' ],
      include: [{
        model: ctx.model.MerchantExt,
        as: 'ext',
        required: false,
        attributes: [
          'license_no', 'license_expiry', 'address', 'description',
          'license_images', 'qualification_images', 'idcard_front', 'idcard_back',
          'credit_level', 'credit_score', 'order_completion_rate', 'violation_count', 'status',
        ],
      }],
    });
    if (!user) throw new Error('商户不存在');
    const parseJsonArray = v => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    };
    const j = user.toJSON();
    j.shop_status = j.ext ? j.ext.status : 'normal';
    if (j.ext) {
      j.license_images = parseJsonArray(j.ext.license_images);
      j.qualification_images = parseJsonArray(j.ext.qualification_images);
      [ 'license_no', 'license_expiry', 'address', 'description',
        'credit_level', 'credit_score', 'order_completion_rate', 'violation_count' ].forEach(k => {
        j[k] = j.ext[k];
      });
      delete j.ext;
    } else {
      j.license_images = [];
      j.qualification_images = [];
    }
    return j;
  }

  /**
   * 管理员：更新用户状态（封禁/解封/注销）
   */
  async updateUserStatusByAdmin(userId, status) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(userId);
    if (!user) throw new Error('用户不存在');
    await user.update({ status });
    return user;
  }

  /**
   * 管理员：修改用户角色（授予/取消 管理员、商家、游客 权限）
   * 不允许取消最后一个管理员的 admin 身份
   */
  async updateUserRoleByAdmin(userId, newRole) {
    const { ctx } = this;
    const allowedRoles = [ 'consumer', 'merchant', 'admin' ];
    if (!allowedRoles.includes(newRole)) {
      throw new Error('角色需为 consumer / merchant / admin');
    }
    const user = await ctx.model.User.findByPk(userId);
    if (!user) throw new Error('用户不存在');
    const oldRole = user.role;
    if (oldRole === newRole) {
      return user;
    }
    // 若将某用户从 admin 改为其他角色，需保证系统至少还有一名管理员
    if (oldRole === 'admin' && newRole !== 'admin') {
      const adminCount = await ctx.model.User.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new Error('系统至少需保留一名管理员，无法取消该用户的管理员权限');
      }
    }
    await user.update({ role: newRole });
    return user;
  }

  /**
   * 发送找回密码验证码（存储到 Redis，10 分钟有效）
   * 生产环境应对接短信通道，此处仅生成并存储验证码
   */
  async sendResetCode(phone) {
    const { ctx, app } = this;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new Error('手机号格式不正确');
    }
    const user = await ctx.model.User.findOne({ where: { phone } });
    if (!user) {
      throw new Error('该手机号未注册');
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const key = `reset_code:${phone}`;
    await app.redis.set(key, code, 'EX', 600);
    return {
      sent: true,
      codeForDev: app.config.env === 'local' || app.config.env === 'unittest' ? code : undefined,
    };
  }

  /**
   * 通过验证码重置密码
   * 支持默认验证码 123456（无需先发送验证码）
   */
  async resetPassword(phone, code, newPassword) {
    const { ctx, app } = this;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new Error('手机号格式不正确');
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      throw new Error(pwdCheck.message);
    }
    // 默认验证码直接通过
    if (code !== '123456') {
      const key = `reset_code:${phone}`;
      const stored = await app.redis.get(key);
      if (!stored || stored !== code) {
        throw new Error('验证码错误或已过期');
      }
    }
    const user = await ctx.model.User.findOne({ where: { phone } });
    if (!user) {
      throw new Error('该手机号未注册');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });
    // 非默认验证码时清理 Redis
    if (code !== '123456') {
      const key = `reset_code:${phone}`;
      await app.redis.del(key);
    }
    return { success: true };
  }

  /**
   * 已登录用户修改密码（校验原密码）
   */
  async changePassword(userId, oldPassword, newPassword) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    if (!user.password) {
      throw new Error('当前账号未设置密码，请使用找回密码功能设置密码');
    }

    const validOld = await bcrypt.compare(oldPassword, user.password);
    if (!validOld) {
      throw new Error('原密码不正确');
    }
    if (oldPassword === newPassword) {
      throw new Error('新密码不能与原密码一致');
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      throw new Error(pwdCheck.message);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });
    return { success: true };
  }

  /**
   * 获取商家列表（前端使用）
   */
  async getMerchantsList({ page = 1, limit = 10, keyword } = {}) {
    const { ctx } = this;
    const where = { role: 'merchant', status: 'active' };
    if (keyword && String(keyword).trim() !== '') {
      where.business_name = { [ctx.model.Sequelize.Op.like]: `%${String(keyword).trim()}%` };
    }
    const offset = (page - 1) * limit;

    const { count, rows } = await ctx.model.User.findAndCountAll({
      where,
      attributes: [ 'id', 'business_name', 'contact', 'avatar' ],
      include: [{
        model: ctx.model.MerchantExt,
        as: 'ext',
        required: false,
        attributes: [ 'description', 'address', 'shop_images', 'credit_level' ],
      }],
      order: [[ 'created_at', 'DESC' ]],
      limit,
      offset,
    });

    const parseJsonArray = v => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    };

    const list = rows.map(r => {
      const j = r.toJSON();
      j.description = j.ext ? j.ext.description : '';
      j.address = j.ext ? j.ext.address : '';
      j.shop_images = j.ext ? parseJsonArray(j.ext.shop_images) : [];
      j.credit_level = j.ext ? j.ext.credit_level : 'B';
      delete j.ext;
      return j;
    });

    return { total: count, page, pageSize: limit, list };
  }

}

module.exports = UserService;
