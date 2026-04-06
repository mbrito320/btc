import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; tagId: string } }
) {
  try {
    const db = getDb();
    const { id, tagId } = params;

    const existing = db.prepare(
      'SELECT * FROM conversation_tags WHERE conversation_id = ? AND tag_id = ?'
    ).get(id, tagId);

    if (!existing) {
      return NextResponse.json({ error: 'Tag not found on this conversation' }, { status: 404 });
    }

    db.prepare(
      'DELETE FROM conversation_tags WHERE conversation_id = ? AND tag_id = ?'
    ).run(id, tagId);

    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE tag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
