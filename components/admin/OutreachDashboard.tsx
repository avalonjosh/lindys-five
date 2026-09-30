'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Edit, Mail, Send, Download, Upload,
  ChevronDown, ChevronUp, Copy, Check,
  Users, MailCheck, MessageSquare, Radio
} from 'lucide-react';
import {
  Card, PageHeader, Button, Badge, Spinner, StatCard, ErrorBanner,
  Input, Textarea, Select, SearchInput, Field, Modal, EmptyState,
} from './ui';
import { NHL_TEAMS, MLB_TEAMS, findTeam, getTeamUrl } from '@/lib/teamConfig';
import { applyOutreachEvent, isFollowupDue, sequenceLabel, type OutreachContact, type OutreachStatus } from '@/lib/outreach';

type FilterTeam = 'all' | string;
type FilterType = 'all' | 'blog' | 'podcast' | 'beat_writer' | 'radio' | 'tv' | 'other';
type FilterStatus = 'all' | OutreachStatus;

const TYPE_LABELS: Record<string, string> = {
  blog: 'Blog',
  podcast: 'Podcast',
  beat_writer: 'Beat Writer',
  radio: 'Radio',
  tv: 'TV',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  not_contacted: 'Not Contacted',
  contacted: 'Contacted',
  responded: 'Responded',
  converted: 'Converted',
  declined: 'Declined',
  bounced: 'Bounced',
};

const STATUS_COLORS: Record<string, string> = {
  not_contacted: 'bg-gray-100 text-gray-600',
  contacted: 'bg-amber-50 text-amber-700',
  responded: 'bg-blue-50 text-blue-700',
  converted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-600',
  bounced: 'bg-orange-50 text-orange-700',
};

// Short, personal notes sent by hand from Josh's own email. {{team_url}} uses
// the sport-correct route. No feature lists, no asks, no claims about the model.
const TEMPLATES = {
  cold: {
    name: 'First Email',
    subject: 'made a {{team_short}} playoff tracker',
    body: `Hi {{contact_name}},

I built a site that tracks the {{team_possessive}} progress toward making the playoffs. It started as just a Sabres thing, a lot of fans ended up really liking it, so I expanded it to every team. Figured I'd send it your way to check out:

{{team_url}}

Josh`,
  },
  followup: {
    name: 'Follow-Up',
    subject: 'Re: made a {{team_short}} playoff tracker',
    body: `Hi {{contact_name}},

[One line on their team this week: a streak, or a jump in the odds.] Made me think of the {{team_short}} tracker I sent over last week:

{{team_url}}

No worries if it's not your thing.

Josh`,
  },
};

const SITE_URL = 'https://www.lindysfive.com';

function getTeamName(slug: string): string {
  const team = findTeam(slug);
  return team ? `${team.city} ${team.name}` : slug;
}

