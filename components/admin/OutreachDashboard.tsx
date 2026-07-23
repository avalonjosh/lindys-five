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

interface OutreachContact {
  id: string;
  name: string;
  outlet: string;
  type: 'blog' | 'podcast' | 'beat_writer' | 'radio' | 'tv' | 'other';
  team: string;
  email: string;
  twitter: string;
  website: string;
  notes: string;
  status: 'not_contacted' | 'contacted' | 'responded' | 'converted' | 'declined';
  contactedAt?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

type FilterTeam = 'all' | string;
type FilterType = 'all' | 'blog' | 'podcast' | 'beat_writer' | 'radio' | 'tv' | 'other';
type FilterStatus = 'all' | 'not_contacted' | 'contacted' | 'responded' | 'converted' | 'declined';

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
};

const STATUS_COLORS: Record<string, string> = {
  not_contacted: 'bg-gray-100 text-gray-600',
  contacted: 'bg-amber-50 text-amber-700',
  responded: 'bg-blue-50 text-blue-700',
  converted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-600',
};

// Templates are sport-aware: {{league}} and {{sport_fan}} resolve from the
// contact's team (NHL or MLB), and {{team_url}} uses the sport-correct route.
const TEMPLATES = {
  cold: {
    name: 'Cold Outreach',
    subject: "Free tool for {{team_name}} coverage — Lindy's Five",
    body: `Hi {{contact_name}},

I'm a developer and {{sport_fan}} who built Lindy's Five — a free, real-time dashboard for every {{league}} team. I wanted to share it because I think it could be useful for your {{team_name}} coverage at {{outlet_name}}.

Here's the {{team_name}} page: {{team_url}}

It pulls live data from the official {{league}} API and shows:
- Live scores and game results
- Full standings with playoff odds (Monte Carlo simulations)
- Team stats, streaks, and schedule
- AI-generated daily recaps

Buffalo sports radio (WGR 550) has featured the site on air and their listeners loved it, so I'm reaching out to media folks in other markets who might find it useful — whether for personal reference, content ideas, or sharing with your audience.

It's completely free, no ads, and works great on mobile. The site now covers every NHL and MLB team. Would love to hear what you think.

Best,
Josh Rabenold
Lindy's Five — {{team_url}}`,
  },
  followup: {
    name: 'Follow-Up',
    subject: "Re: Free tool for {{team_name}} coverage — Lindy's Five",
    body: `Hi {{contact_name}},

Just wanted to bump this in case it got buried — I built a free real-time dashboard for every {{league}} team and thought it might be useful for your {{team_name}} coverage.

Here's the direct link: {{team_url}}

A few things that might be interesting for your work:
- Playoff odds update daily with Monte Carlo simulations
- Schedule view shows upcoming opponents and recent results at a glance
- Works great on phone during games or pressers

No pressure at all — just thought it could be a handy tool. Happy to answer any questions.

Best,
Josh Rabenold`,
  },
  podcast: {
    name: 'Radio/Podcast Pitch',
    subject: '{{team_name}} data tool — available for on-air use or guest spot',
    body: `Hi {{contact_name}},

I'm a developer who built Lindy's Five, a free real-time dashboard for every {{league}} team. I've been listening to {{outlet_name}} and thought this could be a useful resource for your show.

Here's the {{team_name}} page: {{team_url}}

The site has real-time standings, playoff odds (Monte Carlo simulations), and AI-generated daily recaps — all pulled from official {{league}} data. Buffalo's WGR 550 has featured it on air and it got a great response from listeners.

A few ways this could work for your show:
- On-air resource: Quick reference for standings, stats, and playoff scenarios during broadcasts
- Listener engagement: Share the link — fans love checking playoff odds daily
- Guest segment: Happy to come on and talk about the data behind playoff odds, team trends, or how the tool works

The site is free, no login required, and works on any device. Would love to chat if you're interested.

Best,
Josh Rabenold
Lindy's Five — {{team_url}}`,
  },
};

const SITE_URL = 'https://www.lindysfive.com';

function getTeamName(slug: string): string {
  const team = findTeam(slug);
  return team ? `${team.city} ${team.name}` : slug;
}

function getLeague(slug: string): string {
  if (slug in MLB_TEAMS) return 'MLB';
  return 'NHL';
}

function getFullTeamUrl(slug: string): string {
  return `${SITE_URL}${getTeamUrl(slug)}`;
}

function fillTemplate(template: string, contact: OutreachContact): string {
  const league = getLeague(contact.team);
  return template
    .replace(/\{\{contact_name\}\}/g, contact.name.split(' ')[0] || contact.name)
    .replace(/\{\{team_name\}\}/g, getTeamName(contact.team))
    .replace(/\{\{team_url\}\}/g, getFullTeamUrl(contact.team))
    .replace(/\{\{outlet_name\}\}/g, contact.outlet)
    .replace(/\{\{league\}\}/g, league)
    .replace(/\{\{sport_fan\}\}/g, league === 'MLB' ? 'baseball fan' : 'hockey fan');
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
    const teamsSet = new Set(contacts.map(c => c.team));
    return { total, withEmail, contacted, responded, converted, teams: teamsSet.size };
  }, [contacts]);

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
    const updates: Partial<OutreachContact> = { ...contact, status: newStatus };
    if (newStatus === 'contacted' && !contact.contactedAt) {
      updates.contactedAt = new Date().toISOString();
    }
    if (newStatus === 'responded' && !contact.respondedAt) {
      updates.respondedAt = new Date().toISOString();
    }
    await handleSaveContact(updates);
  }

  async function handleImportFromFile() {
    setImporting(true);
    try {
      const dataRes = await fetch('/data/outreach-contacts.json');
      if (!dataRes.ok) throw new Error('Could not load contacts file');
      const jsonContacts = await dataRes.json();

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
    const header = 'Name,Outlet,Type,Team,Email,Twitter,Website,Status,Notes';
    const rows = filteredContacts.map(c => {
      const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
      return [esc(c.name), esc(c.outlet), esc(c.type), esc(getTeamName(c.team)), esc(c.email), esc(c.twitter), esc(c.website), esc(c.status), esc(c.notes)].join(',');
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
          description="Media contacts and pitch templates — NHL and MLB markets."
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
          <StatCard icon={<Radio className="h-4 w-4" />} label="Teams" value={stats.teams} />
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
            <Button variant="ghost" size="sm" onClick={handleImportFromFile} disabled={importing}>
              <Upload className="h-4 w-4" /> {importing ? 'Importing…' : 'Import'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </span>
        </div>

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
                  ? 'Click "Import" to load contacts from the data file, or add them manually.'
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
              onClick={() => onCopyEmail(contact.type === 'podcast' || contact.type === 'radio' ? 'podcast' : 'cold')}
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
            {contact.contactedAt && (
              <div>
                <span className="text-gray-400">Contacted: </span>
                <span className="text-gray-700">{new Date(contact.contactedAt).toLocaleDateString()}</span>
              </div>
            )}
            {contact.respondedAt && (
              <div>
                <span className="text-gray-400">Responded: </span>
                <span className="text-gray-700">{new Date(contact.respondedAt).toLocaleDateString()}</span>
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
