// Lets Node run the app's own modules in tests: they import siblings without the ".js" ending (Vite adds
// it), and some read localStorage, which Node lacks.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier)) {
      try { return next(`${specifier}.js`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});
globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
