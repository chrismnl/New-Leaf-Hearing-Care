# Figma → emdash Template Guide

How the page templates and shared components for an emdash site are built —
internal pages, blog post pages, the sidebar, audiologist/bio pages, the
contact page, and the supporting component library.

Worked example: **Commonwealth Audiology** (`emdash/commonwealth-audiology`,
site lives in `demos/simple/`). Components are in `demos/simple/src/components/`,
layouts in `demos/simple/src/layouts/`.

> **Figma access:** the Figma token in `~/.claude/credentials/figma.md` expires
> often (`403 Token expired`). Refresh it before pulling. When Figma is
> unavailable, work from the design's HTML/PDF export or screenshots and match
> spacing/colours visually.

---

## 1. Design principle — templatize everything

The homepage is a single large `index.astro` (one ~4,000-line scoped `<style>`
block). Every **non-homepage** page is built from **shared components + one
layout**, so a design tweak is made once and applies everywhere.

```
src/layouts/
  Base.astro          – <html>, <head>, header + footer, global tokens
  InternalPage.astro  – Base + PageHero + 2-col body grid + Sidebar
src/components/
  Header.astro        – sticky nav with multi-level dropdowns
  Footer.astro        – site footer
  PageHero.astro      – short internal-page hero (breadcrumb + title)
  Sidebar.astro       – CTA card + "Recent News & Articles"
  Accordion.astro     – wrapper for collapsible content
  AccordionItem.astro – one <details>/<summary> panel
  TableOfContents.astro – auto-built ToC from h2/h3/h4
  LocationSection.astro – the homepage map/location block (reusable)
  ServicesSection.astro – the homepage services carousel (reusable)
```

**Rule:** edit the component file, not the consuming page. `Base.astro` only
imports `Header`/`Footer` and passes props.

---

## 2. Header & Footer

Extracted out of `Base.astro` into their own components so they are edited in
one place.

**`Header.astro`** — top contact bar + nav pill + mobile menu toggle.

- **Sticky on scroll:** on desktop the nav pill becomes `position: fixed` once
  `scrollY > 140` (class `is-stuck` toggled on `.site-header`). On mobile the
  whole header is `position: fixed` with a JS-set `padding-top` on `<body>` —
  mobile `position: sticky` is broken by an `overflow` rule on `<body>`.
- **Multi-level dropdowns:** renders `navItems` from the emdash menu. Children
  become a `.nav-dropdown`; grandchildren become `.nav-subitem.has-children`
  with a `.nav-subdropdown` flyout (Commonwealth uses 3 levels:
  About → Our Team → individual audiologists).
- Keep `.nav-item` `flex-wrap: nowrap` + `flex-shrink: 0` on desktop so the
  dropdown caret never wraps below its label.

**`Footer.astro`** — static link columns (Services / Hearing Aids / Quick
Links), socials, legal links. Edit the link lists directly.

---

## 3. PageHero — the short internal hero

`PageHero.astro` is the compact hero band for internal pages — shorter than the
homepage hero.

Props: `title`, `breadcrumbs: { label, href? }[]`, `image`.

- Background = a gradient over the `image` (`--page-hero-img` CSS var).
- **Inset width** `min(100% - 56px, 1400px)`, `border-radius: 18px` — the same
  width treatment as the homepage hero, so internal pages feel consistent.
- Top padding clears the absolutely-positioned site nav.
- Breadcrumb is centered above an `<h1>` title.

```astro
<PageHero
  title="Hearing Tests"
  breadcrumbs={[
    { label: "Home", href: "/" },
    { label: "Audiology Services", href: "/audiology-services/" },
    { label: "Hearing Tests" },
  ]}
  image="/uploads/internal-hero-default.png"
/>
```

---

## 4. InternalPage — the standard page layout

`InternalPage.astro` is the template for every standard internal page:
`Base` + `PageHero` + a 2-column body grid + `Sidebar`.

