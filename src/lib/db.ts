import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'nexus.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_account TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ai_handling',
      priority TEXT NOT NULL DEFAULT 'normal',
      channel TEXT NOT NULL DEFAULT 'web_chat',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ai_summary TEXT,
      escalation_reason TEXT,
      assigned_agent TEXT,
      compliance_flags TEXT,
      vulnerable_customer_flag INTEGER NOT NULL DEFAULT 0,
      vulnerable_customer_type TEXT
    );

    -- Immutable audit log — required for FCA / CFPB regulatory examination
    -- NEVER run UPDATE or DELETE on this table
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      conversation_id TEXT,
      actor TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_conversation ON audit_log(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_vulnerable ON conversations(vulnerable_customer_flag);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'custom'
    );

    CREATE TABLE IF NOT EXISTS conversation_tags (
      conversation_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      added_by TEXT NOT NULL DEFAULT 'system',
      PRIMARY KEY (conversation_id, tag_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      content TEXT NOT NULL,
      annotation_type TEXT NOT NULL DEFAULT 'note',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
    CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
    CREATE INDEX IF NOT EXISTS idx_annotations_conversation ON annotations(conversation_id);
  `);

  seedData(db);
}

function seedData(db: Database.Database): void {
  // Check if already seeded
  const tagCount = (db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number }).count;
  if (tagCount > 0) return;

  const now = new Date();
  const isoNow = () => new Date().toISOString();

  // Seed banking-relevant tags
  const tags = [
    // Transaction types
    { id: uuidv4(), name: 'Balance Inquiry', color: '#3b82f6', category: 'transaction_type' },
    { id: uuidv4(), name: 'Wire Transfer', color: '#8b5cf6', category: 'transaction_type' },
    { id: uuidv4(), name: 'ACH Transfer', color: '#6366f1', category: 'transaction_type' },
    { id: uuidv4(), name: 'Bill Payment', color: '#06b6d4', category: 'transaction_type' },
    { id: uuidv4(), name: 'Mobile Deposit', color: '#10b981', category: 'transaction_type' },
    { id: uuidv4(), name: 'ATM Transaction', color: '#14b8a6', category: 'transaction_type' },

    // Issue types
    { id: uuidv4(), name: 'Fraud Alert', color: '#ef4444', category: 'issue_type' },
    { id: uuidv4(), name: 'Dispute <$100', color: '#f97316', category: 'issue_type' },
    { id: uuidv4(), name: 'Dispute >$500', color: '#dc2626', category: 'issue_type' },
    { id: uuidv4(), name: 'Card Issue', color: '#f59e0b', category: 'issue_type' },
    { id: uuidv4(), name: 'NSF/Overdraft', color: '#ef4444', category: 'issue_type' },
    { id: uuidv4(), name: 'Account Lock', color: '#7c3aed', category: 'issue_type' },
    { id: uuidv4(), name: 'Failed Transaction', color: '#f87171', category: 'issue_type' },
    { id: uuidv4(), name: 'Duplicate Charge', color: '#fb923c', category: 'issue_type' },

    // Products
    { id: uuidv4(), name: 'Checking Account', color: '#2563eb', category: 'product' },
    { id: uuidv4(), name: 'Savings Account', color: '#16a34a', category: 'product' },
    { id: uuidv4(), name: 'Credit Card', color: '#9333ea', category: 'product' },
    { id: uuidv4(), name: 'Debit Card', color: '#0891b2', category: 'product' },
    { id: uuidv4(), name: 'Mortgage', color: '#b45309', category: 'product' },
    { id: uuidv4(), name: 'Auto Loan', color: '#0f766e', category: 'product' },
    { id: uuidv4(), name: 'Personal Loan', color: '#4338ca', category: 'product' },
    { id: uuidv4(), name: 'CD/Money Market', color: '#0369a1', category: 'product' },

    // Regulatory
    { id: uuidv4(), name: 'SCRA Eligible', color: '#7c3aed', category: 'regulatory' },
    { id: uuidv4(), name: 'Elder Financial Abuse', color: '#dc2626', category: 'regulatory' },
    { id: uuidv4(), name: 'UDAAP Risk', color: '#b91c1c', category: 'regulatory' },
    { id: uuidv4(), name: 'CFPB Complaint', color: '#991b1b', category: 'regulatory' },
    { id: uuidv4(), name: 'BSA/AML Flag', color: '#7f1d1d', category: 'regulatory' },
    { id: uuidv4(), name: 'Reg E Dispute', color: '#c2410c', category: 'regulatory' },
    { id: uuidv4(), name: 'ECOA/Fair Lending', color: '#d97706', category: 'regulatory' },

    // Custom
    { id: uuidv4(), name: 'VIP Customer', color: '#d97706', category: 'custom' },
    { id: uuidv4(), name: 'First-Time Caller', color: '#64748b', category: 'custom' },
    { id: uuidv4(), name: 'Retention Risk', color: '#dc2626', category: 'custom' },
    { id: uuidv4(), name: 'Positive Feedback', color: '#16a34a', category: 'custom' },
    { id: uuidv4(), name: 'Loan Application', color: '#0284c7', category: 'custom' },
  ];

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (id, name, color, category) VALUES (?, ?, ?, ?)');
  for (const tag of tags) {
    insertTag.run(tag.id, tag.name, tag.color, tag.category);
  }

  // Get tag IDs for seeded conversations
  const getTag = (name: string) => (db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: string })?.id;

  // Sample conversation 1: AI handling - Balance inquiry
  const conv1Id = uuidv4();
  const conv1CustomerId = uuidv4();
  const conv1Start = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago

  db.prepare(`
    INSERT INTO conversations (id, customer_id, customer_name, customer_account, status, priority, channel, created_at, updated_at, ai_summary, compliance_flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conv1Id,
    conv1CustomerId,
    'Sarah Mitchell',
    '****4821',
    'ai_handling',
    'normal',
    'web_chat',
    conv1Start.toISOString(),
    new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    'Customer inquiring about recent transactions and available balance on checking account ending in 4821. AI successfully provided balance information and transaction history. Customer satisfied with responses.',
    JSON.stringify([])
  );

  const conv1Messages = [
    { role: 'user', content: 'Hi, I need to check my account balance and see some recent transactions.', offset: 15 },
    { role: 'assistant', content: "Hello Sarah! Welcome to Nexus Financial's secure chat. I'm your AI banking assistant and I'm here to help you today.\n\nI can see your account information. Your **checking account ending in 4821** currently shows:\n\n• **Available Balance:** $3,247.82\n• **Current Balance:** $3,312.17\n\nThe difference reflects a pending debit card transaction of $64.35 from Whole Foods Market that hasn't fully settled yet.\n\nWould you like to see your recent transaction history?", offset: 14 },
    { role: 'user', content: 'Yes please show me the last 5 transactions', offset: 12 },
    { role: 'assistant', content: "Here are your 5 most recent transactions on your checking account ending in **4821**:\n\n| Date | Description | Amount |\n|------|-------------|--------|\n| Apr 4 | Whole Foods Market | -$64.35 *(pending)* |\n| Apr 3 | Direct Deposit - ACME CORP | +$2,847.50 |\n| Apr 3 | Netflix | -$15.99 |\n| Apr 2 | Shell Gas Station | -$52.18 |\n| Apr 1 | Chase Mortgage Payment | -$1,423.00 |\n\nIs there anything else I can help you with? I can also help with card services, bill payments, or finding a nearby branch or ATM.", offset: 10 },
    { role: 'user', content: "That direct deposit looks right. That's my paycheck. Everything looks good, thanks!", offset: 5 },
    { role: 'assistant', content: "You're welcome, Sarah! I'm glad everything looks in order. Your account is in good standing.\n\nIs there anything else I can help you with today? I'm here if you have questions about your savings account, card services, or any other banking needs.", offset: 4 },
  ];

  const insertMsg = db.prepare('INSERT INTO messages (id, conversation_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)');
  for (const msg of conv1Messages) {
    insertMsg.run(
      uuidv4(),
      conv1Id,
      msg.role,
      msg.content,
      new Date(now.getTime() - msg.offset * 60 * 1000).toISOString(),
      null
    );
  }

  // Add tags to conv1
  const balanceTagId = getTag('Balance Inquiry');
  const checkingTagId = getTag('Checking Account');
  if (balanceTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv1Id, balanceTagId, isoNow(), 'AI');
  if (checkingTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv1Id, checkingTagId, isoNow(), 'AI');

  // Sample conversation 2: Escalated - Fraud dispute
  const conv2Id = uuidv4();
  const conv2CustomerId = uuidv4();
  const conv2Start = new Date(now.getTime() - 45 * 60 * 1000);

  db.prepare(`
    INSERT INTO conversations (id, customer_id, customer_name, customer_account, status, priority, channel, created_at, updated_at, ai_summary, escalation_reason, assigned_agent, compliance_flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conv2Id,
    conv2CustomerId,
    'Robert Chen',
    '****2209',
    'escalated',
    'urgent',
    'web_chat',
    conv2Start.toISOString(),
    new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    'Customer reporting unauthorized charges totaling $847.50 from an unrecognized merchant "INTL-SHOP-EU". Flagged as potential fraud. Three charges made within 2 hours on April 4th. AI escalated due to fraud dispute exceeding $100 threshold and potential card compromise.',
    'Fraud dispute exceeding $100 threshold - unauthorized international charges totaling $847.50 require agent review and potential card freeze',
    'Agent Martinez',
    JSON.stringify([{ type: 'UDAAP', description: 'Customer reporting potential unauthorized charges - immediate action required', severity: 'high', detected_at: new Date(now.getTime() - 35 * 60 * 1000).toISOString() }])
  );

  const conv2Messages = [
    { role: 'user', content: 'I see charges on my account I did not make. Someone stole my card information!', offset: 45 },
    { role: 'assistant', content: "I understand this is very concerning, Robert. I take reports of unauthorized charges very seriously.\n\nI can see your account ending in **2209**. Can you tell me:\n1. Approximately when did you notice these unauthorized charges?\n2. Is your physical card still in your possession?", offset: 42 },
    { role: 'user', content: "My card is here but there are 3 charges from 'INTL-SHOP-EU' that I never made. Total is like $847. I've never heard of this company!", offset: 40 },
    { role: 'assistant', content: "I can see those transactions on your account. I'm noting three charges from **INTL-SHOP-EU**:\n• Apr 4, 11:23 AM - $284.99\n• Apr 4, 12:41 PM - $312.50  \n• Apr 4, 1:15 PM - $250.01\n\n**Total: $847.50**\n\nThese do appear suspicious - multiple charges from an international merchant within a short window. Given the total amount exceeds our threshold, I need to immediately connect you with a fraud specialist who has full authority to:\n✓ Freeze your card right now\n✓ File a formal fraud dispute\n✓ Issue an emergency replacement card\n✓ Initiate a chargeback\n\n[ESCALATE: Fraud dispute - unauthorized international charges totaling $847.50 exceed $100 threshold, potential card compromise, customer card in possession suggesting card number theft]", offset: 35 },
    { role: 'system', content: 'Conversation escalated to Agent Martinez. Customer briefed on next steps. AI flagged potential UDAAP concern.', offset: 30 },
    { role: 'agent', content: "Hi Robert, this is Agent Martinez from our Fraud Response team. I've reviewed the conversation and I can see those three suspicious charges from INTL-SHOP-EU. I've already initiated a temporary freeze on your card as a precaution. Let me walk you through the dispute process...", offset: 10 },
  ];

  for (const msg of conv2Messages) {
    insertMsg.run(
      uuidv4(),
      conv2Id,
      msg.role,
      msg.content,
      new Date(now.getTime() - msg.offset * 60 * 1000).toISOString(),
      null
    );
  }

  const fraudTagId = getTag('Fraud Alert');
  const disputeTagId = getTag('Dispute >$500');
  const cardTagId = getTag('Card Issue');
  const udaapTagId = getTag('UDAAP Risk');
  if (fraudTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv2Id, fraudTagId, isoNow(), 'AI');
  if (disputeTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv2Id, disputeTagId, isoNow(), 'AI');
  if (cardTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv2Id, cardTagId, isoNow(), 'agent');
  if (udaapTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv2Id, udaapTagId, isoNow(), 'system');

  // Add annotation to conv2
  db.prepare('INSERT INTO annotations (id, conversation_id, content, annotation_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(),
    conv2Id,
    'URGENT: Customer reporting international card fraud. Three charges totaling $847.50. Card temporary freeze applied. Full dispute packet needs to be filed. Potential card skimmer or data breach - check if other accounts show similar INTL-SHOP-EU charges.',
    'compliance',
    'Agent Martinez',
    new Date(now.getTime() - 28 * 60 * 1000).toISOString()
  );

  db.prepare('INSERT INTO annotations (id, conversation_id, content, annotation_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(),
    conv2Id,
    'Temporary card freeze applied at 2:35 PM. Dispute case #FRD-2024-8841 opened. Replacement card ordered - 3-5 business days delivery.',
    'action_required',
    'Agent Martinez',
    new Date(now.getTime() - 8 * 60 * 1000).toISOString()
  );

  // Sample conversation 3: Resolved - Bill payment question
  const conv3Id = uuidv4();
  const conv3CustomerId = uuidv4();
  const conv3Start = new Date(now.getTime() - 90 * 60 * 1000);

  db.prepare(`
    INSERT INTO conversations (id, customer_id, customer_name, customer_account, status, priority, channel, created_at, updated_at, ai_summary, compliance_flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conv3Id,
    conv3CustomerId,
    'Jennifer Okafor',
    '****7734',
    'resolved',
    'low',
    'web_chat',
    conv3Start.toISOString(),
    new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    'Customer inquired about bill payment status for their electric utility. AI confirmed payment of $127.43 to Pacific Gas & Electric was scheduled for April 5th and provided estimated processing time. Customer confirmed they wanted no further changes. Resolved without escalation.',
    JSON.stringify([])
  );

  const conv3Messages = [
    { role: 'user', content: 'Did my electric bill payment go through? I set it up a few days ago', offset: 90 },
    { role: 'assistant', content: "Hello Jennifer! Happy to check that for you.\n\nI can see your Bill Pay activity on your account ending in **7734**. I found a scheduled payment:\n\n📋 **Pacific Gas & Electric**\n• Amount: **$127.43**\n• Status: **Scheduled**\n• Payment Date: **April 5, 2024**\n• Confirmation #: **BPY-20240402-8847**\n\nThe payment will be debited from your checking account on April 5th and typically posts to PG&E within 1-2 business days. Is this the payment you were looking for?", offset: 87 },
    { role: 'user', content: 'Yes thats the one! Will it definitely go through on time? My due date is April 7th', offset: 84 },
    { role: 'assistant', content: "Great news - you're well within the timeline! Here's the payment schedule:\n\n✅ **April 5** - Payment debited from your account\n✅ **April 6-7** - Funds posted to Pacific Gas & Electric\n⏰ **April 7** - Your due date\n\nYour payment should arrive **before or on your due date**. You won't incur any late fees.\n\nOne tip: In the future, you can set up **AutoPay** through our mobile app to have recurring bills paid automatically - takes the worry out of remembering due dates!\n\nIs there anything else I can help you with today?", offset: 80 },
    { role: 'user', content: 'Perfect, thats exactly what I needed to know. Thank you!', offset: 75 },
    { role: 'assistant', content: "You're very welcome, Jennifer! Your bill payment is all set and you're good to go.\n\nHave a wonderful day, and don't hesitate to reach out if you need anything else. 😊\n\n[RESOLVED: Customer confirmed bill payment status for PG&E - $127.43 scheduled for April 5th, within due date of April 7th. Customer satisfied, no further assistance needed.]", offset: 72 },
  ];

  for (const msg of conv3Messages) {
    insertMsg.run(
      uuidv4(),
      conv3Id,
      msg.role,
      msg.content,
      new Date(now.getTime() - msg.offset * 60 * 1000).toISOString(),
      null
    );
  }

  const billTagId = getTag('Bill Payment');
  const checkingTag2Id = getTag('Checking Account');
  if (billTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv3Id, billTagId, isoNow(), 'AI');
  if (checkingTag2Id) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv3Id, checkingTag2Id, isoNow(), 'AI');

  db.prepare('INSERT INTO annotations (id, conversation_id, content, annotation_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(),
    conv3Id,
    'Conversation resolved successfully by AI. Customer confirmed bill payment timing. No escalation needed. Customer was satisfied and receptive to AutoPay suggestion.',
    'note',
    'AI System',
    new Date(now.getTime() - 72 * 60 * 1000).toISOString()
  );

  // ── Sample conversation 4: Vulnerable Customer — Elder (FCA hard stop) ──
  const conv4Id = uuidv4();
  const conv4Start = new Date(now.getTime() - 35 * 60 * 1000);

  db.prepare(`
    INSERT INTO conversations (id, customer_id, customer_name, customer_account, status, priority, channel, created_at, updated_at, ai_summary, escalation_reason, assigned_agent, compliance_flags, vulnerable_customer_flag, vulnerable_customer_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conv4Id, uuidv4(), 'Dorothy Williams', '****2156', 'escalated', 'urgent', 'web_chat',
    conv4Start.toISOString(),
    new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    'Elderly customer inquired about account balance. Customer mentioned her nephew usually handles her finances and expressed confusion about recent transactions. FCA Consumer Duty Vulnerable Customer Protocol (FG21/1) triggered immediately. Auto-escalated to Specialist Vulnerable Customer Team. No financial transactions were processed.',
    'VULNERABLE_CUSTOMER — FCA FG21/1 Category 1: Elderly customer with third-party financial management indicators and cognitive confusion. Hard stop — do not return to AI handling.',
    'Specialist: Lisa Patel (Vulnerable Customer Team)',
    JSON.stringify([
      { type: 'FCA_VULNERABLE_CUSTOMER', description: 'FG21/1 Category 1: Elderly customer, third-party financial management, cognitive confusion indicators', severity: 'high', detected_at: new Date(now.getTime() - 33 * 60 * 1000).toISOString() },
      { type: 'POSSIBLE_THIRD_PARTY_INFLUENCE', description: 'Customer states nephew manages finances — LPA/POA status unknown, requires verification', severity: 'medium', detected_at: new Date(now.getTime() - 33 * 60 * 1000).toISOString() }
    ]),
    1,
    'ELDERLY_COGNITIVE_VULNERABILITY'
  );

  const conv4Messages = [
    { role: 'user', content: 'Hello, I need help with my account. I keep getting confused with all these statements.', offset: 35 },
    { role: 'assistant', content: "Hello Dorothy! Welcome to Nexus Financial. I'm your AI assistant and I'm here to help you today.\n\nI'd be happy to help you understand your account. What specifically is confusing you?", offset: 34 },
    { role: 'user', content: "I don't know. My nephew usually sorts all this out for me but he's away at the moment. I've been getting these letters about something changing and I don't understand what they mean. I keep forgetting things lately.", offset: 32 },
    { role: 'assistant', content: "Dorothy, I completely understand, and I want to make sure you receive exactly the right support today.\n\nRather than continue through our AI assistant, I'm immediately connecting you with one of our specialist advisors who is specifically trained to take all the time needed and explain everything clearly. Your wellbeing and security are our absolute priority.\n\nPlease stay with us — one of our dedicated specialists will be with you very shortly. You're in safe hands.\n\n**📋 AGENT HANDOFF BRIEF**\n- **Customer:** Dorothy Williams, Account ending ****2156\n- **Issue:** Elderly customer confused about account correspondence; nephew typically manages finances (third-party authority status unknown)\n- **What I've done:** Greeted customer, identified vulnerability indicators immediately\n- **What's needed:** Specialist vulnerable customer team to: (1) verify LPA/POA status on file, (2) explain correspondence clearly, (3) offer accessible format options, (4) log interaction per FCA Consumer Duty requirements\n- **Urgency:** High\n- **Compliance flags:** FCA_VULNERABLE_CUSTOMER, POSSIBLE_THIRD_PARTY_INFLUENCE\n\n[ESCALATE: VULNERABLE_CUSTOMER — FCA FG21/1 Category 1: Elderly customer, confusion about account, third-party (nephew) manages finances, memory concerns stated. Hard stop per Consumer Duty.]\n[COMPLIANCE:FCA_VULNERABLE_CUSTOMER]", offset: 31 },
    { role: 'system', content: '⚠️ VULNERABLE CUSTOMER PROTOCOL ACTIVATED (FCA Consumer Duty 2023 / FG21/1)\nAuto-escalated to Specialist Vulnerable Customer Team.\nAssigned: Lisa Patel\nCompliance flags logged. Supervisor notification sent.', offset: 30 },
    { role: 'agent', content: "Hello Dorothy, my name is Lisa Patel and I'm a specialist advisor here at Nexus Financial. I've been asked to help you today because I have special training to make sure you get all the support you need.\n\nThere's absolutely no rush at all — we have all the time in the world. Could you tell me a bit about the letters you've been receiving? We'll go through everything together, nice and slowly.", offset: 28 },
  ];

  for (const msg of conv4Messages) {
    insertMsg.run(
      uuidv4(), conv4Id, msg.role, msg.content,
      new Date(now.getTime() - msg.offset * 60 * 1000).toISOString(), null
    );
  }

  const vulnerableTagId = getTag('Elder Financial Abuse');
  const udaapTag2Id = getTag('UDAAP Risk');
  if (vulnerableTagId) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv4Id, vulnerableTagId, isoNow(), 'system');
  if (udaapTag2Id) db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id, added_at, added_by) VALUES (?, ?, ?, ?)').run(conv4Id, udaapTag2Id, isoNow(), 'system');

  db.prepare('INSERT INTO annotations (id, conversation_id, content, annotation_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuidv4(), conv4Id,
    'SYSTEM AUTO-FLAG: FCA Consumer Duty Vulnerable Customer Protocol triggered.\n\nDetected indicators:\n• Customer states nephew "usually sorts all this out" → Possible third-party financial management; LPA/POA status on file must be verified immediately\n• Customer expressed confusion about account correspondence\n• Customer mentioned "forgetting things lately" → Possible cognitive vulnerability (FG21/1 Health driver)\n\nREQUIRED ACTIONS (Specialist Team):\n1. Verify whether LPA/Enduring POA is registered on account\n2. Confirm whether nephew has formal authority or informal arrangement\n3. Offer correspondence in accessible format (larger print, simplified language)\n4. Complete Vulnerability Assessment Form VAF-2024\n5. Log outcome in Vulnerable Customer Register\n6. Supervisor sign-off required before case closure\n\nDo NOT return this conversation to AI handling.\nCompliance reference: FCA Consumer Duty PS22/9 (2023), FCA FG21/1, UK Mental Capacity Act 2005',
    'compliance', 'SYSTEM', new Date(now.getTime() - 31 * 60 * 1000).toISOString()
  );

  // Add to audit log
  const insertAudit = db.prepare('INSERT INTO audit_log (id, event_type, conversation_id, actor, description, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertAudit.run(uuidv4(), 'VULNERABLE_CUSTOMER_DETECTED', conv4Id, 'SYSTEM',
    'FCA Consumer Duty Vulnerable Customer Protocol auto-triggered. Indicators: elderly customer, third-party financial management (nephew), cognitive confusion stated. Auto-escalated to specialist team.',
    JSON.stringify({ vulnerable_type: 'ELDERLY_COGNITIVE_VULNERABILITY', flags: ['FCA_VULNERABLE_CUSTOMER', 'POSSIBLE_THIRD_PARTY_INFLUENCE'], fca_ref: 'FG21/1' }),
    new Date(now.getTime() - 31 * 60 * 1000).toISOString()
  );
  insertAudit.run(uuidv4(), 'ESCALATION', conv2Id, 'AI_SYSTEM',
    'Fraud dispute escalated — $847.50 unauthorized international charges. Threshold exceeded.',
    JSON.stringify({ reason: 'FRAUD_DISPUTE_OVER_THRESHOLD', amount: 847.50, merchant: 'INTL-SHOP-EU' }),
    new Date(now.getTime() - 35 * 60 * 1000).toISOString()
  );
  insertAudit.run(uuidv4(), 'CONVERSATION_RESOLVED', conv3Id, 'AI_SYSTEM',
    'Conversation resolved by AI — bill payment status confirmed.',
    JSON.stringify({ resolution: 'Bill payment confirmed on schedule, customer satisfied' }),
    new Date(now.getTime() - 72 * 60 * 1000).toISOString()
  );
}

// ── Public audit log helper ────────────────────────────────────────────────
export function logAudit(
  eventType: string,
  conversationId: string | null,
  actor: string,
  description: string,
  metadata: Record<string, unknown> = {}
): void {
  const db = getDb();
  db.prepare('INSERT INTO audit_log (id, event_type, conversation_id, actor, description, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), eventType, conversationId, actor, description, JSON.stringify(metadata), new Date().toISOString());
}
