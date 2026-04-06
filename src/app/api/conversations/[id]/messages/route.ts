import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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
