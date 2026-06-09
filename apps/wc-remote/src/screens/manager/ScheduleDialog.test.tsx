// apps/wc-remote/src/screens/manager/ScheduleDialog.test.tsx — RTL tests for the CB-1 "Schedule 1:1"
// modal. MSW-backed, real RTK Query (no mocked hooks). Covers: the prefilled fields (subject
// "1:1 — <report>", tomorrow's date, 10:00, 30 minutes), the exact POST /integration/outlook/schedule
// payload (MSW spy; start is ISO WITH a UTC offset), the busy/disabled in-flight footer, and the 409
// illegal_state path (connect-Outlook inline error, dialog stays open, onScheduled never fires).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ScheduleOutlookEventRequest } from '@wcm/types';
import {
  handlers,
  makeStore,
  outlookScheduleIllegalStateHandler,
  resetMockDb,
} from '@wcm/api';
import { ScheduleDialog } from './ScheduleDialog';

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
const noop = (): void => undefined;

/** Tomorrow's LOCAL calendar date (yyyy-MM-dd) — must match the dialog's default date. */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function renderDialog(
  overrides: Partial<{ onClose: () => void; onScheduled: (eventId: string) => void }> = {},
): void {
  render(
    withStore(
      <ScheduleDialog
        reportMemberId="m1"
        reportName="Maya Chen"
        onClose={overrides.onClose ?? noop}
        onScheduled={overrides.onScheduled ?? noop}
      />,
    ),
  );
}

describe('ScheduleDialog', () => {
  it('renders prefilled: subject from the report name, tomorrow 10:00, 30 minutes', () => {
    renderDialog();
    expect(screen.getByTestId('schedule-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-subject')).toHaveValue('1:1 — Maya Chen');
    expect(screen.getByTestId('schedule-date')).toHaveValue(tomorrowIso());
    expect(screen.getByTestId('schedule-time')).toHaveValue('10:00');
    expect(screen.getByTestId('schedule-duration')).toHaveValue('30');
    expect(screen.getByTestId('schedule-note')).toHaveValue('');
    expect(screen.queryByTestId('schedule-error')).not.toBeInTheDocument();
  });

  it('POSTs the schedule payload (ISO start WITH offset) and reports the created event id', async () => {
    const seen: { body?: ScheduleOutlookEventRequest } = {};
    server.use(
      http.post('*/integration/outlook/schedule', async ({ request }) => {
        seen.body = (await request.json()) as ScheduleOutlookEventRequest;
        return HttpResponse.json({ eventId: 'evt-1' });
      }),
    );
    const onScheduled = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onScheduled });

    await user.selectOptions(screen.getByTestId('schedule-duration'), '45');
    await user.type(screen.getByTestId('schedule-note'), 'Growth-plan check-in');
    await user.click(screen.getByTestId('schedule-submit'));

    await waitFor(() => expect(onScheduled).toHaveBeenCalledWith('evt-1'));
    expect(seen.body?.reportMemberId).toBe('m1');
    expect(seen.body?.subject).toBe('1:1 — Maya Chen');
    expect(seen.body?.durationMinutes).toBe(45);
    expect(seen.body?.note).toBe('Growth-plan check-in');
    // The start is the picked LOCAL wall-clock time carrying an explicit UTC offset, so the
    // backend/Graph receives an absolute instant (not a floating local time).
    expect(seen.body?.startDateTime).toMatch(
      new RegExp(`^${tomorrowIso()}T10:00:00[+-]\\d{2}:\\d{2}$`),
    );
  });

  it('disables the footer while the request is in flight (busy state)', async () => {
    server.use(
      http.post('*/integration/outlook/schedule', async () => {
        await delay(150);
        return HttpResponse.json({ eventId: 'evt-slow' });
      }),
    );
    const onScheduled = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onScheduled });

    await user.click(screen.getByTestId('schedule-submit'));
    await waitFor(() => expect(screen.getByTestId('schedule-submit')).toBeDisabled());
    expect(screen.getByTestId('schedule-cancel')).toBeDisabled();
    await waitFor(() => expect(onScheduled).toHaveBeenCalledWith('evt-slow'));
  });

  it('shows the connect-Outlook error on 409 illegal_state and stays open', async () => {
    server.use(outlookScheduleIllegalStateHandler);
    const onScheduled = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onScheduled, onClose });

    await user.click(screen.getByTestId('schedule-submit'));

    const error = await screen.findByTestId('schedule-error');
    expect(error).toHaveTextContent(/connect outlook in settings/i);
    expect(error).toHaveTextContent(/integrations/i);
    // No crash, no close, no success: the dialog stays open and re-enabled for a retry.
    expect(screen.getByTestId('schedule-dialog')).toBeInTheDocument();
    expect(onScheduled).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('schedule-submit')).toBeEnabled();
  });

  it('Cancel closes without posting', async () => {
    const scheduleSpy = vi.fn(() => HttpResponse.json({ eventId: 'evt-x' }));
    server.use(http.post('*/integration/outlook/schedule', scheduleSpy));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.click(screen.getByTestId('schedule-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(scheduleSpy).not.toHaveBeenCalled();
  });
});
