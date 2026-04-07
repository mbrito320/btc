import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { UpdateConversationRequest } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown> | null;

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const tags = db.prepare(`
      SELECT t.*, ct.added_at, ct.added_by
      FROM tags t
      JOIN conversation_tags ct ON ct.tag_id = t.id
      WHERE ct.conversation_id = ?
    `).all(id);

    const annotations = db.prepare(
      'SELECT * FROM annotations WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(id);

    return NextResponse.json({
      ...conversation,
      compliance_flags: conversation.compliance_flags
        ? JSON.parse(conversation.compliance_flags as string)
        : [],
      tags,
      annotations,
    });
  } catch (error) {
    console.error('GET conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    const body: UpdateConversationRequest = await request.json();

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?');
      values.push(body.priority);
    }
    if (body.assigned_agent !== undefined) {
      updates.push('assigned_agent = ?');
      values.push(body.assigned_agent);
    }
    if (body.ai_summary !== undefined) {
      updates.push('ai_summary = ?');
      values.push(body.ai_summary);
    }
    if (body.escalation_reason !== undefined) {
      updates.push('escalation_reason = ?');
      values.push(body.escalation_reason);
    }
    if (body.compliance_flags !== undefined) {
      updates.push('compliance_flags = ?');
      values.push(JSON.stringify(body.compliance_flags));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    if (body.status === 'resolved') {
      logAudit('CONVERSATION_RESOLVED', id, 'AGENT',
        'Conversation marked resolved by agent.',
        { previous_status: (conversation as Record<string, unknown>).status }
      );
    }

    const updated = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json({
      ...updated,
      compliance_flags: updated.compliance_flags ? JSON.parse(updated.compliance_flags as string) : [],
    });
  } catch (error) {
    console.error('PATCH conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
