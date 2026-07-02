'use strict';

module.exports = app => {
  const { DATE, INTEGER } = app.Sequelize;

  const RoomStock = app.model.define('room_stock', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    room_type_id: {
      type: INTEGER.UNSIGNED,
      comment: '房型ID',
    },
    date: {
      type: DATE,
      comment: '日期',
    },
    remained_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '剩余库存',
    },
  }, {
    tableName: 'room_stocks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['room_type_id', 'date']
      }
    ]
  });

  RoomStock.associate = function() {
    app.model.RoomStock.belongsTo(app.model.RoomType, { foreignKey: 'room_type_id', as: 'room_type' });
  };

  return RoomStock;
};
