import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

// In-memory store for verification codes, keyed by project_id
export const verificationCodes = new Map<
  string,
  { code: string; email: string; expiresAt: number }
>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, email } = body;

    if (!project_id || !email) {
      return NextResponse.json(
        { error: 'project_id and email are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Validate session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', session.user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Generate a random 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in memory with 10-minute expiry
    verificationCodes.set(project_id, {
      code,
      email,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Update email_address on outreach_configs
    const { error: updateError } = await supabase
      .from('outreach_configs')
      .upsert(
        {
          project_id,
          email_address: email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' }
      );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Send verification email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error: emailError } = await resend.emails.send({
      from: 'alerts@superreddit.app',
      to: email,
      subject: 'Your SuperReddit verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="margin-bottom: 16px;">Verify your email</h2>
          <p style="color: #555; margin-bottom: 24px;">
            Enter the following code in SuperReddit to connect your email for alerts:
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</span>
          </div>
          <p style="color: #888; font-size: 13px;">
            This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate email verification' },
      { status: 500 }
    );
  }
}
