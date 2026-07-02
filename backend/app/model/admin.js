'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE, ENUM } = app.Sequelize;

  const Admin = app.model.define('admin', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: STRING(50),
      allowNull: false,
      unique: true,
      comment: '登录用户名',
    },
    password: {
      type: STRING(255),
      allowNull: false,
      comment: '密码（bcrypt 加密）',
    },
    nickname: {
      type: STRING(50),
      comment: '昵称/显示名',
    },
    status: {
      type: ENUM('active', 'inactive', 'banned'),
      defaultValue: 'active',
      comment: '状态：active-正常 inactive-停用 banned-封禁',
    },
  }, {
    tableName: 'admins',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Admin.associate = function() {
    Admin.hasMany(app.model.ViolationLog, { foreignKey: 'admin_id', as: 'violationLogs' });
    Admin.hasMany(app.model.RoomType, { foreignKey: 'admin_id', as: 'roomTypes' });
  };

  return Admin;
};
