# Option Chain OrderBook Frontend

A modern SvelteKit-based control console for options market making operations.

<!--
Screenshots were removed on purpose: the old captures showed fabricated
data (fake fills, fake hedging, fake P&L) that the app no longer renders.
Re-add fresh captures against a live backend once the honest pages settle.
-->

## Features

- **Operational Controls** (`/controls`) - Master quoting switch (confirm-guarded, admin-only), global parameters with optimistic-update reconcile, instrument toggles, live underlying prices
- **Quote Matrix** (`/quotes`) - Live call/put quotes aligned by strike, streamed over the WebSocket; empty book sides render `—`
- **Order Book Depth** (`/depth`) - Call/Put pair order book depth from point-in-time backend snapshots (per-option Greeks and IV are not yet provided by the backend and render as `—`)
- **Risk Commander** (`/risk`) - Layout for portfolio Greeks / inventory / hedging; the backend does not expose positions or hedging yet, so every widget shows an honest placeholder
- **Execution Monitor** (`/executions`) - Live session fills streamed over the WebSocket `fill` frames (empty until the engine trades; no fills history endpoint yet)
- **P&L Decomposition** (`/pnl`) - Layout for attribution by theta, delta, vega and spread capture; P&L is not exposed by the backend yet, so the page shows honest placeholders

## Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5 (runes only), served by `adapter-node`
- **Styling**: TailwindCSS with custom dark theme
- **Icons**: Material Symbols Outlined
- **Font**: Manrope
- **Tests**: Vitest + @testing-library/svelte (jsdom, fully mocked network)

## Getting Started

### Prerequisites

- Node.js 22 (what CI runs)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Tests & checks

```bash
npm run test        # Vitest (stores, money math, reconnect, auth)
npm run validate    # check + lint + format:check + test + build (what CI runs)
```

### Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── lib/
│   ├── api/
│   │   ├── client.ts       # Typed REST client + wire-unit contract docs
│   │   ├── websocket.ts    # WebSocket client (typed frames, backoff reconnect)
│   │   └── auth-token.ts   # Client-only JWT holder shared by both clients
│   ├── components/
│   │   ├── Header.svelte   # Top bar (status, kill switch, identity)
│   │   ├── Sidebar.svelte  # Side navigation
│   │   ├── AuthGate.svelte # Token screen shown until authenticated
│   │   └── ConfirmDialog.svelte # Native-dialog confirm for destructive actions
│   └── stores/
│       ├── auth.ts         # JWT session (permissions, expiry, storage)
│       ├── controls.ts     # Quoting controls state (halt/resume, parameters)
│       ├── market.ts       # Prices, quotes, underlyings, expirations, strikes
│       ├── depth.ts        # Per-level order-book snapshots for /depth
│       ├── executions.ts   # Live WS fills for /executions
│       └── system.ts       # Connection, latency + staleness, heartbeat
├── routes/
│   ├── +layout.svelte      # Main layout
│   ├── +page.svelte        # Root redirect
│   ├── controls/           # Operational Controls
│   ├── quotes/             # Quote Matrix
│   ├── depth/              # Order Book Depth Monitor
│   ├── risk/               # Risk Commander
│   ├── executions/         # Execution Monitor
│   └── pnl/                # P&L Decomposition
├── app.css                 # Global styles
├── app.d.ts                # TypeScript declarations
└── app.html                # HTML template
```

## Backend API

The typed client in `src/lib/api/client.ts` is the single source of truth for the REST surface (shapes and wire units are documented there). The endpoints the app actively calls today:

- `POST /auth/token` - Mint a JWT (gated by the operator bootstrap secret)
- `GET /underlyings` - List underlyings
- `GET /underlyings/:symbol/expirations` - List expirations
- `GET /underlyings/:symbol/expirations/:exp/strikes` - List strikes (values are integer cents)
- `GET /underlyings/:symbol/expirations/:exp/strikes/:strike/options/:style/snapshot?depth=N` - Per-level order-book snapshot (prices in integer cents)
- `GET /prices` / `GET /prices/:symbol` - Underlying prices (dollars — the one dollar-denominated surface)
- `GET /controls` - Current quoting controls
- `POST /controls/kill-switch` - Emergency kill switch
- `POST /controls/enable` - Re-enable quoting
- `POST /controls/parameters` - Update quoting parameters
- `GET /controls/instruments` - List instruments with quoting status
- `POST /controls/instrument/:symbol/toggle` - Toggle instrument quoting

The client also types (but no page calls yet): `GET /health` (served unprefixed, not under `/api/v1`), `GET /stats`, underlying/expiration/strike creation (plus underlying deletion and the single-underlying/single-strike getters), the option-book top summary, per-order add/cancel, `GET …/quote`, and `POST /prices`.

A WebSocket at `/ws` pushes real-time frames (`quote`, `price`, `fill`, `config`, `connected`, `heartbeat`); option prices on the wire are integer cents. `/executions` is fed entirely by the `fill` frames.

### Authentication

Every route except `/health` and `POST /auth/token` requires a JWT. The console gates the whole UI behind a token screen: paste a token minted by the operator (backend `mint-token` CLI) or mint one via `POST /api/v1/auth/token` with the backend's `AUTH_BOOTSTRAP_SECRET`. REST calls carry `Authorization: Bearer <jwt>`; the WebSocket connects with `?token=<jwt>` because browsers cannot set upgrade headers — the token therefore appears in the WS URL (and in any proxy/access log fronting `/ws`), which argues for short TTLs. Permissions are JWT claims — `read`, `trade`, `admin` (admin implies all); the quoting controls (kill switch, parameters, instrument toggles) are disabled in the UI without `admin` and rejected by the backend with 403 regardless — the UI gating is UX, the backend is the enforcement. The token lives in `sessionStorage` (per-tab, cleared on close) and is never written to the console. The session warns 5 minutes before expiry, then drops to the auth screen 30 s before the `exp` claim or immediately on a backend 401; re-authenticate to continue (the console does not retain the bootstrap secret, so there is no silent auto-refresh, and there is no idle-timeout logout).

## Limitations / not yet wired

Honesty over polish — these are the known gaps, in the UI and in this document:

- **Cancel All Limit Orders / Recalibrate Vol Surface / Reset Defaults** on `/controls` are disabled placeholders — no backend endpoints exist ([#17](https://github.com/joaquinbejar/Option-Chain-OrderBook-FrontEnd/issues/17) tracks cancel-all).
- **Per-option Greeks, IV, portfolio positions, hedging status, and P&L** are not exposed by the backend; `/depth`, `/risk`, and `/pnl` render `—` placeholders instead of inventing numbers.
- **`/depth` is point-in-time** — snapshots with timestamps and a Refresh action, not a streaming ladder (the WS `quote` frame carries only top-of-book).
- **`/executions` is view-scoped and volatile** — fills accumulate only while the view is open, stamped with local receipt time (the frame carries no timestamp); there is no fills-history endpoint.
- **Auth**: the JWT travels in the WS URL query (proxy logs see it — use short TTLs), `sessionStorage` is XSS-readable, there is no idle-timeout logout and no silent token refresh.
- **Screenshots** were removed — the old captures showed fabricated data; fresh ones should be taken against a live backend.

## Configuration

The Vite dev server proxies `/api` and `/ws` to `http://localhost:8080` by default. Update `vite.config.ts` to change the backend URL. Production uses the adapter-node server.

## Design System

Tokens are defined CSS-first in the `@theme` block of `src/app.css` (TailwindCSS v4).

### Colors

| Token             | Value     | Usage                       |
| ----------------- | --------- | --------------------------- |
| `primary`         | `#135bec` | Primary actions, highlights |
| `background-dark` | `#101622` | Main background             |
| `surface-dark`    | `#1a2230` | Card backgrounds            |
| `border-dark`     | `#232f48` | Borders                     |
| `text-muted`      | `#92a4c9` | Secondary text              |
| `success`         | `#0bda5e` | Positive values             |
| `danger`          | `#fa6238` | Negative values, alerts     |
| `warning`         | `#f59e0b` | Warnings                    |

## License

MIT
