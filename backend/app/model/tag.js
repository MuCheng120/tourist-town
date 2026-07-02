'use strict';

module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;

  const Tag = app.model.define('tag', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: STRING(32),
      allowNull: false,
      comment: '标签名称（如：免费停车、家庭房）',
    },
    description: {
      type: STRING(120),
      allowNull: true,
      comment: '简短描述（设施服务等处展示，可选）',
    },
    sort_order: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '排序，越小越靠前',
    },
  }, {
    tableName: 'tags',
    timestamps: true,
    underscored: true,
  });

  Tag.associate = function() {
    app.model.Tag.belongsToMany(app.model.Hotel, {
      through: app.model.HotelTag,
      foreignKey: 'tag_id',
      otherKey: 'hotel_id',
      as: 'hotels',
    });
    app.model.Tag.belongsToMany(app.model.ScenicSpot, {
      through: app.model.ScenicSpotTag,
      foreignKey: 'tag_id',
      otherKey: 'scenic_spot_id',
      as: 'scenic_spots',
    });
  };

  return Tag;
};
