-- V3__rcdo.sql — U7 RCDO strategy hierarchy for the Weekly Commit Module.
-- Four levels: rally_cry -> defining_objective -> outcome -> supporting_outcome, each
-- with a NOT NULL parent FK (AS1), title/description and a date window. Window containment
-- is intentionally NOT enforced (AS4). supporting_outcome.owner_id links to a member.

create table rally_cry (
    id                 uuid primary key,
    title              varchar(200) not null,
    description        varchar(2000),
    start_date         date,
    end_date           date,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz
);

create table defining_objective (
    id                 uuid primary key,
    rally_cry_id       uuid         not null references rally_cry (id),
    title              varchar(200) not null,
    description        varchar(2000),
    start_date         date,
    end_date           date,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz
);

create table outcome (
    id                    uuid primary key,
    defining_objective_id uuid         not null references defining_objective (id),
    title                 varchar(200) not null,
    description           varchar(2000),
    start_date            date,
    end_date              date,
    created_by            varchar(120) not null,
    created_date          timestamptz,
    last_modified_by      varchar(120),
    last_modified_date    timestamptz
);

create table supporting_outcome (
    id                 uuid primary key,
    outcome_id         uuid         not null references outcome (id),
    owner_id           uuid         references member (id),
    title              varchar(200) not null,
    description        varchar(2000),
    start_date         date,
    end_date           date,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz
);

create index idx_defining_objective_rally_cry on defining_objective (rally_cry_id);
create index idx_outcome_defining_objective on outcome (defining_objective_id);
create index idx_supporting_outcome_outcome on supporting_outcome (outcome_id);
create index idx_supporting_outcome_owner on supporting_outcome (owner_id);
