-- V5__commit_snapshot.sql — U9 immutable plan snapshot for the Weekly Commit Module.
-- KTD4: at LOCK the LifecycleService freezes the planned set (text/link/tier only — NO status)
-- into commit_snapshot + snapshot_item. The live commit_item.status carries the ACTUAL; the diff
-- between this frozen plan and live status drives reconciliation. One snapshot per weekly_commit.
-- snapshot_item.commit_item_id is a capture-time copy of the source commit_item.id — the
-- deterministic join key U13 uses to pair each frozen plan line to its live item (text/link/tier
-- are non-unique, so they cannot pair reliably). Frozen content stays immutable; only this
-- back-reference is added.

create table commit_snapshot (
    id                 uuid primary key,
    weekly_commit_id   uuid         not null references weekly_commit (id),
    captured_at        timestamptz  not null,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz,
    constraint uq_commit_snapshot_weekly_commit unique (weekly_commit_id)
);

create table snapshot_item (
    id                    uuid primary key,
    snapshot_id           uuid         not null references commit_snapshot (id),
    -- Capture-time copy of the source commit_item.id; the deterministic plan↔actual join key (U13).
    commit_item_id        uuid         references commit_item (id),
    text                  varchar(1000) not null,
    supporting_outcome_id uuid         references supporting_outcome (id),
    chess_tier            varchar(10),
    created_by            varchar(120) not null,
    created_date          timestamptz,
    last_modified_by      varchar(120),
    last_modified_date    timestamptz
);

create index idx_snapshot_item_snapshot on snapshot_item (snapshot_id);
create index idx_snapshot_item_commit_item on snapshot_item (commit_item_id);
