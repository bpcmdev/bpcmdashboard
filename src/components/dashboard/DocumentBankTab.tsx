import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText, FileSpreadsheet, FileImage, FileVideo, FileArchive, File as FileIcon,
  Download, Upload, AtSign, Tags, Search, Check, X, Loader2, Trash2, UserPlus, Mail,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import DataStateWrapper from './DataStateWrapper';
import PaginationControls from './PaginationControls';

/* ── Types ─────────────────────────────────────────────────────── */
interface TagRow {
  id: string;
  name: string;
  color: string | null;
}

interface DocRow {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: string | null;
  version: number | null;
  uploaded_by_name: string | null;
  tags: TagRow[] | null;
  created_at: string | null;
  updated_at: string | null;
  total_count: number | null;
}

interface ClientUser {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

const PAGE_SIZE = 25;

const STATUS_FILTERS = ['All', 'Draft', 'In Review', 'Approved', 'Final'] as const;
const STATUS_VALUES = ['draft', 'in_review', 'approved', 'final'] as const;

const statusMap: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground border border-border' },
  in_review: { label: 'In Review', cls: 'bg-[hsl(42_85%_50%/0.18)] text-[hsl(36_75%_30%)] border border-[hsl(42_85%_50%/0.4)]' },
  approved:  { label: 'Approved',  cls: 'bg-[hsl(145_63%_42%/0.15)] text-[hsl(145_63%_28%)] border border-[hsl(145_63%_42%/0.35)]' },
  final:     { label: 'Final',     cls: 'bg-foreground text-background border border-foreground' },
};

const filterToValue = (f: string) =>
  f === 'All' ? null : f.toLowerCase().replace(/\s+/g, '_');

const fileIconFor = (mime: string | null) => {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return FileImage;
  if (m.startsWith('video/')) return FileVideo;
  if (m.includes('zip') || m.includes('compressed') || m.includes('tar')) return FileArchive;
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (m.includes('pdf') || m.includes('word') || m.includes('document') || m.startsWith('text/')) return FileText;
  return FileIcon;
};

const fmtSize = (bytes: number | null) => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
};

const relativeDate = (iso: string | null) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
};

const userLabel = (u: ClientUser) => u.full_name || u.name || u.email || 'User';

