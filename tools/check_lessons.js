// Сверка уроков перед выкладкой: node tools/check_lessons.js
// Берёт forms/isWord/formIn прямо из app.js и проверяет каждый урок: слово есть в своём примере и в истории,
// ответ в пропуске — та самая форма из предложения, варианты не повторяются, у вопросов есть верный ответ.
// Нашла ошибку — печатает её и завершается с кодом 1.
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'docs');
const app = fs.readFileSync(path.join(D, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const part = (rx, name) => { const m = app.match(rx); if (!m) { console.log('В app.js не нашлось: ' + name); process.exit(1); } return m[0]; };
const { isWord, formIn, formType, optText, optTier, gapOthers, IRRV } = new Function(
  'const shuffle=a=>[...a];\n' +
  part(/^function forms\(w\)\{[\s\S]*?^\}/m, 'forms') + '\n' +
  part(/^const isWord=.*$/m, 'isWord') + '\n' +
  part(/^const formIn=.*$/m, 'formIn') + '\n' +
  part(/^const IRRV=[\s\S]*?(?=^const poolOf=)/m, 'варианты пропусков') + '\nreturn {isWord,formIn,formType,optText,optTier,gapOthers,IRRV};')();
const TOK = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
const json = p => JSON.parse(fs.readFileSync(path.join(D, p), 'utf8'));
const pics = json('data/pics.json'), errs = [], irr = json('data/irr.json'), dict = json('data/dict.json'), core = json('data/core.json'), pool = [];
// неправильные формы: у каждой есть перевод и начальное слово с переводом; петель нет
for (const [f, [b, tr, btr]] of Object.entries(irr)) {
  if (!tr || f === b || irr[b]) errs.push(`irr.json: «${f}» → «${b}» — нет перевода или петля`);
  if (!btr && !core[b] && !dict.w[b]) errs.push(`irr.json: «${f}» → «${b}» — у начального слова нет перевода`);
}
// у каких слов окончание -ed/-s по правилам не подходит
const regular = (f, w) => new RegExp('^(' + w + '|' + w.replace(/[ey]$/, '') + ')(.?ed|ied|e?s|ies|.?ing|ying|.?er|.?est|y)$').test(f);
const irregular = new Set(Object.entries(dict.f).filter(([f, b]) => !regular(f, b)).map(x => x[1]).concat(Object.values(irr).map(x => x[0])));
const KEEP = new Set(['lie']); // «лгать»: lied по правилам (lay/lain — от другого lie)
const show = process.argv.includes('--show');
let words = 0, changed = 0;
for (const x of json('lessons/index.json')) {
  const l = json(`lessons/${x.id}.json`), bad = t => errs.push(`Урок ${x.id}: ${t}`);
  const story = l.story.join(' ').match(TOK) || [];
  if (new Set(l.words.map(w => w.w)).size !== l.words.length) bad('слова повторяются');
  if (new Set(l.words.map(formIn)).size !== l.words.length) bad('варианты в пропусках повторяются');
  pool.push(...l.words); // как poolOf в app.js: этот и прошлые уроки
  for (const w of l.words) {
    const o = gapOthers(w, l.words, pool), ot = o.map(x => optText(x, w));
    if (o.length < 3) bad(`«${w.w}» — в пропуске меньше 4 вариантов`);
    if (new Set([formIn(w), ...ot]).size !== ot.length + 1) bad(`«${w.w}» — варианты пропуска повторяются`);
    if (o.some(x => optTier(x, w) === 2)) bad(`«${w.w}» — верный «${formIn(w)}» угадывается по форме: ${ot.join(', ')}`);
    if (show) console.log(x.id, formType(w).padEnd(3), formIn(w).padEnd(12), '|', ot.join(', '));
    if (irregular.has(w.w) && !IRRV.has(w.w) && !KEEP.has(w.w)) bad(`«${w.w}» — неправильные формы, добавить в IRRV в app.js`);
    words++;
    const toks = w.ex.match(TOK) || [], hit = toks.filter(t => isWord(t, w.w)), f = formIn(w);
    if (f !== w.w) changed++;
    if (!hit.length) bad(`«${w.w}» — нет в примере «${w.ex}»`);
    else {
      // вариант ответа, подставленный в пропуск, обязан дать исходное предложение
      const i = toks.indexOf(hit[0]), back = [...toks]; back[i] = f;
      if (back.join(' ').toLowerCase() !== toks.join(' ').toLowerCase()) bad(`«${w.w}» — в пропуск встаёт «${f}», а в предложении «${hit[0]}»`);
      if (hit.length > 1) bad(`«${w.w}» — в примере дважды, второй раз выдаёт ответ: «${w.ex}»`);
    }
    if (!story.some(t => isWord(t, w.w))) bad(`«${w.w}» — нет в истории`);
    if (!w.tr || !w.ex_ru) bad(`«${w.w}» — нет перевода`);
    if (!pics[w.w]) bad(`«${w.w}» — нет картинки в pics.json`);
  }
  for (const q of l.questions) if (!(q.a >= 0 && q.a < q.o.length) || new Set(q.o).size !== q.o.length) bad(`вопрос «${q.q}» — нет верного ответа или варианты повторяются`);
}
if (errs.length) { console.log(errs.join('\n')); console.log(`Ошибок: ${errs.length}`); process.exit(1); }
console.log(`Уроки в порядке: слов ${words}, в изменённой форме ${changed}`);
