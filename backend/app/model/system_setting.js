'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER } = app.Sequelize;

  const SystemSetting = app.model.define('system_setting', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      type: STRING(64),
      allowNull: false,
      unique: true,
      comment: '配置键，如 contact_phone',
    },
    value: {
      type: TEXT,
      comment: '配置值',
    },
  }, {
    tableName: 'system_settings',
    timestamps: true,
    underscored: true,
  });

  return SystemSetting;
};