function getTeamShort(slug: string): string {
  return findTeam(slug)?.name ?? slug;
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function getLeague(slug: string): string {
  if (slug in MLB_TEAMS) return 'MLB';
  return 'NHL';
}

function getFullTeamUrl(slug: string): string {
  return `${SITE_URL}${getTeamUrl(slug)}`;
}

function fillTemplate(template: string, contact: OutreachContact): string {
  return template
    .replace(/\{\{contact_name\}\}/g, contact.name.split(' ')[0] || contact.name)
    .replace(/\{\{team_short\}\}/g, getTeamShort(contact.team))
    .replace(/\{\{team_possessive\}\}/g, possessive(getTeamShort(contact.team)))
    .replace(/\{\{team_url\}\}/g, getFullTeamUrl(contact.team));
}

// Grouped team options for selectors (NHL then MLB, alphabetical by city)
function TeamOptions() {
  return (
    <>
      <optgroup label="NHL">
        {Object.entries(NHL_TEAMS)
          .sort((a, b) => a[1].city.localeCompare(b[1].city))
          .map(([slug, team]) => (
            <option key={slug} value={slug}>{team.city} {team.name}</option>
          ))}
      </optgroup>
      <optgroup label="MLB">
        {Object.entries(MLB_TEAMS)
          .sort((a, b) => a[1].city.localeCompare(b[1].city))
          .map(([slug, team]) => (
            <option key={slug} value={slug}>{team.city} {team.name}</option>
          ))}
      </optgroup>
    </>
  );
}

export default function OutreachDashboard() {
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTeam, setFilterTeam] = useState<FilterTeam>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState<OutreachContact | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState<{ contact: OutreachContact; template: keyof typeof TEMPLATES } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/outreach/contacts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      setError('Failed to load contacts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    if (filterTeam !== 'all') result = result.filter(c => c.team === filterTeam);
    if (filterType !== 'all') result = result.filter(c => c.type === filterType);
    if (filterStatus !== 'all') result = result.filter(c => c.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.outlet.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.twitter.toLowerCase().includes(q)
      );
    }
    return result;
  }, [contacts, filterTeam, filterType, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const withEmail = contacts.filter(c => c.email).length;
    const contacted = contacts.filter(c => c.status === 'contacted').length;
    const responded = contacts.filter(c => c.status === 'responded').length;
    const converted = contacts.filter(c => c.status === 'converted').length;
    const due = contacts.filter(c => isFollowupDue(c)).length;
    return { total, withEmail, contacted, responded, converted, due };
  }, [contacts]);

  const dueContacts = useMemo(
    () => contacts.filter(c => isFollowupDue(c)).sort((a, b) => (a.nextActionAt || '').localeCompare(b.nextActionAt || '')),
    [contacts]
  );

  async function handleSaveContact(contact: Partial<OutreachContact>) {
    setSaving(true);
    try {
      const res = await fetch('/api/outreach/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contact),
      });
      if (!res.ok) throw new Error('Failed to save');
      setShowAddForm(false);
      setEditingContact(null);
      await loadContacts();
    } catch (err) {
      console.error(err);
      setError('Failed to save contact');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContact(id: string) {
    if (!confirm('Delete this contact?')) return;
    setDeleting(id);
    try {
      const res = await fetch('/api/outreach/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      await loadContacts();
    } catch (err) {
      console.error(err);
      setError('Failed to delete contact');
    } finally {
      setDeleting(null);
    }
  }

  async function handleStatusChange(contact: OutreachContact, newStatus: OutreachContact['status']) {
    // Same sequence rules the chat-driven updates use (lib/outreach.ts).
    const updated =
      newStatus === 'contacted' ? applyOutreachEvent(contact, { kind: 'sent' })
      : newStatus === 'responded' ? applyOutreachEvent(contact, { kind: 'replied' })
      : newStatus === 'converted' || newStatus === 'declined' || newStatus === 'bounced' ? applyOutreachEvent(contact, { kind: newStatus })
      : { ...contact, status: newStatus };
    await handleSaveContact(updated);
  }

  // Contacts are imported from a JSON file on your computer. The list is never
  // served from the site (it holds personal email addresses).
  async function handleImportFromFile(file: File) {
    setImporting(true);
    try {
      const jsonContacts = JSON.parse(await file.text());

      const importRes = await fetch('/api/outreach/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contacts: jsonContacts }),
      });
      if (!importRes.ok) throw new Error('Import failed');
      const result = await importRes.json();
      alert(`Imported ${result.imported} contacts (${result.skipped} already existed)`);
      await loadContacts();
    } catch (err) {
      console.error(err);
      setError('Failed to import contacts');
    } finally {
      setImporting(false);
    }
  }

  function handleExportCSV() {
    const header = 'Name,Outlet,Type,Team,Email,Twitter,Website,Status,Sequence,Outcome,Notes';
    const rows = filteredContacts.map(c => {
      const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
      return [esc(c.name), esc(c.outlet), esc(c.type), esc(getTeamName(c.team)), esc(c.email), esc(c.twitter), esc(c.website), esc(c.status), esc(sequenceLabel(c)), esc(c.outcome || ''), esc(c.notes)].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'outreach-contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyEmail(contact: OutreachContact, templateKey: keyof typeof TEMPLATES) {
    const tmpl = TEMPLATES[templateKey];
    const subject = fillTemplate(tmpl.subject, contact);
    const body = fillTemplate(tmpl.body, contact);
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text);
    setCopiedId(contact.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title="Outreach"
          description="Media contacts and where each one is in the outreach sequence. Emails are sent by hand."
          actions={
            <>
              <Button
                variant="primary"
                onClick={() => { setEditingContact(null); setShowAddForm(true); }}
              >
                <Plus className="h-4 w-4" /> Add Contact
              </Button>
            </>
          }
        />

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} />
          <StatCard icon={<Mail className="h-4 w-4" />} label="With Email" value={stats.withEmail} />
          <StatCard icon={<Send className="h-4 w-4" />} label="Contacted" value={stats.contacted} />
          <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Responded" value={stats.responded} />
          <StatCard icon={<MailCheck className="h-4 w-4" />} label="Converted" value={stats.converted} />
          <StatCard icon={<Radio className="h-4 w-4" />} label="Follow-ups Due" value={stats.due} />
        </div>

        {/* Filters + secondary actions */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search name, outlet, email…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
          <Select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="!w-auto">
            <option value="all">All Teams</option>
            <TeamOptions />
          </Select>
          <Select value={filterType} onChange={e => setFilterType(e.target.value as FilterType)} className="!w-auto">
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)} className="!w-auto">
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          {(filterTeam !== 'all' || filterType !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => { setFilterTeam('all'); setFilterType('all'); setFilterStatus('all'); setSearchQuery(''); }}
              className="px-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
            >
              Clear
            </button>
          )}
          <span className="ml-auto flex items-center gap-2 text-sm text-gray-400">
            {filteredContacts.length} of {contacts.length}
            <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 ${importing ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload className="h-4 w-4" /> {importing ? 'Importing…' : 'Import JSON'}
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleImportFromFile(f); }}
              />
            </label>
            <Button variant="ghost" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </span>
        </div>

        {dueContacts.length > 0 && (
          <Card className="mb-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Follow-ups due ({dueContacts.length})</h2>
            <ul className="divide-y divide-gray-100">
              {dueContacts.map(c => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.outlet} · {getTeamName(c.team)}</span>
                  <span className="text-xs text-gray-400">{sequenceLabel(c)}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowTemplatePreview({ contact: c, template: 'followup' })}>
                      <Mail className="h-4 w-4" /> Follow-up copy
                    </Button>
                    <Button variant="secondary" size="sm" disabled={saving} onClick={() => handleSaveContact(applyOutreachEvent(c, { kind: 'followup' }))}>
                      <Check className="h-4 w-4" /> Mark sent
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {error && (
          <div className="mb-4">
            <ErrorBanner>
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
            </ErrorBanner>
          </div>
        )}

        {/* Contact List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <Card>
            <EmptyState>
              <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="mb-1 font-semibold text-gray-600">No contacts found</p>
              <p>
                {contacts.length === 0
                  ? 'Click "Import JSON" to load contacts from a file on your computer, or add them manually.'
                  : 'Try adjusting your filters.'}
              </p>
            </EmptyState>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredContacts.map(contact => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onEdit={() => { setEditingContact(contact); setShowAddForm(true); }}
                onDelete={() => handleDeleteContact(contact.id)}
                onStatusChange={(s) => handleStatusChange(contact, s)}
                onPreviewTemplate={(t) => setShowTemplatePreview({ contact, template: t })}
                onCopyEmail={(t) => handleCopyEmail(contact, t)}
                isDeleting={deleting === contact.id}
                isCopied={copiedId === contact.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddForm && (
        <ContactFormModal
          contact={editingContact}
          onSave={handleSaveContact}
          onClose={() => { setShowAddForm(false); setEditingContact(null); }}
          saving={saving}
        />
      )}

      {/* Template Preview Modal */}
      {showTemplatePreview && (
        <TemplatePreviewModal
          contact={showTemplatePreview.contact}
          templateKey={showTemplatePreview.template}
          onClose={() => setShowTemplatePreview(null)}
        />
      )}
    </>
  );
}

