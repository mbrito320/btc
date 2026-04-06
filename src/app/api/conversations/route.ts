import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { CreateConversationRequest, ConversationFilters, ConversationWithTags } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const filters: ConversationFilters = {
      status: searchParams.get('status') as ConversationFilters['status'] || undefined,
      priority: searchParams.get('priority') as ConversationFilters['priority'] || undefined,
      search: searchParams.get('search') || undefined,
      assigned_agent: searchParams.get('assigned_agent') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    let query = `
      SELECT
        c.*,
        COUNT(DISTINCT m.id) as message_count,
        MAX(m.created_at) as last_message_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        COUNT(DISTINCT a.id) as annotation_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      LEFT JOIN annotations a ON a.conversation_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (filters.status) {
      query += ' AND c.status = ?';
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ' AND c.priority = ?';
      params.push(filters.priority);
    }

    if (filters.assigned_agent) {
      query += ' AND c.assigned_agent = ?';
      params.push(filters.assigned_agent);
    }

    if (filters.search) {
      query += ' AND (c.customer_name LIKE ? OR c.customer_account LIKE ? OR c.ai_summary LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' GROUP BY c.id ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50, filters.offset || 0);

    const conversations = db.prepare(query).all(...params) as ConversationWithTags[];

    // Attach tags to each conversation
    const tagQuery = db.prepare(`
      SELECT t.*, ct.added_at, ct.added_by
      FROM tags t
      JOIN conversation_tags ct ON ct.tag_id = t.id
      WHERE ct.conversation_id = ?
    `);

    const result = conversations.map(conv => ({
      ...conv,
      compliance_flags: conv.compliance_flags ? JSON.parse(conv.compliance_flags as unknown as string) : [],
      tags: tagQuery.all(conv.id) as ConversationWithTags['tags'],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET conversations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body: CreateConversationRequest = await request.json();

    const { customer_name, customer_account, channel = 'web_chat', initial_message } = body;

    if (!customer_name) {
      return NextResponse.json({ error: 'customer_name is required' }, { status: 400 });
    }

    const id = uuidv4();
    const customerId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO conversations (id, customer_id, customer_name, customer_account, status, priority, channel, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ai_handling', 'normal', ?, ?, ?)
    `).run(id, customerId, customer_name, customer_account || '****0000', channel, now, now);

    if (initial_message) {
      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, created_at, metadata)
        VALUES (?, ?, 'system', ?, ?, ?)
      `).run(uuidv4(), id, initial_message, now, null);
    }

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('POST conversations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
