/**
 * 酒店房费：房型价×晚数；可选每名儿童每晚加价（与 backend/config/config.default.js 中 hotel.chargeableChildFeePerNight 保持一致）
 */
const CHARGEABLE_CHILD_FEE_PER_NIGHT = 0;

function hotelRoomAndChildTotal(roomPrice, nightCount, childCount, feePerNight) {
  const nights = Math.max(0, Number(nightCount) || 0);
  const base = (Number(roomPrice) || 0) * nights;
  const fee = feePerNight != null ? Number(feePerNight) : CHARGEABLE_CHILD_FEE_PER_NIGHT;
  const f = Number.isFinite(fee) && fee > 0 ? fee : 0;
  const kids = Math.max(0, parseInt(childCount, 10) || 0);
  const surcharge = kids * f * nights;
  return {
    base,
    chargeableChildren: kids,
    childSurcharge: surcharge,
    total: base + surcharge,
  };
}

module.exports = {
  CHARGEABLE_CHILD_FEE_PER_NIGHT,
  hotelRoomAndChildTotal,
};
