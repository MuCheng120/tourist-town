// pages/hotel/facility-policy.js - 政策设施独立页（tab -> 锚点滚动）
const app = getApp();
const { policyHtmlToRichNodes } = require('../../utils/policyRichText');

Page({
  data: {
    hotelId: null,
    hotel: null,
    activeTab: 'highlights', // highlights | facilities | policies
    scrollIntoView: 'highlights',
    policySections: [],
    policyRichTextHtml: '',
    policyRichTextNodes: null,
  },

  onLoad(options) {
    const id = options.id;
    const target = options.target;
    const tab = this._normalizeTab(target);
    this.setData({
      hotelId: id,
      activeTab: tab,
      scrollIntoView: tab,
    });
    this.loadHotel();
  },

  _normalizeTab(tab) {
    if (tab === 'facilities') return 'facilities';
    if (tab === 'policies') return 'policies';
    return 'highlights';
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    const next = this._normalizeTab(tab);
    this.setData({
      activeTab: next,
      scrollIntoView: next,
    });
  },

  onScroll() {
    // 这里不做“滚动联动高亮”，避免计算开销；只支持点击tab跳转定位
  },

  async loadHotel() {
    const id = this.data.hotelId;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    try {
      const hotel = await app.request({
        url: `/api/hotels/${id}`,
        method: 'GET',
      });
      const hotelDisplay = hotel ? { ...hotel } : {};
      if (hotelDisplay.tags && Array.isArray(hotelDisplay.tags)) {
        hotelDisplay.tags = hotelDisplay.tags.map(t => ({
          ...t,
          icon_name: this.getTagIconName(t && t.name ? String(t.name) : ''),
        }));
      } else {
        hotelDisplay.tags = [];
      }
      const policyData = this.parsePolicyInfo(hotelDisplay.policy_info);
      this.setData({
        hotel: hotelDisplay,
        policySections: policyData.sections,
        policyRichTextHtml: policyData.richTextHtml,
        policyRichTextNodes: policyData.richTextNodes,
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  getTagIconName(tagName) {
    const n = (tagName || '').trim();
    if (!n) return 'passed';
    if (n.includes('前台')) return 'hotel-o';
    if (n.includes('入住')) return 'underway-o';
    if (n.includes('健身')) return 'fire-o';
    if (n.includes('洗衣')) return 'after-sale';
    if (n.includes('叫醒')) return 'clock-o';
    if (n.includes('停车')) return 'logistics';
    if (n.includes('早餐')) return 'shop-o';
    if (n.includes('泳池')) return 'photo-o';
    if (n.includes('接送')) return 'location-o';
    if (n.includes('会议')) return 'notes-o';
    if (n.includes('亲子')) return 'friends-o';
    if (n.includes('温泉')) return 'fire-o';
    if (n.includes('WiFi') || n.includes('wifi')) return 'points';
    return 'passed';
  },

  parsePolicyInfo(policyInfo) {
    let info = policyInfo;
    if (!info) return { sections: [], richTextHtml: '', richTextNodes: null };
    if (typeof info === 'string') {
      try {
        info = JSON.parse(info);
      } catch (e) {
        return { sections: [], richTextHtml: '', richTextNodes: null };
      }
    }
    if (!info || typeof info !== 'object') return { sections: [], richTextHtml: '', richTextNodes: null };

    const sections = [];
    const pushSection = (title, items) => {
      const normalized = (Array.isArray(items) ? items : [])
        .map(s => (s == null ? '' : String(s).trim()))
        .filter(Boolean);
      if (normalized.length > 0) {
        sections.push({ title, items: normalized });
      }
    };

    const checkInItems = [];
    if (info.check_in && typeof info.check_in === 'object') {
      if (info.check_in.from && info.check_in.to) checkInItems.push(`入住时间：${info.check_in.from} - ${info.check_in.to}`);
      else if (info.check_in.from) checkInItems.push(`入住时间：${info.check_in.from}后`);
      if (info.check_in.note) checkInItems.push(info.check_in.note);
    }
    if (info.check_out && typeof info.check_out === 'object') {
      if (info.check_out.before) checkInItems.push(`退房时间：${info.check_out.before}前`);
      if (info.check_out.note) checkInItems.push(info.check_out.note);
    }
    pushSection('入住与退房', checkInItems);

    const depositItems = [];
    if (info.deposit && typeof info.deposit === 'object') {
      if (info.deposit.required === true) {
        const amount = info.deposit.amount != null ? `，金额 ${info.deposit.amount}${info.deposit.currency || '元'}` : '';
        depositItems.push(`需押金${amount}`);
      } else if (info.deposit.required === false) {
        depositItems.push('免押金');
      }
      if (info.deposit.note) depositItems.push(info.deposit.note);
    }
    pushSection('押金说明', depositItems);

    const invoiceItems = [];
    if (info.invoice && typeof info.invoice === 'object') {
      if (info.invoice.supported === true) invoiceItems.push('支持开发票');
      else if (info.invoice.supported === false) invoiceItems.push('不支持开发票');
      if (Array.isArray(info.invoice.types) && info.invoice.types.length > 0) {
        invoiceItems.push(`发票类型：${info.invoice.types.join(' / ')}`);
      }
      if (info.invoice.note) invoiceItems.push(info.invoice.note);
    }
    pushSection('发票规则', invoiceItems);

    const childItems = [];
    if (info.children_extra_bed && typeof info.children_extra_bed === 'object') {
      const c = info.children_extra_bed;
      if (c.child_free_rule) childItems.push(c.child_free_rule);
      if (c.extra_bed_supported === true) {
        const p = c.extra_bed_price != null ? `，加床费用 ${c.extra_bed_price}元/晚` : '';
        childItems.push(`支持加床${p}`);
      } else if (c.extra_bed_supported === false) {
        childItems.push('不支持加床');
      }
      if (c.extra_bed_note) childItems.push(c.extra_bed_note);
    }
    pushSection('儿童与加床', childItems);

    let richTextHtml = info.rich_text_html ? String(info.rich_text_html) : '';
    const trimmed = richTextHtml.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      richTextHtml = '';
    }
    let richTextNodes = null;
    if (richTextHtml) {
      richTextNodes = policyHtmlToRichNodes(richTextHtml);
      if (richTextNodes && richTextNodes.length) {
        richTextHtml = '';
      } else {
        richTextNodes = null;
      }
    }
    return { sections, richTextHtml, richTextNodes };
  },
});

