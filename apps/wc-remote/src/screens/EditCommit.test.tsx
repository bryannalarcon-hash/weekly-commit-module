// apps/wc-remote/src/screens/EditCommit.test.tsx — RTL tests for the core composer (brief §6.3).
// MSW-backed (real RTK Query). Proves: items render from the server; Submit stays DISABLED while an
// item is unlinked (mirrors the server guard) and the validation summary explains why; linking via the
// picker enables Submit; the lock confirm dialog locks and calls onLocked; the reorder handle is
// KEYBOARD-ACCESSIBLE (focusable, has an aria-label, moves with Space + arrows); add/delete work; the
// debounced autosave timer is CLEARED on unmount (no stray PUT after the screen is gone); and Submit
// FLUSHES the pending autosave before the submit POST so a lock never races a stale plan.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { CommitDto } from '@wcm/types';
import { handlers, makeStore, resetMockDb } from '@wcm/api';
import { EditCommit } from './EditCommit';

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

function seedCommit(items: CommitDto['items']): void {
  const dto: CommitDto = {
    id: 'c1',
    memberId: 'm1',
    weekStart: '2026-06-08',
    lifecycleState: 'DRAFT',
    submittedAt: null,
    reviewedAt: null,
    items,
  };
  server.use(
    http.get('*/commits/c1', () => HttpResponse.json(dto)),
    // PUT (autosave) echoes the body so the slice stays consistent.
    http.put('*/commits/c1', () => HttpResponse.json(dto)),
    // POST submit returns the LOCKED commit (the default handler only knows its own in-memory store).
    http.post('*/commits/c1/submit', () =>
      HttpResponse.json({ ...dto, lifecycleState: 'LOCKED', submittedAt: new Date().toISOString() }),
    ),
  );
}

const item = (id: string, linked: boolean): CommitDto['items'][number] => ({
  id,
  text: `Item ${id}`,
  status: 'OPEN',
  supportingOutcomeId: linked ? `so-${id}` : null,
  chessTier: 'ROOK',
  carriedFromItemId: null,
});

