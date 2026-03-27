import { useState } from 'react';

const calendarMonths = [
  {
    month: 'JAN 2026',
    highlight: false,
    events: [
      { text: 'Golden Globes MUA Partnership — Connor Storrie previews Hydro Grip Concealer', badge: 'MOMENT', badgeStyle: 'bg-[hsl(80_30%_35%)] text-background' },
    ],
  },
  {
    month: 'FEB 2026',
    highlight: false,
    events: [
      { text: 'Hydro Grip Gel Concealer — Sephora Feb 4 · Ulta Feb 6 · 25 shades', badge: 'LAUNCH', badgeStyle: 'bg-foreground text-background' },
      { text: 'HGGC NYC launch event', badge: 'EVENT', badgeStyle: 'bg-muted-foreground/70 text-background' },
      { text: 'HGGC London Space NK dinner', badge: 'EVENT', badgeStyle: 'bg-muted-foreground/70 text-background' },
      { text: 'Mazdack Rassi named President', badge: 'CORP COMMS', badgeStyle: 'bg-foreground text-background' },
    ],
  },
  {
    month: 'MAR 2026',
    highlight: true,
    events: [
      { text: 'HGGC NYFW AREA Show', badge: 'EVENT', badgeStyle: 'bg-muted-foreground/70 text-background' },
      { text: 'HGGC Miami + LA dinners', badge: 'EVENT', badgeStyle: 'bg-muted-foreground/70 text-background' },
      { text: 'Frank B — Global Artistic Director', badge: 'CORP COMMS', badgeStyle: 'bg-foreground text-background' },
    ],
  },
  {
    month: 'APR 2026',
    highlight: false,
    events: [
      { text: 'HGGC Paris event', badge: 'EVENT', badgeStyle: 'bg-muted-foreground/70 text-background' },
      { text: 'HGGC Toronto + Chicago dinners', badge: 'EVENT', badgeStyle: 'bg-muted-foreground/70 text-background' },
    ],
  },
  {
    month: 'MAY 2026',
    highlight: false,
    events: [
      { text: 'MMU Turns 10 — Anniversary activation + NYC events + Throwback Collection (Eye Vinyl, Roll + Blot, Tattoo Stamps)', badge: 'MILESTONE', badgeStyle: 'bg-[hsl(80_30%_35%)] text-background' },
    ],
  },
  {
    month: 'JUN 2026',
    highlight: false,
    events: [
      { text: 'Pride — celebrity brand campaign — TBC — agent monitoring casting', badge: 'MOMENT', badgeStyle: 'bg-[hsl(80_30%_35%)] text-background' },
      { text: 'Retail expansion mmm.com', badge: 'RETAIL', badgeStyle: 'bg-muted-foreground/70 text-background' },
    ],
  },
  {
    month: 'SUMMER 2026',
    highlight: false,
    events: [],
  },
];

interface AgentCard {
  title: string;
  body: string;
  monitors: string[];
  footer: string;
  dot: 'green' | 'amber' | 'grey';
  status: string;
}

