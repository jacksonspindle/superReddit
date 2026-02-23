import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let processed = 0;

  try {
    // Get all configs with email digest enabled and connected
    const { data: configs, error: configError } = await supabase
      .from('outreach_configs')
      .select('project_id, email_address, email_digest_frequency, email_last_digest_at')
      .eq('email_digest_enabled', true)
      .eq('email_connected', true);

    if (configError) {
      console.error('Email digest config query error:', configError);
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    const now = new Date();

    for (const config of configs) {
      try {
        const lastDigest = config.email_last_digest_at
          ? new Date(config.email_last_digest_at)
          : null;
        const frequency = config.email_digest_frequency || 'daily';

        // Check if digest is due
        let isDue = false;
        if (!lastDigest) {
          isDue = true;
        } else if (frequency === 'daily') {
          isDue = now.getTime() - lastDigest.getTime() > 24 * 60 * 60 * 1000;
        } else if (frequency === 'weekly') {
          isDue = now.getTime() - lastDigest.getTime() > 7 * 24 * 60 * 60 * 1000;
        }

        if (!isDue) continue;

        // Get alert deliveries since last digest
        let deliveriesQuery = supabase
          .from('alert_deliveries')
          .select(`
            *,
            signal:outreach_signals(title, subreddit, permalink, matched_keywords, fetched_at)
          `)
          .eq('project_id', config.project_id)
          .eq('channel', 'email')
          .order('created_at', { ascending: false });

        if (lastDigest) {
          deliveriesQuery = deliveriesQuery.gt('created_at', lastDigest.toISOString());
        }

        const { data: deliveries, error: deliveriesError } = await deliveriesQuery;

        if (deliveriesError) {
          console.error(`Deliveries query error for project ${config.project_id}:`, deliveriesError);
          continue;
        }

        if (!deliveries || deliveries.length === 0) {
          // No new alerts, still update last digest time
          await supabase
            .from('outreach_configs')
            .update({ email_last_digest_at: now.toISOString() })
            .eq('project_id', config.project_id);
          continue;
        }

        // Build digest email content
        const alertSummaries = deliveries.map((d) => {
          const signal = d.signal as {
            title?: string;
            subreddit?: string;
            permalink?: string;
            matched_keywords?: string[];
            fetched_at?: string;
          } | null;
          return {
            title: signal?.title || 'Unknown signal',
            subreddit: signal?.subreddit || 'unknown',
            permalink: signal?.permalink
              ? `https://reddit.com${signal.permalink}`
              : '#',
            keywords: signal?.matched_keywords || [],
            deliveredAt: d.created_at,
          };
        });

        const emailHtml = buildDigestHtml(alertSummaries, config.project_id);

        // Send digest email via Resend
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          console.error('RESEND_API_KEY not configured');
          continue;
        }

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SuperReddit Alerts <alerts@superreddit.io>',
            to: [config.email_address],
            subject: `SuperReddit Digest: ${deliveries.length} new alert${deliveries.length === 1 ? '' : 's'}`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          console.error(
            `Resend error for project ${config.project_id}:`,
            await emailResponse.text()
          );
          continue;
        }

        // Update last digest timestamp
        await supabase
          .from('outreach_configs')
          .update({ email_last_digest_at: now.toISOString() })
          .eq('project_id', config.project_id);

        processed++;
      } catch (err) {
        console.error(`Email digest error for project ${config.project_id}:`, err);
      }
    }
  } catch (error) {
    console.error('Email digest cron error:', error);
    return NextResponse.json({ error: 'Email digest cron failed' }, { status: 500 });
  }

  return NextResponse.json({ processed });
}

function buildDigestHtml(
  alerts: {
    title: string;
    subreddit: string;
    permalink: string;
    keywords: string[];
    deliveredAt: string;
  }[],
  projectId: string
): string {
  const alertRows = alerts
    .map(
      (a) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <a href="${a.permalink}" style="color: #2563eb; text-decoration: none; font-weight: 600;">
            ${a.title}
          </a>
          <br/>
          <span style="color: #6b7280; font-size: 13px;">
            r/${a.subreddit} ${a.keywords.length > 0 ? '&middot; ' + a.keywords.join(', ') : ''}
          </span>
        </td>
      </tr>`
    )
    .join('');

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #1e1b4b; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">SuperReddit Alert Digest</h1>
        <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">
          ${alerts.length} new alert${alerts.length === 1 ? '' : 's'} since your last digest
        </p>
      </div>
      <table style="width: 100%; border-collapse: collapse; background: white;">
        ${alertRows}
      </table>
      <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://superreddit.io'}/projects/${projectId}/outreach/alerts" style="color: #2563eb;">
          View all alerts in SuperReddit
        </a>
      </div>
    </div>
  `;
}