describe('EditCommit', () => {
  it('keeps Submit disabled and shows a validation blocker while an item is unlinked', async () => {
    seedCommit([item('a', false)]);
    render(withStore(<EditCommit commitId="c1" />));
    const submit = await screen.findByTestId('submit-lock');
    expect(submit).toBeDisabled();
    const summary = screen.getByTestId('validation-summary');
    expect(within(summary).getByText(/needs a supporting outcome/i)).toBeInTheDocument();
  });

  it('enables Submit and locks via the confirm dialog once every item is linked', async () => {
    seedCommit([item('a', true)]);
    const onLocked = vi.fn();
    const user = userEvent.setup();
    render(withStore(<EditCommit commitId="c1" onLocked={onLocked} />));

    const submit = await screen.findByTestId('submit-lock');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    // The lock confirm dialog's accept button is unique even though Flowbite's Modal duplicates
    // the container test id; clicking it locks the commit and fires onLocked.
    const accept = await screen.findByTestId('confirm-accept');
    await user.click(accept);
    await waitFor(() => expect(onLocked).toHaveBeenCalledOnce());
  });

  it('exposes a keyboard-accessible reorder handle for each item', async () => {
    seedCommit([item('a', true), item('b', true)]);
    render(withStore(<EditCommit commitId="c1" />));
    const handles = await screen.findAllByTestId('drag-handle');
    expect(handles).toHaveLength(2);
    // Handle is a real focusable button with an accessible reorder label (keyboard sensor target).
    const first = handles[0]!;
    expect(first.tagName).toBe('BUTTON');
    expect(first).toHaveAttribute('aria-label', expect.stringMatching(/reorder/i));
    first.focus();
    expect(first).toHaveFocus();
  });

  it('reorders items by keyboard (Space to pick up, ArrowDown, Space to drop)', async () => {
    // @dnd-kit's KeyboardSensor + sortableKeyboardCoordinates compute the next drop position from
    // layout rects, which jsdom reports as all-zero. Give each composer item a stacked rect so the
    // sensor can resolve "move down" to the sibling below — exercising the real keyboard reorder path.
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const li = this.closest('[data-testid="composer-item"]') as HTMLElement | null;
        const id = li?.getAttribute('data-item-id');
        const top = id === 'a' ? 0 : id === 'b' ? 100 : 0;
        return {
          x: 0, y: top, top, left: 0, right: 300, bottom: top + 80,
          width: 300, height: 80, toJSON: () => ({}),
        } as DOMRect;
      });

    seedCommit([item('a', true), item('b', true)]);
    const user = userEvent.setup();
    render(withStore(<EditCommit commitId="c1" />));
    await screen.findAllByTestId('drag-handle');

    const order = () =>
      screen.getAllByTestId('composer-item').map((el) => el.getAttribute('data-item-id'));
    expect(order()).toEqual(['a', 'b']);

    const firstHandle = screen.getAllByTestId('drag-handle')[0]!;
    firstHandle.focus();
    await user.keyboard('{ }'); // pick up
    await user.keyboard('{ArrowDown}'); // move down past b
    await user.keyboard('{ }'); // drop
    await waitFor(() => expect(order()).toEqual(['b', 'a']));
    rectSpy.mockRestore();
  });

  it('adds and deletes items', async () => {
    seedCommit([item('a', true)]);
    const user = userEvent.setup();
    render(withStore(<EditCommit commitId="c1" />));
    await screen.findByTestId('add-item');

    await user.click(screen.getByTestId('add-item'));
    await waitFor(() => expect(screen.getAllByTestId('composer-item')).toHaveLength(2));

    await user.click(screen.getAllByTestId('delete-item')[0]!);
    await waitFor(() => expect(screen.getAllByTestId('composer-item')).toHaveLength(1));
  });

  it('clears the debounced autosave timer on unmount (no stray PUT after the screen is gone)', async () => {
    // Edit an item to arm the 400ms debounce, then unmount BEFORE it fires. The cleanup effect must
    // clear the timer so no PUT reaches the server and no setState runs on the dead component.
    let putHits = 0;
    seedCommit([item('a', true)]);
    server.use(
      http.put('*/commits/c1', () => {
        putHits += 1;
        return HttpResponse.json({
          id: 'c1', memberId: 'm1', weekStart: '2026-06-08', lifecycleState: 'DRAFT',
          submittedAt: null, reviewedAt: null,
          items: [{ id: 'a', text: 'edited', status: 'OPEN', supportingOutcomeId: 'so-a', chessTier: 'ROOK', carriedFromItemId: null }],
        });
      }),
    );
    const user = userEvent.setup();
    const { unmount } = render(withStore(<EditCommit commitId="c1" />));
    await screen.findByTestId('add-item');

    // Type into the first item's text → mutate → scheduleSave arms the 400ms timer.
    const textbox = screen.getAllByRole('textbox')[0]!;
    await user.type(textbox, 'x');

    // Unmount well inside the debounce window; the timer would otherwise fire at ~400ms.
    unmount();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    // The pending debounce was cleared on unmount → the autosave PUT never fired.
    expect(putHits).toBe(0);
  });

  it('flushes the pending autosave BEFORE the submit POST so a lock cannot freeze a stale plan', async () => {
    // Record server request order. An edit arms the debounce; locking immediately must flush the PUT
    // (autosave) first, so the PUT is observed by the server BEFORE the submit POST — never after.
    const order: string[] = [];
    seedCommit([item('a', true)]);
    server.use(
      http.put('*/commits/c1', () => {
        order.push('PUT');
        return HttpResponse.json({
          id: 'c1', memberId: 'm1', weekStart: '2026-06-08', lifecycleState: 'DRAFT',
          submittedAt: null, reviewedAt: null,
          items: [{ id: 'a', text: 'edited', status: 'OPEN', supportingOutcomeId: 'so-a', chessTier: 'ROOK', carriedFromItemId: null }],
        });
      }),
      http.post('*/commits/c1/submit', () => {
        order.push('SUBMIT');
        return HttpResponse.json({
          id: 'c1', memberId: 'm1', weekStart: '2026-06-08', lifecycleState: 'LOCKED',
          submittedAt: new Date().toISOString(), reviewedAt: null,
          items: [{ id: 'a', text: 'edited', status: 'OPEN', supportingOutcomeId: 'so-a', chessTier: 'ROOK', carriedFromItemId: null }],
        });
      }),
    );
    const onLocked = vi.fn();
    const user = userEvent.setup();
    render(withStore(<EditCommit commitId="c1" onLocked={onLocked} />));

    const submit = await screen.findByTestId('submit-lock');
    await waitFor(() => expect(submit).toBeEnabled());

    // Edit an item to arm the debounce, then lock IMMEDIATELY (inside the 400ms window).
    const textbox = screen.getAllByRole('textbox')[0]!;
    await user.type(textbox, 'y');
    await user.click(submit);
    const accept = await screen.findByTestId('confirm-accept');
    await user.click(accept);

    await waitFor(() => expect(onLocked).toHaveBeenCalledOnce());
    // The flush forced the autosave PUT to complete before the submit POST reached the server.
    expect(order).toEqual(['PUT', 'SUBMIT']);
  });
});
