# Static HTML to Emdash/Astro Guide

This is a reusable developer guide for converting a local static HTML site into an Emdash/Astro project.

Use this after the WordPress site has already been scraped/localized into static HTML. The companion guide is:

```txt
C:\Clients\Bidview Marketing\emdash\WP-HTML-GUIDE.MD
```

## Goal

- Move a working local HTML copy into an Emdash/Astro codebase.
- Preserve visual parity with the static HTML and live site.
- Create maintainable Astro layouts/components instead of leaving every page as one large HTML blob.
- Keep global header/footer easy to update.
- Prepare routes, assets, SEO metadata, and local behavior for staging and production deployment.

## Input and Output

Input:

```txt
client-project/
  local-site/
    index.html
    about/index.html
    assets/
  partials/
    header.html
    footer.html
  local-site/export-manifest.json
```

Output:

```txt
emdash-project/
  src/
    layouts/
      Base.astro
    components/
      Header.astro
      Footer.astro
      sections/
    pages/
      index.astro
      about.astro
      contact-us.astro
  public/
    assets/
  seed/
    seed.json
  astro.config.mjs
  wrangler.jsonc
```

## Two Conversion Tracks

There are two valid tracks. Choose based on schedule and fidelity needs.

### Track A: Fast Visual Parity

Use this when the first goal is to make the static HTML render inside Astro/Emdash as quickly as possible.

Pattern:

- Copy localized assets into `public/`.
- Import page/section HTML with `?raw`.
- Render with `<Fragment set:html={...} />`.
- Inline or import the localized CSS.
- Rebuild missing runtime behavior with local scripts.
- Visually match first, then refactor.

This is useful for large Elementor-style pages where the compiled CSS and DOM are deeply coupled.

### Track B: Clean Emdash Build

Use this when the design is simple enough, or after Track A has reached parity.

Pattern:

- Convert header/footer to Astro components.
- Convert each section to a semantic `.astro` component.
- Move global styles into `src/styles/`.
- Move reusable content into Emdash collections or `seed/seed.json`.
- Use Emdash APIs for dynamic content.

This is the maintainable target.

## Step-by-Step Workflow

### 1. Create or Open the Emdash Project

For a new Emdash project:

```powershell
npm create emdash@latest
cd client-project
npm install --ignore-scripts
```

On Windows, use:

```powershell
npm install --ignore-scripts
```

For an existing project, read:

- `CLAUDE.md`
- `AGENTS.md`
- `package.json`
- `astro.config.mjs`
- `wrangler.jsonc`
- `seed/seed.json`

Confirm whether the project is full Emdash or Astro-only. Some projects may use Astro + Cloudflare first, then add Emdash later.

### 2. Copy Static Assets Into Public

Copy assets from the static HTML export:

```txt
local-site/assets/
```

to an Emdash/Astro public folder such as:

```txt
public/assets/
```

or, during a parity bridge:

```txt
public/static-copy/
public/v3-assets/
public/v3-css/
```

Recommended asset mapping:

- `local-site/assets/media/` to `public/assets/media/`
- `local-site/assets/styles/` to `public/assets/styles/` or `src/styles/`
- `local-site/assets/site.js` to `public/assets/site.js` or a local Astro script
- favicons to `public/` or `public/assets/media/`

Keep paths simple and root-relative in Astro:

```html
<img src="/assets/media/logo.webp" alt="Client name" />
<link rel="stylesheet" href="/assets/styles/site.css" />
```

### 3. Start With Global Layout

Create a base layout:

```txt
src/layouts/Base.astro
```

Minimum layout responsibilities:

- `<html>`, `<head>`, and `<body>`
- title and meta description props
- canonical URL
- favicon
- global CSS imports
- header
- footer
- default `<slot />`

Example shape:

