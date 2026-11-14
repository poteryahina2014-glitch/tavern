-- «Таверна»: английский для чтения романтического фэнтези.
-- Вставить целиком в Supabase → SQL Editor → Run. Можно запускать повторно. Таблицы t_* — только свои строки (RLS).

-- карточки слов (интервальное повторение)
create table if not exists t_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  word text not null,              -- английское слово / фраза (в нижнем регистре)
  tr text not null default '',     -- перевод
  emoji text,
  ex text,                         -- фраза-пример
  ex_ru text,
  note text,                       -- её ассоциация
  src text,                        -- 'lesson:01', 'book:<id>', 'manual'
  due date not null default current_date,
  ivl int not null default 0,      -- текущий промежуток, дней
  ease numeric(4, 2) not null default 2.5,
  reps int not null default 0,
  lapses int not null default 0,
  last_seen date,
  created_at timestamptz not null default now(),
  unique (user_id, word)
);

-- тексты: уроки и главы книг, когда перечитать
create table if not exists t_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ref text not null,               -- 'lesson:01' или 'book:<id>:<глава>'
  title text,
  rating text check (rating in ('no', 'part', 'yes')),
  due date,
  ivl int not null default 0,
  reads int not null default 0,
  last_read date,
  unique (user_id, ref)
);

-- пройденные уроки
create table if not exists t_lessons (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lesson text not null,
  done_on date not null default current_date,
  primary key (user_id, lesson)
);

-- журнал повторений (для статистики)
create table if not exists t_log (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null default current_date,
  card_id uuid references t_cards on delete cascade,
  grade smallint not null          -- 0 не помню, 1 трудно, 2 помню, 3 легко
);

-- книги (EPUB, загружены ею для себя; текст хранится только здесь, не в репозитории)
create table if not exists t_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  author text,
  chapters int not null default 0,
  pos int not null default 0,      -- глава, где остановилась
  created_at timestamptz not null default now()
);
create table if not exists t_chapters (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id uuid not null references t_books on delete cascade,
  n int not null,
  title text,
  body text not null,              -- абзацы через перевод строки
  primary key (book_id, n)
);

do $$
declare t text;
begin
  foreach t in array array['t_cards', 't_texts', 't_lessons', 't_log', 't_books', 't_chapters'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own on %I', t);
    execute format('create policy own on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create index if not exists t_cards_due on t_cards (user_id, due);
create index if not exists t_log_day on t_log (user_id, day);
