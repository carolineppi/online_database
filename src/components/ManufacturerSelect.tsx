'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';

export default function ManufacturerSelect({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [options, setOptions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const supabase = createClient();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchManufacturers = async () => {
      const { data } = await supabase.from('manufacturers').select('name').order('name');
      if (data) setOptions(data.map(m => m.name));
    };
    fetchManufacturers();
  }, [supabase]);

  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents the dropdown from opening when clearing
    onChange('');
    setSearch('');
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') setIsOpen(true);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) {
          onChange(filtered[activeIndex]);
          setIsOpen(false);
          setSearch('');
        } else if (search && !options.includes(search)) {
          handleAddNew();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const handleAddNew = async () => {
    if (!search) return;
    const { error } = await supabase.from('manufacturers').insert([{ name: search }]);
    if (!error) {
      setOptions(prev => [...prev, search].sort());
      onChange(search);
      setIsOpen(false);
      setSearch('');
    }
  };

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Manufacturer</label>
      
      <div 
        tabIndex={0} 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border rounded-xl bg-white flex justify-between items-center cursor-pointer hover:border-blue-400 focus:ring-2 focus:ring-blue-500 outline-none transition group"
      >
        <span className={value ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>
          {value || 'Select or type...'}
        </span>
        
        <div className="flex items-center gap-2">
          {/* Clear Button: Only shows if a value exists */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-zinc-600 transition"
            >
              <X size={14} />
            </button>
          )}
          <ChevronsUpDown size={16} className="text-zinc-400" />
        </div>
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden"
          style={{ zIndex: 9999, top: '100%', position: 'absolute' }}
        >
          <input 
            autoFocus
            className="w-full p-3 border-b outline-none text-sm"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(0); }}
          />
          <div className="max-h-48 overflow-y-auto" ref={listRef}>
            {filtered.map((opt, index) => (
              <div 
                key={opt}
                onClick={() => { onChange(opt); setIsOpen(false); }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`p-3 text-sm cursor-pointer flex justify-between items-center transition ${
                  activeIndex === index ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'
                }`}
              >
                {opt}
                {value === opt && <Check size={14} className={activeIndex === index ? 'text-white' : 'text-blue-600'} />}
              </div>
            ))}
            
            {search && !options.includes(search) && (
              <div 
                onClick={handleAddNew}
                className={`p-3 text-sm font-bold cursor-pointer flex items-center gap-2 ${
                  activeIndex === -1 ? 'bg-blue-100 text-blue-700' : 'text-blue-600 bg-blue-50'
                }`}
              >
                <Plus size={14} /> Add "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}