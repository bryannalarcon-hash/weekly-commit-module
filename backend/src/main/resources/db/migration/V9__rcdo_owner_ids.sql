-- V9__rcdo_owner_ids.sql — admin RCDO edit-tree support: an OPTIONAL owner per upper level.
-- Adds a nullable owner_id (-> member.id) to rally_cry, defining_objective and outcome so the
-- admin "Edit tree" can assign an owner at every RCDO level (supporting_outcome already has one,
-- added in V3). Nullable on purpose: an orphaned owner (member deleted) degrades gracefully and
-- never blocks strategy edits. Each gets an idx_<table>_owner index to keep owner look-ups cheap.

alter table rally_cry          add column owner_id uuid references member (id);
alter table defining_objective add column owner_id uuid references member (id);
alter table outcome            add column owner_id uuid references member (id);

create index idx_rally_cry_owner          on rally_cry (owner_id);
create index idx_defining_objective_owner on defining_objective (owner_id);
create index idx_outcome_owner            on outcome (owner_id);
