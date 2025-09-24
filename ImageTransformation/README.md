# ImageTransformation

Replaces image URLs from crawled websites with public links from Content Hub.

For example, it makes the follwoing replacements:

```json
    {
      "type": "Mini Banner",
      "title": "About Us",
      "image": "/sites/bayer_co_uk/files/styles/1500x250/public/2020-09/Green-Park-_about-us_0.jpg?h=2c411dcf&itok=3akRniyU"
    }
```
with
```json
    {
      "type": "Mini Banner",
      "title": "About Us",
      "image": "https://bag-p-001.sitecorecontenthub.cloud/api/public/content/548278eaf56c449388fea4caf4be8053?v=0bd19208"
    }
```
The result is created ina a separate transformation folder. Note that it uses the file name (not the complete path), so it might be prone to mistakes if multiple files with the same name exist.

## How to use
```bash
node ImageTransformation/transformImages.js ./en
```

## How it works
Files
- `queryImages.js` - Modular ES module that exports `queryImagesByUrl(url, verbose)` and can be executed standalone. It reads `.env.local` for API configuration. Use this to look up a Content Hub asset by a URL or filename and return the `relativeUrl`.
- `transformImages.js` - Script that scans a source folder for `data.json` files, finds image URLs, queries Content Hub for matching assets, and writes transformed copies into a `transformed/<root>` folder (preserving folder structure).

Environment
- Copy `.env.local` into this folder or set environment variables in your shell. The script expects the following variables (the project may already include `.env.local`):

```
CONTENT_HUB_API_KEY=... (used as X-GQL-Token header in queryImages.js)
CONTENT_HUB_API_URL=/api/graphql/preview/v1
CONTENT_HUB_BASE_URL=https://bag-p-001.sitecorecontenthub.cloud
CONTENT_HUB_CONTENT_URL=/api/public/content/
```

How it works
1. `queryImages.js` reads `getImagesByUrl.graphql` and performs a GraphQL `allM_Asset` query using the `url` variable. It returns a structured result including `relativeUrl` and `assets`.
2. `transformImages.js` scans the source folder you provide for `data.json` files. For each found file:
   - It collects every string that looks like an image URL (by extension and domain)
   - Extracts the filename and queries `queryImagesByUrl` for matches
   - Replaces image URLs in the JSON with Content Hub public links, using the format: `${CONTENT_HUB_BASE_URL}${CONTENT_HUB_CONTENT_URL}${relativeUrl}?v=<hash>`
   - Writes the modified JSON to `transformed/<root>/<...same path...>/data.json`

Usage
From the repository root (recommended):

```bash
# Transform the default 'en' folder
node ImageTransformation/transformImages.js ./en

# Or transform a different folder
node ImageTransformation/transformImages.js ./some/other/folder
```

Notes
- The script resolves the source folder relative to the current working directory. The `transformed` folder is created in the current working directory as `transformed/<root>`.
- If a `data.json` file contains no image URLs, it will be copied as-is into the `transformed` folder.
- `queryImages.js` is an ES module and expects to be used in an environment with Node.js ESM enabled (the repository has `type: "module"` in `package.json`).

Troubleshooting
- If lookups fail, verify the `.env.local` values and that the GraphQL endpoint is reachable.
- If images are not matched, check the filenames and try running `queryImages.js` directly with a test URL or filename in verbose mode.

Example
```bash
node ImageTransformation/queryImages.js    # runs standalone (reads testurl.txt)
node ImageTransformation/transformImages.js ./en
```

If you'd like, I can also add a small test script that runs a single-file transform or provide a dry-run mode that prints planned replacements without writing files.