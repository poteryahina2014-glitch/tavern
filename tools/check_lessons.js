// Сверка уроков перед выкладкой: node tools/check_lessons.js
// Берёт forms/isWord/formIn прямо из app.js и проверяет каждый урок: слово есть в своём примере и в истории,
// ответ в пропуске — та самая форма из предложения, варианты не повторяются, у вопросов есть верный ответ.
// Нашла ошибку — печатает её и завершается с кодом 1.
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'docs');
const app = fs.readFileSync(path.join(D, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const part = (rx, name) => { const m = app.match(rx); if (!m) { console.log('В app.js не нашлось: ' + name); process.exit(1); } return m[0]; };
const { isWord, formIn } = new Function(
  part(/^function forms\(w\)\{[\s\S]*?^\}/m, 'forms') + '\n' +
  part(/^const isWord=.*$/m, 'isWord') + '\n' +
  part(/^const formIn=.*$/m, 'formIn') + '\nreturn {isWord,formIn};')();
const TOK = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
const json = p => JSON.parse(fs.readFileSync(path.join(D, p), 'utf8'));
const pics = json('data/pics.json'), errs = [];
let words = 0, changed = 0;
for (const x of json('lessons/index.json')) {
  const l = json(`lessons/${x.id}.json`), bad = t => errs.push(`Урок ${x.id}: ${t}`);
  const story = l.story.join(' ').match(TOK) || [];
  if (new Set(l.words.map(w => w.w)).size !== l.words.length) bad('слова повторяются');
  if (new Set(l.words.map(formIn)).size !== l.words.length) bad('варианты в пропусках повторяются');
  for (const w of l.words) {
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
