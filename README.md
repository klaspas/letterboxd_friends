# Friends Average for Letterboxd

A Chrome extension that adds a "Ratings from Friends" histogram to Letterboxd film pages.

## Loading the Extension

No build step required.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this directory

After editing any file, click the reload button on the extension card.

## Development

Install dev dependencies (ESLint, Prettier, git hooks):

```sh
npm install
```

### Lint

```sh
npm run lint        # check for errors
npm run lint:fix    # auto-fix where possible
```

### Format

```sh
npm run format      # format all files with Prettier
```

### Pre-commit hook

Installed automatically by `npm install`. On each commit, ESLint and Prettier run against staged `.js` and `.json` files.
