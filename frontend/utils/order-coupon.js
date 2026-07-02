/**
 * 下单页：拉取可用优惠券（user_coupon.id，一单限用一张）
 * @param {object} app - getApp()
 * @param {{ totalAmount: number, merchantId?: number|string }} opts
 */
function fetchAvailableCoupons(app, { totalAmount, merchantId }) {
  const data = { totalAmount: Number(totalAmount) || 0 };
  if (merchantId != null && merchantId !== '') {
    data.merchantId = merchantId;
  }
  return app.request({
    url: '/api/coupons/available',
    method: 'GET',
    data,
    needAuth: true,
  });
}

function computeDiscount(total, coupon) {
  const t = Number(total) || 0;
  const discount = coupon ? Math.min(Number(coupon.value) || 0, t) : 0;
  return {
    discountAmount: discount,
    finalAmount: Math.max(0, t - discount),
  };
}

module.exports = {
  fetchAvailableCoupons,
  computeDiscount,
};
