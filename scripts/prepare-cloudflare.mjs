/* global process, console, URL */
// Prepares the repository for a Cloudflare build. Only run by CI (see `.github/workflows/deploy.yml`).
//
// 1. Removes `pnpm.overrides.esbuild` from package.json. That override is needed on the local
//    machine, but breaks wrangler / @cloudflare/vite-plugin, which need a modern esbuild.
// 2. Fills the placeholders in wrangler.jsonc from environment variables (GitHub secrets/vars).
import fs from 'node:fs'

const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

if (pkg.pnpm?.overrides?.esbuild) {
  delete pkg.pnpm.overrides.esbuild
  if (Object.keys(pkg.pnpm.overrides).length === 0) delete pkg.pnpm.overrides
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log('Removed pnpm.overrides.esbuild from package.json')
}

const required = ['WORKER_NAME', 'D1_DATABASE_ID', 'D1_DATABASE_NAME', 'R2_BUCKET_NAME']
const missing = required.filter((key) => !process.env[key])
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const wranglerPath = new URL('../wrangler.jsonc', import.meta.url)
let wrangler = fs.readFileSync(wranglerPath, 'utf8')
for (const key of required) {
  wrangler = wrangler.replaceAll(`__${key}__`, process.env[key])
}
fs.writeFileSync(wranglerPath, wrangler)
console.log('Filled wrangler.jsonc placeholders')
