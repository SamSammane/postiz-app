# Publishing the Trelexa CLI to npm

## Quick Publish (Current Name: "trelexa")

```bash
# From apps/cli directory
pnpm run build
pnpm publish --access public
```

Then users can install:
```bash
npm install -g trelexa
# or
pnpm install -g trelexa

# And use:
trelexa --help
```

## Publishing with a Different Package Name

If you want to publish as a different npm package name (e.g., "agent-trelexa"):

### 1. Change Package Name

Edit `apps/cli/package.json`:

```json
{
  "name": "agent-trelexa",  // ← Changed package name
  "version": "1.0.0",
  "bin": {
    "trelexa": "./dist/index.js"  // ← Keep command name!
  }
}
```

**Important:** The `bin` field determines the command name, NOT the package name!

### 2. Publish

```bash
cd apps/cli
pnpm run build
pnpm publish --access public
```

### 3. Users Install

```bash
npm install -g agent-trelexa
# or
pnpm install -g agent-trelexa
```

### 4. Users Use

Even though the package is called "agent-trelexa", the command is still:

```bash
trelexa --help  # ← Command name from "bin" field
trelexa posts:create -c "Hello!" -i "twitter-123"
```

## Package Name vs Command Name

| Field | Purpose | Example |
|-------|---------|---------|
| `"name"` | npm package name (what you install) | `"agent-trelexa"` |
| `"bin"` | Command name (what you type) | `"trelexa"` |

**Examples:**

1. **Same name:**
   ```json
   "name": "trelexa",
   "bin": { "trelexa": "./dist/index.js" }
   ```
   Install: `npm i -g trelexa`
   Use: `trelexa`

2. **Different names:**
   ```json
   "name": "agent-trelexa",
   "bin": { "trelexa": "./dist/index.js" }
   ```
   Install: `npm i -g agent-trelexa`
   Use: `trelexa`

3. **Multiple commands:**
   ```json
   "name": "agent-trelexa",
   "bin": {
     "trelexa": "./dist/index.js",
     "pz": "./dist/index.js"
   }
   ```
   Install: `npm i -g agent-trelexa`
   Use: `trelexa` or `pz`

## Publishing Checklist

### Before First Publish

- [ ] Verify package name is available on npm
  ```bash
  npm view trelexa
  # If error "404 Not Found" - name is available!
  ```

- [ ] Update version if needed
  ```json
  "version": "1.0.0"
  ```

- [ ] Review files to include
  ```json
  "files": [
    "dist",
    "README.md",
    "SKILL.md"
  ]
  ```

- [ ] Build the package
  ```bash
  pnpm run build
  ```

- [ ] Test locally
  ```bash
  pnpm link --global
  trelexa --help
  ```

### Publish to npm

```bash
# Login to npm (first time only)
npm login

# From apps/cli
pnpm run build
pnpm publish --access public

# Or use the root script
cd /path/to/monorepo/root
pnpm run publish-cli
```

### After Publishing

Verify it's published:
```bash
npm view trelexa
# Should show your package info
```

Test installation:
```bash
npm install -g trelexa
trelexa --version
```

## Using from Monorepo Root

The root `package.json` already has:

```json
{
  "scripts": {
    "publish-cli": "pnpm run --filter ./apps/cli publish"
  }
}
```

So you can publish from the root:

```bash
# From monorepo root
pnpm run publish-cli
```

## Version Updates

### Patch Release (1.0.0 → 1.0.1)

```bash
cd apps/cli
npm version patch
pnpm publish --access public
```

### Minor Release (1.0.0 → 1.1.0)

```bash
cd apps/cli
npm version minor
pnpm publish --access public
```

### Major Release (1.0.0 → 2.0.0)

```bash
cd apps/cli
npm version major
pnpm publish --access public
```

## Scoped Packages

If you want to publish under an organization scope:

```json
{
  "name": "@yourorg/trelexa",
  "bin": {
    "trelexa": "./dist/index.js"
  }
}
```

Install:
```bash
npm install -g @yourorg/trelexa
```

Use:
```bash
trelexa --help
```

## Testing Before Publishing

### Test the Build

```bash
pnpm run build
node dist/index.js --help
```

### Test Linking

```bash
pnpm link --global
trelexa --help
pnpm unlink --global
```

### Test Publishing (Dry Run)

```bash
npm publish --dry-run
# Shows what would be published
```

### Test with `npm pack`

```bash
npm pack
# Creates a .tgz file

# Test installing the tarball
npm install -g ./trelexa-1.0.0.tgz
trelexa --help
npm uninstall -g trelexa
```

## Continuous Publishing

### Using GitHub Actions

Create `.github/workflows/publish-cli.yml`:

```yaml
name: Publish CLI to npm

on:
  push:
    tags:
      - 'cli-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install
      - run: pnpm run build:cli

      - name: Publish to npm
        run: pnpm --filter ./apps/cli publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Then publish with:
```bash
git tag cli-v1.0.0
git push origin cli-v1.0.0
```

## Common Issues

### "You do not have permission to publish"

- Make sure you're logged in: `npm login`
- Check package name isn't taken: `npm view trelexa`
- If scoped, ensure org access: `npm org ls yourorg`

### "Package name too similar to existing package"

- Choose a more unique name
- Or use a scoped package: `@yourorg/trelexa`

### "Missing required files"

- Check `"files"` field in package.json
- Run `npm pack` to see what would be included
- Make sure `dist/` exists and is built

### Command not found after install

- Check `"bin"` field is correct
- Ensure `dist/index.js` has shebang: `#!/usr/bin/env node`
- Try reinstalling: `npm uninstall -g trelexa && npm install -g trelexa`

## Recommended Names

If "trelexa" is taken, consider:

- `@trelexa/cli`
- `trelexa-cli`
- `trelexa-agent`
- `agent-trelexa`
- `@yourorg/trelexa`

Remember: The package name is just for installation. The command can still be `trelexa`!

## Summary

✅ Current setup works perfectly!
✅ `bin` field defines the command name
✅ `name` field defines the npm package name
✅ They can be different!

**To publish now:**

```bash
cd apps/cli
pnpm run build
pnpm publish --access public
```

**Users install:**

```bash
npm install -g trelexa
# or
pnpm install -g trelexa
```

**Users use:**

```bash
trelexa --help
trelexa posts:create -c "Hello!" -i "twitter-123"
```

🚀 **Ready to publish!**
