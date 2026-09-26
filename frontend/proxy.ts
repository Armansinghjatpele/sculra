import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define paths requiring user authentication
const isProtectedRoute = createRouteMatcher([
  '/activity(.*)',
  '/ai-insights(.*)',
  '/api-keys(.*)',
  '/billing(.*)',
  '/campaigns(.*)',
  '/dashboard(.*)',
  '/issues(.*)',
  '/notifications(.*)',
  '/organization(.*)',
  '/profile(.*)',
  '/projects(.*)',
  '/release-readiness(.*)',
  '/reports(.*)',
  '/settings(.*)',
  '/team(.*)',
  '/test-runs(.*)',
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
