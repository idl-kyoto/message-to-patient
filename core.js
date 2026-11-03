// 書面の組み立てと点検の処理（画面に依存しない）
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MTP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function findVar(data, id) { return data.variables.find(v => v.id === id); }

  function textOf(data, overrides, v, o) {
    const k = v.id + '.' + o.id;
    return overrides && Object.prototype.hasOwnProperty.call(overrides, k) ? overrides[k] : o.text;
  }

  function initialState(data) {
    const sel = {}, special = {};
    data.variables.forEach(v => {
      sel[v.id] = v.type === 'always' ? [v.options[0].id] : [];
      special[v.id] = '';
    });
    return { sel, special };
  }

  // 選択の操作。always は外せない。single は1つ。multi は none と他を同時に選べない
  function setChoice(data, state, varId, optId, checked) {
    const v = findVar(data, varId);
    const o = v.options.find(x => x.id === optId);
    if (v.type === 'always') { state.sel[varId] = [v.options[0].id]; return; }
    if (v.type === 'single') { state.sel[varId] = checked ? [optId] : []; return; }
    let cur = state.sel[varId].filter(x => x !== optId);
    if (checked) {
      if (o.none) cur = [optId];
      else cur = cur.filter(id => !v.options.find(p => p.id === id).none).concat(optId);
    }
    state.sel[varId] = v.options.filter(p => cur.includes(p.id)).map(p => p.id);
  }

  function buildSheet(data, state, overrides, contacts) {
    const sections = data.sections.map(s => {
      const items = [];
      data.variables.filter(v => v.section === s.id).forEach(v => {
        const parts = [];
        v.options.forEach(o => {
          if (!state.sel[v.id].includes(o.id) || o.none) return;
          const t = textOf(data, overrides, v, o);
          parts.push(t.trim() === '' ? o.name : t);
        });
        const sp = (state.special[v.id] || '').trim();
        if (parts.length || sp) items.push({ varId: v.id, texts: parts, special: sp });
      });
      return { id: s.id, name: s.name, items };
    });
    const notice = {
      body: data.fixedNotice.body,
      lines: data.fixedNotice.contacts.map(c => {
        const val = contacts && contacts[c.id] ? contacts[c.id] : c.placeholder;
        return c.label + '：' + val;
      })
    };
    return { sections, notice };
  }

  function inspect(data, state, overrides, contacts) {
    const blockers = [], warnings = [];
    data.variables.forEach(v => {
      const sel = state.sel[v.id];
      if (v.type !== 'always' && sel.length === 0) blockers.push('選び忘れ：' + v.name);
    });
    if (!data.fixedNotice || !data.fixedNotice.body || !data.fixedNotice.body.trim())
      blockers.push('外せない注意書きがありません');
    const unset = data.fixedNotice.contacts.some(c => {
      const v = contacts && contacts[c.id] ? String(contacts[c.id]).trim() : '';
      return v === '' || v === c.placeholder;
    });
    if (unset) blockers.push('連絡先が未設定です');
    (data.rules || []).forEach(r => {
      const hit = r.when.every(c => (state.sel[c.variable] || []).includes(c.option));
      if (hit) warnings.push(r.message);
    });
    const hasSpecial = data.variables.some(v => (state.special[v.id] || '').trim() !== '');
    return { blockers, warnings, hasSpecial };
  }

  function sheetToText(sheet) {
    const out = [];
    sheet.sections.forEach(s => {
      if (!s.items.length) return;
      out.push(s.name);
      s.items.forEach(i => { i.texts.forEach(t => out.push(t)); if (i.special) out.push(i.special); });
    });
    out.push(sheet.notice.body);
    sheet.notice.lines.forEach(l => out.push(l));
    return out.join('\n');
  }

  function formatDate(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }

  return { formatDate, findVar, textOf, initialState, setChoice, buildSheet, inspect, sheetToText };
});
