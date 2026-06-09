-- V2__member_team.sql — U6 member/team schema for the Weekly Commit Module.
-- Creates team (self-referencing org hierarchy) and member (self-FK manager graph,
-- auth0_subject for JIT provisioning, email uniqueness). All tables carry audit columns.

create table team (
    id                 uuid primary key,
    name               varchar(160) not null,
    type               varchar(20)  not null,
    parent_team_id     uuid         references team (id),
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz
);

create table member (
    id                 uuid primary key,
    email              varchar(254) not null,
    display_name       varchar(160) not null,
    title              varchar(160),
    manager_id         uuid         references member (id),
    role               varchar(20)  not null,
    auth0_subject      varchar(255) not null,
    team_id            uuid         references team (id),
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz,
    constraint uq_member_email unique (email),
    constraint uq_member_auth0_subject unique (auth0_subject)
);

create index idx_member_manager_id on member (manager_id);
create index idx_member_team_id on member (team_id);