```
┌─────────────────────────────────────────┐
│ Header (sticky)                          │
├─────────────────────────────────────────┤
│ PageHero  (breadcrumb + title)           │
├──────────────────────────┬──────────────┤
│ <main data-toc-content>  │  <Sidebar>   │
│   slotted page content   │  CTA card    │
│   (minmax(0,1fr))        │  Recent News │
│                          │  (360px)     │
├──────────────────────────┴──────────────┤
│ Footer                                   │
└─────────────────────────────────────────┘
```

- **Props:** `title`, `breadcrumbs`, `description`, optional `heroImage`.
- **Body grid:** `grid-template-columns: minmax(0, 1fr) 360px`, `gap: 3rem`,
  collapses to one column at `960px`.
- **Content typography** is defined once here, scoped with `:global()` for the
  slotted markup — `p`, `h2`, `h3`, `h4`, `ul`, `li`, plus helper classes
  `.lead-italic`, `.note-italic`, `.section-rule`.
- The `<main>` carries `data-toc-content` so `TableOfContents` can scan it.
- It fetches `site_config` (phone, book URL) and the latest 3 `posts`, and
  passes them to `Sidebar`.

A page that uses it is just frontmatter + slotted content — see
`DOC-EMDASH-GUIDE.MD` §2.

---

## 5. Sidebar

`Sidebar.astro` — the right-hand column of every `InternalPage`.

Two cards:

1. **"Compassionate Hearing Care" CTA** — image, heading, copy, a
   "Book an Appointment" button (`bookUrl`), and a phone link.
2. **"Recent News & Articles"** — the latest posts. Each row is a **64×64
   featured-image thumbnail + title**, linking to `/news/<id>/`.

Props: `phone`, `bookUrl`, `posts: { id, title, image }[]`.

The `image` for each post is a media URL built from the post's
`featured_image.meta.storageKey` (see `DOC-EMDASH-GUIDE.MD` §4). If a post has
no image, a gradient fallback block is shown.

`InternalPage` is responsible for assembling the `posts` array (including the
image URL) and passing it down.

---

## 6. Accordion & Table of Contents

**`Accordion.astro` + `AccordionItem.astro`** — collapsible Q&A / FAQ blocks.
Built on native `<details>/<summary>` (matches the homepage FAQ pattern, no JS
needed). Wrap items in `<Accordion>`; each `<AccordionItem title="…">` takes
slotted panel content.

```astro
<Accordion>
  <AccordionItem title="How long does a hearing test take?">
    <p>About 45 minutes…</p>
  </AccordionItem>
</Accordion>
```

**`TableOfContents.astro`** — auto-builds a ToC.

- On load it scans the element marked `[data-toc-content]` for `h2/h3/h4`,
  assigns `id`s, and renders a linked, indented list (h3/h4 indented).
- **Collapsed by default**; a header button toggles it.
- Slugify prefixes any digit-leading id with `section-` so the id is a valid
  CSS selector target.
- Drop `<TableOfContents />` anywhere inside the content slot.

---

## 7. Blog post page (`news/[slug].astro`)

The single blog post page **reuses the `InternalPage` layout** — same template
as every other internal page, for visual consistency.

