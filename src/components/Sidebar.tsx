'use client';

import Link from 'next/link';
import { LayoutDashboard, FileText, ClipboardList, CheckCircle2, Users, DollarSign, Trash2 } from 'lucide-react';
import UserProfile from './UserProfile';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Inbound Submittals', href: '/submittals', icon: FileText },
  { name: 'Completed Jobs', href: '/jobs', icon: CheckCircle2 },
  { name: 'Financials', href: '/financials', icon: DollarSign },
  { name: 'Customers', href: '/customers', icon: Users },
];

export default function Sidebar({ user }: { user: any }) {
  if (!user) return null;
  
  return (
    <div className="w-64 bg-zinc-900 h-screen text-zinc-300 flex flex-col fixed left-0 top-0">
      <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">P</div>
        <span className="text-xl font-bold text-white">Partition+</span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors group"
          >
            <item.icon size={20} className="text-zinc-500 group-hover:text-blue-400" />
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* NEW: Replaced Call Queue with System Trash */}
      <Link href="/trash" className="flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-2xl transition group mx-2 mb-2">
        <Trash2 size={20} className="text-zinc-500 group-hover:text-red-500 transition-colors" />
        <span className="text-sm font-bold text-zinc-400 group-hover:text-zinc-100 transition-colors">System Trash</span>
      </Link>

      <UserProfile />
    </div>
  );
}