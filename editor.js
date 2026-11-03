(function () {
  const KEY = 'mtp-editor.draft';
  const E = MTPEditor;
  const $ = id => document.getElementById(id);
  const TYPE_LABEL = { single: '1つだけ選ぶ', multi: '複数選べる', always: '必ず出す' };
  const REPLACE_MSG = 'いまの下書きを、置き換えます。よろしいですか。';
  let model = null;
  let sel = null; // { varId } または { varId, optId }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'text') e.textContent = v; else e[k] = v; });
    (children || []).forEach(c => e.appendChild(c));
    return e;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(model)); return true; } catch (e) { return false; }
  }
  function restore() {
    try {
      const s = localStorage.getItem(KEY);
      if (s) return E.fromJSON(JSON.parse(s));
    } catch (e) {}
    return null;
  }

  function lines(box, list, cls) {
    box.textContent = ''; box.className = cls || '';
    (Array.isArray(list) ? list : [list]).forEach(l => { if (l) box.appendChild(el('p', { text: l })); });
  }
  const errMsg = list => { lines($('msg'), list); $('msg').setAttribute('role', 'alert'); };
  const clearErr = () => lines($('msg'), '');
  const note = t => lines($('note'), t);

  // ---- 表 ----
  function findVar(id) { return model.variables.find(v => v.id === id); }
  function sectionName(id) { const s = model.sections.find(x => x.id === id); return s ? s.name : null; }

  function select(next) { sel = next; clearErr(); renderGrid(); renderPanel(); }

  function renderGrid() {
    const g = $('grid'); g.textContent = '';
    const n = model.variables.length;
    g.style.gridTemplateColumns = 'repeat(' + n + ', minmax(120px, 180px)) 140px';
    const put = (node, col, row, span) => {
      node.style.gridColumn = String(col);
      node.style.gridRow = String(row);
      if (span) node.style.gridColumn = col + ' / span ' + span;
      g.appendChild(node);
    };
    // 中見出し（隣り合う同じ中見出しをまとめる）
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && model.variables[j + 1].section === model.variables[i].section) j++;
      const name = sectionName(model.variables[i].section);
      const c = el('div', { className: 'cell sec' + (name === null ? ' hint' : ''), text: name === null ? '（中見出し未選択）' : (name || '（名前なし）') });
      c.title = c.textContent;
      put(c, i + 1, 1, j - i + 1);
      i = j + 1;
    }
    model.variables.forEach((v, k) => {
      const on = sel && sel.varId === v.id && !sel.optId;
      const c = el('div', { className: 'cell vname' + (on ? ' sel' : '') }, [
        el('span', { className: v.name ? '' : 'dim', text: v.name || '（名前を入れてください）' }),
        el('small', { text: TYPE_LABEL[v.type] || v.type })]);
      c.onclick = () => select({ varId: v.id });
      put(c, k + 1, 2);
      v.options.forEach((o, r) => {
        const sOn = sel && sel.varId === v.id && sel.optId === o.id;
        const oc = el('div', { className: 'cell' + (sOn ? ' sel' : ''), text: o.name || '（名前を入れてください）' });
        if (!o.name) oc.classList.add('hint');
        oc.title = o.name || '';
        oc.onclick = () => select({ varId: v.id, optId: o.id });
        put(oc, k + 1, 3 + r);
      });
      const plus = el('div', { className: 'cell plus', text: '＋', title: 'この列に選択肢を足す' });
      plus.onclick = () => {
        if (v.type === 'always') { note('always（必ず出す）の列は、選択肢を1つしか持てません'); return; }
        const o = E.addOption(model, v.id); save(); note(''); select({ varId: v.id, optId: o.id });
      };
      put(plus, k + 1, 3 + v.options.length);
    });
    const add = el('div', { className: 'cell addcol', text: '＋ 列を足す' });
    add.onclick = () => { const v = E.addVariable(model); save(); note(''); select({ varId: v.id }); };
    put(add, n + 1, 2);
  }

  // ---- 編集欄 ----
  function field(label, node) { return el('label', {}, [el('div', { text: label }), node]); }

  function renderPanel() {
    const p = $('panel'); p.textContent = '';
    const v = sel && findVar(sel.varId);
    if (!v) { p.appendChild(el('p', { className: 'dim', text: '表のマスをクリックすると、ここで編集できます' })); return; }
    if (sel.optId) { optionPanel(p, v, v.options.find(o => o.id === sel.optId)); return; }
    variablePanel(p, v);
  }

  function optionPanel(p, v, o) {
    if (!o) { p.appendChild(el('p', { className: 'dim', text: '表のマスをクリックすると、ここで編集できます' })); return; }
    const name = el('input', { type: 'text', value: o.name });
    name.oninput = () => { o.name = name.value; save(); renderGrid(); };
    const text = el('textarea', { rows: 5, value: o.text });
    text.oninput = () => { o.text = text.value; save(); };
    const row1 = el('div', { className: 'row' }, [field('名前', name), field('書面に出る文', text)]);
    p.appendChild(el('p', { text: '選択肢の編集（' + (v.name || '名前なしの変数') + '）' }));
    p.appendChild(row1);
    if (v.type !== 'always') {
      const none = el('input', { type: 'checkbox', checked: !!o.none });
      none.onchange = () => { o.none = none.checked; save(); };
      p.appendChild(el('div', { className: 'row' }, [el('label', {}, [none, document.createTextNode(' 該当なし（何も出さない）')])]));
    }
    const del = el('button', { type: 'button', className: 'danger', text: 'この行を削除' });
    del.onclick = () => {
      if (!confirm('この行（選択肢）を削除しますか')) return;
      v.options = v.options.filter(x => x !== o); save(); select({ varId: v.id });
    };
    const up = el('button', { type: 'button', text: '上へ' });
    up.onclick = () => { E.moveOption(model, v.id, o.id, -1); save(); renderGrid(); };
    const down = el('button', { type: 'button', text: '下へ' });
    down.onclick = () => { E.moveOption(model, v.id, o.id, 1); save(); renderGrid(); };
    p.appendChild(el('div', { className: 'row' }, [del, up, down]));
  }

  function variablePanel(p, v) {
    p.appendChild(el('p', { text: '変数（列）の編集' }));
    const name = el('input', { type: 'text', value: v.name });
    name.oninput = () => { v.name = name.value; save(); renderGrid(); };
    const type = el('select', {}, [
      el('option', { value: 'single', text: 'single：1つだけ選ぶ' }),
      el('option', { value: 'multi', text: 'multi：複数選べる' }),
      el('option', { value: 'always', text: 'always：必ず出す（選択肢は1つだけ）' })]);
    type.value = v.type;
    type.onchange = () => {
      const r = E.setType(model, v.id, type.value);
      if (!r.ok) { type.value = v.type; note(r.message); return; }
      save(); note(''); renderGrid(); renderPanel();
    };
    const secSel = el('select', {}, [el('option', { value: '', text: '（中見出しを選ぶ）' })]);
    model.sections.forEach(s => secSel.appendChild(el('option', { value: s.id, text: s.name || '（名前なし）' })));
    secSel.value = v.section;
    secSel.onchange = () => { v.section = secSel.value; save(); renderGrid(); renderPanel(); };
    const nsName = el('input', { type: 'text', placeholder: '新しい中見出しの名前' });
    const nsBtn = el('button', { type: 'button', text: '中見出しを作る' });
    nsBtn.onclick = () => {
      const t = nsName.value.trim();
      if (!t) { note('新しい中見出しの名前を入れてください'); return; }
      const s = E.addSection(model, t); v.section = s.id; save(); note(''); renderGrid(); renderPanel();
    };
    const row2 = el('div', { className: 'row' }, [
      field('変数の名前', name), field('選び方', type), field('中見出し', secSel),
      field('新しい中見出しを作る', el('div', {}, [nsName, nsBtn]))]);
    const sec = model.sections.find(s => s.id === v.section);
    if (sec) {
      const rn = el('input', { type: 'text', value: sec.name });
      rn.oninput = () => { sec.name = rn.value; save(); renderGrid(); };
      row2.appendChild(field('選んだ中見出しの名前を直す（同じ中見出しの全部の列に反映されます）', rn));
    }
    p.appendChild(row2);
    const del = el('button', { type: 'button', className: 'danger', text: 'この列を削除' });
    del.onclick = () => {
      if (!confirm('この列（変数）を削除しますか')) return;
      model.variables = model.variables.filter(x => x !== v); save(); select(null);
    };
    const left = el('button', { type: 'button', text: '左へ' });
    left.onclick = () => { E.moveVariable(model, v.id, -1); save(); renderGrid(); };
    const right = el('button', { type: 'button', text: '右へ' });
    right.onclick = () => { E.moveVariable(model, v.id, 1); save(); renderGrid(); };
    p.appendChild(el('div', { className: 'row' }, [del, left, right]));
  }

  function render() {
    $('title').value = model.title; $('did').value = model.id;
    renderGrid(); renderPanel();
  }

  function check() {
    const b = E.validate(model);
    if (b.length) { errMsg(['書き出せません'].concat(b.map(x => x.message))); return false; }
    clearErr();
    return true;
  }

  function replaceWith(next, doneText) {
    if (!E.isBlank(model) && !confirm(REPLACE_MSG)) return;
    model = next; sel = null; save(); render(); clearErr(); note(doneText);
  }

  $('title').oninput = () => { model.title = $('title').value; save(); };
  $('did').oninput = () => { model.id = $('did').value; save(); };
  $('export').onclick = () => {
    if (!check()) return;
    const blob = new Blob([JSON.stringify(E.toJSON(model), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: model.id + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    note(model.id + '.json を書き出しました');
  };
  $('import').onclick = () => $('file').click();
  $('file').onchange = () => {
    const f = $('file').files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { replaceWith(E.fromJSON(JSON.parse(r.result)), f.name + ' を読み込みました'); }
      catch (e) { note('読み込めませんでした：' + e.message); }
      $('file').value = '';
    };
    r.onerror = () => note('読み込めませんでした');
    r.readAsText(f);
  };
  $('example').onclick = () => {
    fetch('data/osteoporosis-exercise.json').then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => replaceWith(E.fromJSON(d), '骨粗鬆症の例を読み込みました'))
      .catch(() => note('例を読み込めませんでした（data/osteoporosis-exercise.json）'));
  };
  $('toSheet').onclick = () => {
    if (!check()) return;
    if (!save()) { errMsg('この環境では下書きを保存できないため、1階を開けません'); return; }
    location.href = 'index.html?d=draft';
  };

  const restored = restore();
  if (restored) { model = restored; render(); }
  else {
    fetch('data/blank.json').then(r => r.json()).then(d => { model = E.emptyModel(d.fixedNotice); render(); })
      .catch(() => { model = E.emptyModel({ body: '', contacts: [] }); render(); note('data/blank.json を読み込めませんでした。注意書きが空のままです'); });
  }
})();
