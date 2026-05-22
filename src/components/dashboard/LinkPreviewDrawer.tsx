import { useEffect, useMemo, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface LinkPreviewMetaItem {
  label: string;
  value: string;
}

interface PreviewData {
  url: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  siteName?: string;
  type?: string;
  author?: string;
  publishedAt?: string;
  favicon?: string;
  host?: string;
  embedHtml?: string;
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'web';
  blocked?: boolean;
}

interface OpenArgs {
  url: string;
  title?: string;
  meta?: LinkPreviewMetaItem[];
}

interface Ctx {
  open: (args: OpenArgs) => void;
}

const LinkPreviewCtx = createContext<Ctx | null>(null);

export function useLinkPreview() {
  const ctx = useContext(LinkPreviewCtx);
  if (!ctx) throw new Error('LinkPreviewProvider missing');
  return ctx;
}

export function LinkPreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OpenArgs | null>(null);

  const open = useCallback((args: OpenArgs) => setState(args), []);
  const close = useCallback(() => setState(null), []);

  return (
    <LinkPreviewCtx.Provider value={{ open }}>
      {children}
      <LinkPreviewDrawer args={state} onClose={close} />
    </LinkPreviewCtx.Provider>
  );
}

function LinkPreviewDrawer({ args, onClose }: { args: OpenArgs | null; onClose: () => void }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!args?.url) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const { data: res, error: err } = await supabase.functions.invoke('fetch-link-preview', {
          body: { url: args.url },
        });
        if (cancelled) return;
        if (err) throw err;
        if ((res as any)?.error) throw new Error((res as any).error);
        setData(res as PreviewData);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [args?.url]);

  const embed = useMemo(() => buildEmbed(args?.url, data), [args?.url, data]);

  return (
    <Sheet open={!!args} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="p-5 border-b border-black/10">
          <SheetHeader>
            <SheetTitle className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
              Link Preview
            </SheetTitle>
          </SheetHeader>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground truncate">
            {data?.favicon && <img src={data.favicon} alt="" className="w-3.5 h-3.5" />}
            <span className="truncate">{data?.host || safeHost(args?.url) || args?.url}</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading preview…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground border border-black/10 p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>
                <p>Couldn't load preview.</p>
                <p className="text-[11px] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Native embed for IG/TT/YT */}
          {embed && (
            <div className="border border-black/10 bg-black/[0.02] overflow-hidden">
              {embed.kind === 'iframe' ? (
                <div className="relative w-full" style={{ paddingTop: embed.ratio || '56.25%' }}>
                  <iframe
                    src={embed.src}
                    className="absolute inset-0 w-full h-full"
                    frameBorder={0}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div
                  className="link-preview-embed"
                  dangerouslySetInnerHTML={{ __html: embed.html }}
                />
              )}
            </div>
          )}

          {/* OG image (if no embed and not blocked) */}
          {!embed && !data?.blocked && data?.image && (
            <a href={args?.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={data.image}
                alt={data.title || ''}
                className="w-full max-h-80 object-cover border border-black/10"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            </a>
          )}

          {/* Blocked notice (e.g. Instagram login wall) */}
          {data?.blocked && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground border border-black/10 p-3 bg-black/[0.02]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                {data.platform === 'instagram' ? 'Instagram' : 'This site'} blocks unauthenticated previews.
                Showing the data we have on file — open the original to see the full post.
              </p>
            </div>
          )}

          {/* Title + description (skip when blocked — the scraped values are useless) */}
          {!data?.blocked && (data?.title || data?.description) && (
            <div>
              {data?.siteName && (
                <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
                  {data.siteName}
                </p>
              )}
              {data?.title && (
                <h3 className="font-display text-lg font-bold text-foreground leading-snug">
                  {data.title}
                </h3>
              )}
              {data?.description && (
                <p className="text-sm text-foreground/75 mt-2 leading-relaxed">
                  {data.description}
                </p>
              )}
              {(data?.author || data?.publishedAt) && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  {data.author}{data.author && data.publishedAt ? ' · ' : ''}
                  {data.publishedAt ? new Date(data.publishedAt).toLocaleDateString() : ''}
                </p>
              )}
            </div>
          )}

          {/* Contextual metadata from caller */}
          {args?.meta && args.meta.length > 0 && (
            <div className="border border-black/10 bg-card">
              <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground px-3 pt-3">
                Context
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3">
                {args.meta.map((m, i) => (
                  <div key={i} className="text-xs">
                    <dt className="font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground">
                      {m.label}
                    </dt>
                    <dd className="font-medium text-foreground mt-0.5 break-words">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Fallback when nothing loaded */}
          {!loading && !error && !data?.title && !data?.image && !embed && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border border-black/10 p-3">
              <LinkIcon className="w-4 h-4" />
              <span className="truncate">{args?.url}</span>
            </div>
          )}

          <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs">
            <a href={args?.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> View Original
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function safeHost(u?: string) {
  if (!u) return undefined;
  try { return new URL(u).host.replace(/^www\./, ''); } catch { return undefined; }
}

type Embed =
  | { kind: 'iframe'; src: string; ratio?: string }
  | { kind: 'html'; html: string };

function buildEmbed(url: string | undefined, data: PreviewData | null): Embed | null {
  if (!url) return null;
  // YouTube → iframe
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  // TikTok video → iframe
  const tt = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (tt) return { kind: 'iframe', src: `https://www.tiktok.com/embed/v2/${tt[1]}`, ratio: '170%' };
  // Instagram → embed via instagram embed endpoint
  if (/instagram\.com\/(p|reel|tv)\//i.test(url)) {
    const clean = url.split('?')[0].replace(/\/$/, '');
    return { kind: 'iframe', src: `${clean}/embed`, ratio: '125%' };
  }
  // Twitter/X → use oEmbed HTML if available
  if (data?.embedHtml) return { kind: 'html', html: data.embedHtml };
  return null;
}

/** Convenience button/link wrapper that opens preview drawer. */
export function LinkPreviewTrigger({
  url,
  meta,
  className,
  children,
  as: Tag = 'button',
}: {
  url?: string | null;
  meta?: LinkPreviewMetaItem[];
  className?: string;
  children: ReactNode;
  as?: 'button' | 'a' | 'div';
}) {
  const { open } = useLinkPreview();
  const handle = (e: React.MouseEvent) => {
    if (!url) return;
    e.preventDefault();
    e.stopPropagation();
    open({ url, meta });
  };
  const Comp: any = Tag;
  return (
    <Comp
      type={Tag === 'button' ? 'button' : undefined}
      href={Tag === 'a' ? (url ?? undefined) : undefined}
      onClick={handle}
      className={className}
    >
      {children}
    </Comp>
  );
}
