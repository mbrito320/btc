// Core entity types for Nexus Financial AI Customer Service Platform

export type ConversationStatus = 'ai_handling' | 'escalated' | 'resolved' | 'closed';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type MessageRole = 'user' | 'assistant' | 'agent' | 'system';
export type TagCategory = 'transaction_type' | 'issue_type' | 'product' | 'regulatory' | 'custom';
export type AnnotationType = 'note' | 'flag' | 'compliance' | 'action_required';
export type ConversationChannel = 'web_chat' | 'mobile' | 'phone' | 'email';

export interface Conversation {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_account: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  channel: ConversationChannel;
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  escalation_reason: string | null;
  assigned_agent: string | null;
  compliance_flags: string | null; // JSON array of flag strings
}

export interface ConversationWithTags extends Conversation {
  tags: Tag[];
  message_count?: number;
  last_message?: string;
  last_message_at?: string;
  annotation_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  metadata: string | null; // JSON
}

export interface MessageWithMetadata extends Omit<Message, 'metadata'> {
  metadata: Record<string, unknown> | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  category: TagCategory;
  usage_count?: number;
}

export interface ConversationTag {
  conversation_id: string;
  tag_id: string;
  added_at: string;
  added_by: string;
}

export interface Annotation {
  id: string;
  conversation_id: string;
  content: string;
  annotation_type: AnnotationType;
  created_by: string;
  created_at: string;
}

export interface Metrics {
  today_conversations: number;
  ai_resolution_rate: number;
  avg_handle_time_minutes: number;
  active_escalations: number;
  compliance_flags_today: number;
  total_conversations: number;
  resolved_today: number;
  escalated_today: number;
  ai_handled_today: number;
  hourly_volume: HourlyVolume[];
  top_tags: TagUsage[];
  escalation_reasons: EscalationReason[];
}

export interface HourlyVolume {
  hour: string;
  count: number;
}

export interface TagUsage {
  tag_id: string;
  tag_name: string;
  color: string;
  count: number;
}

export interface EscalationReason {
  reason: string;
  count: number;
}

// API request/response types

export interface ChatRequest {
  conversation_id: string;
  message: string;
  customer_name?: string;
  customer_account?: string;
}

export interface CreateConversationRequest {
  customer_name: string;
  customer_account?: string;
  channel?: ConversationChannel;
  initial_message?: string;
}

export interface UpdateConversationRequest {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  assigned_agent?: string;
  ai_summary?: string;
  escalation_reason?: string;
  compliance_flags?: string[];
}

export interface AddTagRequest {
  tag_id: string;
  added_by?: string;
}

export interface CreateTagRequest {
  name: string;
  color: string;
  category: TagCategory;
}

export interface CreateAnnotationRequest {
  content: string;
  annotation_type: AnnotationType;
  created_by?: string;
}

export interface EscalateRequest {
  reason: string;
  priority?: ConversationPriority;
  assigned_agent?: string;
}

export interface ConversationFilters {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  search?: string;
  assigned_agent?: string;
  limit?: number;
  offset?: number;
}

// AI/System types

export interface ComplianceFlag {
  type: 'UDAAP' | 'CFPB' | 'SCRA' | 'ELDER_ABUSE' | 'FAIR_LENDING' | 'BSA_AML';
  description: string;
  severity: 'low' | 'medium' | 'high';
  message_id?: string;
  detected_at: string;
}

export interface AIEscalationSignal {
  type: 'escalate' | 'resolved';
  reason?: string;
  summary?: string;
}

export interface MockAccountData {
  account_number: string;
  customer_name: string;
  account_type: string;
  available_balance: number;
  current_balance: number;
  last_4_digits: string;
  recent_transactions: MockTransaction[];
}

export interface MockTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  status: 'posted' | 'pending';
  category: string;
}
