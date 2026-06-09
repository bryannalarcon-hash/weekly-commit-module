// libs/ui/src/theme.colors.d.mts — ambient types for the plain-JS color literal module so the typed
// tokens.ts (and tailwind.config.js) can share one source under allowJs:false + Bundler resolution.
type Scale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
export const PRIMARY: Scale;
export const ACCENT: Scale;
export const NEUTRAL: Scale;
export const SEMANTIC: { success: string; warning: string; danger: string; info: string; draft: string };
export const FONT_SANS: string[];
