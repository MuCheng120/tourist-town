/**
 * 统一解析为 Date，无效返回 null
 */
function toDate(input) {
  if (input == null) return null;
  const date = new Date(input);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 格式化为日期 YYYY-MM-DD
 * @param {string|Date} dateStr
 * @param {string} fallback - 无效时返回值，默认 ''
 */
function formatDate(dateStr, fallback = '') {
  const date = toDate(dateStr);
  if (!date) return fallback;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化为日期时间 YYYY-MM-DD HH:mm
 * @param {string|Date} dateStr
 */
function formatTime(dateStr) {
  const date = toDate(dateStr);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 格式化为日期时间 YYYY-MM-DD HH:mm:ss
 * @param {string|Date} dateStr
 */
function formatTimeWithSeconds(dateStr) {
  const date = toDate(dateStr);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 将 ISO 或日期字符串格式化为常规时间显示（用于优惠券有效期等）
 * @param {string|Date} dateStr - ISO 或日期字符串，如 2026-03-13T15:59:59.000Z
 * @returns {string} 如 "2026-03-13 23:59"
 */
function formatExpiryDate(dateStr) {
  return formatTime(dateStr) || (typeof dateStr === 'string' ? dateStr : '');
}

/**
 * 用于酒店日期选择等：M月D日今天 / M月D日明天 / M月D日
 * @param {string|Date} dateStr
 */
function formatDateLabel(dateStr) {
  const date = toDate(dateStr);
  if (!date) return '';
  const m = date.getMonth() + 1;
  const day = date.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const isToday = d.getTime() === today.getTime();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.getTime() === tomorrow.getTime();
  if (isToday) return `${m}月${day}日今天`;
  if (isTomorrow) return `${m}月${day}日明天`;
  return `${m}月${day}日`;
}

/**
 * 解析 YYYY-MM-DD 为本地日历日 0 点（避免 new Date('YYYY-MM-DD') 按 UTC 解析的偏差）
 */
function parseLocalYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * 连住每一晚对应的日历日（不含离店日）：[checkIn, checkOut) 左闭右开，与后端库存按「入住日」一致
 */
function stayNightCalendarKeys(checkInYmd, checkOutYmd) {
  const start = parseLocalYmd(checkInYmd);
  const end = parseLocalYmd(checkOutYmd);
  if (!start || !end || start >= end) return [];
  const keys = [];
  for (let cur = new Date(start.getTime()); cur < end; cur.setDate(cur.getDate() + 1)) {
    keys.push(formatDate(cur));
  }
  return keys;
}

/**
 * 接口里库存 date 可能是 ISO 字符串，统一成 YYYY-MM-DD 再与入住晚比对
 */
function normalizeStockDateKey(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  if (raw instanceof Date) return formatDate(raw);
  const s = String(raw);
  const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m2 ? m2[1] : s.slice(0, 10);
}

module.exports = {
  formatDate,
  formatTime,
  formatTimeWithSeconds,
  formatExpiryDate,
  formatDateLabel,
  toDate,
  parseLocalYmd,
  stayNightCalendarKeys,
  normalizeStockDateKey,
};
