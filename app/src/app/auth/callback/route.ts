import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';

  if (code) {
    const successUrl = `${origin}${next}`;
    const response = NextResponse.redirect(successUrl);

    // Bind cookies directly to the redirect response so session cookies
    // are sent with the redirect (not lost when creating a new response).
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error('Auth callback code exchange failed:', error.message);
  } else {
    console.error('Auth callback called without code param');
  }

  // If there's no code or exchange failed, redirect to signup
  return NextResponse.redirect(`${origin}/signup.html`);
}
