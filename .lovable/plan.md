# Influencer Intelligence — Merged Tab

Consolidate `INFLUENCER & SOCIAL` and `PARTNERSHIPS` into a single scrolling narrative tab, "INFLUENCER INTELLIGENCE". Both existing route keys keep routing to the new component so `enabled_tabs` stays valid.

## Files

- **New**: `src/components/dashboard/InfluencerIntelligenceTab.tsx` — main container, hero KPIs, filter bar, section orchestration.
- **New**: `src/components/dashboard/influencer/` folder with focused subcomponents:
  - `HeroKpiBand.tsx` — 5 KPI cards with count-up + sparkline + delta chip
  - `FilterBar.tsx` — sticky date range / network / campaign multi-select
  - `PerformanceOverTime.tsx` — monthly EMV area + posts line
  - `CampaignPerformance.tsx` — active/pipeline cards + top-10 EMV bar chart + searchable/sortable historical table with expandable rows
  - `InfluencerLeaderboard.tsx` — top-3 spotlight + sortable table + author drawer
  - `ContentSpotlight.tsx` — card grid of top posts
  - `useInfluencerData.ts` — single hook that paginates `lefty_posts` once (no row cap) and derives everything downstream through filters
- **Edit**: `src/pages/Index.tsx` — map both `INFLUENCER & SOCIAL` and `PARTNERSHIPS` in `TAB_MAP` to the new component; remove imports of the two old tabs from Index.
- **Edit**: `src/lib/dashboardTabs.ts` — keep both IDs (`influencer_social`, `partnerships`) but relabel one/both; simplest: keep both entries with their existing IDs but rename the labels — however since both must render the same tab, better to keep `influencer_social` labeled "INFLUENCER INTELLIGENCE" and hide `partnerships` from the nav while still mapping it. Actually simplest and least invasive: keep both tab entries but both map to same component; rename `INFLUENCER & SOCIAL` label to `INFLUENCER INTELLIGENCE` and drop the `PARTNERSHIPS` nav entry (still in TAB_MAP so any legacy `enabled_tabs` entries don't error).
- **Keep** (unused by nav but preserved for now): `InfluencerSocialTab.tsx`, `PartnershipsTab.tsx`, `PartnershipAccordion.tsx` — referenced for logic patterns; can be deleted in a follow-up once verified.

## Data layer

Single fetch in `useInfluencerData`:
- Paginates `lefty_posts` for `activeClientId` in 1000-row chunks, no cap (pattern from `InfluencerSocialTab`).
- Additionally fetches `partnerships` rows for the client (for active/pipeline cards + campaign metadata like status/dates).
- Returns `{ posts, partnerships, loading, error }`.
- Downstream filters (`dateRange`, `networks`, `campaignIds`) applied in memoized selectors.
- Prior-period deltas: same window length immediately before current window.
- Sparklines: 6 monthly buckets from `posted_at`.

All aggregates (KPIs, monthly series, campaign totals, influencer totals) derived from the same filtered post array — guarantees consistency across sections and eliminates the row-cap discrepancies.

## Section specs

### 1. Hero KPI band
5 cards in a `grid-cols-2 md:grid-cols-5`. Each: label (DM Mono uppercase), animated count-up number (Playfair), inline `Sparkline` (reuse `src/components/dashboard/Sparkline.tsx`), delta chip (gold `#C9A961` up / neutral grey down).
Metrics: Total Posts, Total Reach (sum reach), Total EMV, Avg Engagement Rate (mean of non-null rates), Active Influencers (distinct `author_name`).

### 2. Filter bar
Sticky `top-0 z-10 bg-background/95 backdrop-blur` beneath KPIs.
- Date range segmented pill: 30d / 90d / 12mo / All time (default 12mo).
- Network segmented pill: All / Instagram / TikTok (extend from `normalizeNetwork`).
- Campaign multi-select (shadcn Command in Popover) populated from distinct `campaign_name` in fetched posts.
State lifted to `InfluencerIntelligenceTab`, applied via a single `filteredPosts` memo.

### 3. Performance Over Time
`ResponsiveContainer` `ComposedChart`: area for monthly EMV (royal blue `#1B2B8A` gradient fill), line for post volume on right y-axis (gold `#C9A961`). Custom tooltip: month label, posts, reach (formatReach), EMV (formatMoney).

### 4. Campaign Performance
Two-column `lg:grid-cols-2` (stacks on mobile).
- **Left**: active + pipeline campaign cards. Use existing partnership data. Each card gets a small reach/EMV sparkline (per-month totals from filtered posts joined by `campaign_name`).
- **Right**: horizontal bar chart of top 10 campaigns by EMV, colored royal blue, hover shows posts + reach + EMV. Clicking a bar scrolls to the corresponding table row (via `ref` map + `scrollIntoView({behavior:'smooth'})` and a brief highlight flash).
Below (full width): historical reference **searchable/sortable table**:
Columns: Campaign, Status, Influencers, Posts, Reach, EMV, Dates. Header click toggles sort. Search input filters by name. Row click expands inline panel with: Tracked KPI cards (posts/reach/EMV from full dataset), Top 5 influencers for that campaign (by EMV), Top 5 posts (with links via `LinkPreviewTrigger`).

### 5. Influencer Leaderboard
Group filtered posts by `author_name`. Compute followers (max seen), posts, reach sum, EMV sum, avg engagement.
Tier: Mega ≥1M, Macro 100K–1M, Mid 50K–100K, Micro <50K.
Top 3 rendered as spotlight cards (`grid-cols-1 md:grid-cols-3`) with a gold circular medallion ("1", "2", "3" in Playfair) + tier badge + big numbers.
Remaining rows in a sortable table, initial 10 rows + "Load more" (+10).
Clicking a row opens a shadcn `Sheet` (right drawer) listing that author's posts for this client with `LinkPreviewTrigger` external-link icons.

### 6. Content Spotlight
`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` of top 12 posts by EMV.
Card: author (bold), network badge (Instagram = pink→purple→orange gradient text badge, TikTok = solid black), post type inferred from URL (Reel/Post/Video/Photo), reach + EMV (Playfair), external-link icon opening the post.
Hover: `transition-all` translate-y-[-2px] + border color to royal blue at 40%.

## Design details

- Fonts already available: DM Sans / Playfair Display / DM Mono (per memory).
- Palette: white bg, royal blue `#1B2B8A` (also uses dynamic `--client-accent` where applicable), gold `#C9A961` for positive deltas + medallions, greys for structure, black for TikTok badge / Instagram gradient for IG badge.
- Skeletons via `DataStateWrapper` per section.
- Staggered fade-in: apply `animate-fade-in` with `style={{ animationDelay: '${i*80}ms' }}` on section wrappers; hero cards stagger 60ms.
- Section eyebrow labels reuse existing `.section-label` (DM Mono, uppercase, tracking-wide).
- Fully responsive: single-column stack below `md`, sticky filter bar collapses horizontally scrollable on mobile.

## Verification

- `tsgo` typecheck.
- Playwright: navigate to preview, log in via injected session, click "INFLUENCER INTELLIGENCE" tab, screenshot each of the six sections, verify KPI numbers render (non-zero), verify filter interactions rerender the chart.
