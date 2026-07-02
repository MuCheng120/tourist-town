/**
 * 违规记录表 Model
 * 
 * 功能说明：
 * 1. 记录管理员对商户的处罚操作
 * 2. 跟踪违规类型、原因和处理状态
 * 3. 支持违规记录的查询和历史追溯
 * 4. 用于商户信用评级和违规统计
 * 
 * 主要字段：
 * - merchant_id: 被处罚的商户 ID
 * - admin_id: 执行处罚的管理员 ID
 * - violation_type: 违规类型（warning/limit/suspend/revoke）
 * - reason: 违规原因说明
 * - status: 记录状态（active/resolved）
 * - deleted_at: 软删除时间戳
 * 
 * @module Model/ViolationLog
 * @author 系统生成
 * @created 2026-02-20
 */

module.exports = app => {
  const { STRING, INTEGER, DATE, TEXT, ENUM } = app.Sequelize;

  const ViolationLog = app.model.define('violation_logs', {
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
     * 关联 users 表，指向被处罚的商户
     * 外键关系：violation_logs.merchant_id → users.id
     * @type {INTEGER.UNSIGNED}
     */
    merchant_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '商户 ID，关联 users.id（被处罚的商户）',
    },

    /**
     * 管理员 ID
     * 关联 users 表，指向执行处罚操作的管理员
     * 外键关系：violation_logs.admin_id → users.id
     * @type {INTEGER.UNSIGNED}
     */
    admin_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '管理员 ID，关联 users.id（执行处罚的管理员）',
    },

    /**
     * 违规类型
     * 定义了四种处罚类型，严重程度递增：
     * - warning: 警告（轻微违规，不影响经营）
     * - limit: 限流（降低曝光权重，但仍可正常经营）
     * - suspend: 暂停营业（严重违规，下架所有商品和房型）
     * - revoke: 注销账号（最严重处罚，永久封禁）
     * @type {ENUM}
     */
    violation_type: {
      type: ENUM('warning', 'limit', 'suspend', 'revoke'),
      allowNull: false,
      comment: '违规类型（warning-警告，limit-限流，suspend-暂停营业，revoke-注销）',
    },

    /**
     * 违规原因
     * 管理员填写的违规详情说明
     * 支持长文本，详细描述违规行为
     * @type {TEXT}
     */
    reason: {
      type: TEXT,
      allowNull: true,
      comment: '违规原因说明',
    },

    /**
     * 记录状态
     * - active: 生效中（处罚仍在执行）
     * - resolved: 已解除（管理员已撤销该处罚）
     * @type {ENUM}
     */
    status: {
      type: ENUM('active', 'resolved'),
      defaultValue: 'active',
      comment: '记录状态（active-生效中，resolved-已解除）',
    },

    /**
     * 软删除时间戳
     * 用于实现软删除功能
     * NULL 表示未删除，有值表示已删除
     * 即使违规记录被删除，也应保留历史数据用于审计
     * @type {DATE}
     */
    deleted_at: {
      type: DATE,
      allowNull: true,
      comment: '软删除时间戳',
    },

    /**
     * 创建时间
     * 记录处罚操作执行的时间
     * @type {DATE}
     */
    created_at: {
      type: DATE,
      allowNull: false,
      defaultValue: app.Sequelize.NOW,
      comment: '创建时间（处罚时间）',
    },

    /**
     * 更新时间
     * 记录状态变更的时间
     * @type {DATE}
     */
    updated_at: {
      type: DATE,
      allowNull: false,
      defaultValue: app.Sequelize.NOW,
      comment: '更新时间',
    },
  }, {
    /**
     * 表名配置
     */
    tableName: 'violation_logs',

    /**
     * 表注释
     */
    comment: '违规记录表 - 记录管理员对商户的处罚操作',

    /**
     * 索引配置
     * 用于优化查询性能
     */
    indexes: [
      {
        /**
         * 商户 ID 索引
         * 用于查询某个商户的所有违规记录
         * 场景：商户端查看违规历史
         */
        name: 'idx_merchant_id',
        fields: ['merchant_id'],
      },
      {
        /**
         * 管理员 ID 索引
         * 用于查询某个管理员执行的所有处罚
         * 场景：管理员操作日志审计
         */
        name: 'idx_admin_id',
        fields: ['admin_id'],
      },
      {
        /**
         * 记录状态索引
         * 用于筛选生效中的违规记录
         * 场景：统计当前生效的处罚数量
         */
        name: 'idx_status',
        fields: ['status'],
      },
      {
        /**
         * 违规类型索引
         * 用于按类型统计违规记录
         * 场景：生成违规类型分布报表
         */
        name: 'idx_violation_type',
        fields: ['violation_type'],
      },
      {
        /**
         * 组合索引：商户 ID + 状态
         * 用于查询某个商户的生效违规记录
         * 场景：检查商户是否有未解除的处罚
         */
        name: 'idx_merchant_status',
        fields: ['merchant_id', 'status'],
      },
      {
        /**
         * 软删除索引
         * 用于快速查询未删除的记录
         */
        name: 'idx_deleted_at',
        fields: ['deleted_at'],
      },
      {
        /**
         * 时间索引
         * 用于按时间范围查询违规记录
         * 场景：统计某时间段的违规数量
         */
        name: 'idx_created_at',
        fields: ['created_at'],
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
   * ViolationLog 与 User 的关系：
   * - 一个违规记录属于一个商户（merchant_id）
   * - 一个违规记录由一个管理员执行（admin_id）
   * - 使用 belongsTo 关联
   */
  ViolationLog.associate = function() {
    // 关联到被处罚的商户（User 表）
    app.model.ViolationLog.belongsTo(app.model.User, {
      foreignKey: 'merchant_id',
      as: 'merchant',
      constraints: false, // 禁用外键约束，因为使用软删除
    });

    // 关联到执行处罚的管理员（admins 表，与用户完全分离）
    app.model.ViolationLog.belongsTo(app.model.Admin, {
      foreignKey: 'admin_id',
      as: 'admin',
      constraints: false,
    });
  };

  /**
   * 实例方法：检查违规记录是否生效中
   * @returns {Boolean} true-生效中，false-已解除
   */
  ViolationLog.prototype.isActive = function() {
    return this.status === 'active' && this.deleted_at === null;
  };

  /**
   * 实例方法：获取违规类型的中文描述
   * @returns {String} 违规类型描述
   */
  ViolationLog.prototype.getTypeDescription = function() {
    const descriptions = {
      warning: '警告 - 轻微违规，不影响经营',
      limit: '限流 - 降低曝光权重',
      suspend: '暂停营业 - 下架所有商品',
      revoke: '注销账号 - 永久封禁',
    };
    return descriptions[this.violation_type] || '未知类型';
  };

  /**
   * 实例方法：获取违规严重程度等级
   * @returns {Number} 严重程度（1-4，数字越大越严重）
   */
  ViolationLog.prototype.getSeverity = function() {
    const severityMap = {
      warning: 1,
      limit: 2,
      suspend: 3,
      revoke: 4,
    };
    return severityMap[this.violation_type] || 0;
  };

  /**
   * 实例方法：解除违规处罚
   * @returns {Promise} 更新后的记录
   */
  ViolationLog.prototype.resolve = async function() {
    this.status = 'resolved';
    return await this.save();
  };

  /**
   * 类方法：获取商户的生效违规记录
   * @param {Number} merchantId - 商户 ID
   * @returns {Promise<Array>} 违规记录数组
   */
  ViolationLog.getActiveViolations = async function(merchantId) {
    return await this.findAll({
      where: {
        merchant_id: merchantId,
        status: 'active',
      },
      order: [['created_at', 'DESC']],
    });
  };

  /**
   * 类方法：统计商户的违规次数
   * @param {Number} merchantId - 商户 ID
   * @param {String} type - 违规类型（可选）
   * @returns {Promise<Number>} 违规次数
   */
  ViolationLog.countViolations = async function(merchantId, type = null) {
    const where = {
      merchant_id: merchantId,
    };
    
    if (type) {
      where.violation_type = type;
    }
    
    return await this.count({ where });
  };

  /**
   * 类方法：获取违规类型统计
   * @param {Object} options - 查询选项（可选的时间范围等）
   * @returns {Promise<Object>} 各类型违规数量统计
   */
  ViolationLog.getViolationStats = async function(options = {}) {
    const { startDate, endDate } = options;
    
    const where = {};
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[app.Sequelize.Op.gte] = startDate;
      if (endDate) where.created_at[app.Sequelize.Op.lte] = endDate;
    }
    
    const results = await this.findAll({
      where,
      attributes: [
        'violation_type',
        [app.Sequelize.fn('COUNT', app.Sequelize.col('id')), 'count'],
      ],
      group: ['violation_type'],
      raw: true,
    });
    
    // 转换为对象格式
    const stats = {
      warning: 0,
      limit: 0,
      suspend: 0,
      revoke: 0,
      total: 0,
    };
    
    results.forEach(row => {
      stats[row.violation_type] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });
    
    return stats;
  };

  return ViolationLog;
};
