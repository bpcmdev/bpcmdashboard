# Product Intelligence — Product Card Layout

Replace the current product leaderboard with a responsive card grid while preserving the existing GEO Summary and product detail drawer unchanged.

## Overview and data

- Load up to 12 products from `peec_product_cards` using the active client ID.
- Normalize RPC arrays/objects defensively for categories, competitors, merchants, queries, and recent press.
- Default sorting to **Newest**: products with `first_seen` first, descending by date, then visibility; products without a date follow, ordered by visibility.
- Add a **Newest / Most visible** segmented sort control. “Most visible” sorts descending by visibility, with newest date as the tie-breaker.
- Refetch whenever the active client changes and after an insight-generation request succeeds.

## Header and admin action

- Add a Product Intelligence header above the cards with the sort control.
- For admins, add **Generate insights**. It invokes `peec-product-card-insights` with `{ client_id, limit: 12 }`, surfaces any failure, and reloads the card data on success.
- Keep the existing GEO Summary card and its separate generation behavior unchanged.

## Product cards

Render one card per product in a one-column mobile / two-column desktop grid. Clicking anywhere on a card opens the existing product detail drawer with the selected product.

Each card contains, when data exists:

1. **Product header** — image or fallback icon, product name, brand, resolved category pills, and a `NEW` badge for products first seen within 45 days.
2. **Four KPI cells** — visibility, mentions, average position (`Top N`), and AI #1 wins, using the established large-figure typography.
3. **Competitive SOV** — the current product first, followed by up to five competitors, ranked by visibility with bars normalized to the largest value.
4. **Where AI sends shoppers** — up to three merchants with percentage share.
5. **Top queries** — up to four query chips.
6. **Recent press** — only when `press_count > 0`, with a count badge and up to three linked press rows showing outlet, headline, date, and compact reach.
7. **GEO insight** — only when insight text exists, using a tinted green callout with a colored left border.

Empty optional sections remain hidden. No unsupported retail, revenue, GMV, ROAS, review, conversion, or per-platform ranking panels will be added.

## Technical details

- Extend the overview product type so the card result remains compatible with `ProductDetailSheetBody`.
- Keep `ProductDetailSheetBody`, its requests, trend controls, analytics sections, and `Sheet` dimensions unchanged.
- Use existing semantic design tokens, the shared button component, and the active client accent for ranking emphasis.
- Validate with the project typecheck and inspect the rendered card grid and detail-drawer click flow in the preview when authentication permits.
