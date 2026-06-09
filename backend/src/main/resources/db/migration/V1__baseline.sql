-- V1__baseline.sql — first Flyway migration for the Weekly Commit Module.
-- Creates app_meta, a minimal auditable table validated by Hibernate and mapped by AppMeta.
create table app_meta (
    id                 uuid primary key,
    label              varchar(120) not null,
    created_by         varchar(120) not null,
    created_date       timestamptz,
    last_modified_by   varchar(120),
    last_modified_date timestamptz
);
