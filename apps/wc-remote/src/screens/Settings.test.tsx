// apps/wc-remote/src/screens/Settings.test.tsx — RTL tests for the re-skinned two-tab Settings screen
// (brief §6.10). MSW-backed, real RTK Query. ACCOUNT tab: profile (display name + manager-access badge),
// read-only email, timezone select (account-timezone), Save (account-save) persisting via PUT
// /settings/account, the 5 notification toggles persisting via PUT /settings/notifications, Sign out.
// INTEGRATIONS tab: the Outlook delegated-Graph consent flow — disconnected → Connect triggers the
// (spied) consent redirect, connected shows account + last-sync + the lock-event toggle persisting,
// disconnect, plus loading + error. Tabs switch via settings-tab-account / settings-tab-integrations.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type {
  MemberAccountDto,
  NotificationPreferenceDto,
  OutlookConnectionDto,
} from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { Settings } from './Settings';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetMockDb();
});
afterAll(() => server.close());

function withStore(node: ReactNode): JSX.Element {
  return <Provider store={makeStore()}>{node}</Provider>;
}

const account: MemberAccountDto = {
  id: 'm-1',
  email: 'lindsley.alvaro@solovis.com',
  displayName: 'Lindsley Alvaro',
  timezone: 'America/Chicago',
  canReview: true,
};
const notifications: NotificationPreferenceDto = {
  emailOnLock: true,
  emailOnReview: true,
  emailOnReconciled: true,
  weeklyDigest: true,
  reminderEmails: false,
};
const disconnected: OutlookConnectionDto = {
  status: 'DISCONNECTED',
  account: null,
  lastSyncAt: null,
  createEventOnLock: true,
};
const connected: OutlookConnectionDto = {
  status: 'CONNECTED',
  account: 'ada@solovis.com',
  lastSyncAt: '2026-06-08T09:00:00Z',
  createEventOnLock: true,
};

/** Route an Outlook GET to a fixed connection state for the Integrations tab. */
function useOutlook(state: OutlookConnectionDto): void {
  server.use(http.get('*/integration/outlook', () => HttpResponse.json(state)));
}

