'use client'; // This must be the very first line

import React, { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast, Toaster } from 'sonner';

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const supabase = createClient();

  useEffect(() => {
    // We listen for any new row added to the 'quote_submittals' table
    const channel = supabase
      .channel('realtime-submittals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quote_submittals', // Ensure this matches your Supabase table name exactly
        },
        (payload) => {
          toast.success(`New Request: ${payload.new.job_name}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // The Fragment (<>...</>) is valid here as long as it's a Client Component
  return (
    <>
      <Toaster position="top-right" richColors />
      {children}
    </>
  );
}