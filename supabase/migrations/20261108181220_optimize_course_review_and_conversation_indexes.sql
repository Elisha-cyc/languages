-- Optimize due-review, source-lesson cascade and recent-conversation queries.
drop index if exists public.idx_vocabulary_reviews_due;
create index if not exists idx_vocabulary_reviews_due
  on public.vocabulary_reviews(user_id, language, due_at);
create index if not exists idx_vocabulary_reviews_source_lesson
  on public.vocabulary_reviews(source_lesson_id);
drop index if exists public.idx_course_conversation_user_created;
create index if not exists idx_course_conversation_user_created
  on public.course_conversation_turns(user_id, language, level, created_at desc);
