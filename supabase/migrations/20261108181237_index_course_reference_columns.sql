-- Index each referenced language/level FK column for joins and referential checks.
create index if not exists idx_course_content_level on public.course_lesson_content(level);
create index if not exists idx_course_attempts_language on public.course_attempts(language);
create index if not exists idx_course_attempts_level on public.course_attempts(level);
create index if not exists idx_course_skill_progress_language on public.course_skill_progress(language);
create index if not exists idx_course_skill_progress_level on public.course_skill_progress(level);
create index if not exists idx_course_enrollments_language on public.course_enrollments(language);
create index if not exists idx_course_enrollments_level on public.course_enrollments(level);
create index if not exists idx_vocabulary_reviews_language on public.vocabulary_reviews(language);
create index if not exists idx_course_conversation_language on public.course_conversation_turns(language);
create index if not exists idx_course_conversation_level on public.course_conversation_turns(level);
