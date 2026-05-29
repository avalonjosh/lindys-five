import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

// Site-wide end-user accounts (the site's first). Pick the Bills is the first
// feature to require login, but this is intentionally general infrastructure.
//
// JWT session strategy: stateless, no per-request DB read, no adapter needed.
// We upsert the user into our own `users` table (keeping our uuid as the PICKS
// foreign key) and stash the internal id in the token.
//
// This is fully independent of the admin auth system (jose JWT in the
// `admin_token` cookie). Different cookie name, different secret (AUTH_SECRET).
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only populated on initial sign-in.
      if (user?.email) {
        const rows = await db
          .insert(users)
          .values({
            email: user.email,
            displayName: user.name ?? null,
            image: user.image ?? null,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { displayName: user.name ?? null, image: user.image ?? null },
          })
          .returning({ id: users.id });
        if (rows[0]) token.userId = rows[0].id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
