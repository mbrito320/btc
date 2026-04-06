'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Tag, FileText, AlertTriangle, CheckCircle, Clock,
  User, Bot, UserCheck, Shield, AlertCircle, Plus, X, Send,
  ChevronDown, MessageSquare
} from 'lucide-react';
import { ConversationWithTags, Message, Tag as TagType, Annotation } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  ai_handling: 'AI Handling',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  ai_handling: 'bg-blue-100 text-blue-800 border-blue-200',
  escalated: 'bg-amber-100 text-amber-800 border-amber-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ANNOTATION_CONFIG = {
  note:             { label: 'Note',             color: 'bg-blue-100 text-blue-700 border-blue-200' },
  flag:             { label: 'Flag',             color: 'bg-orange-100 text-orange-700 border-orange-200' },
  compliance:       { label: 'Compliance',       color: 'bg-red-100 text-red-700 border-red-200' },
  action_required:  { label: 'Action Required',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderContent(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[ESCALATE:[^\]]*\]/gi, '')
    .replace(/\[RESOLVED:[^\]]*\]/gi, '')
    .replace(/\[COMPLIANCE:[^\]]*\]/gi, '')
    .replace(/\n/g, '<br/>')
    .trim();
}

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [conv, setConv] = useState<ConversationWithTags | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [activeTab, setActiveTab] = useState<'tags' | 'annotations' | 'escalation'>('annotations');
  const [loading, setLoading] = useState(true);

  // Annotation form
  const [annotationText, setAnnotationText] = useState('');
  const [annotationType, setAnnotationType] = useState<'note' | 'flag' | 'compliance' | 'action_required'>('note');
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Tag management
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [convRes, msgRes, annRes, tagsRes] = await Promise.all([
        fetch(`/api/conversations/${id}`),
        fetch(`/api/conversations/${id}/messages`),
        fetch(`/api/conversations/${id}/annotations`),
        fetch('/api/tags'),
      ]);
      const [convData, msgData, annData, tagsData] = await Promise.all([
        convRes.json(), msgRes.json(), annRes.json(), tagsRes.json()
      ]);
      setConv(convData);
      setMessages(msgData);
      setAnnotations(annData);
      setAllTags(tagsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Poll for new messages when AI is handling
  useEffect(() => {
    if (!conv || conv.status !== 'ai_handling') return;
    const t = setInterval(fetchAll, 4000);
    return () => clearInterval(t);
  }, [conv, fetchAll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addAnnotation = async () => {
    if (!annotationText.trim()) return;
    setSavingAnnotation(true);
    try {
      await fetch(`/api/conversations/${id}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: annotationText, annotation_type: annotationType, created_by: 'Agent' }),
      });
      setAnnotationText('');
      await fetchAll();
    } finally {
      setSavingAnnotation(false);
    }
  };

  const addTag = async (tagId: string) => {
    await fetch(`/api/conversations/${id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId, added_by: 'Agent' }),
    });
    setShowTagPicker(false);
    fetchAll();
  };

  const removeTag = async (tagId: string) => {
    await fetch(`/api/conversations/${id}/tags/${tagId}`, { method: 'DELETE' });
    fetchAll();
  };

  const escalate = async (reason: string) => {
    await fetch(`/api/conversations/${id}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    fetchAll();
  };

  const resolve = async () => {
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    fetchAll();
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-500 text-sm">Loading conversation…</div>
    </div>
  );

  if (!conv) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-slate-500 mb-4">Conversation not found</div>
        <Link href="/agent" className="text-teal-600 hover:underline text-sm">← Back to dashboard</Link>
      </div>
    </div>
  );

  const isVulnerable = (conv as ConversationWithTags & { vulnerable_customer_flag?: number }).vulnerable_customer_flag === 1;
  const vulnerableType = (conv as ConversationWithTags & { vulnerable_customer_type?: string }).vulnerable_customer_type;

  const complianceFlags: Array<{ type: string; description: string; severity: string }> = (() => {
    try {
      return conv.compliance_flags ? JSON.parse(conv.compliance_flags as unknown as string) : [];
    } catch { return []; }
  })();

  const currentTagIds = new Set(conv.tags?.map(t => t.id) || []);
  const availableTags = allTags.filter(t =>
    !currentTagIds.has(t.id) &&
    (tagSearch === '' || t.name.toLowerCase().includes(tagSearch.toLowerCase()))
  );

  const roleIcon = (role: string) => {
    if (role === 'user') return <User className="w-4 h-4 text-white" />;
    if (role === 'agent') return <UserCheck className="w-4 h-4 text-white" />;
    if (role === 'system') return null;
    return <Bot className="w-4 h-4 text-white" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-full px-4 py-3 flex items-center gap-3">
          <Link href="/agent" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
            {conv.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">{conv.customer_name}</span>
              <span className="text-sm text-slate-500">{conv.customer_account}</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[conv.status]}`}>
                {STATUS_LABELS[conv.status]}
              </span>
              {isVulnerable && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                  <Shield className="w-3 h-3" />
                  VULNERABLE CUSTOMER
                </span>
              )}
              {complianceFlags.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                  <AlertTriangle className="w-3 h-3" />
                  {complianceFlags.length} Compliance Flag{complianceFlags.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Started {timeAgo(conv.created_at)} · Last updated {timeAgo(conv.updated_at)}
              {conv.channel && ` · ${conv.channel.replace('_', ' ')}`}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {conv.status !== 'resolved' && conv.status !== 'closed' && (
              <button
                onClick={resolve}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Resolve
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Vulnerable Customer Alert Banner — unmissable per FCA obligation */}
      {isVulnerable && (
        <div className="bg-red-600 text-white px-4 py-3">
          <div className="max-w-full flex items-start gap-3">
            <Shield className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">⚠ VULNERABLE CUSTOMER PROTOCOL ACTIVE (FCA Consumer Duty 2023 / FG21/1)</div>
              {vulnerableType && <div className="text-xs text-red-200 mt-0.5">Category: {vulnerableType}</div>}
              <div className="text-xs text-red-100 mt-1">
                This conversation MUST NOT be returned to AI handling. Specialist team review and supervisor sign-off required before closure.
                Ensure LPA/POA status is verified. Complete Vulnerability Assessment Form.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary bar */}
      {conv.ai_summary && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
          <div className="max-w-full flex items-start gap-2">
            <Bot className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-blue-700 mr-2">AI Summary:</span>
              <span className="text-xs text-blue-700">{conv.ai_summary}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Messages Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => {
              if (msg.role === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="text-xs text-slate-400 bg-slate-100 rounded-full px-3 py-1 border border-slate-200 max-w-md text-center">
                      {msg.content}
                    </div>
                  </div>
                );
              }
              const isUser = msg.role === 'user';
              const isAgent = msg.role === 'agent';
              const bgColor = isUser
                ? 'bg-teal-600 text-white'
                : isAgent
                  ? 'bg-blue-100 text-slate-800 border border-blue-200'
                  : 'bg-white text-slate-800 border border-slate-100 shadow-sm';
              const avatarColor = isUser ? '#0d9488' : isAgent ? '#1d4ed8' : '#1e3a5f';

              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: avatarColor }}>
                      {roleIcon(msg.role)}
                    </div>
                  )}
                  <div className={`max-w-sm lg:max-w-md xl:max-w-lg rounded-2xl ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'} px-4 py-2.5 text-sm ${bgColor}`}>
                    {isAgent && <div className="text-xs font-semibold text-blue-600 mb-1">Agent</div>}
                    <div
                      className="chat-content"
                      dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                    />
                    <div className={`text-xs mt-1 ${isUser ? 'text-teal-200' : 'text-slate-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 xl:w-96 border-l border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            {(['annotations', 'tags', 'escalation'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-teal-600 text-teal-700 bg-teal-50/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'escalation' ? 'Compliance' : tab}
                {tab === 'annotations' && annotations.length > 0 && (
                  <span className="ml-1 bg-slate-200 text-slate-600 rounded-full px-1.5 text-xs">{annotations.length}</span>
                )}
                {tab === 'escalation' && (complianceFlags.length > 0 || isVulnerable) && (
                  <span className="ml-1 bg-red-100 text-red-600 rounded-full px-1.5 text-xs">!</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* Annotations Tab */}
            {activeTab === 'annotations' && (
              <div className="space-y-3">
                {annotations.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-4">No annotations yet</div>
                )}
                {annotations.map(ann => (
                  <div key={ann.id} className="text-xs bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${ANNOTATION_CONFIG[ann.annotation_type]?.color}`}>
                        {ANNOTATION_CONFIG[ann.annotation_type]?.label}
                      </span>
                      <span className="text-slate-400">{timeAgo(ann.created_at)}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                    <div className="text-slate-400 mt-1.5">— {ann.created_by}</div>
                  </div>
                ))}

                {/* Add annotation form */}
                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="text-xs font-semibold text-slate-600 mb-2">Add Annotation</div>
                  <select
                    value={annotationType}
                    onChange={e => setAnnotationType(e.target.value as typeof annotationType)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="note">Note</option>
                    <option value="flag">Flag</option>
                    <option value="compliance">Compliance</option>
                    <option value="action_required">Action Required</option>
                  </select>
                  <textarea
                    value={annotationText}
                    onChange={e => setAnnotationText(e.target.value)}
                    placeholder="Add a note, flag, or compliance record…"
                    rows={3}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-teal-500 mb-2"
                  />
                  <button
                    onClick={addAnnotation}
                    disabled={!annotationText.trim() || savingAnnotation}
                    className="w-full py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {savingAnnotation ? 'Saving…' : 'Add Annotation'}
                  </button>
                </div>
              </div>
            )}

            {/* Tags Tab */}
            {activeTab === 'tags' && (
              <div className="space-y-3">
                {/* Current tags */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">Current Tags</div>
                  {(!conv.tags || conv.tags.length === 0) && (
                    <div className="text-xs text-slate-400">No tags yet</div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {conv.tags?.map(tag => (
                      <div key={tag.id} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: tag.color + 'cc', border: `1px solid ${tag.color}60` }}>
                        {tag.name}
                        <button onClick={() => removeTag(tag.id)} className="hover:bg-black/20 rounded-full p-0.5 transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add tag */}
                <div className="border-t border-slate-200 pt-3">
                  <div className="text-xs font-semibold text-slate-600 mb-2">Add Tag</div>
                  <input
                    type="text"
                    placeholder="Search tags…"
                    value={tagSearch}
                    onChange={e => setTagSearch(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => addTag(tag.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-left transition-colors"
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tag.color }} />
                        <span className="text-xs text-slate-700">{tag.name}</span>
                        <span className="text-xs text-slate-400 ml-auto capitalize">{tag.category.replace('_', ' ')}</span>
                      </button>
                    ))}
                    {availableTags.length === 0 && (
                      <div className="text-xs text-slate-400 text-center py-2">No matching tags</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === 'escalation' && (
              <div className="space-y-3">
                {/* Vulnerable customer section */}
                {isVulnerable && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-bold text-red-700">VULNERABLE CUSTOMER ACTIVE</span>
                    </div>
                    {vulnerableType && (
                      <div className="text-xs text-red-600 mb-2">
                        <strong>Category:</strong> {vulnerableType.replace(/_/g, ' ')}
                      </div>
                    )}
                    <div className="text-xs text-red-600 space-y-1">
                      <div className="font-semibold">Required actions (FCA FG21/1):</div>
                      <ul className="list-disc list-inside space-y-0.5 text-red-500">
                        <li>Verify LPA / POA status on account</li>
                        <li>Complete Vulnerability Assessment Form</li>
                        <li>Log in Vulnerable Customer Register</li>
                        <li>Supervisor sign-off before closure</li>
                        <li>Offer accessible format correspondence</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Compliance flags */}
                {complianceFlags.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 mb-2">
                      Compliance Flags ({complianceFlags.length})
                    </div>
                    {complianceFlags.map((flag, i) => (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs font-semibold text-red-700">{flag.type}</span>
                          <span className={`ml-auto text-xs px-1.5 rounded font-medium ${
                            flag.severity === 'high' ? 'bg-red-100 text-red-600' :
                            flag.severity === 'medium' ? 'bg-orange-100 text-orange-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>{flag.severity}</span>
                        </div>
                        <p className="text-xs text-red-600">{flag.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Escalation reason */}
                {conv.escalation_reason && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-amber-700 mb-1">Escalation Reason</div>
                    <p className="text-xs text-amber-700">{conv.escalation_reason}</p>
                  </div>
                )}

                {/* Manual escalation */}
                {conv.status === 'ai_handling' && (
                  <div className="border-t border-slate-200 pt-3">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Manual Escalation</div>
                    <div className="space-y-1.5">
                      {[
                        'Customer request — prefers human agent',
                        'VULNERABLE_CUSTOMER — FCA protocol',
                        'Complex issue requires specialist',
                        'Compliance concern identified',
                      ].map(reason => (
                        <button
                          key={reason}
                          onClick={() => escalate(reason)}
                          className="w-full text-left text-xs px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isVulnerable && complianceFlags.length === 0 && !conv.escalation_reason && conv.status === 'ai_handling' && (
                  <div className="text-center text-xs text-slate-400 py-4">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    No compliance flags detected
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
