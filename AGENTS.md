# emdash Developer Agent Guide

This file is for AI coding agents (Codex, Claude Code, Gemini CLI). Read this before making any changes to an emdash project.

---

## What is emdash

emdash is a serverless CMS built on Cloudflare Workers using TypeScript + Astro 6.0. It is a WordPress alternative — no PHP, no MySQL, no servers to manage.

- GitHub: https://github.com/emdash-cms/emdash
- Version: v0.1.0 beta
- Stack: TypeScript + Astro 6.0 + Cloudflare Workers + D1 (database) + R2 (media)

---

## Project Setup (One-Time)

```bash
# Clone the project repo
git clone https://github.com/vince112385/[project].git
cd [project]

# Install dependencies — always use --ignore-scripts on Windows
npm install --ignore-scripts

# Log in to Cloudflare (use Cameron's account)
npx wrangler login
```

---

## Local Development

```bash
npm run dev
# Runs at http://localhost:4321
# Admin panel at http://localhost:4321/_emdash/admin
```

---

## Deploy Workflow

**Never deploy directly to production without going through staging first.**

```
Local dev → Staging (review) → Production (approved by Vince)
```

```bash
# Deploy to staging for review
npm run deploy:staging

# After Vince approves staging:
npm run deploy:production
```

- Staging URL: `[project]-staging.local-981.workers.dev`
- Production URL: `[project].local-981.workers.dev` (or custom domain)
- Production deploys require Vince's approval — do not skip this step

---

## Project File Structure

```
project-root/
├── src/
│   ├── pages/          # Astro pages — one file per route
│   ├── layouts/        # Astro layout components
│   ├── components/     # Reusable Astro components
│   ├── styles/         # CSS/SCSS stylesheets
│   └── utils/          # Helper functions
├── seed/
│   └── seed.json       # Content schema — collections, fields, taxonomies
├── scripts/
│   └── deploy-staging.mjs   # Staging deploy script — patches wrangler for staging bindings
├── astro.config.mjs    # Astro config + emdash integration
├── wrangler.jsonc      # Cloudflare Workers config (D1 + R2 bindings)
├── live.config.ts      # emdash loader config
└── emdash-env.d.ts     # Auto-generated types — do not edit manually
```

---

## Cloudflare Infrastructure (Per Project)

Each project has its own isolated Cloudflare resources:

| Resource | Staging | Production |
|---|---|---|
| Worker | `[project]-staging` | `[project]` |
| D1 Database | `[project]-staging-db` | `[project]-db` |
| R2 Bucket | `[project]-staging-media` | `[project]-media` |
| KV (sessions) | shared: `028dfa4da881449cb1fcfb8ae46b6e2e` | same |