/* ── Small pieces ──────────────────────────────────────────────── */
function StatusChip({ status }: { status: string | null }) {
  const key = (status || 'draft').toLowerCase();
  const m = statusMap[key] ?? { label: key.replace(/_/g, ' '), cls: 'bg-muted text-muted-foreground border border-border' };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-mono-ui tracking-wider uppercase rounded-full whitespace-nowrap ${m.cls}`}>
      {m.label}
    </span>
  );
}

function TagPill({ tag }: { tag: TagRow }) {
  const color = tag.color || '#6b7280';
  return (
    <span
      className="inline-block px-2 py-0.5 text-[10px] font-mono-ui tracking-wider uppercase rounded-full border"
      style={{ backgroundColor: `${color}22`, borderColor: `${color}55`, color }}
    >
      {tag.name}
    </span>
  );
}

/* ── Main tab ──────────────────────────────────────────────────── */
interface DocumentBankTabProps {
  clientId?: string | null;
  accent?: string;
}

const DocumentBankTab = ({ clientId: clientIdProp, accent: accentProp }: DocumentBankTabProps = {}) => {
  const { isAdmin, clientId: adminClientId, clientColor } = useAdmin();
  const clientId = clientIdProp ?? adminClientId;
  const accent = accentProp || clientColor || 'hsl(225 70% 35%)';

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const [clientTags, setClientTags] = useState<TagRow[]>([]);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => { setPage(0); }, [debouncedSearch, selectedTagIds, selectedStatus, clientId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const [tagsRes, usersRes] = await Promise.all([
        supabase.from('client_tags').select('id, name, color').eq('client_id', clientId),
        supabase.rpc('client_users', { p_client_id: clientId }),
      ]);
      setClientTags((tagsRes.data as TagRow[]) ?? []);
      setClientUsers((usersRes.data as ClientUser[]) ?? []);
    })();
  }, [clientId]);

  const fetchDocs = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error: err } = await supabase.rpc('documents_list', {
      p_client_id: clientId,
      p_search: debouncedSearch || null,
      p_tag_ids: selectedTagIds.length ? selectedTagIds : null,
      p_status: filterToValue(selectedStatus),
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });
    if (err) {
      setError(true);
      setDocs([]);
    } else {
      const rows = (data as DocRow[]) ?? [];
      setError(false);
      setDocs(rows);
      setTotal(Number(rows[0]?.total_count ?? 0));
    }
    setLoading(false);
  }, [clientId, debouncedSearch, selectedTagIds, selectedStatus, page]);

  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDownload = async (doc: DocRow) => {
    const { data, error: err } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 3600);
    if (err || !data?.signedUrl) {
      setNotice('Could not prepare that download. Please try again.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const handleStatusChange = async (doc: DocRow, newStatus: string) => {
    setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, status: newStatus } : d)));
    const { error: err } = await supabase.from('documents').update({ status: newStatus }).eq('id', doc.id);
    if (err) {
      setNotice('Could not update the status.');
      void fetchDocs();
    }
  };

  const handleTagToggle = async (doc: DocRow, tag: TagRow, active: boolean) => {
    if (!clientId) return;
    setDocs(prev => prev.map(d => {
      if (d.id !== doc.id) return d;
      const tags = d.tags ?? [];
      return { ...d, tags: active ? tags.filter(t => t.id !== tag.id) : [...tags, tag] };
    }));
    if (active) {
      await supabase.from('entity_tags').delete()
        .eq('entity_type', 'document').eq('entity_id', doc.id).eq('tag_id', tag.id);
    } else {
      await supabase.from('entity_tags').insert({
        client_id: clientId,
        entity_type: 'document',
        entity_id: doc.id,
        tag_id: tag.id,
      });
    }
  };

  const handleMention = async (doc: DocRow, recipientId: string, message: string) => {
    if (!clientId) return false;
    const { error: err } = await supabase.rpc('create_mention', {
      p_client_id: clientId,
      p_recipient_id: recipientId,
      p_actor_id: currentUserId,
      p_entity_type: 'document',
      p_entity_id: doc.id,
      p_entity_title: doc.title,
      p_message: message,
    });
    if (err) { setNotice('Could not send that mention.'); return false; }
    setNotice('Mention sent.');
    return true;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Document Bank</div>
          <h2 className="font-display text-xl md:text-2xl font-bold mt-1">Shared files</h2>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRecipientsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono-ui font-semibold tracking-[0.12em] uppercase border border-border hover:bg-muted"
            >
              <UserPlus className="w-3 h-3" />
              Manage recipients
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono-ui font-semibold tracking-[0.12em] uppercase text-background"
              style={{ backgroundColor: accent }}
            >
              <Upload className="w-3 h-3" />
              Upload document
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 border border-border bg-muted/40 px-3 py-2 text-xs">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Filter bar */}
      <div className="border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 border border-border px-2 py-1.5 flex-1 min-w-[200px]">
          <Search className="w-3 h-3 opacity-50" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search documents…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[10px] font-mono-ui tracking-[0.12em] uppercase hover:bg-muted">
              <Tags className="w-3 h-3" />
              Tags{selectedTagIds.length ? ` · ${selectedTagIds.length}` : ''}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1 max-h-72 overflow-y-auto">
            {clientTags.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">No tags yet</div>
            ) : clientTags.map(t => {
              const active = selectedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTagIds(prev => active ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
                >
                  <TagPill tag={t} />
                  {active && <Check className="w-3 h-3" />}
                </button>
              );
            })}
            {selectedTagIds.length > 0 && (
              <button
                onClick={() => setSelectedTagIds([])}
                className="w-full px-2 py-1.5 mt-1 border-t border-border text-[10px] font-mono-ui tracking-wider uppercase text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              className={`px-2.5 py-1.5 text-[10px] font-mono-ui tracking-[0.12em] uppercase border transition-colors ${
                selectedStatus === s ? 'text-background border-transparent' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              style={selectedStatus === s ? { backgroundColor: accent } : undefined}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <DataStateWrapper loading={loading} error={error} skeletonCount={5} skeletonHeight="h-16">
        <div className="border border-border bg-card">
          {docs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No documents match these filters.</div>
          ) : (
            <div className="divide-y divide-border">
              {docs.map(doc => {
                const Icon = fileIconFor(doc.mime_type);
                return (
                  <div key={doc.id} className="flex items-start gap-3 p-3 md:p-4 hover:bg-muted/30 transition-colors">
                    <Icon className="w-5 h-5 mt-0.5 shrink-0 opacity-60" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{doc.title}</span>
                        {doc.version ? (
                          <span className="text-[10px] font-mono-ui tracking-wider uppercase text-muted-foreground">v{doc.version}</span>
                        ) : null}
                        <StatusChip status={doc.status} />
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {doc.file_name}
                        {doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ''}
                      </div>
                      {doc.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.description}</div>
                      )}
                      {(doc.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(doc.tags ?? []).map(t => <TagPill key={t.id} tag={t} />)}
                        </div>
                      )}
                      <div className="text-[10px] font-mono-ui tracking-wider uppercase text-muted-foreground mt-1.5">
                        {doc.uploaded_by_name ?? 'Unknown'} · {relativeDate(doc.updated_at || doc.created_at)}
                      </div>
                    </div>

                    {/* Row actions */}
                    <TooltipProvider delayDuration={150}>
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleDownload(doc)}
                            aria-label="Download"
                            className="p-1.5 border border-border hover:bg-muted"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>

                      <Popover>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <button aria-label="Change status" className="p-1.5 border border-border hover:bg-muted">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Change status</TooltipContent>
                        </Tooltip>
                        <PopoverContent align="end" className="w-44 p-1">
                          {STATUS_VALUES.map(s => (
                            <button
                              key={s}
                              onClick={() => { if (s !== doc.status) void handleStatusChange(doc, s); }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
                            >
                              <StatusChip status={s} />
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <button aria-label="Edit tags" className="p-1.5 border border-border hover:bg-muted">
                                <Tags className="w-3.5 h-3.5" />
                              </button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Edit tags</TooltipContent>
                        </Tooltip>
                        <PopoverContent align="end" className="w-56 p-1 max-h-72 overflow-y-auto">
                          {clientTags.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-muted-foreground">No tags yet</div>
                          ) : clientTags.map(t => {
                            const active = (doc.tags ?? []).some(x => x.id === t.id);
                            return (
                              <button
                                key={t.id}
                                onClick={() => void handleTagToggle(doc, t, active)}
                                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
                              >
                                <TagPill tag={t} />
                                {active && <Check className="w-3 h-3" />}
                              </button>
                            );
                          })}
                        </PopoverContent>
                      </Popover>

                      <MentionButton
                        users={clientUsers}
                        onSend={(userId, message) => handleMention(doc, userId, message)}
                      />
                    </div>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={page + 1}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p - 1)}
            />
          </div>
        </div>
      </DataStateWrapper>

      {isAdmin && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          clientId={clientId}
          currentUserId={currentUserId}
          clientTags={clientTags}
          accent={accent}
          onUploaded={() => { setPage(0); void fetchDocs(); }}
        />
      )}

      {isAdmin && (
        <RecipientsDialog
          open={recipientsOpen}
          onOpenChange={setRecipientsOpen}
          clientId={clientId}
          accent={accent}
        />
      )}
    </div>
  );
};

/* ── Mention picker ────────────────────────────────────────────── */
function MentionButton({
  users,
  onSend,
}: { users: ClientUser[]; onSend: (userId: string, message: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!userId) return;
    setSending(true);
    const ok = await onSend(userId, message.trim());
    setSending(false);
    if (ok) { setOpen(false); setMessage(''); setUserId(null); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button title="Mention someone" className="p-1.5 border border-border hover:bg-muted">
          <AtSign className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 space-y-2">
        <div className="font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground">Mention</div>
        <div className="max-h-40 overflow-y-auto border border-border">
          {users.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">No users found</div>
          ) : users.map(u => (
            <button
              key={u.id}
              onClick={() => setUserId(u.id)}
              className={`w-full flex items-center justify-between px-2 py-1.5 text-xs text-left hover:bg-muted ${userId === u.id ? 'bg-muted font-semibold' : ''}`}
            >
              <span className="truncate">{userLabel(u)}</span>
              {userId === u.id && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
        <div className="text-[10px] leading-snug text-muted-foreground">
          Dashboard users only — use Manage recipients to notify external addresses.
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="w-full border border-border bg-transparent p-2 text-xs outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={() => void send()}
          disabled={!userId || sending}
          className="w-full bg-foreground text-background py-1.5 text-[10px] font-mono-ui tracking-[0.14em] uppercase disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </PopoverContent>
    </Popover>
  );
}

/* ── Upload dialog ─────────────────────────────────────────────── */
function UploadDialog({
  open, onOpenChange, clientId, currentUserId, clientTags, accent, onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | null;
  currentUserId: string | null;
  clientTags: TagRow[];
  accent: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null); setTitle(''); setDescription(''); setTagIds([]);
    setBusy(false); setStage(''); setErr(null);
  };

  const canSubmit = useMemo(() => !!file && !!title.trim() && !!clientId && !busy, [file, title, clientId, busy]);

  const submit = async () => {
    if (!file || !clientId) return;
    setBusy(true); setErr(null); setStage('Uploading file…');
    const path = `${clientId}/${crypto.randomUUID()}-${file.name}`;

    const up = await supabase.storage.from('documents').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (up.error) {
      setErr(`Upload failed: ${up.error.message}`);
      setBusy(false); setStage('');
      return;
    }

    setStage('Saving details…');
    const ins = await supabase.from('documents').insert({
      client_id: clientId,
      title: title.trim(),
      description: description.trim() || null,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      status: 'draft',
      uploaded_by: currentUserId,
    }).select('id').maybeSingle();

    if (ins.error || !ins.data?.id) {
      setErr(`Could not save the document: ${ins.error?.message ?? 'unknown error'}`);
      setBusy(false); setStage('');
      return;
    }

    if (tagIds.length) {
      setStage('Applying tags…');
      const tagRes = await supabase.from('entity_tags').insert(
        tagIds.map(tag_id => ({
          client_id: clientId,
          entity_type: 'document',
          entity_id: ins.data!.id,
          tag_id,
        }))
      );
      if (tagRes.error) {
        setErr(`Document uploaded, but tags failed: ${tagRes.error.message}`);
        setBusy(false); setStage('');
        onUploaded();
        return;
      }
    }

    onUploaded();
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono-ui text-[11px] tracking-[0.16em] uppercase">Upload document</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-1">File</div>
            <input
              ref={inputRef}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
              className="w-full text-xs border border-border p-2"
            />
            {file && <div className="text-[10px] text-muted-foreground mt-1">{fmtSize(file.size)}</div>}
          </div>

          <div>
            <div className="font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-1">Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-border bg-transparent p-2 text-xs outline-none"
            />
          </div>

          <div>
            <div className="font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-1">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-border bg-transparent p-2 text-xs outline-none"
            />
          </div>

          <div>
            <div className="font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-1">Tags</div>
            {clientTags.length === 0 ? (
              <div className="text-xs text-muted-foreground">No tags available</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {clientTags.map(t => {
                  const active = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTagIds(prev => active ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                      className={active ? 'opacity-100' : 'opacity-45 hover:opacity-80'}
                    >
                      <TagPill tag={t} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {err && <div className="border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> {stage}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { if (!busy) { onOpenChange(false); reset(); } }}
              className="px-3 py-1.5 text-[10px] font-mono-ui tracking-[0.12em] uppercase border border-border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="px-3 py-1.5 text-[10px] font-mono-ui font-semibold tracking-[0.12em] uppercase text-background disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              Upload
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentBankTab;
