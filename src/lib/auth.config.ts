import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe NextAuth config — NO bcryptjs/mongoose imports.
 * Used by middleware (edge runtime) and merged into the full auth config.
 */
export default {
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Public pages: sign-in, sign-up
      const isPublicPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');

      // API auth routes must always be accessible
      const isAuthRoute = pathname.startsWith('/api/auth');

      if (isAuthRoute) return true;

      // API routes return 401 JSON instead of redirect
      if (pathname.startsWith('/api/')) {
        if (!isLoggedIn) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return true;
      }

      // Public pages: allow access, redirect to dashboard if already logged in
      if (isPublicPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', request.nextUrl));
        }
        return true;
      }

      // All other pages require auth
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Populated in auth.ts
} satisfies NextAuthConfig;