describe('Settings — Account tab', () => {
  it('shows the profile (name + manager-access badge), email, and timezone, and lands on Account', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    render(withStore(<Settings />));

    // Account tab is the default landing.
    expect(await screen.findByTestId('settings-account-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-tab-account')).toHaveAttribute('data-state', 'active');

    expect((screen.getByTestId('account-display-name') as HTMLInputElement).value).toBe('Lindsley Alvaro');
    expect(screen.getByTestId('manager-access-badge')).toHaveTextContent('Manager access');
    expect((screen.getByTestId('account-email') as HTMLInputElement).value).toBe(
      'lindsley.alvaro@solovis.com',
    );
    expect(screen.getByTestId('account-email')).toHaveAttribute('readonly');
    expect((screen.getByTestId('account-timezone') as HTMLSelectElement).value).toBe('America/Chicago');
  });

  it('saves an edited display name + timezone via PUT /settings/account', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    const saveSpy = vi.fn(async ({ request }: { request: Request }) => {
      const body = (await request.json()) as { displayName: string; timezone?: string };
      return HttpResponse.json({ ...account, displayName: body.displayName, timezone: body.timezone });
    });
    server.use(http.put('*/settings/account', saveSpy));
    const user = userEvent.setup();
    render(withStore(<Settings />));

    const name = (await screen.findByTestId('account-display-name')) as HTMLInputElement;
    // Save is disabled until the form is dirty.
    expect(screen.getByTestId('account-save')).toBeDisabled();

    await user.clear(name);
    await user.type(name, 'Lindsley A.');
    await user.selectOptions(screen.getByTestId('account-timezone'), 'America/New_York');
    expect(screen.getByTestId('account-save')).toBeEnabled();

    await user.click(screen.getByTestId('account-save'));
    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
  });

  it('persists a notification toggle via PUT /settings/notifications', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    const notifSpy = vi.fn(async ({ request }: { request: Request }) => {
      const body = (await request.json()) as NotificationPreferenceDto;
      return HttpResponse.json(body);
    });
    server.use(http.put('*/settings/notifications', notifSpy));
    const user = userEvent.setup();
    render(withStore(<Settings />));

    // 'reminderEmails' starts off → flip it on.
    const row = await screen.findByTestId('notif-toggle-reminderEmails');
    await user.click(within(row).getByRole('switch'));
    await waitFor(() => expect(notifSpy).toHaveBeenCalled());
  });

  it('calls onSignOut from the Session card', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    const onSignOut = vi.fn();
    const user = userEvent.setup();
    render(withStore(<Settings onSignOut={onSignOut} />));

    await user.click(await screen.findByTestId('account-sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows an error state when the account fails to load', async () => {
    server.use(http.get('*/settings/account', () => new HttpResponse(null, { status: 500 })));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    render(withStore(<Settings />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});

describe('Settings — Integrations tab', () => {
  it('switches to the Integrations tab and shows the disconnected Outlook card', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    useOutlook(disconnected);
    const user = userEvent.setup();
    render(withStore(<Settings />));

    await user.click(await screen.findByTestId('settings-tab-integrations'));
    expect(await screen.findByTestId('connection-status')).toHaveAttribute('data-status', 'DISCONNECTED');
    expect(screen.getByTestId('connect-outlook')).toBeInTheDocument();
  });

  it('triggers the Graph consent redirect on Connect', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    useOutlook(disconnected);
    const onRedirect = vi.fn();
    const user = userEvent.setup();
    render(withStore(<Settings onRedirect={onRedirect} />));

    await user.click(await screen.findByTestId('settings-tab-integrations'));
    await user.click(await screen.findByTestId('connect-outlook'));
    // connectOutlook (MSW) returns the Microsoft authorize URL → the screen redirects to it.
    await waitFor(() =>
      expect(onRedirect).toHaveBeenCalledWith(expect.stringContaining('login.microsoftonline.com')),
    );
  });

  it('shows the connected account + last-sync and persists the lock-event toggle', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    useOutlook(connected);
    const settingsSpy = vi.fn(() => HttpResponse.json({ ...connected, createEventOnLock: false }));
    server.use(http.put('*/integration/outlook/settings', settingsSpy));
    const user = userEvent.setup();
    render(withStore(<Settings />));

    await user.click(await screen.findByTestId('settings-tab-integrations'));
    expect(await screen.findByTestId('connected-account')).toHaveTextContent('ada@solovis.com');
    expect(screen.getByTestId('last-sync')).toBeInTheDocument();

    const toggleWrap = screen.getByTestId('event-on-lock-toggle');
    await user.click(within(toggleWrap).getByRole('switch'));
    await waitFor(() => expect(settingsSpy).toHaveBeenCalled());
  });

  it('disconnects a connected account', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    useOutlook(connected);
    const disconnectSpy = vi.fn(() => HttpResponse.json(disconnected));
    server.use(http.delete('*/integration/outlook', disconnectSpy));
    const user = userEvent.setup();
    render(withStore(<Settings />));

    await user.click(await screen.findByTestId('settings-tab-integrations'));
    await user.click(await screen.findByTestId('disconnect-outlook'));
    await waitFor(() => expect(disconnectSpy).toHaveBeenCalled());
  });

  it('shows an error state when the Outlook connection fails to load', async () => {
    server.use(http.get('*/settings/account', () => HttpResponse.json(account)));
    server.use(http.get('*/settings/notifications', () => HttpResponse.json(notifications)));
    server.use(http.get('*/integration/outlook', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    render(withStore(<Settings />));

    await user.click(await screen.findByTestId('settings-tab-integrations'));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
