-- V6__graph_token.sql — U16/KTD7 delegated Microsoft Graph token store (one per member).
-- A member consents once (Authorization Code + PKCE); the resulting access + refresh tokens are
-- stored here ENCRYPTED AT REST (AES-GCM, key from the GRAPH_TOKEN_ENC_KEY env ref) — never in
-- plaintext. expires_at drives the refresh-before-expiry path in GraphTokenService. UNIQUE(member_id)
-- makes the store an upsert: re-consenting replaces the member's single token row.
create table graph_token (
    id                  uuid primary key,
    member_id           uuid         not null references member (id),
    access_token_enc    text         not null,
    refresh_token_enc   text,
    expires_at          timestamptz  not null,
    created_by          varchar(120) not null,
    created_date        timestamptz,
    last_modified_by    varchar(120),
    last_modified_date  timestamptz,
    constraint uq_graph_token_member unique (member_id)
);
