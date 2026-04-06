import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Metrics } from '@/lib/types';

export async function GET() {
  try {
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Today's conversations
    const todayConvs = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE created_at >= ?"
    ).get(todayISO) as { count: number }).count;

    // Total conversations
    const totalConvs = (db.prepare("SELECT COUNT(*) as count FROM conversations").get() as { count: number }).count;

    // Resolved today
    const resolvedToday = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE status = 'resolved' AND updated_at >= ?"
    ).get(todayISO) as { count: number }).count;

    // Escalated today
    const escalatedToday = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE status = 'escalated' AND updated_at >= ?"
    ).get(todayISO) as { count: number }).count;

    // AI handled today (resolved without escalation)
    const aiHandledToday = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE status = 'resolved' AND escalation_reason IS NULL AND updated_at >= ?"
    ).get(todayISO) as { count: number }).count;

    // Active escalations
    const activeEscalations = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE status = 'escalated'"
    ).get() as { count: number }).count;

    // Compliance flags today
    const convWithFlags = db.prepare(
      "SELECT compliance_flags FROM conversations WHERE compliance_flags IS NOT NULL AND compliance_flags != '[]' AND created_at >= ?"
    ).all(todayISO) as { compliance_flags: string }[];

    let complianceFlagsToday = 0;
    for (const conv of convWithFlags) {
      try {
        const flags = JSON.parse(conv.compliance_flags);
        complianceFlagsToday += Array.isArray(flags) ? flags.length : 0;
      } catch {
        // ignore parse errors
      }
    }

    // AI resolution rate
    const resolvedConvs = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE status IN ('resolved', 'closed')"
    ).get() as { count: number }).count;

    const aiResolved = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE status IN ('resolved', 'closed') AND escalation_reason IS NULL"
    ).get() as { count: number }).count;

    const aiResolutionRate = resolvedConvs > 0 ? Math.round((aiResolved / resolvedConvs) * 100) : 0;

    // Average handle time (estimate based on message timestamps)
    const convTimings = db.prepare(`
      SELECT
        c.id,
        c.created_at,
        MAX(m.created_at) as last_msg,
        c.status
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE c.status IN ('resolved', 'closed')
      GROUP BY c.id
      LIMIT 100
    `).all() as { id: string; created_at: string; last_msg: string; status: string }[];

    let avgHandleTime = 0;
    if (convTimings.length > 0) {
      const totalMinutes = convTimings.reduce((sum, conv) => {
        const start = new Date(conv.created_at).getTime();
        const end = new Date(conv.last_msg).getTime();
        return sum + (end - start) / 60000;
      }, 0);
      avgHandleTime = Math.round(totalMinutes / convTimings.length);
    }

    // Hourly volume (last 24 hours)
    const hourlyData: { hour: string; count: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(Date.now() - i * 3600000);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 3600000);

      const count = (db.prepare(
        "SELECT COUNT(*) as count FROM conversations WHERE created_at >= ? AND created_at < ?"
      ).get(hourStart.toISOString(), hourEnd.toISOString()) as { count: number }).count;

      hourlyData.push({
        hour: hourStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        count,
      });
    }

    // Top tags
    const topTags = db.prepare(`
      SELECT t.id as tag_id, t.name as tag_name, t.color, COUNT(ct.conversation_id) as count
      FROM tags t
      JOIN conversation_tags ct ON ct.tag_id = t.id
      GROUP BY t.id
      ORDER BY count DESC
      LIMIT 10
    `).all() as { tag_id: string; tag_name: string; color: string; count: number }[];

    // Escalation reasons
    const escalationReasons = db.prepare(`
      SELECT escalation_reason as reason, COUNT(*) as count
      FROM conversations
      WHERE escalation_reason IS NOT NULL
      GROUP BY escalation_reason
      ORDER BY count DESC
      LIMIT 10
    `).all() as { reason: string; count: number }[];

    // Vulnerable customers active (FCA Consumer Duty — critical metric)
    const vulnerableCustomersActive = (db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE vulnerable_customer_flag = 1 AND status NOT IN ('resolved', 'closed')"
    ).get() as { count: number }).count;

    // Immutable audit log (from audit_log table)
    let auditLog: unknown[] = [];
    try {
      auditLog = db.prepare(
        "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50"
      ).all();
    } catch {
      // audit_log table may not exist on older DBs — graceful fallback
    }

    const metrics: Metrics & { audit_log: unknown[] } = {
      today_conversations: todayConvs,
      ai_resolution_rate: aiResolutionRate,
      avg_handle_time_minutes: avgHandleTime,
      active_escalations: activeEscalations,
      compliance_flags_today: complianceFlagsToday,
      total_conversations: totalConvs,
      resolved_today: resolvedToday,
      escalated_today: escalatedToday,
      ai_handled_today: aiHandledToday,
      vulnerable_customers_active: vulnerableCustomersActive,
      hourly_volume: hourlyData,
      top_tags: topTags,
      escalation_reasons: escalationReasons,
      audit_log: auditLog,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('GET metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
