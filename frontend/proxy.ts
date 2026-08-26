import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define paths requiring user authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/projects(.*)',
  '/reports(.*)',
  '/settings(.*)',
  '/profile(.*)',
  '/billing(.*)',
  '/notifications(.*)',
  '/api-keys(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
