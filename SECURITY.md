# Security Policy

## Supported versions

Only the latest `main` branch of Verdigris receives security fixes. There are no
long-term support branches.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** to the maintainer rather
than opening a public GitHub issue or pull request. Include:

- a description of the issue and its impact,
- the steps or a proof of concept needed to reproduce it, and
- any relevant logs or affected code paths.

You will get an acknowledgement as soon as the report is triaged. Please give the
maintainer a reasonable window to ship a fix before any public disclosure.

## Operator notes

The authoritative server is designed to fail closed:

- **Dev / wiz commands** (`dev:*` socket events — teleport, give items, set
  level, heal) are enabled **only** when `NODE_ENV=development`, or explicitly via
  `ENABLE_DEV_COMMANDS=true`. Any other environment (including an unset or
  misspelled `NODE_ENV`) disables them.
- **Debug HTTP endpoints** (`/world/*`) and the permissive development CORS on
  `/api` are served **only** when `NODE_ENV=development`.
- Run a production deployment with `NODE_ENV=production` (the `npm start` script
  and the pm2 `ecosystem.config.cjs` both set this).
- Behind a TLS/reverse proxy (e.g. Caddy), set `TRUST_PROXY=true` so per-IP rate
  limiting sees the real client address instead of the proxy loopback.
- Run `npm run security:audit` to review runtime-dependency advisories.
