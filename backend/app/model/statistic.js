'use strict';

module.exports = app => {
  const { DATE, INTEGER, DECIMAL } = app.Sequelize;

  const Statistic = app.model.define('statistic', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    stat_date: {
      type: DATE,
      allowNull: false,
      comment: '统计日期',
    },
    page_views: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: 'PV（页面浏览量）',
    },
    unique_visitors: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: 'UV（独立访客数）',
    },
    gmv: {
      type: DECIMAL(15, 2),
      defaultValue: 0,
      comment: '成交总额',
    },
    order_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '订单数量',
    },
  }, {
    tableName: 'statistics',
    timestamps: true,
    underscored: true,
  });

  return Statistic;
};
