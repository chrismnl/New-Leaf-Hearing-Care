# Website Standards

## Global Workflow
- Build new sections/pages from scratch with clean, semantic HTML.
- Match approved visual references as closely as possible.
- Use existing project files as reference only when requested.
- If a file is mentioned as a reference file, never edit that file; use it for guidance only.

## Structure and Layout
- Use flex containers as the default layout method for wrappers and section internals.
- Prefer this hierarchy for sections: `section` (owns background + section spacing) -> `container` (content wrapper).
- Do not add inner container padding unless intentionally needed.
- Apply section spacing tokens to the section itself, not the inner container.
- Containers should use `width` only; avoid `min-width`/`max-width` unless intentionally required.
- Default container widths:
- `D | L | T | M`
- `1280px | 100% | 100% | 100%`

## Responsive Spacing Tokens
- Use these breakpoint rules consistently:
- `D` (desktop): min-width `1367px`
- `L` (laptop): max-width `1366px`
- `T` (tablet): max-width `1024px`
- `M` (mobile): max-width `767px`
- Use tokenized spacing values (`--section-pad-d/l/t/m`) per breakpoint.
- Standard section padding tokens:
- `--section-pad-d: 100px 20px;`
- `--section-pad-l: 80px 20px;`
- `--section-pad-t: 80px 40px;`
- `--section-pad-m: 60px 20px;`

## Spacing Style Preference
- Avoid using margins for element-to-element spacing whenever possible.
- Prefer `row-gap` / `column-gap` (or `gap`) on parent flex containers.

## Hero/Breadcrumb Pattern
- For internal hero sections, apply background image + gradient on the section element.
- Avoid extra background/overlay child wrappers unless truly necessary.
- Breadcrumb rows should not use fixed/min height unless intentionally required.
- Breadcrumb inner containers should be content-sized with no fixed height and no padding by default.

## Typography and Brand System
- Always include the project's required font loading in the HTML file so fonts render correctly.
- Always strictly follow the project's global color tokens and typography tokens/styles.
- If a hardcoded color matches an existing global color token, always use the global token instead (example: use `color: var(--color-white);` instead of `color: #ffffff;` when `--color-white: #ffffff` exists).
- When creating a new CSS file for a different page, copy the following global foundations first:
- All global colors.
- All typography rules/tokens.
- All layout foundations (section padding tokens and container width rules).
- Section and container semantic/layout rules.
- All button styling (`.btn-primary`, `.btn-secondary`, and related hover/interaction states).
- Header and footer styling from the index/home (first) page, since these are part of global styling.
- Reuse global brand system from `style.css` for consistency:
- Global colors.
- Global typography tokens and heading/body rules.
- Relevant global layout and spacing tokens.
- Global button styles (`.btn-primary`, `.btn-secondary`).
- Keep button class naming consistent: always use `btn-primary` and `btn-secondary`.

## CSS Quality
- Keep class naming clean and semantic.
- Avoid unnecessary wrappers and redundant declarations.
- Keep styles predictable and reusable for non-homepage internal pages.

## Interaction States
- Any link or button must have a hover effect.
- Use a consistent transition duration of `0.3s` for interactive elements.
- For button hover class naming, append `-hover` (example: `btn-primary-hover`).
- External links must open in a new tab and include `rel=\"nofollow\"` (with security rel values as needed).
