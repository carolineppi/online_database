'use client';

// 1. THIS IS THE MOST IMPORTANT LINE: It imports all your Tailwind styles
import "./globals.css"; 

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import LoginPage from './login/page';
import { Toaster } from 'sonner';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

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
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  // Prevent a flash of unstyled content while checking auth
  if (loading) return null; 

  // GUARD: If no user, wrap the Login page in the SAME style-friendly tags
  if (!user && pathname !== '/login') {
    return (
      <html lang="en">
        {/* Antialiased helps the font look crisp like it did before */}
        <body className="bg-zinc-50 antialiased min-h-screen">
          <LoginPage />
          <Toaster position="top-center" />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      {/* 'flex' is required here so the Sidebar sits left and content sits right */}
      <body className="bg-zinc-50 flex antialiased min-h-screen">
        {user && <Sidebar user={user} />} 
        
        {/* 'flex-1' ensures the main content takes up the remaining horizontal space */}
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
        
        <Toaster position="top-center" />
      </body>
    </html>
  );
}