// libs/ui/src/Avatar.test.tsx — proves the avatar derives initials from a name, uses explicit initials
// when given, and exposes an accessible label (data-testid=avatar).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('derives initials from the first + last word of a name', () => {
    render(<Avatar name="Lena Acosta" />);
    const el = screen.getByTestId('avatar');
    expect(el).toHaveTextContent('LA');
    expect(el).toHaveAttribute('aria-label', 'Lena Acosta');
  });

  it('uses explicit initials when provided', () => {
    render(<Avatar initials="QZ" />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('QZ');
  });

  it('applies an explicit hue to the tint colors', () => {
    render(<Avatar name="Lena Acosta" hue={120} size={40} ring />);
    const el = screen.getByTestId('avatar');
    // Explicit hue (not hashed) flows into the OKLCH foreground/background.
    expect(el).toHaveStyle({ color: 'oklch(0.42 0.12 120)' });
    expect(el).toHaveStyle({ background: 'oklch(0.955 0.04 120)' });
  });

  it('falls back to "?" when neither name nor initials are given', () => {
    render(<Avatar />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('?');
  });

  it('derives a single initial from a one-word name', () => {
    render(<Avatar name="Madonna" />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('M');
  });

  it('hashes a stable hue from the name when none is supplied (same name ⇒ same tint)', () => {
    const { getByTestId, unmount } = render(<Avatar name="Rey Mysterio" />);
    const first = getByTestId('avatar').getAttribute('style');
    unmount();
    render(<Avatar name="Rey Mysterio" />);
    expect(screen.getByTestId('avatar').getAttribute('style')).toBe(first);
  });
});
