(function () {
  // 書面の見た目に関わる定数（文言は仮）
  const SPECIAL_LABEL = '担当医から';
  const HIGHLIGHT_SECTIONS = ['s4'];
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const diseaseId = (params.get('d') || 'ankle-sprain-acute').replace(/[^a-z0-9-]/g, '');
  const LS = 'mtp.' + diseaseId + '.';
  let data, state, approved = false;

  function load(key, fallback) {
    try { const s = localStorage.getItem(LS + key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(LS + key, JSON.stringify(val)); } catch (e) {} }
  let overrides = load('overrides', {});
  let contacts = load('contacts', {});

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'text') e.textContent = v; else e[k] = v; });
    (children || []).forEach(c => e.appendChild(c));
    return e;
  }

  function changed() { approved = false; renderOutput(); }

  function renderChoices() {
    const box = $('choices'); box.textContent = '';
    data.sections.forEach(s => {
      box.appendChild(el('h2', { text: s.name }));
      data.variables.filter(v => v.section === s.id).forEach(v => {
        const w = el('div', { className: 'var' });
        w.appendChild(el('h3', { text: v.name + (v.type === 'multi' ? '（複数選べます）' : v.type === 'always' ? '（毎回出ます）' : '') }));
        v.options.forEach(o => {
          const inp = el('input', { type: v.type === 'multi' ? 'checkbox' : 'radio', name: 'v_' + v.id });
          inp.checked = state.sel[v.id].includes(o.id);
          if (v.type === 'always') { inp.type = 'checkbox'; inp.checked = true; inp.disabled = true; }
          inp.onchange = () => {
            MTP.setChoice(data, state, v.id, o.id, inp.checked);
            renderChoices(); changed();
          };
          w.appendChild(el('label', {}, [inp, document.createTextNode(' ' + o.name)]));
        });
        const ta = el('textarea', { rows: 2, placeholder: '特別指示（保存しません）', value: state.special[v.id] });
        ta.oninput = () => { state.special[v.id] = ta.value; changed(); };
        const sp = el('div', { className: 'sp' }, [ta]);
        w.appendChild(sp);
        box.appendChild(w);
      });
    });
  }

  function renderContacts() {
    const box = $('contacts'); box.textContent = '';
    data.fixedNotice.contacts.forEach(c => {
      const inp = el('input', { type: 'text', value: contacts[c.id] || '', placeholder: c.placeholder });
      inp.oninput = () => {
        if (inp.value) contacts[c.id] = inp.value; else delete contacts[c.id];
        save('contacts', contacts); changed();
      };
      box.appendChild(el('label', {}, [document.createTextNode(c.label + ' '), inp]));
      box.appendChild(el('br'));
    });
  }

  function renderEditor() {
    const box = $('editor'); box.textContent = '';
    data.variables.forEach(v => v.options.forEach(o => {
      if (o.none) return;
      const k = v.id + '.' + o.id;
      const ta = el('textarea', { rows: 3, value: MTP.textOf(data, overrides, v, o) });
      ta.oninput = () => {
        if (ta.value === o.text) delete overrides[k]; else overrides[k] = ta.value;
        save('overrides', overrides); changed();
      };
      const reset = el('button', { type: 'button', text: '元に戻す' });
      reset.onclick = () => { delete overrides[k]; save('overrides', overrides); ta.value = o.text; changed(); };
      box.appendChild(el('div', { className: 'mod' }, [
        el('div', { text: v.name + '／' + o.name }), ta, reset]));
    }));
  }

  function renderOutput() {
    const sheet = MTP.buildSheet(data, state, overrides, contacts);
    const r = MTP.inspect(data, state, overrides, contacts);
    const sh = $('sheet'); sh.textContent = '';
    sh.appendChild(el('h1', { className: 'sheet-title', text: data.title }));
    sh.appendChild(el('p', { className: 'sheet-date', text: MTP.formatDate(new Date()) }));
    sheet.sections.forEach(s => {
      if (!s.items.length) return;
      const box = el('section', { className: 'blk' + (HIGHLIGHT_SECTIONS.includes(s.id) ? ' hl' : '') });
      box.appendChild(el('h2', { text: s.name }));
      s.items.forEach(i => {
        const card = el('div', { className: 'card' });
        i.texts.forEach(t => card.appendChild(el('p', { text: t })));
        if (i.special) card.appendChild(el('p', { className: 'sp' }, [
          el('span', { className: 'splabel', text: SPECIAL_LABEL }), el('span', { text: i.special })]));
        box.appendChild(card);
      });
      sh.appendChild(box);
    });
    const n = el('div', { className: 'notice' }, [el('p', { text: sheet.notice.body })]);
    sheet.notice.lines.forEach(l => {
      const k = l.indexOf('：');
      n.appendChild(el('p', { className: 'contact' }, [
        el('span', { className: 'lbl', text: l.slice(0, k + 1) }), el('span', { text: l.slice(k + 1) })]));
    });
    sh.appendChild(n);

    const c = $('check'); c.textContent = '';
    c.appendChild(el('strong', { text: '点検の結果' }));
    if (!r.blockers.length && !r.warnings.length) c.appendChild(el('p', { text: '問題は見つかりませんでした。' }));
    r.blockers.forEach(b => c.appendChild(el('p', { className: 'blocker', text: '印刷できません　' + b })));
    r.warnings.forEach(w => c.appendChild(el('p', { className: 'warn', text: '警告　' + w })));
    if (r.hasSpecial) c.appendChild(el('p', { text: '特別指示あり' }));
    const ap = el('button', { type: 'button', text: approved ? '承認済み' : '内容を確認し、承認する' });
    ap.disabled = r.blockers.length > 0 || approved;
    ap.onclick = () => { approved = true; renderOutput(); };
    const pr = el('button', { type: 'button', text: '印刷する' });
    pr.disabled = r.blockers.length > 0 || !approved;
    pr.onclick = () => {
      const again = MTP.inspect(data, state, overrides, contacts);
      if (again.blockers.length || !approved) return;
      if (again.hasSpecial && !confirm('特別指示あり。書面に特別指示が含まれています。印刷しますか')) return;
      if (again.warnings.length && !confirm('警告があります。確認のうえ印刷しますか')) return;
      window.print();
    };
    c.appendChild(ap); c.appendChild(document.createTextNode(' ')); c.appendChild(pr);
  }

  // draft のときは、2階の下書き（localStorage）を読む。それ以外は、data/*.json を読む
  const source = diseaseId === 'draft'
    ? new Promise(res => res(JSON.parse(localStorage.getItem('mtp-editor.draft'))))
    : fetch('data/' + diseaseId + '.json').then(r => r.json());
  source.then(d => {
    data = d; state = MTP.initialState(data);
    $('title').textContent = data.title;
    renderChoices(); renderContacts(); renderEditor(); renderOutput();
  }).catch(e => { $('check').textContent = '疾患のデータを読み込めませんでした'; });
})();
