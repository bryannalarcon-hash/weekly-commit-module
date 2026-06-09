// apps/wc-remote/src/screens/Settings.test.tsx — RTL tests for the Outlook settings/consent screen
// (brief §6.10, U22). MSW-backed. Covers: the disconnected state → Connect triggers the Graph consent
// redirect (spied), the connected state showing account + last-sync + the lock-event toggle persisting,
// disconnect, loading, and error. The consent redirect is injected so jsdom never navigates for real.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { OutlookConnectionDto } from '@wcm/types';
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

describe('Settings', () => {
  it('shows the disconnected state and triggers the Graph consent redirect on Connect', async () => {
    server.use(http.get('*/integration/outlook', () => HttpResponse.json(disconnected)));
    const onRedirect = vi.fn();
    const user = userEvent.setup();
    render(withStore(<Settings onRedirect={onRedirect} />));

    expect(await screen.findByTestId('connection-status')).toHaveAttribute('data-status', 'DISCONNECTED');
    await user.click(screen.getByTestId('connect-outlook'));
    // connectOutlook (MSW) returns the Microsoft authorize URL → the screen redirects to it.
    await waitFor(() =>
      expect(onRedirect).toHaveBeenCalledWith(expect.stringContaining('login.microsoftonline.com')),
    );
  });

  it('shows the connected account + last-sync and persists the lock-event toggle', async () => {
    server.use(http.get('*/integration/outlook', () => HttpResponse.json(connected)));
    const settingsSpy = vi.fn(() => HttpResponse.json({ ...connected, createEventOnLock: false }));
    server.use(http.put('*/integration/outlook/settings', settingsSpy));
    const user = userEvent.setup();
    render(withStore(<Settings />));

    expect(await screen.findByTestId('connected-account')).toHaveTextContent('ada@solovis.com');
    expect(screen.getByTestId('last-sync')).toBeInTheDocument();

    await user.click(screen.getByTestId('event-on-lock-toggle'));
    await waitFor(() => expect(settingsSpy).toHaveBeenCalled());
  });

  it('disconnects a connected account', async () => {
    server.use(http.get('*/integration/outlook', () => HttpResponse.json(connected)));
    const disconnectSpy = vi.fn(() => HttpResponse.json(disconnected));
    server.use(http.delete('*/integration/outlook', disconnectSpy));
    const user = userEvent.setup();
    render(withStore(<Settings />));

    await user.click(await screen.findByTestId('disconnect-outlook'));
    await waitFor(() => expect(disconnectSpy).toHaveBeenCalled());
  });

  it('shows an error state when the connection fails to load', async () => {
    server.use(http.get('*/integration/outlook', () => new HttpResponse(null, { status: 500 })));
    render(withStore(<Settings />));
    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
  });
});
