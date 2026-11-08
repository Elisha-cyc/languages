-- Course lesson explanations are generated in the learner's native language.
-- Keep one reusable version per target lesson and native language.
alter table public.course_lesson_content
  add column if not exists native_language text not null default 'English';

alter table public.course_lesson_content
  drop constraint if exists course_lesson_content_pkey;

alter table public.course_lesson_content
  add constraint course_lesson_content_pkey primary key (lesson_id, native_language);

create index if not exists idx_course_content_native_language
  on public.course_lesson_content(language, level, native_language);
