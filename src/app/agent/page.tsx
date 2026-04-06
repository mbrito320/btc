'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, Clock, AlertTriangle, CheckCircle, Users, MessageSquare, Tag, RefreshCw, ChevronLeft, Zap, User, AlertCircle } from 'lucide-react';
import { ConversationWithTags } from '@/lib/types';

type FilterTab = 'all' | 'needs_attention' | 'escalated' | 'resolved' | 'ai_handling';

const STATUS_CONFIG = {
  ai_handling: { label: 'AI Handling', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500', border: 'border-l-blue-500' },
  escalated: { label: 'Escalated', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', border: 'border-l-amber-500' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', border: 'border-l-slate-400' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  low: { label: 'Low', color: 'bg-green-100 text-green-700 border-green-200' },
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(text: string, length: number): string {
  if (!text) return '';
  return text.length > length ? text.slice(0, length) + '...' : text;
}

function ConversationCard({ conv, isSelected }: { conv: ConversationWithTags; isSelected: boolean }) {
  const statusCfg = STATUS_CONFIG[conv.status] || STATUS_CONFIG.ai_handling;
  const priorityCfg = PRIORITY_CONFIG[conv.priority] || PRIORITY_CONFIG.normal;
  const hasComplianceFlags = conv.compliance_flags && (
    typeof conv.compliance_flags === 'string'
      ? JSON.parse(conv.compliance_flags).length > 0
      : (conv.compliance_flags as unknown[]).length > 0
  );
  // FCA Consumer Duty: vulnerable customer gets highest visual priority
  const isVulnerable = (conv as ConversationWithTags & { vulnerable_customer_flag?: number }).vulnerable_customer_flag === 1;
  const borderClass = isVulnerable ? 'border-l-red-600' : statusCfg.border;

  return (
    <Link href={`/agent/${conv.id}`}>
      <div className={`p-4 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer border-l-4 ${borderClass} ${isSelected ? 'bg-slate-700/50' : ''} ${isVulnerable ? 'bg-red-950/20' : ''}`}>
        {isVulnerable && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-900/40 rounded-md border border-red-700/50">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-xs text-red-300 font-semibold">VULNERABLE CUSTOMER — FCA Protocol Active</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
              {conv.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm text-slate-200 truncate">{conv.customer_name}</div>
              <div className="text-xs text-slate-500">{conv.customer_account}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-slate-500">{timeAgo(conv.updated_at)}</span>
            {hasComplianceFlags && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
          {truncate(conv.last_message || conv.ai_summary || 'No messages yet', 100)}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${statusCfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}></span>
            {statusCfg.label}
          </span>

          {conv.priority !== 'normal' && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${priorityCfg.color}`}>
              {priorityCfg.label}
            </span>
          )}

          {conv.tags?.slice(0, 2).map(tag => (
            <span
              key={tag.id}
              className="px-2 py-0.5 rounded-md text-xs font-medium text-white"
              style={{ backgroundColor: tag.color + 'cc', border: `1px solid ${tag.color}40` }}
            >
              {tag.name}
            </span>
          ))}

          {(conv.tags?.length || 0) > 2 && (
            <span className="text-xs text-slate-500">+{conv.tags.length - 2}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AgentPage() {
  const [conversations, setConversations] = useState<ConversationWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === 'escalated') params.set('status', 'escalated');
      else if (filter === 'resolved') params.set('status', 'resolved');
      else if (filter === 'ai_handling') params.set('status', 'ai_handling');
      if (search) params.set('search', search);

      const res = await fetch(`/api/conversations?${params}`);
      const data = await res.json();

      let filtered = data;
      if (filter === 'needs_attention') {
        filtered = data.filter((c: ConversationWithTags) =>
          c.status === 'escalated' ||
          (c.compliance_flags && (
            typeof c.compliance_flags === 'string'
              ? JSON.parse(c.compliance_flags as unknown as string).length > 0
              : (c.compliance_flags as unknown[]).length > 0
          )) ||
          c.priority === 'urgent' || c.priority === 'high'
        );
      }

      setConversations(filtered);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const stats = {
    all: conversations.length,
    needs_attention: conversations.filter(c =>
      c.status === 'escalated' || c.priority === 'urgent' || c.priority === 'high'
    ).length,
    escalated: conversations.filter(c => c.status === 'escalated').length,
    ai_handling: conversations.filter(c => c.status === 'ai_handling').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
  };

  const filterTabs: { key: FilterTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'All', icon: <MessageSquare className="w-3.5 h-3.5" />, count: stats.all },
    { key: 'needs_attention', label: 'Needs Attention', icon: <AlertCircle className="w-3.5 h-3.5" />, count: stats.needs_attention },
    { key: 'escalated', label: 'Escalated', icon: <Users className="w-3.5 h-3.5" />, count: stats.escalated },
    { key: 'ai_handling', label: 'AI Active', icon: <Zap className="w-3.5 h-3.5" />, count: stats.ai_handling },
    { key: 'resolved', label: 'Resolved', icon: <CheckCircle className="w-3.5 h-3.5" />, count: stats.resolved },
  ];

  return (
    <div className="min-h-screen bg-[#0f1629] flex flex-col">
      {/* Header */}
      <header className="bg-[#0a0f1e] border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" />
              <span>Portal</span>
            </Link>
            <div className="h-5 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <span className="text-teal-400 font-bold text-sm">N</span>
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Nexus Financial</div>
                <div className="text-teal-400 text-xs font-medium">Agent Dashboard</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Updated {lastRefresh.toLocaleTimeString()}</span>
              <RefreshCw className="w-3 h-3 animate-spin text-teal-500" style={{ animationDuration: '3s', animationPlayState: loading ? 'running' : 'paused' }} />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 text-sm font-medium">Agent View</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-[#0a0f1e] border-r border-slate-700/50 flex flex-col">
          {/* Quick stats */}
          <div className="p-4 grid grid-cols-3 gap-3 border-b border-slate-700/50">
            <div className="text-center p-2 rounded-lg bg-slate-800/50">
              <div className="text-lg font-bold text-amber-400">{stats.escalated}</div>
              <div className="text-xs text-slate-500">Escalated</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-800/50">
              <div className="text-lg font-bold text-blue-400">{stats.ai_handling}</div>
              <div className="text-xs text-slate-500">AI Active</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-800/50">
              <div className="text-lg font-bold text-emerald-400">{stats.resolved}</div>
              <div className="text-xs text-slate-500">Resolved</div>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-slate-700/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="p-3 border-b border-slate-700/50">
            <div className="flex flex-col gap-1">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {tab.icon}
                    <span>{tab.label}</span>
                  </div>
                  {tab.count > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      filter === tab.key ? 'bg-teal-500/30 text-teal-300' :
                      tab.key === 'needs_attention' && tab.count > 0 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-teal-500" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-500 text-sm">No conversations found</p>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationCard key={conv.id} conv={conv} isSelected={false} />
              ))
            )}
          </div>
        </aside>

        {/* Main content area - prompt to select conversation */}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-300 mb-3">Select a Conversation</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
              Choose a conversation from the sidebar to view details, manage tags, add annotations, and assist customers.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <Zap className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-400 mb-1">{stats.ai_handling}</div>
                <div className="text-xs text-slate-500">AI Handling</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-400 mb-1">{stats.escalated}</div>
                <div className="text-xs text-slate-500">Need Attention</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-emerald-400 mb-1">{stats.resolved}</div>
                <div className="text-xs text-slate-500">Resolved</div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5" />
              <span>Auto-refreshes every 3 seconds</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
