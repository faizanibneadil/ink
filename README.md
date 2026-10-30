# Payload TanStack Blank Template

This TanStack Start template comes configured with the bare minimum to get started on anything you need.

## Quick start

This template can be deployed directly from our Cloud hosting and it will setup MongoDB and cloud S3 object storage for media.

## Quick Start - local setup

To spin up this template locally, follow these steps:

### Clone

After you click the `Deploy` button above, you'll want to have standalone copy of this repo on your machine. If you've already cloned this repo, skip to [Development](#development).

### Development

1. First [clone the repo](#clone) if you have not done so already
2. `cd my-project && cp .env.example .env` to copy the example environment variables. You'll need to add the `DATABASE_URL` from your Cloud project to your `.env` if you want to use S3 storage and the MongoDB database that was created for you.

3. `pnpm install && pnpm dev` to install dependencies and start the dev server
4. open `http://localhost:3000` to open the app in your browser

That's it! Changes made in `./src` will be reflected in your app. Follow the on-screen instructions to login and create your first admin user. Then check out [Production](#production) once you're ready to build and serve your app, and [Deployment](#deployment) when you're ready to go live.

#### Docker (Optional)

If you prefer to use Docker for local development instead of a local MongoDB instance, the provided docker-compose.yml file can be used.

To do so, follow these steps:

- Modify the `DATABASE_URL` in your `.env` file to `mongodb://mongo/<dbname>`
- Run `docker-compose up` to start the database, optionally pass `-d` to run in the background.

## Production

To build and serve the template in production mode, run `pnpm build && pnpm start`.

## How it works

The Payload config is tailored specifically to the needs of most websites. It is pre-configured in the following ways:

### Collections

See the [Collections](https://payloadcms.com/docs/configuration/collections) docs for details on how to extend this functionality.

- #### Users (Authentication)

  Users are auth-enabled collections that have access to the admin panel.

  For additional help, see the official [Auth Example](https://github.com/payloadcms/payload/tree/main/examples/auth) or the [Authentication](https://payloadcms.com/docs/authentication/overview#authentication-overview) docs.

- #### Media

  This is the uploads enabled collection. It features pre-configured sizes, focal point and manual resizing to help you manage your pictures.

### Docker

Alternatively, you can use [Docker](https://www.docker.com) to spin up this template locally. To do so, follow these steps:

1. Follow [steps 1 and 2 from above](#development), the docker-compose file will automatically use the `.env` file in your project root
1. Next run `docker-compose up`
1. Follow [steps 4 and 5 from above](#development) to login and create your first admin user

That's it! The Docker instance will help you get up and running quickly while also standardizing the development environment across your teams.

## Questions

If you have any issues or questions, reach out to us on [Discord](https://discord.com/invite/payload) or start a [GitHub discussion](https://github.com/payloadcms/payload/discussions).
# ink

## Deployment (Cloudflare Workers + D1 + R2)

Production runs on a Cloudflare Worker, with **D1** as the database and **R2** for media.
Local development (`pnpm dev`) has no link to Cloudflare at all: it uses a local SQLite file
(`DATABASE_URL` in `.env`) and stores uploads in `./media`.

| | Local (`pnpm dev`) | Cloudflare Worker |
| --- | --- | --- |
| Database | `@payloadcms/db-sqlite` (`DATABASE_URL`) | `@payloadcms/db-d1-sqlite` (binding `D1`) |
| Media | `./media` folder | `@payloadcms/storage-r2` (binding `R2`) |
| Env | `.env` / `process.env` | GitHub secrets → Worker secrets |

How the switch works:

- `vite.config.ts` only adds `@cloudflare/vite-plugin` when `CLOUDFLARE_BUILD=true` (set by CI).
- `src/lib/runtime/cloudflare-env.ts` returns no bindings in Node.js, so `payload.config.ts` uses
  SQLite + local disk. In the Worker build it is swapped for `cloudflare-env.worker.ts`, which reads
  `D1` and `R2` from `cloudflare:workers`.
- `src/lib/patch-pbkdf2.ts` clamps PBKDF2 iterations to 100,000 (the Workers limit).
- `scripts/prepare-cloudflare.mjs` (CI only) removes the local-only `pnpm.overrides.esbuild` from
  `package.json` and fills the placeholders in `wrangler.jsonc`.

### CI/CD (`.github/workflows/deploy.yml`)

- **Push to `main`** → build → run Payload migrations on D1 → `wrangler deploy` (production).
- **Pull request to `main`** → build → `wrangler versions upload --preview-alias pr-<number>`
  ([preview URL](https://developers.cloudflare.com/workers/previews/)), posted as a PR comment.
  Previews share the production D1 database and R2 bucket and **never run migrations**.

### One-time setup

1. Cloudflare account on the **Workers Paid** plan (the Worker bundle is ~4 MB gzipped, above the
   3 MB free-plan limit).
2. D1 database `ink` and R2 bucket `ink` (already created, configured in `wrangler.jsonc`).
3. Cloudflare API token (My Profile → API Tokens → Create Token → Custom token) with:
   Account → **Workers Scripts: Edit**, **D1: Edit**, **Workers R2 Storage: Edit**;
   Zone `devslix.com` → **Workers Routes: Edit**, **DNS: Edit**, **Zone: Read**.
4. GitHub → Settings → Secrets and variables → Actions → Secrets:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PAYLOAD_SECRET`.
5. Push to `main`. The Worker is deployed and attached to **https://ink.devslix.com**. The first production deploy has to happen before PR previews can be uploaded.

### Changing the schema

Locally Payload pushes schema changes to SQLite automatically. D1 only changes through migrations,
so after changing collections, globals or fields run:

```bash
pnpm payload migrate:create <name>
```

and commit the new files in `src/migrations`. The next push to `main` applies them to D1.
