import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check for Supabase auth cookie (sb-*-auth-token)
  const hasAuthCookie = request.cookies.getAll().some(
    (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  )

  const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')

  // Portal pages are public (password-protected in-page)
  const pathname = request.nextUrl.pathname
  const isPortalPage = /^\/[a-z0-9-]+$/.test(pathname) &&
    !['overview', 'visibility', 'competitors', 'geo', 'keywords', 'reports', 'settings', 'login', 'signup'].includes(
      pathname.slice(1)
    )

  // If not logged in and trying to access protected routes, redirect to login
  if (!hasAuthCookie && !isAuthPage && !isPortalPage && !pathname.startsWith('/api')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If logged in and trying to access auth pages, redirect to overview
  if (hasAuthCookie && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/overview'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
