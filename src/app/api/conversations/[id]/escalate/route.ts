import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { EscalateRequest } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    const body: EscalateRequest = await request.json();

    const { reason, priority = 'high', assigned_agent } = body;

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as {
      id: string; status: string;
    } | null;

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE conversations
      SET status = 'escalated', escalation_reason = ?, priority = ?, assigned_agent = ?, updated_at = ?
      WHERE id = ?
    `).run(reason, priority, assigned_agent || null, now, id);

    // Add system message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, metadata)
      VALUES (?, ?, 'system', ?, ?, ?)
    `).run(
      uuidv4(),
      id,
      `Conversation manually escalated. Reason: ${reason}${assigned_agent ? `. Assigned to: ${assigned_agent}` : ''}`,
      now,
      JSON.stringify({ escalation_reason: reason, assigned_agent: assigned_agent || null })
    );

    // Add annotation
    db.prepare(`
      INSERT INTO annotations (id, conversation_id, content, annotation_type, created_by, created_at)
      VALUES (?, ?, ?, 'flag', 'system', ?)
    `).run(
      uuidv4(),
      id,
      `Escalated: ${reason}${assigned_agent ? `. Assigned to ${assigned_agent}` : ''}`,
      now
    );

    const updated = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json({
      ...updated,
      compliance_flags: updated.compliance_flags ? JSON.parse(updated.compliance_flags as string) : [],
    });
  } catch (error) {
    console.error('POST escalate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
