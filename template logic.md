# Template Logic

## Global Page Rules

- All pages must use the shared global header and footer.
- Header logo and footer logo must link to the homepage.
- Use global colors, typography, buttons, spacing, and responsive breakpoints from `website standards.md`.
- Do not create page-specific styling if an existing global or reusable class already handles the design.
- For new reusable sections, place styles in the reusable/global section CSS, not only in a page-specific CSS file.
- For page-specific one-off layouts, place styles in that page's CSS file.
- Use gaps for spacing between child elements instead of relying on margins, unless the standard explicitly calls for margin.
- On L/T/M viewports, main inner containers should generally be `width: 100%`.

## Internal Page Template

- Use `internal-hero-section` at the top.
- Use `internal-content-section` below the hero.
- Hero includes breadcrumb and H1 page title.
- Main content uses `internal-content-container`.
- Standard internal layout is:
  - `content-container-left`
  - `sidebar-container`
- Use `internal-article` inside `content-container-left`.
- Use optional `toc-container` after intro content.
- Use sidebar CTA and sidebar blogs unless the page type specifically removes them.
- If the page is a simple utility page like Sitemap, content can be plain but should keep the sidebar unless instructed otherwise.

## Two-Column Informational Page Template

- Use `internal-hero-section`.
- Use `internal-content-section`.
- Inside `internal-content-container`, use:
  - `content-container-two-column`
    - `content-container-left-column`
    - `content-container-right-column`
- Desktop and laptop: 2 columns.
- Tablet and mobile: 1 column.
- Gap by viewport: `80px | 80px | 60px | 40px`.
- Use this for pages like About, Member, Contact, or pages needing two balanced content blocks.
- Do not use `content-container-left` or `internal-article` unless the page is article-style.

## Contact Page Template

- Use `internal-hero-section`.
- Use `internal-content-section`.
- Contact page can use a custom 1-column internal content layout when needed.
- If scheduling is needed, place `schedule-embed-container` above the global location card.
- Add the global location card inside the content section.
- Contact-specific layout changes should apply only to contact page CSS, not global internal layout.

## Blog / Article Page Template

- Use the same base layout as internal pages.
- Use `internal-hero-section`.
- Use `internal-content-section`.
- Use `content-container-left` with `internal-article`.
- Keep sidebar CTA and Recent News/Articles sidebar.
- Intro content appears before TOC.
- TOC is allowed when the article has multiple headings.
- Heading/accordion logic applies based on h2/h3/h4 hierarchy.

## Hearing Aids / Service Detail Page Template

- Use the same base structure as internal pages.
- Use `internal-hero-section`.
- Use `internal-content-section`.
- Use article-style content with sidebar unless the page needs a custom two-column layout.
- Use TOC for longer educational content.
- Apply accordion rules for nested h3/h4 groups.
- Sidebar CTA should use the global appointment button style and link to `/contact-us`.

## Location Page Template

- Use shared header and footer.
- Use `internal-hero-section` with the location name as H1.
- Use content sections that can include:
  - Location intro/details
  - Address, phone, hours, fax
  - Map embed or location card
  - Appointment CTA
- Location links:
  - Arvada: `/audiologist-hearing-aids-arvada-colorado`
  - Littleton: `/audiologist-hearing-aids-littleton-colorado`
- Phone links should use `tel:` links.
- Address links should point to the correct location/map page.

## Sitemap Page Template

- Use `internal-hero-section`.
- Use `internal-content-section`.
- Use plain grouped links inside `internal-article`.
- No Table of Contents.
- Keep the sidebar unless specifically instructed to remove it.
- Sitemap links should use:
  - `color: var(--text)`
  - no underline
  - hover/focus color `var(--accent)`

## Accordion Logic For Internal / Article Pages

- Intro content goes above `toc-container`.
- If a parent `h2` has more than one `h3`, convert those `h3` sections into accordions.
- If a parent `h3` has more than one `h4`, convert those `h4` sections into accordions.
- If a parent `h3` has only one `h4`, keep it flat.
- Accordions open one at a time within the same group.
- Opening one accordion closes the previously open accordion in that group.
- Accordion expand/collapse should be smooth.
- TOC links should scroll with offset: header height + 30px.
- TOC links should not update the URL hash.
