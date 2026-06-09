// postcss.config.js — PostCSS pipeline for the WCM frontend.
// Runs Tailwind (with an explicit absolute config path so content scanning works from any
// build cwd — root via nx or an app subdir) then Autoprefixer for vendor-prefix coverage.
import { fileURLToPath } from 'node:url';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const tailwindConfig = fileURLToPath(
  new URL('./tailwind.config.js', import.meta.url),
);

export default {
  plugins: [tailwindcss({ config: tailwindConfig }), autoprefixer()],
};
