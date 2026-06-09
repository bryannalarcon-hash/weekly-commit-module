-- V8__outlook_preference.sql — per-member Outlook sync preference (U22 settings surface).
-- The delegated Graph token itself lives in graph_token (V6); this row holds the user-facing
-- preference shown on the Settings screen and read by the OutlookController: whether locking a week
-- creates a calendar event (create_event_on_lock) and the last successful sync time (last_sync_at).
-- UNIQUE(member_id) makes it an upsert: one preference row per member. connected status is derived
-- from the presence of a graph_token row, so it is NOT duplicated here.
create table outlook_preference (
    id                   uuid primary key,
    member_id            uuid         not null references member (id),
    create_event_on_lock boolean      not null default true,
    last_sync_at         timestamptz,
    created_by           varchar(120) not null,
    created_date         timestamptz,
    last_modified_by     varchar(120),
    last_modified_date   timestamptz,
    constraint uq_outlook_preference_member unique (member_id)
);