const agentCards: AgentCard[] = [
  {
    dot: 'green', status: 'ACTIVE · MONITOR DAILY',
    title: 'Golden Globes MUA / Connor Storrie coverage tail',
    body: 'Coverage from Jan Golden Globes preview continues generating pickup. Monitor for MUA profiles, red carpet beauty recaps, award season retrospectives.',
    monitors: ['"Golden Globes makeup 2026"', '"Connor Storrie beauty"', '"Hydro Grip concealer red carpet"'],
    footer: 'ROLLING · HIGH PRIORITY THROUGH AWARDS SEASON',
  },
  {
    dot: 'green', status: 'ACTIVE · MONITOR DAILY',
    title: 'Frank B / Global Artistic Director story',
    body: 'Announced Mar 20. Still in active coverage window. Monitor for follow-up profiles, industry reaction, debut campaign previews. Key outlets: WWD, Vogue, BoF, i-D, PAPER.',
    monitors: ['"Frank B makeup artist"', '"Frank Buscarello"', '"Milk Makeup brand revival 2026"'],
    footer: 'ACTIVE NOW · 4-6 WEEK COVERAGE WINDOW',
  },
  {
    dot: 'amber', status: 'WATCH · PREP NOW',
    title: 'MMU 10th anniversary + Throwback Collection',
    body: 'Brand turns 10 in May 2026. NYC anniversary activation + Throwback Collection drop. Monitor nostalgia beauty editorial and \'original clean beauty brands\' coverage.',
    monitors: ['"Milk Makeup 10 years"', '"indie beauty brand anniversary"', '"2016 beauty nostalgia"'],
    footer: 'MAY 2026 · BEGIN OUTREACH APRIL',
  },
  {
    dot: 'amber', status: 'WATCH · PREP NOW',
    title: 'Fall Sticks relaunch — pre-launch earned media',
    body: 'New Sticks with new formula + packaging is the major Fall 2026 story. Monitor competitor stick coverage. Key narrative: 10-year reformulation, \'stick authority\' positioning.',
    monitors: ['"best cream blush stick 2026"', '"new makeup stick launches"', '"Milk Makeup sticks"'],
    footer: 'FALL 2026 · BEGIN SEEDING Q3',
  },
  {
    dot: 'amber', status: 'WATCH · PREP NOW',
    title: 'Line + Fill Lip Color launch',
    body: 'New entry-price lip color (10 shades, $24-26, 10H+ wear) launching Fall 2026. Monitor competitive lip launches. Identify gap in \'longwear clean lip\' narrative for BPCM to own.',
    monitors: ['"longwear clean lip 2026"', '"hydrating matte lipstick"', '"entry price lip launch"'],
    footer: 'FALL 2026 · BEGIN SEEDING Q3',
  },
  {
    dot: 'grey', status: 'UPCOMING · TRACK FOR OPPORTUNITY',
    title: 'Pride 2026 celebrity brand campaign',
    body: 'Campaign TBC. Monitor brand casting announcements and competitor Pride campaigns. Pitch window for Allure, Glamour opens early May.',
    monitors: ['"Pride beauty campaign 2026"', '"Milk Makeup Pride"', '"inclusive beauty June 2026"'],
    footer: 'JUNE 2026 · BEGIN OUTREACH APRIL',
  },
];

const dotColors: Record<string, string> = {
  green: 'bg-[hsl(145_63%_42%)]',
  amber: 'bg-[hsl(38_80%_55%)]',
  grey: 'bg-muted-foreground',
};

const PipelineMomentsTab = () => {
  return (
    <div className="p-6 space-y-8">
      {/* Calendar */}
      <div>
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">2026 Full-Year Marketing Calendar</h3>
        <p className="text-[11px] text-muted-foreground mb-4">Product launches + cultural moments — agent monitors all entries for coverage opportunities</p>
        <div className="overflow-x-auto">
          <div className="flex min-w-[1200px]">
            {calendarMonths.map((m) => (
              <div key={m.month} className={`flex-1 min-w-[170px] border-r border-border p-3 ${m.highlight ? 'border-2 border-[hsl(38_80%_55%)] bg-[hsl(38_80%_55%_/_0.04)]' : ''}`}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground">{m.month}</p>
                  {m.highlight && <span className="text-[9px] font-bold text-[hsl(38_80%_55%)]">← NOW</span>}
                </div>
                <div className="space-y-2">
                  {m.events.map((e, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-start gap-1.5">
                        <span className="text-muted-foreground mt-0.5">●</span>
                        <p className="text-[10px] text-foreground/80 leading-snug">{e.text}</p>
                      </div>
                      <span className={`self-start text-[8px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 ${e.badgeStyle}`}>{e.badge}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Intelligence */}
      <div>
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Agent Intelligence — What to Monitor Now</h3>
        <div className="grid grid-cols-3 gap-4">
          {agentCards.map((card, i) => (
            <div key={i} className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${dotColors[card.dot]}`} />
                <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-muted-foreground">{card.status}</span>
              </div>
              <h4 className="text-sm font-bold text-foreground mb-2">{card.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{card.body}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {card.monitors.map((m, j) => (
                  <span key={j} className="text-[9px] bg-muted px-1.5 py-0.5 text-muted-foreground">{m}</span>
                ))}
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground">{card.footer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PipelineMomentsTab;
