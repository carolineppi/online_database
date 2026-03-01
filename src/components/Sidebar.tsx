
import Link from 'next/link';
import { LayoutDashboard, FileText, ClipboardList, CheckCircle2, Users, DollarSign } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Inbound Submittals', href: '/submittals', icon: FileText },
  { name: 'Active Quotes', href: '/quotes', icon: ClipboardList },
  { name: 'Completed Jobs', href: '/jobs', icon: CheckCircle2 },
  { name: 'Financials', href: '/financials', icon: DollarSign }, // Add this line
  { name: 'Customers', href: '/customers', icon: Users }, // Added link
];

export function Sidebar() {
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

      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
        Project Manager View (No Auth)
      </div>
    </div>
  );
}