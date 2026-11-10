-- A compact, private learner model for the AI classroom.
-- It stores learning evidence, not raw classroom transcripts.
create table if not exists public.teacher_learning_profiles (
  user_id integer not null references public.users(id) on delete cascade,
  language text not null references public.languages(name),
  level text not null references public.levels(name),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, language, level)
);

create index if not exists idx_teacher_learning_profiles_updated
  on public.teacher_learning_profiles(user_id, updated_at desc);

alter table public.teacher_learning_profiles enable row level security;
revoke all on table public.teacher_learning_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.teacher_learning_profiles to service_role;
