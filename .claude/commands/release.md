# Release @pdf-diff/core and @pdf-diff/cli

Follow these steps in order. Core must be published before CLI.

## 1. Bump versions

Edit `packages/core/package.json` — increment `"version"` (e.g. 0.1.4 → 0.1.5).

Edit `packages/cli/package.json`:
- Update `"@pdf-diff/core"` dependency to match the new core version.
- Increment the cli `"version"` (e.g. 0.1.6 → 0.1.7).

## 2. Build

```bash
npm run build -w @pdf-diff/core
npm run build -w @pdf-diff/cli
```

Both must succeed with zero errors before publishing.

## 3. Run CLI tests

```bash
npm run test -w @pdf-diff/cli
```

All 21 E2E tests must pass.

## 4. Publish core first

```bash
npm publish --access=public -w @pdf-diff/core
```

Verify on npmjs.com that the new version appears before proceeding.

## 5. Publish CLI

```bash
npm publish --access=public -w @pdf-diff/cli
```

## 6. Commit and tag

```bash
git add packages/core/package.json packages/cli/package.json
git commit -m "chore: release core vX.X.X, cli vX.X.X"
git tag vX.X.X
git push && git push --tags
```

The `release.yml` workflow triggers on `v*.*.*` tags and republishes with provenance — this is the canonical release path for CI. Manual publish (steps 4–5) is for hotfixes or when CI is bypassed.

## Notes

- Never publish CLI before core — npm will resolve the old core version.
- If `npm publish` fails with 403, check that `NPM_TOKEN` is valid and the package name matches exactly.
- The `@napi-rs/canvas` binary is platform-specific; the published CLI uses `optionalDependencies` to ship prebuilts for the major platforms.
