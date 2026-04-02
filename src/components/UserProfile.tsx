'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings, 
  LogOut, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';

export default function UserProfile() {
  const [employee, setEmployee] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('employee');
    if (saved) {
      setEmployee(JSON.parse(saved));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('employee');
    window.location.href = '/login'; 
  };

  if (!employee) return null;

  return (
    <div className="relative mt-auto border-t border-zinc-800 pt-4 px-2 mb-4">
      {/* Profile Toggle Button - Added 'group' class here */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
          isOpen ? 'bg-zinc-100' : 'hover:bg-zinc-50'
        }`}
      >
        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
          {employee.name_code}
        </div>
        <div className="flex-1 text-left overflow-hidden">
          {/* TEXT COLOR LOGIC: White/light by default, dark when open or hovered */}
          <p className={`text-sm font-bold truncate transition-colors ${
            isOpen ? 'text-zinc-900' : 'text-zinc-100 group-hover:text-zinc-900'
          }`}>
            {employee.first_name} {employee.last_name}
          </p>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Estimator
          </p>
        </div>
        {isOpen ? (
          <ChevronDown size={16} className="text-zinc-400" />
        ) : (
          <ChevronUp size={16} className="text-zinc-500 group-hover:text-zinc-400 transition-colors" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-2 right-2 mb-2 bg-white border border-zinc-100 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
          <button 
            onClick={() => {
              router.push('/settings');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 p-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition border-b border-zinc-50"
          >
            <Settings size={18} className="text-zinc-400" />
            Account Settings
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 text-sm font-bold text-red-600 hover:bg-red-50 transition"
          >
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}