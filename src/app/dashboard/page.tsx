import Image from "next/image";
import { createClient } from '@/utils/supabase/server';
import RecentActivity from '@/components/RecentActivity';

export default function DashboardPage() {
  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="md:col-span-2">
          <h1 className="text-3xl font-bold mb-6">Sales Overview</h1>
          {/* Your existing stats cards or charts go here */}
        </div>

        {/* Sidebar Activity Feed */}
        <div className="md:col-span-1">
          <RecentActivity />
        </div>

      </div>
    </main>
  );
}