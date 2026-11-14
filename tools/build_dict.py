"""Собирает en→ru словарь для «Таверны» из Викисловаря (kaikki.org, CC-BY-SA) и частотного списка (FrequencyWords, CC-BY-SA).
Большой файл читается потоком, на диск не пишется. Результат: dict.json {"w": {слово: "перевод"}, "f": {форма: начальная}}."""
import gzip, json, re, sys, urllib.request
from collections import defaultdict

OUT = sys.argv[1]
TOP = 40000
FREQ = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt"
KAI = "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz"
UA = {"User-Agent": "tavern-dict-builder"}

freq = []
with urllib.request.urlopen(urllib.request.Request(FREQ, headers=UA)) as r:
    for line in r.read().decode("utf8").splitlines():
        w = line.split(" ")[0].strip().lower()
        if re.fullmatch(r"[a-z][a-z']*", w):
            freq.append(w)
want = set(freq[:TOP])
print("freq", len(want), flush=True)

tr = defaultdict(list)      # слово -> переводы по порядку
base = {}                   # форма -> начальное слово
POS_OK = {"noun", "verb", "adj", "adv", "prep", "pron", "conj", "intj", "det", "num", "phrase", "particle", "name"}
n = 0
with urllib.request.urlopen(urllib.request.Request(KAI, headers=UA)) as r, gzip.open(r, "rt", encoding="utf8") as g:
    for line in g:
        n += 1
        if n % 200000 == 0:
            print("lines", n, "words", len(tr), flush=True)
        e = json.loads(line)
        w = e.get("word", "").lower()
        if w not in want:
            continue
        if e.get("lang_code") not in (None, "en") or e.get("pos") not in POS_OK:
            continue
        ts = list(e.get("translations") or [])
        for s in e.get("senses") or []:
            ts += s.get("translations") or []
            for fo in s.get("form_of") or []:
                b = (fo.get("word") or "").lower()
                if b and b != w and w not in base:
                    base[w] = b
        for t in ts:
            if t.get("code") == "ru" or t.get("lang") == "Russian":
                x = (t.get("word") or "").strip()
                x = re.sub(r"\s*\(.*?\)", "", x)
                if x and x not in tr[w] and len(tr[w]) < 4 and len(x) < 40:
                    tr[w].append(x)

words = {w: ", ".join(v) for w, v in tr.items() if v}
forms = {f: b for f, b in base.items() if f not in words and b in words}
json.dump({"w": words, "f": forms}, open(OUT, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
print("done lines", n, "words", len(words), "forms", len(forms), flush=True)
