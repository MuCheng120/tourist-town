/**
 * 商户扩展信息表 Model
 * 
 * 功能说明：
 * 1. 存储商户的扩展信息，与 users 表一对一关联
 * 2. 记录商户信用评分和等级
 * 3. 跟踪商户资质有效期
 * 4. 记录违规次数和状态
 * 
 * 主要字段：
 * - merchant_id: 关联 users 表的商户 ID（唯一）
 * - license_expiry: 营业执照到期时间
 * - credit_score: 信用评分（0-100）
 * - credit_level: 信用等级（S/A/B/C）
 * - order_completion_rate: 订单完成率（0-1小数）
 * - violation_count: 违规次数
 * - status: 商户状态（normal/suspended/limited/revoked）
 * - deleted_at: 软删除时间戳
 * 
 * @module Model/MerchantExt
 * @author 系统生成
 * @created 2026-02-20
 */

module.exports = app => {
  const { STRING, INTEGER, DATE, DECIMAL, ENUM, TEXT } = app.Sequelize;

  const MerchantExt = app.model.define('merchant_ext', {
    /**
     * 主键 ID
     * @type {INTEGER.UNSIGNED}
     */
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      comment: '主键 ID',
    },

    /**
     * 商户 ID
     * 关联 users 表，外键约束
     * 唯一索引：一个商户只有一条扩展信息记录
     * @type {INTEGER.UNSIGNED}
     */
    merchant_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
      comment: '商户 ID，关联 users.id',
    },

    /**
     * 营业执照到期时间（选填）
     * 用于监控商户资质是否过期，系统会在到期前 30 天自动提醒
     * @type {DATE}
     */
    license_expiry: {
      type: DATE,
      allowNull: true,
      comment: '营业执照到期时间（选填）',
    },

    /**
     * 营业执照号 / 统一社会信用代码（选填）
     * @type {STRING}
     */
    license_no: {
      type: STRING(64),
      allowNull: true,
      comment: '营业执照号/统一社会信用代码（选填）',
    },

    /**
     * 营业执照图片（JSON数组）
     * @type {TEXT}
     */
    license_images: {
      type: TEXT,
      comment: '营业执照图片（JSON数组）',
    },

    /**
     * 资质文件（JSON数组，存上传文件 URL）
     * @type {TEXT}
     */
    qualification_images: {
      type: TEXT,
      comment: '资质文件（JSON数组，存上传文件URL）',
    },

    /**
     * 法人身份证正面照片 URL
     * @type {STRING}
     */
    idcard_front: {
      type: STRING(255),
      comment: '法人身份证正面照片URL',
    },

    /**
     * 法人身份证反面照片 URL
     * @type {STRING}
     */
    idcard_back: {
      type: STRING(255),
      comment: '法人身份证反面照片URL',
    },

    /**
     * 经营地址（选填）
     * @type {STRING}
     */
    address: {
      type: STRING(255),
      allowNull: true,
      comment: '经营地址（选填）',
    },

    /**
     * 店铺纬度（选填，用于距离与导航）
     * @type {DECIMAL(10,7)}
     */
    latitude: {
      type: DECIMAL(10, 7),
      allowNull: true,
      comment: '店铺纬度',
    },

    /**
     * 店铺经度（选填，用于距离与导航）
     * @type {DECIMAL(10,7)}
     */
    longitude: {
      type: DECIMAL(10, 7),
      allowNull: true,
      comment: '店铺经度',
    },

    /**
     * 商家简介
     * @type {STRING}
     */
    description: {
      type: STRING(500),
      comment: '商家简介',
    },

    /**
     * 店铺展示图片（环境、特色等）JSON 数组
     * @type {TEXT}
     */
    shop_images: {
      type: TEXT,
      allowNull: true,
      comment: '店铺展示图片（环境、特色等）JSON数组',
    },

    /**
     * 营业时间
     * @type {STRING}
     */
    business_hours: {
      type: STRING(255),
      allowNull: true,
      comment: '营业时间，如 09:00-21:00 或 周一至周日 09:00-21:00',
    },

    /**
     * 信用评分
     * 范围：0-100 分
     * 计算公式：游客评分 × 40% + 订单完成率 × 100 × 60%
     * 默认值：80 分（B 级）
     * @type {DECIMAL(5,2)}
     */
    credit_score: {
      type: DECIMAL(5, 2),
      defaultValue: 80,
      comment: '信用评分（0-100）',
    },

    /**
     * 信用等级
     * - S 级：90-100 分，首页推荐位 + 路线优先展示
     * - A 级：80-89 分，首页推荐位
     * - B 级：70-79 分，正常展示
     * - C 级：60-69 分，降权展示
     * @type {ENUM}
     */
    credit_level: {
      type: ENUM('S', 'A', 'B', 'C'),
      defaultValue: 'B',
      comment: '信用等级（S/A/B/C）',
    },

    /**
     * 订单完成率
     * 计算方式：已完成订单数 / 总订单数
     * 范围：0-1 的小数（如 0.95 表示 95%）
     * 默认值：1（100%）
     * @type {DECIMAL(3,2)}
     */
    order_completion_rate: {
      type: DECIMAL(3, 2),
      defaultValue: 1,
      comment: '订单完成率（0-1小数，如0.95表示95%）',
    },

    /**
     * 违规次数
     * 记录商户的违规行为次数
     * 每次管理员处罚后会自动 +1
     * @type {INTEGER.UNSIGNED}
     */
    violation_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '违规次数',
    },

    /**
     * 商户状态
     * - normal: 正常营业
     * - suspended: 暂停营业（资质过期或严重违规）
     * - limited: 限流（轻微违规，降低曝光）
     * - revoked: 注销账号
     * @type {ENUM}
     */
    status: {
      type: ENUM('normal', 'suspended', 'limited', 'revoked'),
      defaultValue: 'normal',
      comment: '商户状态（normal-正常，suspended-暂停营业，limited-限流，revoked-注销）',
    },

    /**
     * 上次等级更新时间
     * 记录最后一次更新信用等级的时间
     * 用于判断是否需要重新计算
     * @type {DATE}
     */
    last_level_update: {
      type: DATE,
      comment: '上次等级更新时间',
    },

    /**
     * 软删除时间戳
     * 用于实现软删除功能
     * NULL 表示未删除，有值表示已删除
     * @type {DATE}
     */
    deleted_at: {
      type: DATE,
      allowNull: true,
      comment: '软删除时间戳',
    },

    /**
     * 创建时间
     * 自动生成当前时间戳
     * @type {DATE}
     */
    created_at: {
      type: DATE,
      allowNull: false,
      comment: '创建时间',
    },

    /**
     * 更新时间
     * 数据更新时自动刷新
     * @type {DATE}
     */
    updated_at: {
      type: DATE,
      allowNull: false,
      comment: '更新时间',
    },
  }, {
    /**
     * 表名配置
     */
    tableName: 'merchant_ext',

    /**
     * 表注释
     */
    comment: '商户扩展信息表 - 存储商户信用、资质等扩展信息',

    /**
     * 索引配置
     * 用于优化查询性能
     */
    indexes: [
      {
        /**
         * 信用等级索引
         * 用于快速筛选特定等级的商户
         * 场景：首页推荐位筛选 S 级和 A 级商户
         */
        name: 'idx_credit_level',
        fields: ['credit_level'],
      },
      {
        /**
         * 商户状态索引
         * 用于快速筛选正常营业的商户
         * 场景：商品列表、订单创建时过滤非正常商户
         */
        name: 'idx_status',
        fields: ['status'],
      },
      {
        /**
         * 资质到期时间索引
         * 用于定时任务查询即将到期的商户
         * 场景：每天早上 8 点检查资质到期情况
         */
        name: 'idx_license_expiry',
        fields: ['license_expiry'],
      },
      {
        /**
         * 软删除索引
         * 用于快速查询未删除的记录
         */
        name: 'idx_deleted_at',
        fields: ['deleted_at'],
      },
    ],

    /**
     * Sequelize 配置
     * underscored: true - 使用下划线命名（created_at）
     * timestamps: true - 自动维护 created_at 和 updated_at
     * paranoid: true - 启用软删除（deleted_at）
     */
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  /**
   * 模型关联关系
   * 
   * MerchantExt 与 User 的关系：
   * - 一个商户扩展记录属于一个用户（商户）
   * - 使用 belongsTo 关联
   */
  MerchantExt.associate = function() {
    // 关联到 User 模型
    app.model.MerchantExt.belongsTo(app.model.User, {
      foreignKey: 'merchant_id',
      as: 'merchant',
      constraints: false, // 禁用外键约束，因为使用软删除
    });
  };

  /**
   * 实例方法：检查商户是否可以正常营业
   * @returns {Boolean} true-可以营业，false-不可以
   */
  MerchantExt.prototype.canOperate = function() {
    return this.status === 'normal' && this.deleted_at === null;
  };

  /**
   * 实例方法：获取商户信用等级描述
   * @returns {String} 信用等级描述
   */
  MerchantExt.prototype.getLevelDescription = function() {
    const descriptions = {
      S: '优秀 - 首页推荐位 + 路线优先展示',
      A: '良好 - 首页推荐位',
      B: '中等 - 正常展示',
      C: '较差 - 降权展示',
    };
    return descriptions[this.credit_level] || '未知等级';
  };

  /**
   * 类方法：根据评分确定等级
   * @param {Number} score - 信用评分（0-100）
   * @returns {String} 信用等级（S/A/B/C）
   */
  MerchantExt.calculateLevel = function(score) {
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    return 'C';
  };

  return MerchantExt;
};
