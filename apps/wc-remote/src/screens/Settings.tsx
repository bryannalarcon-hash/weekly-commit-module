// apps/wc-remote/src/screens/Settings.tsx — the Settings screen (brief §6.10), re-skinned to the WCM
// c-design (prototype/wcm/page-settings.jsx) with TWO tabs: ACCOUNT and INTEGRATIONS.
// ACCOUNT: profile card (Avatar + editable display name, role + manager-access badge, read-only email,
//   timezone select), a Notifications group (5 Toggles), and a Session card with a red Sign out — wired
//   to useGetAccountQuery/useUpdateAccountMutation + useGetNotificationsQuery/useUpdateNotificationsMutation.
// INTEGRATIONS: the load-bearing Microsoft Outlook delegated Graph consent handoff — Connect →
//   connectOutlook returns the authorize URL → the browser redirects to consent; states
//   disconnected → connecting ("Redirecting to Microsoft…") → connected; Sync-preferences toggle enabled
//   only when connected — via useGetOutlookConnectionQuery/useConnectOutlookMutation/
//   useDisconnectOutlookMutation/useUpdateOutlookSettingsMutation. All data + mutations via RTK Query.
// Default export `Settings` (signature stable; props optional) — routes import it with no props.
import { useState } from 'react';
import type { NotificationPreferenceDto } from '@wcm/types';
import {
  useConnectOutlookMutation,
  useDisconnectOutlookMutation,
  useGetAccountQuery,
  useGetNotificationsQuery,
  useGetOutlookConnectionQuery,
  useUpdateAccountMutation,
  useUpdateNotificationsMutation,
  useUpdateOutlookSettingsMutation,
} from '@wcm/api';
import {
  Avatar,
  ErrorState,
  Icon,
  SectionTitle,
  Skeleton,
  Toggle,
} from '@wcm/ui';
import { isE2e, setE2eSignedOut } from '../app/e2eAuth';

/** Redirect the browser to the Graph consent URL. Indirected so tests can spy on navigation. */
export function redirectTo(url: string): void {
  if (typeof window !== 'undefined') window.location.assign(url);
}

export interface SettingsProps {
  /** Override the consent redirect (tests inject a spy; defaults to window.location.assign). */
  onRedirect?: (url: string) => void;
  /** Sign-out handler (host owns the Auth0 logout); optional so the route can mount propless. */
  onSignOut?: () => void;
}

type SettingsTab = 'account' | 'integrations';

/** Timezone options surfaced in the Account → Timezone select (label + IANA zone id). */
const TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/Chicago', label: 'Central — America/Chicago' },
  { value: 'America/New_York', label: 'Eastern — America/New_York' },
  { value: 'America/Los_Angeles', label: 'Pacific — America/Los_Angeles' },
  { value: 'Europe/London', label: 'GMT — Europe/London' },
];

/** The 5 email-notification toggles, mapped to the NotificationPreferenceDto keys. */
const NOTIF_ROWS: ReadonlyArray<{
  key: keyof NotificationPreferenceDto;
  label: string;
  desc: string;
}> = [
  { key: 'emailOnLock', label: 'New week is open', desc: 'Monday reminder to start your commit.' },
  { key: 'reminderEmails', label: 'Commit due soon', desc: 'Nudge if your week is still in draft on Thursday.' },
  { key: 'emailOnReview', label: 'My week was reviewed', desc: 'When your manager reviews or comments.' },
  { key: 'emailOnReconciled', label: 'My week was reconciled', desc: 'When your reconciliation is finalized.' },
  { key: 'weeklyDigest', label: 'Weekly team digest', desc: 'Manager roll-up summary each Friday.' },
];

const PANEL_BASE: React.CSSProperties = { marginBottom: 18 };

// ── Account tab ────────────────────────────────────────────────────────────────────────────────

