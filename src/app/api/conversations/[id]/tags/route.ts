import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { AddTagRequest } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    const body: AddTagRequest = await request.json();

    const { tag_id, added_by = 'agent' } = body;

    if (!tag_id) {
      return NextResponse.json({ error: 'tag_id is required' }, { status: 400 });
    }

    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tag_id);
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const existing = db.prepare(
      'SELECT * FROM conversation_tags WHERE conversation_id = ? AND tag_id = ?'
    ).get(id, tag_id);

    if (existing) {
      return NextResponse.json({ error: 'Tag already added to this conversation' }, { status: 409 });
    }

    db.prepare(
      'INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)'
    ).run(id, tag_id, new Date().toISOString(), added_by);

    // Update conversation updated_at
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);

    const tagRecord = db.prepare('SELECT name FROM tags WHERE id = ?').get(tag_id) as { name: string } | null;
    logAudit('TAG_ADDED', id, added_by,
      `Tag added: ${tagRecord?.name ?? tag_id}`,
      { tag_id }
    );

    return NextResponse.json({ success: true, conversation_id: id, tag_id }, { status: 201 });
  } catch (error) {
    console.error('POST tag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
