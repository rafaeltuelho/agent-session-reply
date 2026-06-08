'use client';

import { SessionProvider, useSession } from '@/lib/session-context';
import SessionList from '@/components/SessionList';
import SessionReplay from '@/components/SessionReplay';

function AppContent() {
  const { session, loading } = useSession();

  if (session && !loading) {
    return <SessionReplay />;
  }

  return <SessionList />;
}

export default function Home() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
