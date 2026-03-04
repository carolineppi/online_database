'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function SubmittalSearchBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    // We assume your search logic redirects to a specific ID or search results
    router.push(`/submittal/${query}`); // Simplified: replace with real lookup if needed
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <input 
        type="text" 
        placeholder="Search number or name..."
        className="w-full pl-10 pr-4 py-3 bg-zinc-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Search className="absolute left-3 top-3.5 text-zinc-400" size={16} />
    </form>
  );
}