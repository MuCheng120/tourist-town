/**
 * 用户端订单支付（与订单列表「去支付」一致）
 */
function payOrderById(orderId) {
  const app = getApp();
  return app.request({
    url: `/api/orders/${orderId}/pay`,
    method: 'POST',
    needAuth: true,
  });
}

module.exports = { payOrderById };