function ContactRow({
  contact,
  onEdit,
  onDelete,
  onStatusChange,
  onPreviewTemplate,
  onCopyEmail,
  isDeleting,
  isCopied,
}: {
  contact: OutreachContact;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: OutreachContact['status']) => void;
  onPreviewTemplate: (template: keyof typeof TEMPLATES) => void;
  onCopyEmail: (template: keyof typeof TEMPLATES) => void;
  isDeleting: boolean;
  isCopied: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card padding={false} className="overflow-hidden">
      {/* Main row */}
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-3 hover:bg-gray-50 sm:gap-3 sm:px-4"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900">{contact.name}</span>
            <span className="truncate text-xs text-gray-500">{contact.outlet}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400">{getTeamName(contact.team)}</span>
            <Badge variant="neutral">{TYPE_LABELS[contact.type] || contact.type}</Badge>
            <Badge variant={getLeague(contact.team) === 'MLB' ? 'info' : 'accent'}>{getLeague(contact.team)}</Badge>
            {sequenceLabel(contact) && <span className="text-xs text-gray-500">{sequenceLabel(contact)}</span>}
          </div>
        </div>

        {contact.email && (
          <span className="hidden max-w-[200px] truncate text-xs text-gray-400 sm:inline">
            {contact.email}
          </span>
        )}

        <select
          value={contact.status}
          onChange={e => { e.stopPropagation(); onStatusChange(e.target.value as OutreachContact['status']); }}
          onClick={e => e.stopPropagation()}
          className={`cursor-pointer rounded border-0 px-2 py-1 text-xs font-semibold focus:outline-none ${STATUS_COLORS[contact.status]}`}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k} className="bg-white text-gray-900">{v}</option>
          ))}
        </select>

        <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
          {contact.email && (
            <button
              onClick={() => onCopyEmail(contact.contactedAt ? 'followup' : 'cold')}
              className="p-1.5 text-gray-400 transition-colors hover:text-gray-700"
              title="Copy email template"
            >
              {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 transition-colors hover:text-gray-700"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {contact.email && (
              <div>
                <span className="text-gray-400">Email: </span>
                <a href={`mailto:${contact.email}`} className="text-sabres-blue hover:underline">{contact.email}</a>
              </div>
            )}
            {contact.twitter && (
              <div>
                <span className="text-gray-400">Twitter: </span>
                <a
                  href={`https://x.com/${contact.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sabres-blue hover:underline"
                >
                  {contact.twitter}
                </a>
              </div>
            )}
            {contact.website && (
              <div>
                <span className="text-gray-400">Website: </span>
                <a href={contact.website} target="_blank" rel="noopener noreferrer" className="inline-block max-w-[300px] truncate align-bottom text-sabres-blue hover:underline">
                  {contact.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {contact.notes && (
              <div className="sm:col-span-2">
                <span className="text-gray-400">Notes: </span>
                <span className="text-gray-700">{contact.notes}</span>
              </div>
            )}
            {sequenceLabel(contact) && (
              <div className="sm:col-span-2">
                <span className="text-gray-400">Sequence: </span>
                <span className="text-gray-700">{sequenceLabel(contact)}</span>
              </div>
            )}
            {contact.outcome && (
              <div className="sm:col-span-2">
                <span className="text-gray-400">Outcome: </span>
                <span className="text-gray-700">{contact.outcome}</span>
              </div>
            )}
          </div>

          {/* Template buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="py-1 text-xs text-gray-400">Preview template:</span>
            {Object.entries(TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                onClick={() => onPreviewTemplate(key as keyof typeof TEMPLATES)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// <input type="date"> helpers: stored timestamps are ISO, shown as the Eastern date.
function toDateInput(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : '';
}
function fromDateInput(ymd: string): string | undefined {
  return ymd ? new Date(`${ymd}T16:00:00Z`).toISOString() : undefined;
}

function ContactFormModal({
  contact,
  onSave,
  onClose,
  saving,
}: {
  contact: OutreachContact | null;
  onSave: (c: Partial<OutreachContact>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<OutreachContact>>(
    contact || {
      name: '',
      outlet: '',
      type: 'blog',
      team: 'sabres',
      email: '',
      twitter: '',
      website: '',
      notes: '',
      status: 'not_contacted',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal onClose={onClose} title={contact ? 'Edit Contact' : 'Add Contact'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <Input
              required
              value={form.name || ''}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Outlet *">
            <Input
              required
              value={form.outlet || ''}
              onChange={e => setForm({ ...form, outlet: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team">
            <Select
              value={form.team || 'sabres'}
              onChange={e => setForm({ ...form, team: e.target.value })}
            >
              <TeamOptions />
            </Select>
          </Field>
          <Field label="Type">
            <Select
              value={form.type || 'blog'}
              onChange={e => setForm({ ...form, type: e.target.value as OutreachContact['type'] })}
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Email">
          <Input
            type="email"
            value={form.email || ''}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Twitter">
            <Input
              value={form.twitter || ''}
              onChange={e => setForm({ ...form, twitter: e.target.value })}
              placeholder="@handle"
            />
          </Field>
          <Field label="Website">
            <Input
              value={form.website || ''}
              onChange={e => setForm({ ...form, website: e.target.value })}
              placeholder="https://..."
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            value={form.notes || ''}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="resize-none"
          />
        </Field>
        {contact && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="First sent">
                <Input type="date" value={toDateInput(form.contactedAt)} onChange={e => setForm({ ...form, contactedAt: fromDateInput(e.target.value) })} />
              </Field>
              <Field label="Follow-up sent">
                <Input type="date" value={toDateInput(form.followupSentAt)} onChange={e => setForm({ ...form, followupSentAt: fromDateInput(e.target.value) })} />
              </Field>
              <Field label="Next follow-up">
                <Input type="date" value={form.nextActionAt || ''} onChange={e => setForm({ ...form, nextActionAt: e.target.value || undefined })} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Channel">
                <Select value={form.channel || ''} onChange={e => setForm({ ...form, channel: (e.target.value || undefined) as OutreachContact['channel'] })}>
                  <option value="">Not set</option>
                  <option value="email">Email</option>
                  <option value="x">X</option>
                </Select>
              </Field>
              <div className="col-span-2">
                <Field label="Outcome">
                  <Input value={form.outcome || ''} onChange={e => setForm({ ...form, outcome: e.target.value })} placeholder="What came of it" />
                </Field>
              </div>
            </div>
          </>
        )}
        {contact && (
          <Field label="Status">
            <Select
              value={form.status || 'not_contacted'}
              onChange={e => setForm({ ...form, status: e.target.value as OutreachContact['status'] })}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Saving...' : contact ? 'Update' : 'Add Contact'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TemplatePreviewModal({
  contact,
  templateKey,
  onClose,
}: {
  contact: OutreachContact;
  templateKey: keyof typeof TEMPLATES;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const template = TEMPLATES[templateKey];
  const subject = fillTemplate(template.subject, contact);
  const body = fillTemplate(template.body, contact);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMailto = () => {
    if (contact.email) {
      window.open(`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={
        <span>
          {template.name}
          <span className="mt-0.5 block text-xs font-normal text-gray-400">
            To: {contact.name} ({contact.outlet})
          </span>
        </span>
      }
      wide
    >
      <div className="mb-3">
        <span className="text-xs text-gray-400">Subject:</span>
        <p className="mt-0.5 text-sm font-medium text-gray-900">{subject}</p>
      </div>
      <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
        {body}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </Button>
        {contact.email && (
          <Button variant="primary" size="sm" onClick={handleMailto}>
            <Mail className="h-4 w-4" /> Open in Mail
          </Button>
        )}
      </div>
    </Modal>
  );
}
