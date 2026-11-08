-- Persist AI conversation practice for each learner.
create table if not exists public.course_conversation_turns (
  id bigint generated always as identity primary key,
  conversation_id uuid not null,
  user_id integer not null references public.users(id) on delete cascade,
  language text not null references public.languages(name),
  level text not null references public.levels(name),
  user_message text not null,
  assistant_message text not null,
  translation text,
  correction text,
  score smallint check (score between 0 and 100),
  feedback jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_course_conversation_user_created
  on public.course_conversation_turns(user_id, created_at desc);
create index if not exists idx_course_conversation_id
  on public.course_conversation_turns(user_id, conversation_id, created_at);
alter table public.course_conversation_turns enable row level security;
revoke all on table public.course_conversation_turns from public, anon, authenticated;
grant select, insert, update, delete on table public.course_conversation_turns to service_role;
grant usage, select on sequence public.course_conversation_turns_id_seq to service_role;
