
'use client';
import { AuthProvider, useAuth } from '@/context/auth-context';
import ConnectPoint from '@/components/connect-point';
import LoginPage from '@/components/login-page';

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  return (
      <ConnectPoint />
  );
}


export default function Home() {
  return (
    <AuthProvider>
        <AppContent />
    </AuthProvider>
  );
}
