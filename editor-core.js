// 2階（データを表で作る画面）の、画面に依存しない処理
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MTPEditor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ID_PATTERN = /^[a-z0-9-]+$/;
  const clone = x => JSON.parse(JSON.stringify(x));

  function newId(prefix, existing) {
    const used = new Set(existing);
    let n = 1;
    while (used.has(prefix + n)) n++;
    return prefix + n;
  }

  function newOption(existingIds) {
    return { id: newId('o', existingIds), name: '', text: '', none: false };
  }

  function newVariable(model) {
    return {
      id: newId('v', model.variables.map(v => v.id)),
      name: '', section: '', type: 'single', options: [newOption([])]
    };
  }

  function emptyModel(fixedNotice) {
    const m = {
      id: 'new-disease', title: '', sections: [], variables: [],
      fixedNotice: clone(fixedNotice), rules: []
    };
    m.variables.push(newVariable(m));
    return m;
  }

  // 読み込んだデータは、そのまま保持する（id、fixedNotice、rules を含む）
  function fromJSON(json) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.sections) || !Array.isArray(json.variables)
      || !json.variables.every(v => v && Array.isArray(v.options)))
      throw new Error('データの形が正しくありません');
    const m = clone(json);
    if (!Array.isArray(m.rules)) m.rules = [];
    return m;
  }

  function toJSON(model) { return clone(model); }

  function addSection(model, name) {
    const s = { id: newId('s', model.sections.map(x => x.id)), name };
    model.sections.push(s);
    return s;
  }

  function addVariable(model) { const v = newVariable(model); model.variables.push(v); return v; }

  function addOption(model, varId) {
    const v = model.variables.find(x => x.id === varId);
    const o = newOption(v.options.map(x => x.id));
    v.options.push(o);
    return o;
  }

  // 選び方の切り替え。always は選択肢が1つのときだけ。選択肢は消さない
  function setType(model, varId, type) {
    const v = model.variables.find(x => x.id === varId);
    if (type === 'always' && v.options.length !== 1)
      return { ok: false, message: 'always（必ず出す）は、選択肢が1つのときだけ選べます。先に、選択肢を1つにしてください' };
    v.type = type;
    if (type === 'always') v.options.forEach(o => { o.none = false; });
    return { ok: true, message: '' };
  }

  // 左右・上下の入れ替え。端でさらに動かそうとしたときは、何もしない（false を返す）
  function swap(list, i, dir) {
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    const t = list[i]; list[i] = list[j]; list[j] = t;
    return true;
  }
  function moveVariable(model, varId, dir) {
    return swap(model.variables, model.variables.findIndex(v => v.id === varId), dir);
  }
  function moveOption(model, varId, optId, dir) {
    const v = model.variables.find(x => x.id === varId);
    return swap(v.options, v.options.findIndex(o => o.id === optId), dir);
  }

  // 下書きが空（何も入力されていない）か
  function isBlank(model) {
    return !String(model.title || '').trim() && model.sections.length === 0 && model.variables.length <= 1
      && model.variables.every(v => !String(v.name || '').trim()
        && v.options.every(o => !String(o.name || '').trim() && !String(o.text || '').trim()));
  }

  // 書き出し前の点検。{code, message} の配列
  function validate(model) {
    const b = [];
    const add = (code, message) => b.push({ code, message });
    if (!String(model.title || '').trim()) add('title-empty', '病気の名前が空です');
    if (!ID_PATTERN.test(String(model.id || ''))) add('id-invalid', '病気のIDは、半角の小文字英数字とハイフンだけにしてください');
    model.variables.forEach((v, i) => {
      const label = '（' + (i + 1) + '列目' + (v.name ? '：' + v.name : '') + '）';
      if (!String(v.name || '').trim()) add('var-name-empty', '変数の名前が空です' + label);
      if (v.options.length === 0) add('no-options', '選択肢が0個の変数があります' + label);
      if (v.type === 'always' && v.options.length !== 1) add('always-not-one', 'always の変数は、選択肢を1つにしてください' + label);
      if (v.options.some(o => !String(o.name || '').trim())) add('option-name-empty', '選択肢の名前が空です' + label);
      const names = v.options.map(o => String(o.name || '').trim()).filter(n => n);
      if (new Set(names).size !== names.length) add('option-name-dup', '同じ名前の選択肢があります' + label);
      if (!v.section || !model.sections.some(s => s.id === v.section)) add('section-unset', '中見出しが未選択の変数があります' + label);
    });
    return b;
  }

  return { ID_PATTERN, newId, emptyModel, fromJSON, toJSON, addSection, addVariable, addOption, setType, moveVariable, moveOption, isBlank, validate };
});
