# Running Delaford 24/7 on a home server

The production server is a single Node process: express serves the built
client from `dist/` and the game WebSocket rides the same HTTP server, so
**everything is one port** (default `6500`).

## One-time setup on the host machine

Requirements: Node >= 22, npm >= 10, git.

```sh
git clone https://github.com/alexkorol/Delaford.git
cd Delaford
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

Useful commands: `pm2 status`, `pm2 logs delaford`, `pm2 restart delaford`,
`pm2 stop delaford`. Logs also land in `logs/`.

## Updating to a new version

```sh
git pull
npm ci
npm run build
pm2 restart delaford
```

## Letting players connect

The client connects its WebSocket to **the same host and port the page was
loaded from**, so no client configuration is needed for any of these:

- **Same machine:** http://localhost:6500
- **LAN:** http://&lt;machine-ip&gt;:6500 (open TCP 6500 in the OS firewall)
- **Remote play without port forwarding (recommended):** install
  [Tailscale](https://tailscale.com) on the server and each player's machine,
  then play via http://&lt;tailscale-name-or-100.x-ip&gt;:6500. Traffic is
  end-to-end encrypted by the tailnet; nothing is exposed to the internet.

### Public internet (later)

Only if/when you outgrow Tailscale: put a TLS proxy (Caddy is the least
fuss) in front of port 6500, set `FORCE_HTTPS=true` in the pm2 env so the
server enforces HTTPS behind the proxy, and rebuild the client with
`VITE_WS_URL=wss://your-domain` if the proxy terminates WebSockets on a
different host than the page.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `6500` | HTTP + WebSocket port |
| `NODE_ENV` | — | `production` enables compression/static serving behaviour |
| `FORCE_HTTPS` | unset | `true` redirects HTTP→HTTPS (only behind a TLS proxy) |
| `VITE_WS_URL` | same-origin | Build-time client override for the WebSocket URL |
| `SITE_URL` | unset | Auth/persistence API for non-guest accounts (not yet self-hostable) |

## Persistence

Guest progress is stored locally under `server/data/guest-saves/` and survives
logout and process restarts. Back up that directory with the server if guest
characters matter. Non-guest accounts still require the external `SITE_URL`
auth/persistence API; that account service is not yet bundled for self-hosting.
