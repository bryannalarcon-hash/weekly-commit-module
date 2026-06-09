// libs/ui/src/Avatar.tsx — the member/initials avatar (prototype/wcm/ui.jsx Avatar). Renders monospace
// initials on a generated OKLCH hue tint (deterministic from the supplied hue, or hashed from a name)
// with a matching ring, so a roster of people reads as distinct without per-user images. Square with a
// small radius (matches the design's data-dense, institutional feel). Pure/presentational.

export interface AvatarProps {
  /** Initials to render (e.g. "LA"). When omitted, derived from `name`. */
  initials?: string;
  /** Full name — used to derive initials and a stable hue when `hue`/`initials` are not given. */
  name?: string;
  /** OKLCH hue (0..360). When omitted, hashed deterministically from `name`/`initials`. */
  hue?: number;
  /** Box size in px (default 30). */
  size?: number;
  /** Add the soft elevation ring. */
  ring?: boolean;
  className?: string;
}

/** Deterministic hue (0..360) from a string so the same person always gets the same tint. */
function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** First letters of the first two words, uppercased (e.g. "Lena Acosta" → "LA"). */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || '?';
}

export function Avatar({
  initials,
  name,
  hue,
  size = 30,
  ring = false,
  className,
}: AvatarProps): JSX.Element {
  const text = initials ?? (name ? initialsFrom(name) : '?');
  const h = hue ?? hueFrom(name ?? initials ?? '');
  return (
    <span
      data-testid="avatar"
      aria-label={name ?? text}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--r-sm)',
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
        fontFamily: 'var(--mono)',
        fontWeight: 600,
        fontSize: size * 0.36,
        letterSpacing: '0.01em',
        color: `oklch(0.42 0.12 ${h})`,
        background: `oklch(0.955 0.04 ${h})`,
        border: `1px solid oklch(0.885 0.055 ${h})`,
        boxShadow: ring ? 'var(--shadow-1)' : 'none',
      }}
    >
      {text}
    </span>
  );
}
