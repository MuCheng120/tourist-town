'use strict';

const Service = require('egg').Service;

class ShoppingCartService extends Service {
  /**
   * 获取购物车列表
   * @param {Number} userId - 用户ID
   */
  async getCartList(userId) {
    const { ctx } = this;

    const cartItems = await ctx.model.ShoppingCart.findAll({
      where: { user_id: userId },
      include: [
        {
          model: ctx.model.Product,
          as: 'product',
          attributes: [ 'id', 'name', 'price', 'stock', 'images', 'cover_image', 'merchant_id', 'status', 'product_type' ],
          include: [
            {
              model: ctx.model.User,
              as: 'merchant',
              attributes: [ 'id', 'nickname' ],
            },
          ],
        },
      ],
      order: [[ 'created_at', 'DESC' ]],
    });

    // 过滤掉已下架或已删除的商品
    const validItems = cartItems.filter(item => {
      return item.product && item.product.status === 1;
    });

    // 计算总价
    const totalAmount = validItems.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    return {
      list: validItems,
      totalAmount,
      totalCount: validItems.length,
    };
  }

  /**
   * 添加到购物车
   * @param {Number} userId - 用户ID
   * @param {Number} productId - 商品ID
   * @param {Number} quantity - 数量
   */
  async addToCart(userId, productId, quantity = 1) {
    const { ctx } = this;

    // 检查商品是否存在
    const product = await ctx.model.Product.findByPk(productId);
    if (!product) {
      throw new Error('商品不存在');
    }

    if (product.status !== 1) {
      throw new Error('商品已下架');
    }

    if (product.stock < quantity) {
      throw new Error('库存不足');
    }

    // 检查购物车是否已有该商品
    const cartItem = await ctx.model.ShoppingCart.findOne({
      where: {
        user_id: userId,
        product_id: productId,
      },
    });

    if (cartItem) {
      // 更新数量
      const newQuantity = cartItem.quantity + quantity;
      if (product.stock < newQuantity) {
        throw new Error('库存不足');
      }
      await cartItem.update({ quantity: newQuantity });
      return cartItem;
    } else {
      // 新增购物车项（显式设置时间戳，避免 notNull 报错）
      const now = new Date();
      const newCartItem = await ctx.model.ShoppingCart.create({
        user_id: userId,
        product_id: productId,
        quantity,
        created_at: now,
        updated_at: now,
      });
      return newCartItem;
    }
  }

  /**
   * 更新购物车商品数量
   * @param {Number} userId - 用户ID
   * @param {Number} cartId - 购物车项ID
   * @param {Number} quantity - 数量
   */
  async updateQuantity(userId, cartId, quantity) {
    const { ctx } = this;

    if (quantity <= 0) {
      throw new Error('数量必须大于0');
    }

    const cartItem = await ctx.model.ShoppingCart.findOne({
      where: {
        id: cartId,
        user_id: userId,
      },
      include: [
        {
          model: ctx.model.Product,
          as: 'product',
        },
      ],
    });

    if (!cartItem) {
      throw new Error('购物车项不存在');
    }

    if (cartItem.product.stock < quantity) {
      throw new Error('库存不足');
    }

    await cartItem.update({ quantity });
    return cartItem;
  }

  /**
   * 删除购物车商品
   * @param {Number} userId - 用户ID
   * @param {Number} cartId - 购物车项ID
   */
  async removeFromCart(userId, cartId) {
    const { ctx } = this;

    const cartItem = await ctx.model.ShoppingCart.findOne({
      where: {
        id: cartId,
        user_id: userId,
      },
    });

    if (!cartItem) {
      throw new Error('购物车项不存在');
    }

    await cartItem.destroy();
    return { message: '删除成功' };
  }

  /**
   * 清空购物车
   * @param {Number} userId - 用户ID
   */
  async clearCart(userId) {
    const { ctx } = this;

    await ctx.model.ShoppingCart.destroy({
      where: { user_id: userId },
    });

    return { message: '购物车已清空' };
  }

  /**
   * 批量删除购物车商品
   * @param {Number} userId - 用户ID
   * @param {Array} cartIds - 购物车项ID数组
   */
  async batchRemove(userId, cartIds) {
    const { ctx } = this;

    await ctx.model.ShoppingCart.destroy({
      where: {
        id: cartIds,
        user_id: userId,
      },
    });

    return { message: '删除成功' };
  }

  /**
   * 获取购物车商品数量
   * @param {Number} userId - 用户ID
   */
  async getCartCount(userId) {
    const { ctx } = this;

    const count = await ctx.model.ShoppingCart.count({
      where: { user_id: userId },
    });

    return { count };
  }
}

module.exports = ShoppingCartService;
