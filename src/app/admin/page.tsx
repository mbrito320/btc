'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3, Shield, AlertTriangle, CheckCircle, Clock, Tag,
  TrendingUp, Users, Activity, ArrowLeft, Plus, Trash2,
  RefreshCw, FileText, Mic, ChevronRight, AlertCircle, Lock
} from 'lucide-react';
import { Metrics, Tag as TagType, AuditLogEntry } from '@/lib/types';

const VOICE_CHANNEL_ENABLED = false; // Set to true when NVIDIA PersonaPlex integration is ready

const TAG_CATEGORIES = ['transaction_type', 'issue_type', 'product', 'regulatory', 'custom'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  transaction_type: 'Transaction Type',
  issue_type: 'Issue Type',
  product: 'Product',
  regulatory: 'Regulatory',
  custom: 'Custom',
};

const PRESET_COLORS = [
  '#3b82f6','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#f59e0b','#10b981','#14b8a6','#0ea5e9','#6366f1',
  '#dc2626','#b91c1c','#7c3aed','#0891b2','#16a34a',
];

function MetricCard({
  icon, label, value, sub, accent = 'teal', alert = false
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent?: string; alert?: boolean;
}) {
  const accentMap: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${alert ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 border ${accentMap[accent] || accentMap.teal}`}>
        {icon}
      </div>
      <div className={`text-2xl font-bold mb-0.5 ${alert ? 'text-red-700' : 'text-slate-800'}`}>{value}</div>
      <div className="text-sm font-medium text-slate-600">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tags, setTags] = useState<(TagType & { usage_count: number })[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tags' | 'audit' | 'voice'>('overview');

  // New tag form
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newTagCategory, setNewTagCategory] = useState<typeof TAG_CATEGORIES[number]>('custom');
  const [savingTag, setSavingTag] = useState(false);
  const [tagError, setTagError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, tagsRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/tags'),
      ]);
      const [m, t] = await Promise.all([metricsRes.json(), tagsRes.json()]);
      setMetrics(m);
      setTags(t);

      // Fetch recent audit log entries via conversations API as proxy
      // (audit_log is internal — expose subset via metrics endpoint)
      if (m.audit_log) setAuditLog(m.audit_log);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createTag = async () => {
    if (!newTagName.trim()) { setTagError('Tag name is required'); return; }
    setSavingTag(true);
    setTagError('');
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, category: newTagCategory }),
      });
      if (!res.ok) {
        const err = await res.json();
        setTagError(err.error || 'Failed to create tag');
        return;
      }
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setNewTagCategory('custom');
      await fetchData();
    } finally {
      setSavingTag(false);
    }
  };

  const resolutionRate = metrics ? Math.round(metrics.ai_resolution_rate) : 0;
  const vulnerableActive = metrics?.vulnerable_customers_active ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #7c3aed)' }}>N</div>
          <div className="flex-1">
            <div className="font-semibold text-slate-800">Admin Panel</div>
            <div className="text-xs text-slate-500">Nexus Financial AI Platform</div>
          </div>
          <button onClick={fetchData} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {vulnerableActive > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 border border-red-200 rounded-full text-red-700 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              {vulnerableActive} Vulnerable Customer{vulnerableActive > 1 ? 's' : ''} Active
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0">
          {(['overview', 'tags', 'audit', ...(VOICE_CHANNEL_ENABLED ? ['voice'] : [])] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'voice' ? 'Voice Channel' : tab === 'audit' ? 'Audit Log' : tab === 'overview' ? 'Overview' : 'Tag Management'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
        )}

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && !loading && metrics && (
          <div className="space-y-6">
            {/* Vulnerable customer alert */}
            {vulnerableActive > 0 && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl">
                <Shield className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-700 text-sm">
                    FCA Consumer Duty Alert — {vulnerableActive} Vulnerable Customer{vulnerableActive > 1 ? 's' : ''} Require Attention
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    These conversations must not be AI-handled and require specialist team review and supervisor sign-off before closure. Ensure Vulnerability Assessment Forms are completed.
                  </div>
                  <Link href="/agent?filter=vulnerable" className="text-xs text-red-700 font-semibold underline mt-1 inline-block">
                    View in Agent Dashboard →
                  </Link>
                </div>
              </div>
            )}

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <MetricCard icon={<Activity className="w-5 h-5" />} label="Today's Conversations" value={metrics.today_conversations} sub="All channels" accent="blue" />
              <MetricCard icon={<TrendingUp className="w-5 h-5" />} label="AI Resolution Rate" value={`${resolutionRate}%`} sub="Resolved without escalation" accent="green" />
              <MetricCard icon={<Clock className="w-5 h-5" />} label="Avg Handle Time" value={`${Math.round(metrics.avg_handle_time_minutes)}m`} sub="All conversations" accent="teal" />
              <MetricCard icon={<Users className="w-5 h-5" />} label="Active Escalations" value={metrics.active_escalations} sub="Requires agent" accent="amber" />
              <MetricCard icon={<AlertTriangle className="w-5 h-5" />} label="Compliance Flags" value={metrics.compliance_flags_today} sub="Today" accent="red" alert={metrics.compliance_flags_today > 0} />
              <MetricCard icon={<Shield className="w-5 h-5" />} label="Vulnerable Customers" value={vulnerableActive} sub="Active cases" accent="red" alert={vulnerableActive > 0} />
            </div>

            {/* Today's breakdown */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="font-semibold text-slate-700 text-sm mb-4">Today's Outcomes</div>
                <div className="space-y-3">
                  {[
                    { label: 'AI Resolved', value: metrics.ai_handled_today, color: 'bg-blue-500' },
                    { label: 'Escalated', value: metrics.escalated_today, color: 'bg-amber-500' },
                    { label: 'Resolved', value: metrics.resolved_today, color: 'bg-green-500' },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">{row.label}</span>
                        <span className="font-semibold text-slate-700">{row.value}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{ width: `${metrics.today_conversations > 0 ? Math.round((row.value / metrics.today_conversations) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="font-semibold text-slate-700 text-sm mb-4">Top Tags Today</div>
                <div className="space-y-2">
                  {metrics.top_tags?.slice(0, 6).map(tag => (
                    <div key={tag.tag_id} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tag.color }} />
                      <span className="text-xs text-slate-600 flex-1 truncate">{tag.tag_name}</span>
                      <span className="text-xs font-semibold text-slate-700">{tag.count}</span>
                    </div>
                  ))}
                  {(!metrics.top_tags || metrics.top_tags.length === 0) && (
                    <div className="text-xs text-slate-400">No tag data yet</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="font-semibold text-slate-700 text-sm mb-4">Escalation Reasons</div>
                <div className="space-y-2">
                  {metrics.escalation_reasons?.slice(0, 6).map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                        {r.count}
                      </div>
                      <span className="text-xs text-slate-600 leading-tight">{r.reason}</span>
                    </div>
                  ))}
                  {(!metrics.escalation_reasons || metrics.escalation_reasons.length === 0) && (
                    <div className="text-xs text-slate-400">No escalations yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Compliance summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-slate-500" />
                <div className="font-semibold text-slate-700 text-sm">Compliance & Regulatory Summary</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  { label: 'FCA Consumer Duty', value: 'Compliant', color: 'text-green-700 bg-green-50 border-green-200' },
                  { label: 'Audit Trail', value: 'Active', color: 'text-green-700 bg-green-50 border-green-200' },
                  { label: 'Vulnerable Customer Protocol', value: vulnerableActive > 0 ? `${vulnerableActive} Active` : 'None Active', color: vulnerableActive > 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200' },
                  { label: 'AI Transparency', value: 'Disclosed', color: 'text-green-700 bg-green-50 border-green-200' },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg border px-3 py-2.5 ${item.color}`}>
                    <div className="font-semibold">{item.value}</div>
                    <div className="text-xs opacity-80 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAG MANAGEMENT ── */}
        {activeTab === 'tags' && !loading && (
          <div className="space-y-6">
            {/* Create new tag */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="font-semibold text-slate-700 text-sm mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create New Tag
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-48">
                  <label className="block text-xs text-slate-500 mb-1">Tag Name</label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="e.g. SCRA Eligible"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Category</label>
                  <select
                    value={newTagCategory}
                    onChange={e => setNewTagCategory(e.target.value as typeof newTagCategory)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {TAG_CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Colour</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${newTagColor === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Preview</div>
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: newTagColor + 'cc', border: `1px solid ${newTagColor}60` }}>
                    {newTagName || 'Tag Name'}
                  </div>
                </div>
                <button
                  onClick={createTag}
                  disabled={savingTag || !newTagName.trim()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingTag ? 'Creating…' : 'Create Tag'}
                </button>
              </div>
              {tagError && <div className="text-xs text-red-600 mt-2">{tagError}</div>}
            </div>

            {/* Tag list by category */}
            {TAG_CATEGORIES.map(cat => {
              const catTags = tags.filter(t => t.category === cat);
              if (catTags.length === 0) return null;
              return (
                <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-sm font-semibold text-slate-700">{CATEGORY_LABELS[cat]}</span>
                    <span className="ml-2 text-xs text-slate-400">{catTags.length} tag{catTags.length !== 1 ? 's' : ''}</span>
                    {cat === 'regulatory' && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                        Compliance-critical
                      </span>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-100">
                        <th className="text-left px-5 py-2.5 font-medium">Tag</th>
                        <th className="text-left px-5 py-2.5 font-medium">Used</th>
                        <th className="text-left px-5 py-2.5 font-medium">Added by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catTags.map(tag => (
                        <tr key={tag.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: tag.color }} />
                              <span className="font-medium text-slate-700">{tag.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-slate-500 text-xs">{tag.usage_count || 0}×</td>
                          <td className="px-5 py-2.5 text-slate-400 text-xs">System / Agent</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* ── AUDIT LOG ── */}
        {activeTab === 'audit' && !loading && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Immutable Audit Trail</strong> — This log is append-only and cannot be modified or deleted. It is designed to satisfy FCA, CFPB, and GDPR regulatory examination requirements. All events are timestamped to the second.
              </div>
            </div>

            {auditLog.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Audit events appear here as conversations are processed.
                <div className="text-xs mt-1">Events include escalations, vulnerable customer detections, resolutions, and compliance flags.</div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium">Time</th>
                      <th className="text-left px-4 py-3 font-medium">Event</th>
                      <th className="text-left px-4 py-3 font-medium">Actor</th>
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map(entry => (
                      <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            entry.event_type.includes('VULNERABLE') ? 'bg-red-100 text-red-700 border-red-200' :
                            entry.event_type.includes('ESCALATION') ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            entry.event_type.includes('RESOLVED') ? 'bg-green-100 text-green-700 border-green-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>{entry.event_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{entry.actor}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-700 max-w-sm truncate">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── VOICE CHANNEL (PersonaPlex Roadmap) ── */}
        {activeTab === 'voice' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0">
                  <Mic className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-bold text-slate-800">Voice Channel — NVIDIA PersonaPlex</h2>
                    <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Extend first-line defence to telephone banking using NVIDIA PersonaPlex — a real-time, full-duplex speech-to-speech AI model with
                    precise persona and voice control. Designed for exactly this use case: consistent branded voice, low latency, and natural turn-taking.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Consistent Brand Voice',
                  desc: 'Define a professional, empathetic persona via text prompt. Every call sounds like the same trusted Nexus Financial advisor — no variance between agents.',
                  icon: <Users className="w-5 h-5 text-purple-600" />,
                },
                {
                  title: 'Full-Duplex Low Latency',
                  desc: 'Built on the Moshi architecture for natural conversation with minimal lag. Customers don\'t notice they\'re speaking to AI until they need to.',
                  icon: <Activity className="w-5 h-5 text-purple-600" />,
                },
                {
                  title: 'Same Escalation Rules',
                  desc: 'All existing protocols — vulnerable customer hard stop, fraud escalation, Reg E thresholds — apply identically to voice. One ruleset, all channels.',
                  icon: <Shield className="w-5 h-5 text-purple-600" />,
                },
                {
                  title: 'Warm Handoff to Human',
                  desc: 'When the AI escalates a voice call, the human agent receives the same AI brief already used in web chat. Customer doesn\'t repeat themselves.',
                  icon: <UserIcon className="w-5 h-5 text-purple-600" />,
                },
              ].map(card => (
                <div key={card.title} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                      {card.icon}
                    </div>
                    <div className="font-semibold text-slate-700 text-sm">{card.title}</div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-800 rounded-xl p-5 text-sm text-slate-300">
              <div className="font-semibold text-white mb-2 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-purple-400" />
                Integration Point (Platform Architecture)
              </div>
              <div className="text-xs text-slate-400 font-mono bg-slate-900 rounded-lg p-3 leading-relaxed">
                {`// PersonaPlex hooks into the same conversation pipeline\n// Channel: 'phone' — already in DB schema\n// SIP trunk → PersonaPlex STT → ARIA system prompt → PersonaPlex TTS\n// Escalation signals trigger warm transfer to IVR/agent queue\n// Full conversation transcript saved identically to web chat`}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Inline icon to avoid import collision
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
