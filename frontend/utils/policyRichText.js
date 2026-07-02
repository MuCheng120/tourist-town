/**
 * 酒店政策里的 rich_text_html：转成 rich-text 可用的 nodes 数组。
 * 直接绑 HTML 字符串在部分基础库/机型上可能空白，用节点数组更稳。
 * 支持：<p>、<br>、<strong>/<b>，以及无标签的纯文本；简单 HTML 实体。
 */

function decodeEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '');
}

/**
 * @param {string} html
 * @returns {Array|null} rich-text nodes；无法解析时返回 null（回退用 HTML 字符串）
 */
function policyHtmlToRichNodes(html) {
  const s = String(html || '').trim();
  if (!s) return null;
  if (s.startsWith('{') || s.startsWith('[')) return null;

  function inlineNodes(fragment) {
    const f = decodeEntities(fragment);
    const out = [];
    const re = /<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>|<br\s*\/?\s*>/gi;
    let last = 0;
    let m;
    while ((m = re.exec(f)) !== null) {
      if (m.index > last) {
        const plain = stripTags(f.slice(last, m.index));
        if (plain) out.push({ type: 'text', text: plain });
      }
      if (/^<br/i.test(m[0])) {
        out.push({ type: 'text', text: '\n' });
      } else {
        const t = stripTags(m[1] || '');
        if (t) {
          out.push({
            name: 'strong',
            children: [{ type: 'text', text: t }],
          });
        }
      }
      last = re.lastIndex;
    }
    const tail = stripTags(f.slice(last));
    if (tail) out.push({ type: 'text', text: tail });
    return out.length ? out : [{ type: 'text', text: stripTags(f) }];
  }

  const roots = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let px;
  let hasP = false;
  while ((px = pRe.exec(s)) !== null) {
    hasP = true;
    roots.push({
      name: 'div',
      attrs: { style: 'margin-bottom:12px;' },
      children: inlineNodes(px[1]),
    });
  }
  if (hasP) return roots.length ? roots : null;

  if (!/<[a-z]/i.test(s)) {
    return [{ type: 'text', text: decodeEntities(stripTags(s)) || s }];
  }

  return inlineNodes(s);
}

module.exports = {
  policyHtmlToRichNodes,
};
