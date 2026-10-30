/* global console, URL */
// Prepares the repository for a Cloudflare build. Only run by CI (see `.github/workflows/deploy.yml`).
//
// Removes `pnpm.overrides.esbuild` from package.json. That override is needed on the local
// machine, but breaks wrangler / @cloudflare/vite-plugin, which need a modern esbuild.
import fs from 'node:fs'

const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

if (pkg.pnpm?.overrides?.esbuild) {
  delete pkg.pnpm.overrides.esbuild
  if (Object.keys(pkg.pnpm.overrides).length === 0) delete pkg.pnpm.overrides
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log('Removed pnpm.overrides.esbuild from package.json')
}
