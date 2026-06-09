// libs/ui/src/AutosaveIndicator.test.tsx — verifies each autosave status renders the right text+icon
// in a polite live region (a11y), and that "saved" shows the relative savedLabel.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AutosaveIndicator } from './AutosaveIndicator';

describe('AutosaveIndicator', () => {
  it('announces save status via a polite live region', () => {
    render(<AutosaveIndicator status="saving" />);
    const el = screen.getByTestId('autosave-indicator');
    expect(el).toHaveAttribute('role', 'status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveTextContent(/saving/i);
  });

  it('renders "Saved · <label>" with the relative label when saved', () => {
    render(<AutosaveIndicator status="saved" savedLabel="2 minutes ago" />);
    expect(screen.getByTestId('autosave-indicator')).toHaveTextContent(
      'Saved · 2 minutes ago',
    );
  });

  it('surfaces an error state with text + icon (not color-only)', () => {
    const { container } = render(<AutosaveIndicator status="error" />);
    expect(screen.getByTestId('autosave-indicator')).toHaveTextContent(/could not save/i);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
