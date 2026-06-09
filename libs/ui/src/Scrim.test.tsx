// libs/ui/src/Scrim.test.tsx — proves the Scrim closes on Escape and on a click outside its content,
// but NOT on a click inside the content (data-testid=scrim / scrim-content).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Scrim } from './Scrim';

describe('Scrim', () => {
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Scrim onClose={onClose}>
        <div>panel</div>
      </Scrim>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on a click on the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Scrim onClose={onClose}>
        <div>panel</div>
      </Scrim>,
    );
    await userEvent.click(screen.getByTestId('scrim'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close on a click inside the content', async () => {
    const onClose = vi.fn();
    render(
      <Scrim onClose={onClose}>
        <button type="button">inside</button>
      </Scrim>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'inside' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
