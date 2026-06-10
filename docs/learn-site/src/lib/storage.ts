// storage.ts — small typed wrappers over localStorage for persisted UI preferences.
// Used by the register (plain/deep) and theme (light/dark) toggles; SSR/no-storage safe.

const REGISTER_KEY = 'wcm-learn:register';
const THEME_KEY = 'wcm-learn:theme';

export type Theme = 'light' | 'dark';
export type Register = 'plain' | 'deep';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / privacy-mode failures */
  }
}

export function loadRegister(): Register {
  const v = read(REGISTER_KEY);
  return v === 'deep' ? 'deep' : 'plain'; // default Plain
}

export function saveRegister(value: Register): void {
  write(REGISTER_KEY, value);
}

export function loadTheme(): Theme {
  const v = read(THEME_KEY);
  if (v === 'light' || v === 'dark') return v;
  // Fall back to the OS preference.
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(value: Theme): void {
  write(THEME_KEY, value);
}
