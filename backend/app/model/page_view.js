'use strict';

module.exports = app => {
  const { INTEGER, STRING, DATE } = app.Sequelize;

  const PageView = app.model.define('page_view', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      comment: '用户ID',
    },
    page_path: {
      type: STRING(255),
      allowNull: false,
      comment: '页面路径',
    },
    ip_address: {
      type: STRING(50),
      comment: 'IP地址',
    },
  }, {
    tableName: 'page_views',
    timestamps: true,
    underscored: true,
    updatedAt: false,
  });

  PageView.associate = function() {
    app.model.PageView.belongsTo(app.model.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return PageView;
};
