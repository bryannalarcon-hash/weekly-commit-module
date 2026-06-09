-- V4__weekly_commit.sql — U8 weekly-commit aggregate for the Weekly Commit Module.
-- weekly_commit (UNIQUE member+week) owns commit_item rows. KTD5: commit_item.supporting_outcome_id
-- is NULLABLE at the column (link required only by the DRAFT->LOCKED guard, not the schema).
-- Also: pulse_reading (1..5 score) and manager_review (per-commit review state).

create table weekly_commit (
    id                 uuid primary key,
    member_id          uuid         not null references member (id),
    week_start         date         not null,
    lifecycle_state    varchar(20)  not null,
    submitted_at       timestamptz,
    reviewer_id        uuid         references member (id),
    reviewed_at        timestamptz,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz,
    constraint uq_weekly_commit_member_week unique (member_id, week_start)
);

create table commit_item (
    id                    uuid primary key,
    weekly_commit_id      uuid         not null references weekly_commit (id),
    text                  varchar(1000) not null,
    status                varchar(20)  not null,
    -- KTD5: NULLABLE — an unlinked draft item must persist; the lock guard enforces presence.
    supporting_outcome_id uuid         references supporting_outcome (id),
    chess_tier            varchar(10),
    carried_from_item_id  uuid         references commit_item (id),
    outlook_event_id      varchar(255),
    created_by            varchar(120) not null,
    created_date          timestamptz,
    last_modified_by      varchar(120),
    last_modified_date    timestamptz
);

create table pulse_reading (
    id                 uuid primary key,
    weekly_commit_id   uuid         not null references weekly_commit (id),
    score              smallint     not null,
    comment            varchar(2000),
    comment_private    boolean      not null default false,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz,
    constraint ck_pulse_reading_score check (score between 1 and 5)
);

create table manager_review (
    id                 uuid primary key,
    weekly_commit_id   uuid         not null references weekly_commit (id),
    reviewer_id        uuid         references member (id),
    state              varchar(20)  not null,
    comment            varchar(2000),
    reviewed_at        timestamptz,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz
);

create index idx_commit_item_weekly_commit on commit_item (weekly_commit_id);
create index idx_commit_item_supporting_outcome on commit_item (supporting_outcome_id);
create index idx_commit_item_carried_from on commit_item (carried_from_item_id);
create index idx_pulse_reading_weekly_commit on pulse_reading (weekly_commit_id);
create index idx_manager_review_weekly_commit on manager_review (weekly_commit_id);
