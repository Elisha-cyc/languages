-- Persistent course content, learner attempts, skill mastery and spaced repetition.
-- Private to the trusted LinguaApp server: no browser role has table privileges.
create table if not exists public.course_lesson_content (
  lesson_id integer primary key references public.lessons(id) on delete cascade,
  language text not null references public.languages(name),
  level text not null references public.levels(name),
  topic text not null,
  title text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  curriculum_standard text not null default 'CEFR-informed guided practice',
  content_version integer not null default 1 check (content_version > 0),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_attempts (
  id bigint generated always as identity primary key,
  user_id integer not null references public.users(id) on delete cascade,
  lesson_id integer not null references public.lessons(id) on delete cascade,
  language text not null references public.languages(name),
  level text not null references public.levels(name),
  skill text not null check (skill in ('listening', 'reading', 'speaking', 'writing', 'review')),
  prompt text not null,
  response jsonb not null,
  score smallint check (score between 0 and 100),
  feedback jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.course_skill_progress (
  user_id integer not null references public.users(id) on delete cascade,
  language text not null references public.languages(name),
  level text not null references public.levels(name),
  skill text not null check (skill in ('listening', 'reading', 'speaking', 'writing', 'review')),
  attempts integer not null default 0 check (attempts >= 0),
  total_score integer not null default 0 check (total_score >= 0),
  best_score smallint check (best_score between 0 and 100),
  last_score smallint check (last_score between 0 and 100),
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, language, level, skill)
);

create table if not exists public.vocabulary_reviews (
  user_id integer not null references public.users(id) on delete cascade,
  language text not null references public.languages(name),
  term text not null,
  meaning text not null,
  pronunciation text,
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor >= 1.30),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  last_quality smallint check (last_quality between 0 and 5),
  source_lesson_id integer references public.lessons(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, language, term)
);

create table if not exists public.course_enrollments (
  user_id integer not null references public.users(id) on delete cascade,
  language text not null references public.languages(name),
  level text not null references public.levels(name),
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, language, level)
);

create index if not exists idx_course_content_language_level
  on public.course_lesson_content(language, level);
create index if not exists idx_course_attempts_user_created
  on public.course_attempts(user_id, created_at desc);
create index if not exists idx_course_attempts_lesson_skill
  on public.course_attempts(lesson_id, skill);
create index if not exists idx_course_skill_progress_user
  on public.course_skill_progress(user_id, updated_at desc);
create index if not exists idx_vocabulary_reviews_due
  on public.vocabulary_reviews(user_id, due_at);
create index if not exists idx_course_enrollments_user_activity
  on public.course_enrollments(user_id, last_activity_at desc);

alter table public.course_lesson_content enable row level security;
alter table public.course_attempts enable row level security;
alter table public.course_skill_progress enable row level security;
alter table public.vocabulary_reviews enable row level security;
alter table public.course_enrollments enable row level security;

revoke all on table public.course_lesson_content, public.course_attempts,
  public.course_skill_progress, public.vocabulary_reviews,
  public.course_enrollments from public, anon, authenticated;
grant select, insert, update, delete on table public.course_lesson_content,
  public.course_attempts, public.course_skill_progress,
  public.vocabulary_reviews, public.course_enrollments to service_role;
grant usage, select on sequence public.course_attempts_id_seq to service_role;
