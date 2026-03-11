'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Edit, Mail, Send, Filter, Download, Upload,
  ChevronDown, ChevronUp, Search, X, Copy, Check, ExternalLink,
  Users, MailCheck, MessageSquare, Radio
} from 'lucide-react';
import AdminNav from './AdminNav';
import { TEAMS } from '@/lib/teamConfig';

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
  not_contacted: 'bg-gray-500/20 text-gray-300',
  contacted: 'bg-yellow-500/20 text-yellow-300',
  responded: 'bg-blue-500/20 text-blue-300',
  converted: 'bg-green-500/20 text-green-300',
  declined: 'bg-red-500/20 text-red-300',
};

const TEMPLATES = {
  cold: {
    name: 'Cold Outreach',
    subject: 'Free tool for {{team_name}} coverage — NHL Tracker',
    body: `Hi {{contact_name}},

I'm a developer and hockey fan who built NHL Tracker — a free, real-time dashboard for every NHL team. I wanted to share it because I think it could be useful for your {{team_name}} coverage at {{outlet_name}}.

Here's the {{team_name}} page: {{team_url}}

It pulls live data from the NHL API and shows:
- Live scores and game results
- Full standings with playoff odds
- Team stats, streaks, and schedule
- AI-generated blog posts with daily recaps

Buffalo sports radio (WGR 550) recently mentioned it on air and their listeners loved it, so I'm reaching out to media folks in other markets who might find it useful — whether for personal reference, content ideas, or sharing with your audience.

It's completely free, no ads, and works great on mobile. Would love to hear what you think.

Best,
Josh Rabenold
NHL Tracker — {{team_url}}`,
  },
  followup: {
    name: 'Follow-Up',
    subject: 'Re: Free tool for {{team_name}} coverage — NHL Tracker',
    body: `Hi {{contact_name}},

Just wanted to bump this in case it got buried — I built a free real-time dashboard for every NHL team and thought it might be useful for your {{team_name}} coverage.

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

I'm a developer who built NHL Tracker, a free real-time dashboard for every NHL team. I've been listening to {{outlet_name}} and thought this could be a useful resource for your show.

Here's the {{team_name}} page: {{team_url}}

The site has real-time standings, playoff odds (Monte Carlo simulations), and AI-generated daily recaps — all pulled from official NHL data. Buffalo's WGR 550 mentioned it on-air recently and it got a great response from listeners.

A few ways this could work for your show:
- On-air resource: Quick reference for standings, stats, and playoff scenarios during broadcasts
- Listener engagement: Share the link — fans love checking playoff odds daily
- Guest segment: Happy to come on and talk about the data behind playoff odds, team trends, or how the tool works

The site is free, no login required, and works on any device. Would love to chat if you're interested.

Best,
Josh Rabenold
NHL Tracker — {{team_url}}`,
  },
};

const SITE_URL = 'https://nhltracker.com';

function getTeamName(slug: string): string {
  const team = TEAMS[slug];
  return team ? `${team.city} ${team.name}` : slug;
}

function getTeamUrl(slug: string): string {
  return `${SITE_URL}/${slug}`;
}

