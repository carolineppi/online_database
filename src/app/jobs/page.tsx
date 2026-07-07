import { createClient } from '@/utils/supabase/server';
import JobsTable from '@/components/JobsTable';

// NEW: Locks the boundary to exactly Midnight Eastern Time, respecting DST
const getEasternISO = (dateString: string, isEnd: boolean) => {
  if (!dateString) return '';
  const time = isEnd ? '23:59:59.999' : '00:00:00.000';
  const d = new Date(`${dateString}T12:00:00Z`);
  const tzString = d.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" });
  const offset = tzString.includes("EDT") ? "-04:00" : "-05:00";
  return `${dateString}T${time}${offset}`;
};

export default async function ActiveJobsPage() {
  const supabase = await createClient();

  // Get the first day of the current month in YYYY-MM-DD format
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const firstDayString = `${year}-${month}-01`;
  
  // Calculate the exact Eastern Time ISO string for that first day
  const exactFirstDay = getEasternISO(firstDayString, false);

  const { data: activeJobs, error } = await supabase
    .from('jobs')
    .select('*, quote_submittals!fk_jobs_to_submittals (*)')
    .gte('created_at', exactFirstDay) // Accurately filters to Midnight EST!
    .order('created_at', { ascending: false });

  if (error) console.error("Jobs Fetch Error:", error);

  return (
    <main className="pl-64 min-h-screen bg-gray-50">
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Sold Jobs</h1>
        <p className="text-zinc-500">Update estimated costs to finalize project margins.</p>
      </header>

      {/* Pass the data to the Client Component table */}
      <JobsTable initialJobs={activeJobs || []} />
    </div>
    </main>
  );
}