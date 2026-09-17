import { useEffect, useState } from 'react';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PreviewDoc {
  id: string;
  title: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Kind = 'pdf' | 'image' | 'docx' | 'unsupported';

function kindFor(mime: string | null, fileName: string | null): Kind {
  const m = (mime ?? '').toLowerCase();
  const n = (fileName ?? '').toLowerCase();
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m === DOCX_MIME || n.endsWith('.docx')) return 'docx';
  return 'unsupported';
}

export default function DocumentPreviewDialog({
  doc,
  accent,
  onClose,
}: {
  doc: PreviewDoc | null;
  accent: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  const kind = doc ? kindFor(doc.mime_type, doc.file_name) : 'unsupported';

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setSignedUrl(null);
    setDocxHtml(null);

    (async () => {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 3600);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setErrorMsg("We couldn't open this file. Try downloading it instead.");
        setLoading(false);
        return;
      }
      setSignedUrl(data.signedUrl);

      if (kindFor(doc.mime_type, doc.file_name) === 'docx') {
        try {
          const res = await fetch(data.signedUrl);
          const arrayBuffer = await res.arrayBuffer();
          const mammoth = await import('mammoth');
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (cancelled) return;
          setDocxHtml(result.value);
        } catch {
          if (cancelled) return;
          setErrorMsg("We couldn't read this Word document. Try downloading it instead.");
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [doc]);

  if (!doc) return null;

  const downloadButton = (
    <a
      href={signedUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-mono-ui font-semibold tracking-[0.12em] uppercase text-background"
      style={{ backgroundColor: accent }}
    >
      <Download className="w-3.5 h-3.5" />
      Download
    </a>
  );

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col gap-3 p-4 md:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-mono-ui text-[11px] tracking-[0.16em] uppercase">
            {doc.title}
          </DialogTitle>
          {doc.file_name && (
            <div className="text-xs text-muted-foreground">{doc.file_name}</div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 border border-border bg-muted/20 overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-[10px] font-mono-ui tracking-[0.12em] uppercase">Loading preview</span>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-muted-foreground max-w-sm">{errorMsg}</p>
              {signedUrl && downloadButton}
            </div>
          ) : kind === 'pdf' && signedUrl ? (
            <iframe src={signedUrl} title={doc.title} className="w-full h-full" />
          ) : kind === 'image' && signedUrl ? (
            <img src={signedUrl} alt={doc.title} className="max-w-full max-h-full object-contain" />
          ) : kind === 'docx' && docxHtml !== null ? (
            <div className="w-full h-full overflow-y-auto bg-background">
              <div
                className="mx-auto max-w-[46rem] px-6 py-8 text-[14px] leading-[1.75] [&_h1]:text-2xl [&_h1]:font-display [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-display [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <p className="text-sm text-muted-foreground max-w-sm">
                Preview isn't available for this file type — download to view.
              </p>
              {signedUrl && downloadButton}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
