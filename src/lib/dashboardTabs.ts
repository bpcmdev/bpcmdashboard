export interface TabDef {
  id: string;
  label: string;
}

/** Single source of truth for dashboard tabs and their stable IDs.
 *  `label` matches the tab key used by Index.tsx's TAB_MAP. */
export const ALL_TABS: TabDef[] = [
  { id: 'pipeline',          label: 'PIPELINE & MOMENTS' },
  { id: 'key_wins',          label: 'KEY WINS' },
  { id: 'product_launches',  label: 'PRODUCT LAUNCHES' },
  { id: 'earned_media',      label: 'EARNED MEDIA' },
  { id: 'influencer_social', label: 'INFLUENCER & SOCIAL' },
  { id: 'corporate_comms',   label: 'CORPORATE COMMS' },
  { id: 'ai_visibility',     label: 'AI VISIBILITY' },
  { id: 'geo_ai_sov',        label: 'GEO / AI SOV' },
  { id: 'partnerships',      label: 'PARTNERSHIPS' },
  { id: 'tiktok_shop',       label: 'TIKTOK SHOP' },
  { id: 'resource_management', label: 'RESOURCE MANAGEMENT' },
];

export const ALL_TAB_IDS = ALL_TABS.map(t => t.id);