```astro
---
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import "../styles/global.css";

export const cacheHint = 3600;

const {
  title,
  description,
  canonical,
} = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    {canonical && <link rel="canonical" href={canonical} />}
    <link rel="icon" href="/favicon.png" />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

For full Emdash projects, also use Emdash page/head helpers where the project standard already does:

```astro
---
import { EmDashHead } from "emdash/ui";
import { createPublicPageContext } from "emdash/page";
---
```

Follow the existing project pattern.

### 4. Convert Header and Footer First

Use the source partials from the HTML export:

```txt
partials/header.html
partials/footer.html
```

Create:

```txt
src/components/Header.astro
src/components/Footer.astro
```

Recommended process:

1. Paste the header/footer HTML into Astro components.
2. Replace static asset paths with root-relative `/assets/...` paths.
3. Replace page links with Astro route links like `/about/`, `/contact-us/`.
4. Keep important accessibility attributes.
5. Move header/footer CSS into global or component styles.
6. Rebuild local interactions such as hamburger menus, dropdowns, sticky state, and mobile CTA.

Do this before converting content pages. A global header/footer prevents every page from carrying its own stale copy.

### 5. Convert Pages

Use `local-site/export-manifest.json` as the route checklist.

For each page:

```txt
local-site/about/index.html
```

create:

```txt
src/pages/about.astro
```

For nested routes:

```txt
local-site/services/hearing-tests/index.html
```

create:

```txt
src/pages/services/hearing-tests.astro
```

or:

```txt
src/pages/services/hearing-tests/index.astro
```

Keep route style consistent with the existing project.

### 6. Track A: Raw HTML Bridge

For a fast parity pass, split HTML into section fragments:

```txt
src/components/sections/Hero.html
src/components/sections/About.html
src/components/sections/Services.html
src/components/sections/Faq.html
```

Then import them as raw HTML:

```astro
---
import Base from "../layouts/Base.astro";
import heroHtml from "../components/sections/Hero.html?raw";
import aboutHtml from "../components/sections/About.html?raw";
import servicesHtml from "../components/sections/Services.html?raw";

export const cacheHint = 3600;
---

<Base title="Client Name" description="Page description">
  <Fragment set:html={heroHtml} />
  <Fragment set:html={aboutHtml} />
  <Fragment set:html={servicesHtml} />
</Base>
```

Use this when copied CSS depends on the original HTML structure.

Important:

- Keep required body/page scope classes if the CSS depends on them.
- Remove remote scripts.
- Rewrite all assets to `/assets/...`.
- Rebuild interactions locally.
- Visually verify before refactoring.

### 7. Track B: Clean Astro Components

Once parity is stable, convert each section into a real Astro component:

```txt
src/components/sections/Hero.astro
src/components/sections/Services.astro
src/components/sections/Faq.astro
```

Recommended section workflow:

1. Read the source HTML section.
2. Inspect the rendered local HTML in the browser.
3. Identify actual styles used: fonts, sizes, colors, spacing, breakpoints.
4. Build semantic Astro markup.
5. Move only that section CSS into a scoped component style or shared CSS file.
6. Compare screenshot against the source.
7. Remove old HTML/classes only after visual parity is confirmed.

Avoid global find/replace cleanup. Elementor/WordPress selectors are often deeply coupled. Clean section by section.

### 8. Move Styles Into the Right Place

Use this progression:

1. Parity phase: import or inline copied CSS as-is.
2. Cleanup phase: move reusable tokens to `src/styles/global.css`.
3. Component phase: move section-specific CSS into component `<style>` blocks or section CSS files.

Common global styles:

- CSS variables
- font faces
- body defaults
- containers
- buttons
- header/footer
- utility classes

Common component styles:

- hero layout
- service cards
- testimonials
- FAQ accordion
- location/contact cards
- mobile CTA

### 9. Rebuild JavaScript Behaviors

Do not bring WordPress/Elementor runtime scripts into Emdash.

Rebuild only the behavior needed:

- hamburger menu
- submenu toggles
- sticky header
- mobile bottom CTA
- FAQ accordion
- tabs
- carousel/static row behavior
- modal open/close
- form submit handling

Use inline Astro scripts or a dedicated local script depending on project style.

Avoid nesting `<script>` tags inside `<script is:inline>`. That can break the live page.

### 10. Connect Emdash Content

Static HTML pages can remain hard-coded at first, but the maintainable target is to move editable content into Emdash.

Use Emdash APIs where appropriate:

```astro
---
import { getEmDashCollection, getEmDashEntry, getMenu } from "emdash";

