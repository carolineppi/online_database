'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Hash, CornerDownLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function SubmittalSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const router = useRouter();
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length < 2) {
        setResults([]);
        setSelectedIndex(-1);
        return;
      }

      setIsSearching(true);
      const searchPattern = `%${trimmedQuery}%`;

      // 1. Check if the query matches any customers directly
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
        .limit(10);

      // 2. Build the OR query for the submittals table (Added quote_number_mask here!)
      let orQuery = `quote_number.ilike.${searchPattern},quote_number_mask.ilike.${searchPattern},job_name.ilike.${searchPattern}`;
      
      // If we found matching customers, inject their IDs into the search
      if (customers && customers.length > 0) {
        const custIds = customers.map(c => c.id).join(',');
        orQuery += `,customer.in.(${custIds})`;
      }

      // 3. Fetch the submittals matching the job name, quote number, mask, OR the customer IDs
      // (Added quote_number_mask to the select statement)
      const { data, error } = await supabase
        .from('quote_submittals')
        .select('id, quote_number, quote_number_mask, job_name, linked_customer:customers!customer(first_name, last_name)')
        .or(orQuery)
        .limit(6);

      if (error) {
        console.error("Search Error:", error.message);
        setResults([]);
      } else {
        setResults(data || []);
        setShowDropdown(true);
        setSelectedIndex(0);
      }
      
      setIsSearching(false);
    };

    const timer = setTimeout(fetchResults, 300);
    return () => clearTimeout(timer);
  }, [query, supabase]);

  const handleSelect = (id: string) => {
    router.push(`/submittals/${id}`);
    setQuery('');
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex].id);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <input 
          type="text" 
          placeholder="Search job, quote #, or customer..."
          className="w-full pl-10 pr-4 py-3 bg-zinc-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
        />
        <div className="absolute left-3 top-3.5 text-zinc-400">
          {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </div>
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100">
            {results.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center justify-between p-4 text-left transition ${
                  index === selectedIndex ? 'bg-blue-50' : 'hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    index === selectedIndex ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-400'
                  }`}>
                    <Hash size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <p className={`text-[10px] font-black uppercase ${
                      index === selectedIndex ? 'text-blue-600' : 'text-zinc-400'
                    }`}>
                      {/* Show the mask if it exists, otherwise fallback to standard number */}
                      {item.quote_number_mask || item.quote_number}
                    </p>
                    <p className="text-sm font-bold text-zinc-900 truncate">
                      {item.job_name} 
                      <span className="text-zinc-400 font-medium ml-2">
                        ({item.linked_customer?.first_name} {item.linked_customer?.last_name})
                      </span>
                    </p>
                  </div>
                </div>
                
                {index === selectedIndex && (
                  <div className="text-blue-600 animate-pulse">
                    <CornerDownLeft size={14} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}