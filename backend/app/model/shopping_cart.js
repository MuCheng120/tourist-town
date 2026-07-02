'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const ShoppingCart = app.model.define('shopping_cart', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '用户ID',
    },
    product_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '商品ID',
    },
    quantity: {
      type: INTEGER.UNSIGNED,
      defaultValue: 1,
      comment: '数量',
    },
    created_at: {
      type: DATE,
      allowNull: false,
    },
    updated_at: {
      type: DATE,
      allowNull: false,
    },
  }, {
    tableName: 'shopping_cart',
    comment: '购物车表',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: [ 'user_id', 'product_id' ],
        name: 'uk_user_product',
      },
      {
        fields: [ 'user_id' ],
      },
    ],
  });

  ShoppingCart.associate = function() {
    // 关联用户
    app.model.ShoppingCart.belongsTo(app.model.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    // 关联商品
    app.model.ShoppingCart.belongsTo(app.model.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });
  };

  return ShoppingCart;
};
