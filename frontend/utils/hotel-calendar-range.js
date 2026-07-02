/** 酒店入住/退房区间：与日历页、组件共用 */

function toYYYYMMDD(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const today = new Date();
  const isToday = today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth() && today.getDate() === day;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = tomorrow.getFullYear() === d.getFullYear() && tomorrow.getMonth() === d.getMonth() && tomorrow.getDate() === day;
  if (isToday) return `${m}月${day}日今天`;
  if (isTomorrow) return `${m}月${day}日明天`;
  return `${m}月${day}日`;
}

function nightCountBetween(checkInDate, checkOutDate) {
  if (!checkInDate || !checkOutDate) return 1;
  return Math.max(1, Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (24 * 60 * 60 * 1000)));
}

function buildConfirmPayload(range) {
  const start = range[0];
  const end = range[1];
  const checkInDate = toYYYYMMDD(start != null ? (start.getTime ? start : new Date(start)) : null);
  const checkOutDate = toYYYYMMDD(end != null ? (end.getTime ? end : new Date(end)) : null);
  if (!checkInDate || !checkOutDate) return null;
  if (new Date(checkOutDate).getTime() <= new Date(checkInDate).getTime()) return null;
  const nightCount = nightCountBetween(checkInDate, checkOutDate);
  return {
    checkInDate,
    checkOutDate,
    checkInStr: checkInDate.slice(5),
    checkOutStr: checkOutDate.slice(5),
    checkInLabel: formatDateLabel(checkInDate),
    checkOutLabel: formatDateLabel(checkOutDate),
    nightCount,
  };
}

module.exports = {
  toYYYYMMDD,
  formatDateLabel,
  nightCountBetween,
  buildConfirmPayload,
};
