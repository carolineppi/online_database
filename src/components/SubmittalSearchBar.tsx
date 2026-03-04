'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function SubmittalSearchBar() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);

    // 1. Look up the ID based on quote_number or project_name
    const { data, error } = await supabase
      .from('quote_submittals')
      .select('id')
      .or(`quote_number.eq.${query},project_name.ilike.%${query}%`)
      .limit(1)
      .single();

    if (data?.id) {
      // 2. Navigate to the actual UUID-based URL
      router.push(`/submittal/${data.id}`);
      setQuery('');
    } else {
      alert("No submittal found with that name or number.");
    }

    setIsSearching(false);
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <input 
        type="text" 
        placeholder="Search number or name..."
        className="w-full pl-10 pr-12 py-3 bg-zinc-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={isSearching}
      />
      <div className="absolute left-3 top-3.5 text-zinc-400">
        {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
      </div>
      
      {query && !isSearching && (
        <button 
          type="submit"
          className="absolute right-2 top-2 bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition"
        >
          Go
        </button>
      )}
    </form>
  );
}