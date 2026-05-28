// components/StatusDropdown.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StatusDropdown({ id, currentStatus }: { id: string, currentStatus: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const statuses = ['PENDING', 'QUOTED', 'WON', 'SPAM', 'DUPLICATE', 'OFFICE'];

  const handleUpdate = async (newStatus: string) => {
    setIsOpen(false);
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    const { error } = await supabase
      .from('quote_submittals')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast?.error("Failed to update status.");
    } else {
      toast?.success(`Status updated to ${newStatus}`);
      router.refresh(); // Forces the server page to re-fetch and render the new status
    }
    setIsUpdating(false);
  };

  // Utility to color the badge based on status
  const getBadgeColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'QUOTED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'WON': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'SPAM': return 'bg-red-100 text-red-700 border-red-200';
      case 'DUPLICATE': return 'bg-zinc-200 text-zinc-600 border-zinc-300';
      case 'OFFICE': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${getBadgeColor(currentStatus)} hover:opacity-80`}
      >
        {isUpdating ? <Loader2 size={12} className="animate-spin" /> : currentStatus || 'UNKNOWN'}
        <ChevronDown size={12} className="opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 space-y-1">
            {statuses.map(status => (
              <button
                key={status}
                onClick={() => handleUpdate(status)}
                className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                  currentStatus === status ? 'bg-zinc-100 text-zinc-400 cursor-default' : 'text-zinc-700 hover:bg-zinc-50'
                }`}
                disabled={currentStatus === status}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}