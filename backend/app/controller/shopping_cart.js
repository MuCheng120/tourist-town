'use strict';

const Controller = require('egg').Controller;

class ShoppingCartController extends Controller {
  /**
   * 获取购物车列表
   */
  async list() {
    const { ctx } = this;
    const userId = ctx.state.user.id;

    try {
      const result = await ctx.service.shoppingCart.getCartList(userId);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 添加到购物车
   */
  async add() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { product_id, quantity } = ctx.request.body;

    try {
      const cartItem = await ctx.service.shoppingCart.addToCart(
        userId,
        product_id,
        quantity
      );
      ctx.body = {
        code: 200,
        message: '添加成功',
        data: cartItem,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '添加失败',
      };
    }
  }

  /**
   * 更新购物车商品数量
   */
  async updateQuantity() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { id } = ctx.params;
    const { quantity } = ctx.request.body;

    try {
      const cartItem = await ctx.service.shoppingCart.updateQuantity(
        userId,
        id,
        quantity
      );
      ctx.body = {
        code: 200,
        message: '更新成功',
        data: cartItem,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '更新失败',
      };
    }
  }

  /**
   * 删除购物车商品
   */
  async remove() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { id } = ctx.params;

    try {
      await ctx.service.shoppingCart.removeFromCart(userId, id);
      ctx.body = {
        code: 200,
        message: '删除成功',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '删除失败',
      };
    }
  }

  /**
   * 清空购物车
   */
  async clear() {
    const { ctx } = this;
    const userId = ctx.state.user.id;

    try {
      await ctx.service.shoppingCart.clearCart(userId);
      ctx.body = {
        code: 200,
        message: '清空成功',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '清空失败',
      };
    }
  }

  /**
   * 批量删除购物车商品
   */
  async batchRemove() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { ids } = ctx.request.body;

    try {
      await ctx.service.shoppingCart.batchRemove(userId, ids);
      ctx.body = {
        code: 200,
        message: '删除成功',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '删除失败',
      };
    }
  }

  /**
   * 获取购物车商品数量
   */
  async count() {
    const { ctx } = this;
    const userId = ctx.state.user.id;

    try {
      const result = await ctx.service.shoppingCart.getCartCount(userId);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }
}

module.exports = ShoppingCartController;
