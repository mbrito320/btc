import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;

    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(id);

    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    const body = await request.json() as { content: string; agent_name?: string };

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const conversation = db.prepare('SELECT id, status FROM conversations WHERE id = ?').get(id) as { id: string; status: string } | null;
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const agentName = body.agent_name?.trim() || 'Agent';
    const msgId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(msgId, id, 'agent', body.content.trim(), now, JSON.stringify({ agent_name: agentName }));

    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);

    logAudit('AGENT_MESSAGE_SENT', id, agentName,
      `Agent sent message: ${body.content.trim().substring(0, 100)}${body.content.length > 100 ? '…' : ''}`,
      { message_id: msgId }
    );

    return NextResponse.json({ id: msgId, role: 'agent', content: body.content.trim(), created_at: now }, { status: 201 });
  } catch (error) {
    console.error('POST message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
