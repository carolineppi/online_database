'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Use HTMLFormElement for the event target
  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (data) {
      localStorage.setItem('employee', JSON.stringify(data));
      // Forces the app to "wake up" and show the sidebar immediately
      window.location.href = '/submittals'; 
    } else {
      alert('Login failed. Please verify credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl border shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-black mb-6 text-center">Estimator Login</h1>
        
        <div className="space-y-4">
          <input 
            name="email" 
            type="email" 
            placeholder="Email" 
            className="w-full p-3 border rounded-xl" 
            required 
          />
          <input 
            name="password" 
            type="password" 
            placeholder="Password" 
            className="w-full p-3 border rounded-xl" 
            required 
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  );
}