Account ID: `239e9d015c7a3a39cdc2e9400312f553` (Cameron's Cloudflare account)

---

## Core API — How to Query Content

```ts
import {
  getEmDashCollection,
  getEmDashEntry,
  getSiteSettings,
  getMenu,
  getTaxonomyTerms,
  getWidgetArea,
  search,
  getEntryTerms
} from 'emdash';

const posts = await getEmDashCollection('posts');          // all entries
const post  = await getEmDashEntry('posts', slug);         // single entry by slug
const menu  = await getMenu('primary');                    // navigation menu
const cats  = await getTaxonomyTerms('categories');        // taxonomy terms
```

---

## Critical Rules — Read Before Touching Any Code

1. **Server-rendered only** — never set `output: 'static'` in astro.config.mjs
2. **Image fields are objects** — always use `entry.data.image.src` and `entry.data.image.alt`, never `entry.data.image` as a string
3. **Entry IDs** — use `entry.id`, not `entry.data.id`
4. **Cache hints** — always add `export const cacheHint = 3600` to public-facing Astro pages
5. **Taxonomy names** — must match `seed.json` exactly, including case
6. **After editing seed.json** — always run `npx emdash types` to regenerate type definitions
7. **Plugins** — must declare ALL capabilities in their manifest; no undeclared extras allowed
8. **Staging first** — never deploy to production without staging review and Vince's approval

---

## wrangler.jsonc Structure

```jsonc
{
  "name": "[project]",
  "account_id": "239e9d015c7a3a39cdc2e9400312f553",
  "main": "./src/worker.ts",
  "compatibility_date": "2026-03-29",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{ "binding": "DB", "database_name": "[project]-db", "database_id": "PROD_D1_ID" }],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "[project]-media" }],
  "kv_namespaces": [{ "binding": "SESSION", "id": "028dfa4da881449cb1fcfb8ae46b6e2e" }],
  "workers_dev": true,
  "env": {
    "staging": {
      "name": "[project]-staging",
      "d1_databases": [{ "binding": "DB", "database_name": "[project]-staging-db", "database_id": "STAGING_D1_ID" }],
      "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "[project]-staging-media" }],
      "kv_namespaces": [{ "binding": "SESSION", "id": "028dfa4da881449cb1fcfb8ae46b6e2e" }],
      "workers_dev": true
    }
  }
}
```

---

## Known Issues (v0.1.x)

### SQLite compound SELECT limit
`hydrateBylinesMany` and `hydrateSeoMany` hit D1's SQLite compound SELECT limit when collections have 100+ entries. Patch:
- `node_modules/emdash/src/database/repositories/byline.ts`
- `node_modules/emdash/src/database/repositories/seo.ts`

Batch `WHERE id IN(...)` clauses to chunks of 30. Patches are lost on `npm install` — re-apply after every install or check for an emdash update.

### Admin UI crash on large collections
Collections with 4,000+ entries crash the admin dashboard. The content list page (paginated) still works. Workaround: reduce collection size or accept the dashboard error.

### Tailwind CDN + forms
Tailwind CDN strips `<form>` tags in certain contexts. Use JavaScript `onclick` handlers for search forms instead of native `<form method="GET">` submission.

---

## Daily Developer Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Start local dev
npm run dev

# 3. Make your changes in src/

# 4. Commit and push
git add -A
git commit -m "description of change"
git push origin main

# 5. Deploy to staging
npm run deploy:staging

# 6. Share staging URL with Vince for review
# Staging: [project]-staging.local-981.workers.dev

# 7. After Vince approves:
npm run deploy:production
```

---

## Migrating from WordPress to emdash

---

### Overview

WordPress content (posts, pages, custom post types, taxonomies) can be migrated to emdash via WXR export. Themes and plugins do NOT migrate — they must be rebuilt as Astro components and emdash plugins.

---

### Step 1 — Export from WordPress

**Option A — WXR Export (standard)**
1. Go to WordPress Admin → Tools → Export
2. Select content to export (All content, or by post type)
3. Download the `.xml` (WXR) file

**Option B — Emdash Exporter Plugin**
1. Install the "Emdash Exporter" plugin on the WordPress site
2. It creates a secure API endpoint for export (protected by application passwords)
3. emdash can pull directly from that endpoint during import

---

### Step 2 — Import into emdash

```bash
npx emdash import --file export.wxr
```

After import, regenerate types:

```bash
npx emdash types
```

---

### What Migrates Automatically

| WordPress | emdash | Notes |
|---|---|---|
| Posts | Entries in `posts` collection | Slugs preserved |
| Pages | Entries in `pages` collection | Slugs preserved |
| Custom post types | emdash collections | Auto-created |
| Categories / Tags | Taxonomy terms | Preserved |
| Custom fields (ACF standard) | Collection fields | Standard fields only |
| Gutenberg blocks | Portable Text | Lossy for complex custom blocks |
| Featured images | Image fields | Re-uploaded to R2 |
| Authors | Bylines | Names preserved |

---

### What Does NOT Migrate

| WordPress | What to do in emdash |
|---|---|
| PHP themes | Rebuild as Astro components in `src/` |
| WordPress plugins | Rebuild as emdash plugins (TypeScript + capability manifest) |
| WooCommerce | Not supported yet in v0.1.x |
| Shortcodes | Replace with Astro components |
| Widgets | Rebuild as emdash widget areas in `seed.json` |
| ACF complex fields (repeaters, flex fields) | Manually map to emdash field types |
| Membership / LMS plugins | Not supported yet |

---

### Step 3 — Rebuild the Theme

WordPress themes are PHP — they do not port to emdash. After import, rebuild the frontend:

```
WordPress theme (PHP)
    ↓ rebuild as
src/layouts/BaseLayout.astro     ← header, footer, nav
src/layouts/PostLayout.astro     ← single post wrapper
src/components/                  ← reusable blocks
src/pages/index.astro            ← homepage
src/pages/[slug].astro           ← dynamic pages
src/pages/blog/[slug].astro      ← blog posts
```

Use the imported content to wire up pages:

```astro
---
import { getEmDashCollection } from 'emdash';
export const cacheHint = 3600;
const posts = await getEmDashCollection('posts');
---
```

---

### Step 4 — Update seed.json

After import, verify `seed.json` reflects the correct collections, fields, and taxonomies. Add anything missing:

```bash
# Edit seed.json, then regenerate types
npx emdash types
```

---

### Step 5 — Verify Content

1. Deploy to staging: `npm run deploy:staging`
2. Visit staging and check all content pages render correctly
3. Check images load from R2
4. Check navigation menus are correct
5. Report any issues to Vince before promoting to production

---

### Common Migration Issues

| Issue | Cause | Fix |
|---|---|---|
| Images not showing | R2 upload failed during import | Re-run import or manually upload via admin |
| Gutenberg content broken | Complex custom blocks | Manually reformat as Portable Text |
| Slugs 404 | Route not defined in `src/pages/` | Add matching Astro page file |
| ACF fields missing | Complex field types not auto-mapped | Manually add fields to `seed.json` |
| Menu empty | Menus need to be defined in `seed.json` | Add menu structure manually |

---

## Converting Designs to emdash

emdash themes are Astro components. Designs from Figma, Stitch, or Pencil must be converted into Astro pages, layouts, and components inside `src/`.

---

### From Figma

1. Open the Figma file and inspect the design
2. Export frames as reference (no auto-conversion — manual build required)
3. Identify reusable elements → create as Astro components in `src/components/`
4. Build page layouts in `src/layouts/`
5. Build individual pages in `src/pages/`
6. Wire up emdash content using the Core API (see above)

**Tips:**
- Use Figma's Dev Mode to inspect spacing, typography, colors
- Copy CSS values directly from Figma inspect panel
- Map Figma frames 1:1 to Astro page files

---

### From Stitch (Google Stitch)

Stitch generates a `DESIGN.md` design system file. Use it as the style contract for the build.

1. Read the `DESIGN.md` — it defines typography, color palette, spacing, component specs
2. Apply the design tokens as CSS variables in `src/styles/`
3. Build Astro components that match the Stitch screen specs
4. Stitch screens map to Astro pages in `src/pages/`

```
DESIGN.md (Stitch) → src/styles/tokens.css → src/components/ → src/pages/
```

---

### From Pencil (.pen files)

Pencil files are opened and read via the Pencil MCP tool — do NOT open `.pen` files directly.

1. Use the Pencil MCP to read the design file and extract layout specs
2. Export node properties (colors, fonts, spacing, dimensions)
3. Build matching Astro components in `src/components/`
4. Assemble into layouts in `src/layouts/` and pages in `src/pages/`

**Important:** `.pen` files are encrypted — always use the Pencil MCP tools to read them, never a text editor.

---

### Design → emdash Component Pattern

Regardless of design tool, follow this pattern:

```
Design frame/screen
    ↓
src/layouts/BaseLayout.astro      ← header, footer, global styles
src/layouts/PageLayout.astro      ← page-specific wrapper
src/components/Card.astro         ← reusable UI elements
src/components/Hero.astro
src/pages/index.astro             ← wires layout + components + emdash data
src/pages/[slug].astro            ← dynamic content pages
```

Wire in emdash content at the page level:

```astro
---
import { getEmDashCollection } from 'emdash';
import BaseLayout from '../layouts/BaseLayout.astro';
import Card from '../components/Card.astro';

export const cacheHint = 3600;
const posts = await getEmDashCollection('posts');
---

<BaseLayout>
  {posts.map(post => (
    <Card
      title={post.data.title}
      image={post.data.featuredImage.src}
      href={`/posts/${post.slug}`}
    />
  ))}
</BaseLayout>
```

---

## Questions or Issues

Contact Vince before making any structural changes to `seed.json`, `wrangler.jsonc`, or the deploy pipeline.
