'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DATE } = app.Sequelize;

  const Logistics = app.model.define('logistics', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: INTEGER.UNSIGNED,
      comment: '订单ID',
    },
    company: {
      type: STRING(50),
      comment: '快递公司',
    },
    company_code: {
      type: STRING(20),
      comment: '快递公司编码',
    },
    tracking_no: {
      type: STRING(50),
      comment: '快递单号',
    },
    status: {
      type: STRING(20),
      comment: '物流状态',
    },
    traces: {
      type: TEXT,
      comment: '物流轨迹（JSON）',
    },
    last_update: {
      type: DATE,
      comment: '最后更新时间',
    },
  }, {
    tableName: 'logistics',
    timestamps: true,
    underscored: true,
  });

  Logistics.associate = function() {
    app.model.Logistics.belongsTo(app.model.Order, { foreignKey: 'order_id', as: 'order' });
  };

  return Logistics;
};
