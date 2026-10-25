# Contributing

Issues and pull requests are welcome.

## The invariant

The app makes **zero network calls at runtime**. This is the one rule that must never be broken. A change that adds telemetry, analytics, a CDN dependency, a remote font, a remote image, a tracking pixel, or any other outbound request will be rejected.

The app already wraps `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `navigator.sendBeacon` to count outbound calls. The self-test reports the count. A pull request that increases it is a regression.

Do not re-add the host beacons. A clean build from this repository must not contain `__vincen__/collector.js` or an inline `navigator.sendBeacon('/__va', ...)` script. If you are working from a vendor bundle, run `scripts/strip-host-beacons.sh` and check the result before publishing.

## Other constraints

- Keep the repository a static site. Do not add a server, a database, a build-time telemetry plugin, or a postinstall step that injects one.
- Keep asset references relative (`./assets/...`). Do not introduce absolute paths or external origins.
- Keep the service worker and manifest at the paths `index.html` references.
- Do not weaken the honesty of the interface: unavailable, partial, and not-measured values must stay labelled as such rather than being replaced with plausible-looking numbers.
- Do not add claims that the code cannot support. A passing self-test proves only that specific code paths returned specific values in that browser at that moment.
- Do not describe the `src/` template scaffold as the AEGIS implementation. The AEGIS runtime is the prebuilt bundle in `public/assets/`.

## Reporting a security issue

See `SECURITY.md`. Do not open a public issue for a security report.
