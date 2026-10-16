# Mini Marketplace

A small online store with an admin panel: product catalog, cart, checkout with a mock payment,
stock accounting that cannot oversell, order processing in a queue, and sales analytics.

**Stack:** NestJS 12 · React 19 · PostgreSQL 17 · Prisma 7 · Redis 7 · BullMQ · Docker

![CI](https://github.com/gallisak/e-commerce/actions/workflows/ci.yml/badge.svg)

## Quick start

```bash
docker compose up --build
```

| What                 | Where                            |
| -------------------- | -------------------------------- |
| Storefront and admin | http://localhost:8080            |
| Swagger (OpenAPI)    | http://localhost:8080/api/docs   |
| Health check         | http://localhost:8080/api/health |

On start the backend applies migrations and seeds demo data: 6 categories, 36 products and
80 orders over the last 30 days.

| Role     | Email                  | Password         |
| -------- | ---------------------- | ---------------- |
| Admin    | `admin@example.com`    | `Admin12345!`    |
| Customer | `customer@example.com` | `Customer12345!` |

Ports: `FRONTEND_PORT`, `POSTGRES_PORT`, `REDIS_PORT` (PostgreSQL and Redis listen on
`127.0.0.1` only). `docker compose down -v` removes the data.

**Demo mode.** Compose runs the production build with `DEMO_MODE=true`, which allows the
placeholder secrets from `backend/.env.example` and seeds the demo accounts. Without it, the
backend refuses to start in production with placeholder or identical JWT secrets or with
`COOKIE_SECURE=false`, and seeds nothing.

## Features

**Customer:** catalog with pagination, search, category and price filters, sorting by price and
newest (all kept in the URL); product page; cart with optimistic updates; checkout with a mock
payment; order history; cancelling an order until it is paid.

**Admin:** products (image upload or URL), categories, orders with status changes and
cancellation (a paid order is refunded), dashboard with revenue, orders, average order, top 5
products, sales by day chart for a chosen period and CSV export.

## Architecture

```
Browser ──► nginx (frontend container)
              ├── /            React SPA, CSP and security headers
              ├── /api/*  ──►  NestJS API ──► PostgreSQL
              └── /uploads/* ─►     │      ──► Redis: catalog cache, rate limits, BullMQ
                                    └── BullMQ worker (same process): payments, refunds
```

The browser works with a single origin, so the refresh token cookie can be `SameSite=Strict`.

**Backend.** Modules `auth`, `users`, `products`, `categories`, `cart`, `orders`, `analytics`,
plus `database`, `redis`, `catalog-cache`, `storage`, `health` and shared `common`. Each feature
is split into controller → service → repository: controllers validate DTOs with
`class-validator` (unknown fields are rejected), services hold the business rules and use the
database only through repositories. Response DTOs map entities explicitly.

**Frontend.** React 19 + Vite, React Router, TanStack Query, React Hook Form + zod,
shadcn/ui (Base UI) + Tailwind CSS. Code is grouped by feature (`catalog`, `cart`, `orders`,
`account`, `auth`, `admin`). The admin panel and the chart library are loaded lazily.

```
backend/   prisma/ (schema, migrations), src/<module>/ (*.spec.ts next to code), test/ (e2e)
frontend/  src/features/, src/components/ (shadcn/ui in components/ui), .storybook/
```

## Why PostgreSQL and Prisma

The key requirement is "place an order and take the stock atomically": a transaction across
several tables with strict consistency, which is what a relational database is built for.

- **Transactions and row locks.** Stock is reserved with a conditional
  `UPDATE … SET stock = stock - n WHERE stock >= n` inside the checkout transaction.
- **Constraints.** `CHECK (stock >= 0)`, positive quantities and prices, foreign keys and unique
  keys protect the data even if application code has a bug.
- **Reporting.** Revenue, top products and sales per day are SQL aggregations by day in the
  store time zone.
- **Indexes.** `pg_trgm` GIN index for search by name, plus category + price, price, creation
  date and order lookups.

Prisma gives typed queries and migrations. The stock update, analytics and the trigram index
use raw SQL through Prisma's parameterised tagged templates.

## Key decisions

### Checkout without overselling

One transaction:

1. Lock the customer's cart row (`SELECT … FOR UPDATE`), so a double submit creates one order
   and the second request gets `400 Cart is empty`.
2. Read cart lines sorted by product id, so concurrent orders lock products in the same order
   and cannot deadlock.
3. Run the conditional `UPDATE` per line. If any line is short, return `409` with the shortages
   and roll everything back.
4. Create the order with price snapshots and clear the cart.

An `Idempotency-Key` header makes retries return the original order; reusing a key with a
different payload returns `422`. E2E tests fire concurrent checkouts for the last units and
check that stock never goes below zero.

### Order processing in a queue

Checkout creates the order in `NEW` and adds a BullMQ job. The worker charges the mock payment
(`PAYMENT_MOCK_DELAY_MS`, `PAYMENT_MOCK_FAILURE_RATE`) and moves the order to `PROCESSING`, or to
`CANCELLED` with the stock released.

- The charge is idempotent per order, so a retried job never charges twice. Only the worker can
  set `PROCESSING`.
- Statuses: `NEW → PROCESSING → SHIPPED → COMPLETED`, and `NEW`/`PROCESSING → CANCELLED`. Every
  change is saved in the order history; updates are conditional on the current status, so
  concurrent changes get `409`.
- Cancelling a paid order (also during the payment) queues a refund: `REFUND_PENDING`, then
  `REFUNDED`.
- Jobs retry with backoff, and a recovery task re-queues stale orders and refunds every minute
  (for example, if Redis was down at checkout).

### Catalog cache

Product lists, product pages and categories are cached in Redis under a version number. Any
catalog or stock change bumps the version, so old entries are never read again and expire by
TTL. Without Redis the API reads from the database. Cached data includes stock, so every order
invalidates the cache: exact stock in exchange for a lower hit rate.

### Security

- **Auth.** JWT access token (15 min) in memory; refresh token in an `httpOnly`,
  `SameSite=Strict` cookie on `/api/auth`, stored hashed and rotated on every use. Reusing a
  rotated token logs the user out everywhere, except one retry within 20 seconds (a lost
  response). Tabs share refreshes through the Web Locks API. Passwords use argon2.
- **Roles** come from the access token, so a role change applies within 15 minutes.
- **Rate limiting** in Redis: 5 logins per minute per client IP (behind nginx), plus a general
  API limit. If Redis is down, requests are let through.
- **Input.** DTO validation, control characters blocked in single-line fields, parameterised
  SQL, React escaping, CSP in nginx, helmet on the API. Uploads are checked by content; image
  URLs must be `https`.
- **CSV export** is streamed, guarded against formula injection and aborted if the database
  fails midway.
- **Errors and logs.** One error format with a request id; 5xx details are hidden. Key events
  (order created, status changed, payment, refund) are logged with the request id.

### Frontend

- **Optimistic cart.** The cart and the header badge update at once; changes are sent one by
  one, rolled back with the server's message if rejected, and removal offers Undo. Checkout
  waits until pending changes are saved.
- Every data page has loading, empty and error states; forms validate with the same rules as
  the server. Order pages poll while a payment or refund is in progress.

## Local development

Requires Node.js 24 and Docker.

```bash
npm install
docker compose up -d postgres redis
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run prisma:deploy -w backend
npm run db:seed -w backend
npm run dev:backend      # http://localhost:3000/api
npm run dev:frontend     # http://localhost:5173
```

## Tests

```bash
npm run lint && npm run typecheck && npm run format:check
npm test -w backend      # 227 unit tests
npm run test:e2e         # 61 e2e tests (PostgreSQL and Redis from docker compose)
npm test -w frontend     # 200 tests
```

- **Unit:** checkout and stock reservation, status workflow, payments and refunds, queue, auth,
  cache, analytics, CSV, validation.
- **E2E:** the real app against PostgreSQL and Redis, including add to cart → checkout → stock
  decreases → queue → fulfilment, concurrent checkouts, idempotency, refunds and access to other
  users' orders. They use a separate database (`marketplace_test`) and Redis database.
- **Frontend:** Testing Library tests for the catalog, cart, checkout, orders, auth and admin.

## Storybook

```bash
npm run storybook -w frontend          # http://localhost:6006
```

Runs separately from the app with mocked data: buttons, product card, badges, cart components,
forms (login, registration, checkout, product, category), feedback states and dashboard
widgets. Many stories include interaction tests, and every story is checked for accessibility
with axe.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes to `master` and on pull
requests: lint, types and formatting; backend unit and e2e tests with PostgreSQL and Redis;
frontend tests and builds (app and Storybook); `docker compose up --wait` with smoke checks.

## Not done / would do differently

- **Guest cart.** Buying requires login; a local cart merged after login would be next.
- **Real payments.** A real provider needs webhooks and idempotent refunds; the mock refund can
  repeat if the job crashes between the refund and saving it.
- **Images** live on a local volume; in production they would go to object storage with a CDN.
- **Search** is `ILIKE` with a trigram index; full-text search would rank results better.
- **Worker** runs inside the API process; in production it would be a separate service.
- **Browser tests.** Flows were checked with Playwright scripts during development, but they are
  not in the repository or CI.
- **Image size.** The backend image is about 830 MB, mostly the Prisma CLI used for migrations;
  a separate migration image would make it much smaller.
- **Login limit** is per IP only, not per account.
- **Monitoring and email** are not implemented (only logs and a health endpoint).
- **Time zone.** Analytics use the store time zone; dashboard presets use the browser date.
- **Known noise.** `npm audit` is clean for production dependencies; the remaining reports are
  in the dev-only shadcn CLI. Prisma 7 prints `pg` deprecation warnings from its own code.