- The post's **featured image is used as the `PageHero` background**.
- Breadcrumbs: `Home → News & Articles → <post title>`.
- Body: a published-date line, `<TableOfContents />`, then
  `<PortableText value={post.data.content} />` rendered inside the content slot
  (so it inherits `InternalPage`'s typography).
- The post's `excerpt` is **not** repeated as a lead paragraph — PortableText
  content already opens with that text; showing both duplicates it.
- A small `.post-content :global(...)` style block covers the few extra tags
  PortableText can emit (links, images, blockquotes).

The blog **archive** (`news/index.astro`) is `Base` + `PageHero` + a full-width
3-column card grid (featured image, date, title, excerpt, "Read More") — it
does **not** use `InternalPage` because an archive wants full width, not the
2-column sidebar layout.

> URL convention: blog lives at `/news/` and `/news/<slug>/` (not `/posts/`).

---

## 8. Audiologist / team bio pages

Each team member gets their **own page** (e.g. `/tiffany-brewer/`,
`/aubrey-gingrich/`, `/magnolia/`) — not a shared listing.

Structure (modelled on a 2-column bio reference design):

1. **Bio block** — photo on the **right**, bio text on the **left**.
   **No sidebar, no ToC** — this is a custom layout, not `InternalPage`.
2. Below the bio, the **exact homepage Location section** via
   `<LocationSection />`.
3. Then the **exact homepage Services section** via `<ServicesSection />`.

`LocationSection.astro` and `ServicesSection.astro` were **extracted from the
homepage** with identical markup + CSS, so the bio pages and the homepage stay
pixel-identical. Edit the component once; homepage and every bio page update
together.

### ServicesSection — the infinite carousel

`ServicesSection` renders the services as a horizontally-scrolling carousel:

- Renders **5 copies** of the card set (`[0,1,2,3,4].map`) and parks the
  scroller in set index 2, so there is always content to both sides.
- An infinite loop: on scroll, when a seam is reached the handler jumps the
  `scrollLeft` by ±`setWidth`.
- Card width is `flex: 0 0 calc((100vw - 4 * 1.85rem) / 4.4)` on desktop so the
  **leftmost and rightmost cards are ~30% cut off on both edges** (`/3.4`
  tablet, `/2.4` mobile).
- `recenter()` sets `scrollLeft = setWidth*2 + cardWidth*0.3` for the symmetric
  30% peek.

---

## 9. Contact page — a distinct layout

The contact page uses a **different layout** — **not** `InternalPage` (no
sidebar, no ToC). Pattern (reuse this for any contact page):

`Base` + `PageHero`, then full-width sections in this order:

1. **Centered intro CTA** — heading + subtext.
2. **"Send Us a Message" form** — Name / Phone / Email / Message, plus a
   honeypot `url` field. (Sits *after* the intro, *before* the contact cards.)
3. **4-column contact cards** — Call/Text, Visit Us, Email, Office Hours, each
   with a blue circle icon.
4. **Blue "Request an Appointment" CTA band.**

> The contact form currently has no backend (`action="#"` is a TODO — needs a
> form-handling endpoint).

---

## 10. Homepage news section

The homepage `News & Articles` block lives in `index.astro`. It shows the
latest posts as cards: **featured image header (230px)**, date, category, title,
"Learn More".

- Build the image URL from `featured_image.meta.storageKey` — not a `.src`
  field (stored `MediaValue`s don't have one).
- Format the date with `timeZone: "UTC"` (see `DOC-EMDASH-GUIDE.MD` §3).
- The homepage CSS has several stacked `.news-*` overrides — the **last**
  definition wins. To change the card image behaviour, edit the final
  `.news-img-wrap` rule (the earlier ones are overridden).

---

## 11. Inline editing policy

For **new emdash-native sites** (built from scratch, like Commonwealth),
inline editing via `createEditable()` is **mandatory** for editable sections —
the in-page edit experience is the point of choosing emdash. Every editable
field rendered through Astro SSR should carry its `data-emdash-ref` binding.

(For WP→emdash conversions inline editing is optional — see the parent
`emdash/CLAUDE.md`.)

---

## 12. Assets & gotchas

- Hero/sidebar images and SVG icons live in `public/uploads/` (served at
  `/uploads/…`). emdash-managed media lives in `demos/simple/uploads/` (served
  at `/_emdash/api/media/file/…`) — two different folders, don't confuse them.
- **Windows dev watcher** does not pick up *newly created* route files —
  restart `pnpm dev` after adding a page. Edits to existing files are fine.
- After any template change: `npx astro check` (0 errors), then **visually
  screenshot** the affected pages — status codes alone don't catch layout
  regressions.

---

## Related guides

- `DOC-EMDASH-GUIDE.MD` — Google Doc → emdash content workflow (pages, blog
  posts, featured images, navigation, SEO).
- `EMDASH.MD` — wiring data into emdash (collections, CPTs, inline editing).
- `HTML-EMDASH-GUIDE.MD` / `WP-HTML-GUIDE.MD` — static-HTML / WordPress
  conversion paths.
