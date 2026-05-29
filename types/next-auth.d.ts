import type { DefaultSession } from 'next-auth';

// Expose our internal users.id on the session and the JWT.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
  }
}
