# Running Verdigris 24/7 on a home server

The production server is a single Node process: express serves the built
client from `dist/` and the game WebSocket rides the same HTTP server, so
**everything is one port** (default `6500`).

## One-time setup on the host machine

Requirements: Node >= 22, npm >= 10, git.

Clone your Verdigris repository, then from its game directory run:

```sh
npm ci
npm run build          # builds the client into dist/
npm install -g pm2
```

## Start (and keep running)

```sh
pm2 start ecosystem.config.cjs
pm2 save               # remember the process list across pm2 restarts
```

Make pm2 itself survive reboots:

- **Linux:** `pm2 startup` and run the command it prints.
- **Windows:** `npm i -g pm2-windows-startup && pm2-startup install`.

Useful commands: `pm2 status`, `pm2 logs server`, `pm2 restart server`,
`pm2 stop server`. Logs also land in `logs/`.

## Updating to a new version

```sh
git pull
npm ci
npm run build
pm2 restart server
```

## Public TLS deployment (recommended)

Point an A/AAAA record for your domain at the server, install
[Caddy](https://caddyserver.com/docs/install), then use the supplied proxy:

```sh
cp Caddyfile.example Caddyfile
VERDIGRIS_DOMAIN=play.example.com caddy run --config Caddyfile
```

Caddy obtains and renews TLS certificates and proxies HTTP and WebSocket
traffic to `127.0.0.1:6500`. Expose only ports 80/443, not 6500. WebSockets are same-origin, so no
`VITE_WS_URL` override is required.

After deployment, verify `https://play.example.com/?play`. That URL provisions
a browser-stable guest House/scion and enters a populated instance; the goal
harness asserts combat begins in under ten seconds.

Run the production-only probes before sharing the URL:

```sh
npm run smoke:production-local
npm run smoke:public -- https://play.example.com
```

Both probes avoid `dev:*` events and use isolated guest identities. The public
probe verifies the built page, secure WebSocket upgrade, quick House/scion
creation, and a populated instance inside one ten-second budget.

For a deployment preflight on a machine with `cloudflared` installed, this
command creates a temporary TLS tunnel, runs the same HTTP/WSS probe, and then
shuts the tunnel down automatically:

```sh
npm run smoke:public-tunnel
```

That temporary `trycloudflare.com` address is verification only. A shareable
24/7 URL still needs the named DNS/Caddy setup above (or a persistent named
Cloudflare Tunnel tied to a domain).

## Other ways to connect

The client connects its WebSocket to **the same host and port the page was
loaded from**, so no client configuration is needed for any of these:

- **Same machine:** http://localhost:6500
- **LAN:** http://&lt;machine-ip&gt;:6500 (open TCP 6500 in the OS firewall)
- **Private remote play without port forwarding:** install
  [Tailscale](https://tailscale.com) on the server and each player's machine,
  then play via http://&lt;tailscale-name-or-100.x-ip&gt;:6500. Traffic is
  end-to-end encrypted by the tailnet; nothing is exposed to the internet.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `6500` | HTTP + WebSocket port |
| `NODE_ENV` | — | `production` enables compression/static serving behaviour |
| `FORCE_HTTPS` | unset | `true` redirects HTTP→HTTPS (only behind a TLS proxy) |
| `VITE_WS_URL` | same-origin | Build-time client override for the WebSocket URL |
| `CHRONICLES_DB_FILE` | `server/data/verdigris.sqlite` | SQLite House/scion/relic database |
| `IDENTITY_DB_FILE` | Chronicle DB path | Optional separate SQLite identity database |

## Persistence and backups

Guest/account Chronicles and the identity registry live in
`server/data/verdigris.sqlite` by default. Back up that file and its `-wal`
sidecar while running, or stop PM2 briefly and copy the main database. Legacy
`identity-store.json` records are imported automatically; new writes use only
SQLite.
