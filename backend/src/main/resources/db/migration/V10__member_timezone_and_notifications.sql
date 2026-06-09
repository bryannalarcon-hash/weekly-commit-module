-- V10__member_timezone_and_notifications.sql — Settings > Account tab persistence.
-- Adds the member's preferred IANA timezone (nullable; validated as a java.time.ZoneId at the API
-- boundary) and a per-member notification_preference row holding the five email-notification toggles
-- shown on the Account settings screen. UNIQUE(member_id) makes the preference row an upsert: one
-- row per member, lazy-created with defaults on first read (like outlook_preference in V8).
alter table member
    add column timezone varchar(63);

create table notification_preference (
    id                    uuid primary key,
    member_id             uuid         not null references member (id),
    email_on_lock         boolean      not null default true,
    email_on_review       boolean      not null default true,
    email_on_reconciled   boolean      not null default true,
    weekly_digest         boolean      not null default true,
    reminder_emails       boolean      not null default true,
    created_by            varchar(120) not null,
    created_date          timestamptz,
    last_modified_by      varchar(120),
    last_modified_date    timestamptz,
    constraint uq_notification_preference_member unique (member_id)
);
