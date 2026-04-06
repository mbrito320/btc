import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { CreateAnnotationRequest } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    const body: CreateAnnotationRequest = await request.json();

    const { content, annotation_type = 'note', created_by = 'Agent' } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const annotationId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO annotations (id, conversation_id, content, annotation_type, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(annotationId, id, content, annotation_type, created_by, now);

    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);

    const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(annotationId);
    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    console.error('POST annotation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;

    const annotations = db.prepare(
      'SELECT * FROM annotations WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(id);

    return NextResponse.json(annotations);
  } catch (error) {
    console.error('GET annotations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
