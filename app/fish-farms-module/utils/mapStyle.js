const MAPTILER_KEY_PLACEHOLDER = '{MAPTILER_KEY}';

/**
 * Deep-clones a Mapbox GL style and substitutes the MapTiler API key.
 *
 * The style JSONs in app/styles/ ship with `{MAPTILER_KEY}` placeholders rather
 * than a literal key, so the credential stays out of version control and can be
 * rotated in one place. Mapbox GL mutates the style object it is handed, so
 * callers still get a fresh copy every time.
 */
export const cloneMapStyle = (style) => {
  const serialized = JSON.stringify(style);

  if (!serialized.includes(MAPTILER_KEY_PLACEHOLDER)) {
    return JSON.parse(serialized);
  }

  // Next.js inlines `process.env.NEXT_PUBLIC_*` at build time by literal text
  // substitution, so this has to be written out in full — destructuring it or
  // reading it dynamically leaves it undefined in the browser bundle.
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  if (!key) {
    console.warn(
      'NEXT_PUBLIC_MAPTILER_KEY was not set at build time — basemap tiles ' +
        'will not load. Set it in the environment that builds this app ' +
        '(.env.local for local dev, Netlify site environment variables, or ' +
        'GitHub Actions secrets), then rebuild — the value is inlined at ' +
        'build time, so setting it without a rebuild changes nothing.'
    );
    return JSON.parse(serialized);
  }

  return JSON.parse(serialized.replaceAll(MAPTILER_KEY_PLACEHOLDER, key));
};
