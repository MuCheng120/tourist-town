'use strict';

/**
 * Context 扩展
 * 为 ctx 添加常用的辅助方法
 */

module.exports = {
  /**
   * 成功响应
   * @param {*} data - 返回数据
   * @param {String} message - 成功消息
   */
  success(data, message = '操作成功') {
    this.body = {
      code: 200,
      message,
      data,
    };
  },

  /**
   * 错误响应
   * @param {String} message - 错误消息
   * @param {Number} code - 错误码
   */
  error(message, code = 400) {
    this.status = code >= 500 ? code : 200; // HTTP状态码保持200，业务错误码在body中
    this.body = {
      code,
      message,
    };
  },

  /**
   * 分页响应
   * @param {Array} list - 数据列表
   * @param {Object} pagination - 分页信息
   */
  paginate(list, pagination = {}) {
    this.body = {
      code: 200,
      message: '获取成功',
      data: {
        list,
        pagination: {
          page: pagination.page || 1,
          pageSize: pagination.pageSize || 10,
          total: pagination.total || 0,
        },
      },
    };
  },
};