export const cacheHint = 3600;

const posts = await getEmDashCollection("posts");
const menu = await getMenu("primary");
---
```

Common content decisions:

- Header/footer navigation can come from Emdash menus.
- Blog posts should usually be a collection.
- Staff/providers can be a collection.
- Services can be either static pages or a collection.
- Testimonials can be a collection when clients need editing.
- Sitewide phone/address/hours can live in site settings or a small config object.

After editing `seed/seed.json`, run:

```powershell
npx emdash types
```

or the project-specific type generation command.

### 11. SEO and Metadata

Carry over from the static HTML:

- page title
- meta description
- canonical URL
- robots tag
- Open Graph tags
- Twitter card tags
- JSON-LD schema
- favicon/apple touch icons

In Astro, prefer layout props:

```astro
<Base
  title="Page Title"
  description="Page description"
  canonical="https://example.com/page/"
>
```

For dynamic content pages, derive metadata from entry data.

### 12. Build and Local QA

Run:

```powershell
npm run build
npm run dev
```

or for Emdash projects:

```powershell
npx emdash dev
```

Local dev usually runs at:

```txt
http://localhost:4321/
```

Admin usually runs at:

```txt
http://localhost:4321/_emdash/admin
```

If the project is Cloudflare/Workers-only, use the project's configured dev command.

### 13. Visual QA

Always compare against the static HTML source and live site.

Minimum visual QA:

- homepage desktop
- homepage mobile
- header before and after scroll
- mobile navigation open/close
- footer on a long page
- contact page/forms
- at least one service/product page
- at least one blog/post page if present

Use screenshots. Do not rely on code inspection.

If a page differs:

1. Measure live/static source first.
2. Identify whether the issue is HTML structure, CSS, asset path, or missing JS.
3. Fix at the shared component/source level.
4. Rebuild and recheck.

### 14. Deployment Workflow

Standard Emdash flow:

```txt
Local dev -> Staging -> Vince review -> Production
```

Do not deploy directly to production without staging review and approval.

Typical commands:

```powershell
npm run deploy:staging
```

After approval:

```powershell
npm run deploy:production
```

Some older projects may use:

```powershell
npm run deploy
```

Check `package.json` and project notes first.

## Cleanup Checklist

Before calling the conversion ready:

- [ ] Routes from `export-manifest.json` are represented in `src/pages/`.
- [ ] Header is one component or one shared layout source.
- [ ] Footer is one component or one shared layout source.
- [ ] Assets load from `public/`, not the old local export path.
- [ ] No unintended live-domain asset URLs remain.
- [ ] WordPress/Elementor runtime scripts are removed.
- [ ] Required interactions are rebuilt locally.
- [ ] SEO metadata exists on every page.
- [ ] `npm run build` passes.
- [ ] Local visual QA passes on desktop and mobile.
- [ ] Staging deploy is reviewed before production.

## Common Pitfalls

- Opening the static source directly with `file://` and assuming that matches Astro behavior.
- Copying WordPress/Elementor runtime scripts instead of rebuilding only the needed behavior.
- Removing page/body scope classes too early, breaking copied CSS.
- Converting every section at once instead of working section by section.
- Forgetting to move header/footer into shared components.
- Leaving nested page links pointing to `../local-site/...`.
- Forgetting `export const cacheHint = 3600` or project-specific cache handling.
- Treating Emdash image fields as strings. Image fields are objects; use `.src` and `.alt`.
- Editing `seed/seed.json` but forgetting to regenerate types.
- Skipping visual QA after responsive changes.

## Recommended Developer Handoff Notes

For each converted project, document:

- source static HTML folder
- Emdash project folder
- route/page count
- asset folder mapping
- which track was used: raw bridge, clean components, or hybrid
- header/footer component paths
- global CSS path
- behavior script path
- Emdash collections used
- local dev command and URL
- staging deploy command and URL
- production deploy command
- final QA results

Save these details in that project's `CLAUDE.md` and `AGENTS.md`.