function AccountTab({ onSignOut }: { onSignOut?: () => void }): JSX.Element {
  const accountQ = useGetAccountQuery();
  const notifQ = useGetNotificationsQuery();
  const [updateAccount, updateAccountState] = useUpdateAccountMutation();
  const [updateNotifications] = useUpdateNotificationsMutation();

  const account = accountQ.data;
  const notif = notifQ.data;

  // Local edits as an overlay over the fetched account (null = pristine, not yet touched). The
  // field values are DERIVED from `account` until the first edit (see below), so there is no
  // one-render "empty field + Save momentarily enabled" flash on load — which the previous
  // empty-string state + post-render effect-sync produced (and which flaked the save test).
  const [edited, setEdited] = useState<{ displayName: string; timezone: string } | null>(null);

  if (accountQ.isLoading || notifQ.isLoading) {
    return (
      <div className="panel" style={{ padding: 22 }} data-testid="settings-account-loading">
        <Skeleton lines={5} />
      </div>
    );
  }
  if (accountQ.isError || notifQ.isError || !account || !notif) {
    return (
      <ErrorState
        title="Could not load your account"
        onRetry={() => {
          void accountQ.refetch();
          void notifQ.refetch();
        }}
      />
    );
  }

  // Derive the field values from the edit overlay, falling back to the loaded account (pristine).
  const displayName = edited?.displayName ?? account.displayName;
  const timezone = edited?.timezone ?? account.timezone;
  const dirty =
    edited !== null &&
    (displayName !== account.displayName || timezone !== account.timezone);
  const save = (): void => {
    void updateAccount({ displayName: displayName.trim(), timezone })
      .unwrap()
      .then(() => setEdited(null)) // back to pristine; the refetched account now holds these values
      .catch(() => undefined); // mutation error surfaces via updateAccountState; keep the draft
  };
  const setNotif = (key: keyof NotificationPreferenceDto, value: boolean): void => {
    void updateNotifications({ ...notif, [key]: value });
  };

  return (
    <div data-testid="settings-account-panel">
      {/* profile */}
      <div className="panel" style={{ padding: 22, ...PANEL_BASE }} data-testid="account-profile">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar name={account.displayName} size={60} ring />
          <div style={{ flex: 1, minWidth: 180 }}>
            <input
              className="input"
              value={displayName}
              aria-label="Display name"
              data-testid="account-display-name"
              onChange={(e) => setEdited({ displayName: e.target.value, timezone })}
              style={{
                fontSize: 18,
                fontWeight: 700,
                padding: '4px 8px',
                marginLeft: -8,
                border: '1px solid transparent',
                background: 'transparent',
                width: '100%',
                maxWidth: 320,
              }}
            />
            <div style={{ fontSize: 13, color: 'var(--ink-low)', marginTop: 3 }}>
              Senior Engineer · reports to Brian Artemayev
            </div>
            {account.canReview && (
              <div
                data-testid="manager-access-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--violet)',
                  background: 'var(--violet-dim)',
                  padding: '3px 10px',
                  borderRadius: 99,
                }}
              >
                <Icon.mgr size={13} aria-hidden /> Manager access
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary lift"
            disabled={!dirty || updateAccountState.isLoading}
            onClick={save}
            data-testid="account-save"
          >
            {updateAccountState.isLoading ? 'Saving…' : 'Save profile'}
          </button>
        </div>
        <div
          className="acct-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <div>
            <label className="kicker" style={{ display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              className="input"
              value={account.email}
              aria-label="Email"
              data-testid="account-email"
              readOnly
            />
          </div>
          <div>
            <label className="kicker" htmlFor="account-timezone" style={{ display: 'block', marginBottom: 6 }}>
              Timezone
            </label>
            <select
              id="account-timezone"
              className="input"
              value={timezone}
              aria-label="Timezone"
              data-testid="account-timezone"
              onChange={(e) => setEdited({ displayName, timezone: e.target.value })}
              style={{ appearance: 'none', cursor: 'pointer' }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* notifications */}
      <SectionTitle title="Notifications" />
      <div className="panel" style={{ padding: 4, ...PANEL_BASE }} data-testid="notifications-panel">
        {NOTIF_ROWS.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              borderTop: i ? '1px solid var(--line-soft)' : 'none',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{row.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-low)', marginTop: 3 }}>{row.desc}</div>
            </div>
            <span data-testid={`notif-toggle-${row.key}`}>
              <Toggle on={notif[row.key]} onChange={(v) => setNotif(row.key, v)} label={row.label} />
            </span>
          </div>
        ))}
      </div>

      {/* session */}
      <div
        className="panel"
        data-testid="session-card"
        style={{
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Session</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-low)', marginTop: 2 }}>
            Signed in via Microsoft · Auth0
          </div>
        </div>
        <button
          type="button"
          className="btn btn-danger lift"
          onClick={() => {
            // Hermetic demo build: "Sign out" sets the e2e signed-out flag and reloads, surfacing
            // the standalone login screen + demo bypass (CB-2 loop). Real builds defer to the host.
            if (isE2e()) {
              setE2eSignedOut(true);
              window.location.assign('/');
              return;
            }
            onSignOut?.();
          }}
          data-testid="account-sign-out"
        >
          <Icon.unlock size={15} aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );
}

// ── Integrations tab (Outlook / Microsoft Graph) ────────────────────────────────────────────────

function IntegrationsTab({ onRedirect }: { onRedirect: (url: string) => void }): JSX.Element {
  const { data, isLoading, isError, refetch } = useGetOutlookConnectionQuery();
  const [connect, connectState] = useConnectOutlookMutation();
  const [disconnect, disconnectState] = useDisconnectOutlookMutation();
  const [updateSettings, updateState] = useUpdateOutlookSettingsMutation();
  const [connecting, setConnecting] = useState(false);

  const startConnect = (): void => {
    setConnecting(true);
    void connect()
      .unwrap()
      .then((res) => onRedirect(res.authorizationUrl))
      .catch(() => setConnecting(false));
  };

  if (isLoading) {
    return (
      <div className="panel" style={{ padding: 22 }} data-testid="settings-integrations-loading">
        <Skeleton lines={4} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <ErrorState
        title="Could not load your Outlook connection"
        onRetry={() => void refetch()}
      />
    );
  }

  const connected = data.status === 'CONNECTED';

  return (
    <div data-testid="settings-integrations-panel">
      {/* connect card */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', ...PANEL_BASE }}>
        <div
          style={{
            padding: '20px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span
            data-testid="connection-status"
            data-status={data.status}
            aria-hidden
            style={{
              width: 48,
              height: 48,
              flex: 'none',
              borderRadius: 'var(--r-md)',
              display: 'grid',
              placeItems: 'center',
              background: connected ? 'var(--signal-dim)' : 'var(--cyan-dim)',
              color: connected ? 'var(--signal-deep)' : 'var(--cyan)',
            }}
          >
            <Icon.mail size={24} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>Microsoft Outlook</span>
              {connected && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--signal)',
                    background: 'var(--signal-dim)',
                    padding: '2px 9px',
                    borderRadius: 99,
                  }}
                >
                  <span
                    aria-hidden
                    style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--signal)' }}
                  />{' '}
                  Connected
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-low)', marginTop: 4 }}>
              {connected ? (
                <span data-testid="connected-account">
                  {data.account}
                  {data.lastSyncAt && (
                    <span data-testid="last-sync"> · synced {new Date(data.lastSyncAt).toLocaleString()}</span>
                  )}
                </span>
              ) : (
                'Delegated calendar access via Microsoft Graph.'
              )}
            </div>
          </div>
          <div>
            {!data.available && !connected ? (
              <span
                data-testid="outlook-unavailable"
                style={{ fontSize: 12.5, color: 'var(--ink-low)', maxWidth: 240, display: 'inline-block', textAlign: 'right' }}
              >
                Outlook isn’t enabled on this host.
              </span>
            ) : connected ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={disconnectState.isLoading}
                onClick={() => void disconnect()}
                data-testid="disconnect-outlook"
              >
                Disconnect
              </button>
            ) : connecting ? (
              <button type="button" className="btn btn-ghost" disabled data-testid="connect-outlook">
                <span
                  aria-hidden
                  style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--cyan)' }}
                />{' '}
                Redirecting to Microsoft…
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary lift"
                disabled={connectState.isLoading}
                onClick={startConnect}
                data-testid="connect-outlook"
              >
                <Icon.mail size={15} aria-hidden /> Connect Outlook
              </button>
            )}
          </div>
        </div>
        {connecting && !connected && (
          <div
            data-testid="outlook-connecting-note"
            style={{
              padding: '11px 22px',
              background: 'var(--cyan-dim)',
              borderTop: '1px solid var(--line-soft)',
              fontSize: 12.5,
              color: 'var(--ink-mid)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon.external size={14} aria-hidden /> You&apos;ll be sent to Microsoft to grant calendar
            permission, then returned here.
          </div>
        )}
        {connected && (
          <div
            style={{
              padding: '10px 22px',
              background: 'var(--surface-2)',
              borderTop: '1px solid var(--line-soft)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-low)' }}>
              LAST SYNC · {data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : 'JUST NOW'}
            </span>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={startConnect}
              disabled={connectState.isLoading || connecting}
              data-testid="reconnect-outlook"
              style={{ fontSize: 11 }}
            >
              <Icon.refresh size={13} aria-hidden /> Reconnect
            </button>
          </div>
        )}
      </div>

      {/* sync preferences */}
      <SectionTitle title="Sync preferences" />
      <div
        className="panel"
        data-testid="sync-preferences-panel"
        style={{
          padding: 4,
          opacity: connected ? 1 : 0.55,
          pointerEvents: connected ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              Create a calendar event when I lock my week
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-low)', marginTop: 3 }}>
              Adds a focus block summarizing your committed items.
            </div>
          </div>
          <span data-testid="event-on-lock-toggle">
            <Toggle
              on={data.createEventOnLock}
              disabled={!connected || updateState.isLoading}
              label="Create a calendar event when I lock my week"
              onChange={(checked) => void updateSettings({ createEventOnLock: checked })}
            />
          </span>
        </div>
      </div>

      {!connected && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12.5,
            color: 'var(--ink-low)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Icon.info size={14} aria-hidden /> Connect Outlook to enable calendar sync preferences.
        </div>
      )}
    </div>
  );
}

// ── Settings (tab shell) ─────────────────────────────────────────────────────────────────────────

const TABS: ReadonlyArray<{ id: SettingsTab; label: string; testid: string; Glyph: typeof Icon.user }> = [
  { id: 'account', label: 'Account', testid: 'settings-tab-account', Glyph: Icon.user },
  { id: 'integrations', label: 'Integrations', testid: 'settings-tab-integrations', Glyph: Icon.mail },
];

export function Settings({ onRedirect = redirectTo, onSignOut }: SettingsProps): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('account');

  return (
    <section className="page" data-testid="settings" style={{ maxWidth: 760 }}>
      <div className="ptitle">
        <div>
          <h1>Settings</h1>
          <div className="sub">Your account, notifications, and connected apps.</div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--line)' }}
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={t.testid}
              data-state={on ? 'active' : 'inactive'}
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13.5,
                fontWeight: 600,
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${on ? 'var(--signal)' : 'transparent'}`,
                color: on ? 'var(--ink)' : 'var(--ink-low)',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              <t.Glyph size={16} aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'account' ? (
        <AccountTab onSignOut={onSignOut} />
      ) : (
        <IntegrationsTab onRedirect={onRedirect} />
      )}
    </section>
  );
}
