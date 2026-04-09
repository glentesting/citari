import { NextResponse } from 'next/server'

// Explicit pass-through — no auth redirects.
// Auth is handled in dashboard layout server component.
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
