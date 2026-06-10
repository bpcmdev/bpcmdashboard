// Single source of truth for ClickTime project_name → friendly workstream label.
// Used by both the Workstream table (Section 6) and Workstream by Task (Section 7).
export const WORKSTREAM_MAP: Record<string, string> = {
  'VW - Lifestyle / Brand':    'Brand & Lifestyle',
  'VW - Product/Technology':   'Product & Technology',
  'VW - Corporate':            'Corporate Comms',
  'VW - Workforce':            'Workforce',
  'VW - Strategic Comms':      'Strategic Comms / Planning',
  'Volkswagen':                'General / Admin (VW-*)',
};

/** Map a ClickTime project_name to the friendly workstream label.
 *  Falls back to the project_name itself when no mapping exists. */
export function workstreamFor(projectName: string | null | undefined): string {
  if (!projectName) return 'Unmapped';
  return WORKSTREAM_MAP[projectName] ?? projectName;
}

/** Stable categorical color per workstream, used for share bars. */
export const WORKSTREAM_COLORS: Record<string, string> = {
  'Brand & Lifestyle':           'hsl(225 70% 35%)',
  'Product & Technology':        'hsl(199 89% 38%)',
  'Corporate Comms':             'hsl(262 52% 47%)',
  'Workforce':                   'hsl(158 64% 32%)',
  'Strategic Comms / Planning':  'hsl(32 95% 44%)',
  'General / Admin (VW-*)':      'hsl(0 0% 35%)',
};

export function colorFor(workstream: string): string {
  return WORKSTREAM_COLORS[workstream] ?? 'hsl(0 0% 35%)';
}
