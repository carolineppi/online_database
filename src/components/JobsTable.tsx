'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, Edit3, PlusCircle, Truck, Calendar } from 'lucide-react';
import EditJobFinancials from './EditJobFinancials';
import AddOnForm from './AddOnForm'; 
import TrackingMailer from './TrackingMailer'; 

// Helper to get YYYY-MM-DD for our default date states
const getDefaults = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const format = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: format(firstDay),
    end: format(today)
  };
};

export default function JobsTable({ initialJobs }: { initialJobs: any[] }) {
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [addonData, setAddonData] = useState<{ jobId: string; quoteId: string } | null>(null);
  const [trackingJob, setTrackingJob] = useState<any>(null);

  // 1. Set up Date Filter State
  const defaults = getDefaults();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  // 2. Filter the jobs using actual Date objects (Timezone safe!)
  const filteredJobs = useMemo(() => {
    // Create strict boundary dates using the local timezone
    const start = new Date(`${startDate}T00:00:00`);
    
    // For the end date, we push it to the very last millisecond of the day 
    // to ensure jobs created late in the afternoon are still included!
    const end = new Date(`${endDate}T23:59:59.999`);

    return initialJobs.filter(job => {
      if (!job.created_at) return false;
      
      const jobDate = new Date(job.created_at);
      
      // Compare the exact timestamps
      return jobDate >= start && jobDate <= end;
    });
  }, [initialJobs, startDate, endDate]);

  return (
    <div className="space-y-4">
      {/* Date Filters UI */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar size={20} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Start Date</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-zinc-700"
              />
            </div>
            <span className="text-zinc-300 mt-5 font-bold">-</span>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">End Date</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-zinc-700"
              />
            </div>
          </div>
        </div>
        
        <div className="text-sm text-zinc-500 font-medium px-2">
          Showing <span className="font-black text-blue-600 text-base">{filteredJobs.length}</span> active jobs
        </div>
      </div>

      {/* Existing Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Project</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Contract</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Actual Cost</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Markup</th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredJobs.map((job) => (
              <tr key={job.id} className="hover:bg-zinc-50/50 transition">
                <td className="px-6 py-4">
                  <span className="font-medium text-zinc-900 text-sm">
                    {job.quote_submittals?.job_name || 'Untitled Project'}
                  </span>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                    {new Date(job.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-zinc-700">
                  ${Number(job.sale_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-zinc-700">
                  ${Number(job.actual_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-emerald-600">
                  ${Number(job.markup_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                  <button 
                    onClick={() => setSelectedJob(job)}
                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                    title="Edit Financials"
                  >
                    <Edit3 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredJobs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-medium">
                  No active jobs found for this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Render Edit Slide-over */}
      {selectedJob && (
        <EditJobFinancials 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
        />
      )}

      {/* Render the Add-On Modal */}
      {addonData && (
        <AddOnForm 
          quoteId={addonData.quoteId} 
          onClose={() => setAddonData(null)} 
        />
      )}

      {/* Render the Tracking Mailer Modal */}
      {trackingJob && (
        <TrackingMailer 
          job={trackingJob} 
          onClose={() => setTrackingJob(null)} 
        />
      )}
    </div>
  );
}