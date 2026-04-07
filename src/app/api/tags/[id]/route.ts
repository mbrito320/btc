import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as { id: string; name: string; category: string } | null;
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Protect regulatory tags from deletion
    if (tag.category === 'regulatory') {
      return NextResponse.json(
        { error: 'Regulatory tags cannot be deleted — they are required for compliance reporting.' },
        { status: 403 }
      );
    }

    // Remove from all conversation_tags first (referential integrity)
    db.prepare('DELETE FROM conversation_tags WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);

    logAudit('TAG_DELETED', null, 'ADMIN',
      `Tag deleted: "${tag.name}" (category: ${tag.category})`,
      { tag_id: id, tag_name: tag.name }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE tag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
