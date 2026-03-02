'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import LoginPage from './login/page';

// Create a simple context to force updates across components
const AuthContext = createContext({ user: null, login: (u: any) => {}, logout: () => {} });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const checkUser = () => {
    const saved = localStorage.getItem('employee');
    if (saved) {
      setUser(JSON.parse(saved));
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkUser();
    // Listen for storage changes across tabs
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-50">Loading...</div>;

  // If no user and not on login page, show Login only
  if (!user && pathname !== '/login') {
    return (
      <html lang="en">
        <body><LoginPage /></body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="flex bg-zinc-50">
        {user && <Sidebar user={user} />} 
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}