function fillTemplate(template: string, contact: OutreachContact): string {
  return template
    .replace(/\{\{contact_name\}\}/g, contact.name.split(' ')[0] || contact.name)
    .replace(/\{\{team_name\}\}/g, getTeamName(contact.team))
    .replace(/\{\{team_url\}\}/g, getTeamUrl(contact.team))
    .replace(/\{\{outlet_name\}\}/g, contact.outlet);
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
      // Fetch the local JSON file
      const fileRes = await fetch('/api/outreach/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contacts: [] }), // placeholder
      });
      // Actually, let's load from the data file
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

  // Teams that have contacts
  const teamsWithContacts = useMemo(() => {
    const teams = new Set(contacts.map(c => c.team));
    return Object.keys(TEAMS).filter(k => teams.has(k)).sort();
  }, [contacts]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AdminNav activeTab="outreach" />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard icon={<Users className="w-4 h-4" />} label="Total" value={stats.total} />
          <StatCard icon={<Mail className="w-4 h-4" />} label="With Email" value={stats.withEmail} />
          <StatCard icon={<Send className="w-4 h-4" />} label="Contacted" value={stats.contacted} />
          <StatCard icon={<MessageSquare className="w-4 h-4" />} label="Responded" value={stats.responded} />
          <StatCard icon={<MailCheck className="w-4 h-4" />} label="Converted" value={stats.converted} />
          <StatCard icon={<Radio className="w-4 h-4" />} label="Teams" value={stats.teams} />
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => { setEditingContact(null); setShowAddForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors"
            style={{ background: '#FCB514', color: '#000' }}
          >
            <Plus className="w-4 h-4" /> Add Contact
          </button>
          <button
            onClick={handleImportFromFile}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Import from JSON'}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, outlet, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-400 w-64 focus:outline-none focus:border-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2.5">
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            )}
          </div>
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Teams</option>
            {Object.entries(TEAMS).sort((a, b) => a[1].city.localeCompare(b[1].city)).map(([slug, team]) => (
              <option key={slug} value={slug}>{team.city} {team.name}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as FilterType)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {(filterTeam !== 'all' || filterType !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => { setFilterTeam('all'); setFilterType('all'); setFilterStatus('all'); setSearchQuery(''); }}
              className="px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
          <span className="px-3 py-2 text-sm text-slate-400">
            {filteredContacts.length} of {contacts.length}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Contact List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-slate-600 border-t-yellow-500 rounded-full animate-spin" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-2">No contacts found</p>
            <p className="text-sm">
              {contacts.length === 0
                ? 'Click "Import from JSON" to load contacts from the data file, or add them manually.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
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
      </div>

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
          onCopy={() => {
            handleCopyEmail(showTemplatePreview.contact, showTemplatePreview.template);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
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
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      {/* Main row */}
      <div
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-slate-750"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="shrink-0 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{contact.name}</span>
            <span className="text-xs text-slate-400 truncate">{contact.outlet}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500">{getTeamName(contact.team)}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
              {TYPE_LABELS[contact.type] || contact.type}
            </span>
          </div>
        </div>

        {contact.email && (
          <span className="hidden sm:inline text-xs text-slate-400 truncate max-w-[200px]">
            {contact.email}
          </span>
        )}

        <select
          value={contact.status}
          onChange={e => { e.stopPropagation(); onStatusChange(e.target.value as OutreachContact['status']); }}
          onClick={e => e.stopPropagation()}
          className={`text-xs px-2 py-1 rounded border-0 cursor-pointer focus:outline-none ${STATUS_COLORS[contact.status]}`}
          style={{ background: 'transparent' }}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k} className="bg-slate-800 text-white">{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {contact.email && (
            <button
              onClick={() => onCopyEmail(contact.type === 'podcast' || contact.type === 'radio' ? 'podcast' : 'cold')}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Copy email template"
            >
              {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {contact.email && (
              <div>
                <span className="text-slate-400">Email: </span>
                <a href={`mailto:${contact.email}`} className="text-blue-400 hover:underline">{contact.email}</a>
              </div>
            )}
            {contact.twitter && (
              <div>
                <span className="text-slate-400">Twitter: </span>
                <a
                  href={`https://x.com/${contact.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {contact.twitter}
                </a>
              </div>
            )}
            {contact.website && (
              <div>
                <span className="text-slate-400">Website: </span>
                <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate inline-block max-w-[300px] align-bottom">
                  {contact.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {contact.notes && (
              <div className="sm:col-span-2">
                <span className="text-slate-400">Notes: </span>
                <span className="text-slate-300">{contact.notes}</span>
              </div>
            )}
            {contact.contactedAt && (
              <div>
                <span className="text-slate-400">Contacted: </span>
                <span className="text-slate-300">{new Date(contact.contactedAt).toLocaleDateString()}</span>
              </div>
            )}
            {contact.respondedAt && (
              <div>
                <span className="text-slate-400">Responded: </span>
                <span className="text-slate-300">{new Date(contact.respondedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Template buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-400 py-1">Preview template:</span>
            {Object.entries(TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                onClick={() => onPreviewTemplate(key as keyof typeof TEMPLATES)}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-bold">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name *</label>
              <input
                required
                value={form.name || ''}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Outlet *</label>
              <input
                required
                value={form.outlet || ''}
                onChange={e => setForm({ ...form, outlet: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Team</label>
              <select
                value={form.team || 'sabres'}
                onChange={e => setForm({ ...form, team: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
              >
                {Object.entries(TEAMS).sort((a, b) => a[1].city.localeCompare(b[1].city)).map(([slug, team]) => (
                  <option key={slug} value={slug}>{team.city} {team.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                value={form.type || 'blog'}
                onChange={e => setForm({ ...form, type: e.target.value as OutreachContact['type'] })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email || ''}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Twitter</label>
              <input
                value={form.twitter || ''}
                onChange={e => setForm({ ...form, twitter: e.target.value })}
                placeholder="@handle"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Website</label>
              <input
                value={form.website || ''}
                onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400 resize-none"
            />
          </div>
          {contact && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                value={form.status || 'not_contacted'}
                onChange={e => setForm({ ...form, status: e.target.value as OutreachContact['status'] })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-slate-400"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: '#FCB514', color: '#000' }}
            >
              {saving ? 'Saving...' : contact ? 'Update' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplatePreviewModal({
  contact,
  templateKey,
  onClose,
  onCopy,
}: {
  contact: OutreachContact;
  templateKey: keyof typeof TEMPLATES;
  onClose: () => void;
  onCopy: () => void;
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold">{template.name}</h2>
            <p className="text-xs text-slate-400">To: {contact.name} ({contact.outlet})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div className="mb-3">
            <span className="text-xs text-slate-400">Subject:</span>
            <p className="text-sm font-medium mt-0.5">{subject}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {body}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
            {contact.email && (
              <button
                onClick={handleMailto}
                className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{ background: '#FCB514', color: '#000' }}
              >
                <Mail className="w-4 h-4" /> Open in Mail
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
