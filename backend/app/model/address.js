'use strict';

module.exports = app => {
  const { STRING, INTEGER, BOOLEAN } = app.Sequelize;

  const Address = app.model.define('address', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      comment: '地址ID',
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '用户ID',
    },
    user_name: {
      type: STRING(50),
      allowNull: false,
      comment: '收货人姓名',
    },
    tel_number: {
      type: STRING(20),
      allowNull: false,
      comment: '手机号',
    },
    province_name: {
      type: STRING(50),
      allowNull: false,
      comment: '省',
    },
    city_name: {
      type: STRING(50),
      allowNull: false,
      comment: '市',
    },
    county_name: {
      type: STRING(50),
      allowNull: false,
      comment: '区/县',
    },
    detail_info: {
      type: STRING(200),
      allowNull: false,
      comment: '详细地址',
    },
    postal_code: {
      type: STRING(10),
      allowNull: true,
      comment: '邮政编码',
    },
    is_default: {
      type: BOOLEAN,
      defaultValue: false,
      comment: '是否默认地址',
    },
  }, {
    tableName: 'addresses',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: [ 'user_id', 'id' ],
      },
    ],
  });

  Address.associate = function() {
    app.model.Address.belongsTo(app.model.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return Address;
};
