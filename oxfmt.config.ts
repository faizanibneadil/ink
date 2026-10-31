import type { OxfmtConfig } from 'oxfmt'

export default {
  ignorePatterns: [
    'src/app/(payload)/admin/importMap.js',
    'src/payload-types.ts',
    'cloudflare-env.d.ts',
    'tsconfig.json',
  ],
  printWidth: 100,
  semi: false,
  singleQuote: true,
  sortPackageJson: false,
  trailingComma: 'all',
} satisfies OxfmtConfig
