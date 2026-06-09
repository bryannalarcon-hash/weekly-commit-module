-- V7__manager_review_unique.sql — deferred fix: enforce ONE ManagerReview per weekly_commit.
-- ReviewService upserts the single review per commit (findByWeeklyCommitId -> save), but nothing at
-- the schema level forbade a second row. This UNIQUE constraint makes that invariant durable: a
-- concurrent/duplicate insert now fails as a DB constraint violation (surfaced as 409 by
-- ApiExceptionHandler#onDataIntegrity) instead of silently creating a second review.
alter table manager_review
    add constraint uq_manager_review_weekly_commit unique (weekly_commit_id);
