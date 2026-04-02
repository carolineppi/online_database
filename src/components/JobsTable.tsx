'use client';

import { useState } from 'react';
import { TrendingUp, Edit3, PlusCircle, Truck } from 'lucide-react';
import EditJobFinancials from './EditJobFinancials';
import AddOnForm from './AddOnForm'; 
import TrackingMailer from './TrackingMailer'; // Import the new modal

export default function JobsTable({ initialJobs }: { initialJobs: any[] }) {
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [addonData, setAddonData] = useState<{ jobId: string; quoteId: string } | null>(null);
  const [trackingJob, setTrackingJob] = useState<any>(null); // State for Tracking Mailer

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Project</th>
            <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Contract</th>
            <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Est. Cost</th>
            <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Markup</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {initialJobs.map((job) => (
            <tr key={job.id} className="hover:bg-zinc-50/50 transition">
              <td className="px-6 py-4">
                <div className="font-bold text-zinc-900">{job.quote_submittals?.job_name}</div>
                <div className="text-xs text-zinc-400">#{job.quote_submittals?.quote_number}</div>
              </td>
              <td className="px-6 py-4 font-medium">${Number(job.sale_amount).toLocaleString()}</td>
              <td className="px-6 py-4 text-zinc-600">${Number(job.estimated_cost).toLocaleString()}</td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  (job.markup_percent * 100) > 15 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <TrendingUp size={12} />
                  {(job.markup_percent * 100).toFixed(1)}%
                </span>
              </td>
              <td className="px-6 py-4 text-right flex justify-end gap-2">
                {/* NEW: Send Tracking Button */}
                <button 
                  onClick={() => setTrackingJob(job)}
                  className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition"
                  title="Send Tracking Info"
                >
                  <Truck size={18} />
                </button>

                {/* Record Add-On Button
                <button 
                  onClick={() => setAddonData({ jobId: job.id, quoteId: job.quote_id })}
                  className="p-2 hover:bg-zinc-100 text-zinc-600 rounded-lg transition"
                  title="Record Add-on"
                >
                  <PlusCircle size={18} />
                </button> */}

                {/* Edit Financials Button */}
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
          {initialJobs.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-medium">
                No active jobs found. Win a quote to see it here!
              </td>
            </tr>
          )}
        </tbody>
      </table>

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

      {/* NEW: Render the Tracking Mailer Modal */}
      {trackingJob && (
        <TrackingMailer 
          job={trackingJob} 
          onClose={() => setTrackingJob(null)} 
        />
      )}
    </div>
  );
}