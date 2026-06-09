// apps/wc-remote/src/screens/Settings.tsx — the Outlook integration settings screen (brief §6.10, U22).
// This is load-bearing: the primary job is the REAL delegated Microsoft Graph consent handoff. Connect
// → connectOutlook returns the Graph authorization URL → the screen redirects the browser to consent.
// When connected, it shows the account + last-sync, the "create a calendar event when I lock my week"
// toggle (updateOutlookSettings), and a disconnect/reconnect path. States: loading, disconnected,
// connecting (redirecting to consent), connected, error. All data + mutations via RTK Query.
import { useState } from 'react';
import { Button, Card, ToggleSwitch } from 'flowbite-react';
import {
  useConnectOutlookMutation,
  useDisconnectOutlookMutation,
  useGetOutlookConnectionQuery,
  useUpdateOutlookSettingsMutation,
} from '@wcm/api';
import { ErrorState, Skeleton } from '@wcm/ui';

/** Redirect the browser to the Graph consent URL. Indirected so tests can spy on navigation. */
export function redirectTo(url: string): void {
  if (typeof window !== 'undefined') window.location.assign(url);
}

export interface SettingsProps {
  /** Override the consent redirect (tests inject a spy; defaults to window.location.assign). */
  onRedirect?: (url: string) => void;
}

export function Settings({ onRedirect = redirectTo }: SettingsProps): JSX.Element {
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
      <div className="mx-auto max-w-2xl p-6" data-testid="settings">
        <Skeleton lines={5} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl p-6" data-testid="settings">
        <ErrorState title="Could not load your Outlook connection" onRetry={() => void refetch()} />
      </div>
    );
  }

  const connected = data.status === 'CONNECTED';

  return (
    <section className="mx-auto max-w-2xl space-y-4 p-6" data-testid="settings">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-primary-900">Outlook integration</h1>
        <p className="text-sm text-slate-500">
          Connect Outlook so locking your week can create a calendar event for it.
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <span
                data-testid="connection-status"
                data-status={data.status}
                className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-slate-400'}`}
                aria-hidden
              />
              {connected ? 'Connected' : 'Not connected'}
            </p>
            {connected ? (
              <p className="mt-1 text-sm text-slate-600" data-testid="connected-account">
                {data.account}
                {data.lastSyncAt && (
                  <span className="ml-1 text-slate-400" data-testid="last-sync">
                    · last synced {new Date(data.lastSyncAt).toLocaleString()}
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                You haven’t connected a Microsoft account yet.
              </p>
            )}
          </div>

          {connected ? (
            <Button
              color="light"
              disabled={disconnectState.isLoading}
              onClick={() => void disconnect()}
              data-testid="disconnect-outlook"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              color="blue"
              disabled={connecting || connectState.isLoading}
              onClick={startConnect}
              data-testid="connect-outlook"
            >
              {connecting ? 'Redirecting to Microsoft…' : 'Connect Outlook'}
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800">
              Create a calendar event when I lock my week
            </p>
            <p className="text-xs text-slate-500">
              Adds an Outlook event with your committed items, timed to the week.
            </p>
          </div>
          <ToggleSwitch
            checked={data.createEventOnLock}
            disabled={!connected || updateState.isLoading}
            aria-label="Create a calendar event when I lock my week"
            data-testid="event-on-lock-toggle"
            onChange={(checked) => void updateSettings({ createEventOnLock: checked })}
          />
        </div>
      </Card>

      {connected && (
        <Button
          color="light"
          size="sm"
          onClick={startConnect}
          disabled={connecting || connectState.isLoading}
          data-testid="reconnect-outlook"
        >
          Reconnect
        </Button>
      )}
    </section>
  );
}
