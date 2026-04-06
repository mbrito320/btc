import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { NEXUS_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { ChatRequest, Message } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { conversation_id, message, customer_name, customer_account } = body;

    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: 'conversation_id and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();

    // Get or create conversation
    let conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversation_id) as {
      id: string; customer_name: string; customer_account: string; status: string;
    } | null;

    if (!conversation) {
      // Create new conversation
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO conversations (id, customer_id, customer_name, customer_account, status, priority, channel, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'ai_handling', 'normal', 'web_chat', ?, ?)
      `).run(
        conversation_id,
        uuidv4(),
        customer_name || 'Customer',
        customer_account || '****0000',
        now,
        now
      );
      conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversation_id) as typeof conversation;
    }

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Failed to get or create conversation' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Save user message
    const userMsgId = uuidv4();
    db.prepare('INSERT INTO messages (id, conversation_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(
      userMsgId,
      conversation_id,
      'user',
      message,
      new Date().toISOString(),
      null
    );

    // Get conversation history for context
    const history = db.prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? AND role IN ('user', 'assistant', 'agent') ORDER BY created_at ASC"
    ).all(conversation_id) as { role: string; content: string }[];

    // Build messages array for Anthropic (exclude the message we just added, it's already in history)
    const anthropicMessages: Anthropic.MessageParam[] = history.map(msg => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    }));

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        try {
          const streamResponse = await anthropic.messages.stream({
            model: 'claude-opus-4-6',
            max_tokens: 16000,
            thinking: {
              type: 'adaptive',
            },
            system: NEXUS_SYSTEM_PROMPT,
            messages: anthropicMessages,
          });

          for await (const event of streamResponse) {
            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                fullContent += event.delta.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`));
              }
            }
          }

          // Process the complete response for escalation/resolution signals
          const escalateMatch = fullContent.match(/\[ESCALATE:\s*([^\]]+)\]/);
          const resolvedMatch = fullContent.match(/\[RESOLVED:\s*([^\]]+)\]/);

          // Save assistant message
          const asstMsgId = uuidv4();
          db.prepare('INSERT INTO messages (id, conversation_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(
            asstMsgId,
            conversation_id,
            'assistant',
            fullContent,
            new Date().toISOString(),
            null
          );

          // Process compliance flags
          const complianceFlags: Array<{ type: string; description: string; severity: string; detected_at: string }> = [];
          const compliancePatterns = [
            { pattern: /\[COMPLIANCE:UDAAP\]/i, type: 'UDAAP', description: 'Potential UDAAP risk detected in conversation', severity: 'high' },
            { pattern: /\[COMPLIANCE:ELDER_ABUSE\]/i, type: 'ELDER_ABUSE', description: 'Potential elder financial abuse indicators', severity: 'high' },
            { pattern: /\[COMPLIANCE:CFPB\]/i, type: 'CFPB', description: 'Customer indicated regulatory complaint intent', severity: 'medium' },
            { pattern: /\[COMPLIANCE:SCRA\]/i, type: 'SCRA', description: 'Active military service member - SCRA benefits review required', severity: 'medium' },
            { pattern: /\[COMPLIANCE:BSA_AML\]/i, type: 'BSA_AML', description: 'Potential BSA/AML structuring concern', severity: 'high' },
          ];

          for (const cp of compliancePatterns) {
            if (cp.pattern.test(fullContent)) {
              complianceFlags.push({ ...cp, detected_at: new Date().toISOString() });
            }
          }

          // FCA Consumer Duty: detect vulnerable customer escalation
          const isVulnerableCustomer = /VULNERABLE_CUSTOMER/i.test(fullContent);
          if (isVulnerableCustomer) {
            const vcTypeMatch = fullContent.match(/VULNERABLE_CUSTOMER[^—\]]*[—-]\s*([^[]+)/i);
            const vcType = vcTypeMatch ? vcTypeMatch[1].trim().replace(/[[\]]/g, '') : 'UNSPECIFIED';
            db.prepare(`
              UPDATE conversations SET vulnerable_customer_flag = 1, vulnerable_customer_type = ?, priority = 'urgent', updated_at = ?
              WHERE id = ?
            `).run(vcType.substring(0, 255), new Date().toISOString(), conversation_id);

            // Auto-add compliance flag
            if (!complianceFlags.find(f => f.type === 'FCA_VULNERABLE_CUSTOMER')) {
              complianceFlags.push({ type: 'FCA_VULNERABLE_CUSTOMER', description: 'FCA Consumer Duty / FG21/1 Vulnerable Customer Protocol triggered', severity: 'high', detected_at: new Date().toISOString() });
            }

            // Auto-create system annotation for audit trail
            db.prepare('INSERT INTO annotations (id, conversation_id, content, annotation_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
              uuidv4(), conversation_id,
              `SYSTEM AUTO-FLAG: FCA Consumer Duty Vulnerable Customer Protocol triggered.\n\nType: ${vcType}\n\nThis conversation must NOT be returned to AI handling. Specialist team review and supervisor sign-off required before closure.\n\nCompliance reference: FCA Consumer Duty (2023) PS22/9, FG21/1`,
              'compliance', 'SYSTEM', new Date().toISOString()
            );
          }

          if (escalateMatch) {
            const reason = escalateMatch[1].trim();
            const priority = isVulnerableCustomer || fullContent.toLowerCase().includes('fraud') || fullContent.toLowerCase().includes('urgent') ? 'urgent' : 'high';

            db.prepare(`
              UPDATE conversations SET status = 'escalated', escalation_reason = ?, priority = ?, updated_at = ?
              WHERE id = ?
            `).run(reason, priority, new Date().toISOString(), conversation_id);

            // Add system message about escalation
            db.prepare('INSERT INTO messages (id, conversation_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(
              uuidv4(),
              conversation_id,
              'system',
              `Conversation escalated to human agent. Reason: ${reason}`,
              new Date().toISOString(),
              JSON.stringify({ escalation_reason: reason })
            );

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'escalated', reason, vulnerable_customer: isVulnerableCustomer })}\n\n`));
          } else if (resolvedMatch) {
            const summary = resolvedMatch[1].trim();

            db.prepare(`
              UPDATE conversations SET status = 'resolved', ai_summary = ?, updated_at = ?
              WHERE id = ?
            `).run(summary, new Date().toISOString(), conversation_id);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'resolved', summary })}\n\n`));
          } else {
            // Update last activity
            db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(
              new Date().toISOString(),
              conversation_id
            );
          }

          // Update compliance flags if found
          if (complianceFlags.length > 0) {
            const existingConv = db.prepare('SELECT compliance_flags FROM conversations WHERE id = ?').get(conversation_id) as { compliance_flags: string | null };
            const existing = existingConv?.compliance_flags ? JSON.parse(existingConv.compliance_flags) : [];
            const merged = [...existing, ...complianceFlags];
            db.prepare('UPDATE conversations SET compliance_flags = ? WHERE id = ?').run(JSON.stringify(merged), conversation_id);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'compliance_flags', flags: complianceFlags })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'AI service unavailable' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
