import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id?: string;
    activeWorkspaceId?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      activeWorkspaceId?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    activeWorkspaceId?: string;
  }
}
