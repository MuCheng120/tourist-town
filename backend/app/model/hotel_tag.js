'use strict';

module.exports = app => {
  const { INTEGER } = app.Sequelize;

  const HotelTag = app.model.define('hotel_tag', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    hotel_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '酒店ID',
    },
    tag_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '标签ID',
    },
  }, {
    tableName: 'hotel_tags',
    timestamps: false,
    underscored: true,
    indexes: [
      { unique: true, fields: [ 'hotel_id', 'tag_id' ], name: 'uk_hotel_tag' },
      { fields: [ 'hotel_id' ], name: 'idx_hotel_id' },
      { fields: [ 'tag_id' ], name: 'idx_tag_id' },
    ],
  });

  HotelTag.associate = function() {
    app.model.HotelTag.belongsTo(app.model.Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
    app.model.HotelTag.belongsTo(app.model.Tag, { foreignKey: 'tag_id', as: 'tag' });
  };

  return HotelTag;
};
