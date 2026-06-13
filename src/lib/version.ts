// App version, surfaced in Settings → Acerca de. Sourced from package.json so
// there is a single source of truth for the released version.
import pkg from '../../package.json';

export const APP_VERSION: string = pkg.version;
