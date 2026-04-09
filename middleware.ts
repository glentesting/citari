import { NextResponse, NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isApiRoute = pathname.startsWith('/api')
  const isProtected =
    pathname === '/' ||
    pathname.startsWith('/overview') ||
    pathname.startsWith('/visibility') ||
    pathname.startsWith('/competitors') ||
    pathname.startsWith('/geo') ||
    pathname.startsWith('/keywords') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings')

  const cookies = request.cookies.getAll()
  let hasAuth = false
  for (let i = 0; i < cookies.length; i++) {
    if (cookies[i].name.startsWith('sb-') && cookies[i].name.includes('auth-token')) {
      hasAuth = true
      break
    }
  }

  if (!hasAuth && isProtected && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasAuth && isAuthPage) {
    return NextResponse.redirect(new URL('/overview', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
