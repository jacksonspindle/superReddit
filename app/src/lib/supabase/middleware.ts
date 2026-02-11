import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup');

  const isOnboardingPage = pathname.startsWith('/onboarding');

  const isProtectedRoute =
    pathname.startsWith('/projects') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/inspiration') ||
    pathname.startsWith('/bookmarks');

  // Unauthenticated users can't access protected routes or onboarding
  if (!user && (isProtectedRoute || isOnboardingPage)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated users on auth pages → redirect to projects
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  // Onboarding gate: check if authenticated user has completed onboarding
  if (user && (isProtectedRoute || isOnboardingPage)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    const onboardingCompleted = profile?.onboarding_completed ?? false;

    // User hasn't completed onboarding → redirect to onboarding
    if (!onboardingCompleted && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // User already completed onboarding → redirect away from onboarding page
    if (onboardingCompleted && isOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/projects';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
