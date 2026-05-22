import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface OgData {
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
  error?: string;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function pickMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${name}["'][^>]*>`,
      'i'
    );
    const m = html.match(re);
    if (m) {
      const c = m[0].match(/content\s*=\s*["']([^"']*)["']/i);
      if (c?.[1]) return decode(c[1].trim());
    }
  }
  return undefined;
}

function detectPlatform(u: string): OgData['platform'] {
  const h = u.toLowerCase();
  if (/instagram\.com/.test(h)) return 'instagram';
  if (/tiktok\.com/.test(h)) return 'tiktok';
  if (/youtube\.com|youtu\.be/.test(h)) return 'youtube';
  if (/twitter\.com|x\.com/.test(h)) return 'twitter';
  return 'web';
}

async function fetchOEmbed(url: string, platform: OgData['platform']): Promise<{ html?: string; title?: string; image?: string; author?: string } | null> {
  try {
    let endpoint: string | null = null;
    if (platform === 'youtube') {
      endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    } else if (platform === 'tiktok') {
      endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    } else if (platform === 'instagram') {
      // Instagram oEmbed requires an FB app token; skip if unavailable.
      return null;
    }
    if (!endpoint) return null;
    const r = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0 LinkPreviewBot' } });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      html: j.html,
      title: j.title,
      image: j.thumbnail_url,
      author: j.author_name,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const url: string | undefined = body.url;
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const platform = detectPlatform(url);
    const data: OgData = { url, platform };

    try {
      const u = new URL(url);
      data.host = u.host.replace(/^www\./, '');
      data.favicon = `https://www.google.com/s2/favicons?domain=${u.host}&sz=64`;
    } catch {}

    // Try oEmbed in parallel with HTML scrape
    const [oembed, htmlRes] = await Promise.all([
      fetchOEmbed(url, platform),
      fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://lovable.app)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      }).catch(() => null),
    ]);

    if (htmlRes && htmlRes.ok) {
      data.finalUrl = htmlRes.url;
      const ct = htmlRes.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        const html = (await htmlRes.text()).slice(0, 500_000);
        data.title =
          pickMeta(html, ['og:title', 'twitter:title']) ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
        data.description = pickMeta(html, ['og:description', 'twitter:description', 'description']);
        data.image = pickMeta(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
        data.video = pickMeta(html, ['og:video', 'og:video:url', 'og:video:secure_url', 'twitter:player:stream']);
        data.siteName = pickMeta(html, ['og:site_name', 'application-name']);
        data.type = pickMeta(html, ['og:type']);
        data.author = pickMeta(html, ['article:author', 'author']);
        data.publishedAt = pickMeta(html, ['article:published_time', 'datePublished']);
      }
    }

    if (oembed) {
      data.embedHtml = oembed.html;
      data.title = data.title || oembed.title;
      data.image = data.image || oembed.image;
      data.author = data.author || oembed.author;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
