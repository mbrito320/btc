import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { CreateTagRequest } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();

    const tags = db.prepare(`
      SELECT t.*, COUNT(ct.conversation_id) as usage_count
      FROM tags t
      LEFT JOIN conversation_tags ct ON ct.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.category, t.name
    `).all();

    return NextResponse.json(tags);
  } catch (error) {
    console.error('GET tags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body: CreateTagRequest = await request.json();

    const { name, color, category = 'custom' } = body;

    if (!name || !color) {
      return NextResponse.json({ error: 'name and color are required' }, { status: 400 });
    }

    const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (existing) {
      return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO tags (id, name, color, category) VALUES (?, ?, ?, ?)').run(id, name, color, category);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('POST tag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, name, color, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(id);
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: string[] = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (color) { updates.push('color = ?'); values.push(color); }
    if (category) { updates.push('category = ?'); values.push(category); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH tag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
