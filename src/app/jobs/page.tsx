import { createClient } from '@/utils/supabase/server';
import JobsTable from '@/components/JobsTable';

export default async function ActiveJobsPage() {
  const supabase = await createClient();

  // Fetch jobs with the joined submittal name
  // Inside your jobs fetch logic
  const { data: activeJobs, error } = await supabase
    .from('jobs')
    .select(`
      *,
      quote_submittals!fk_jobs_quote_submittal (*) // <--- USE THE NEW CONSTRAINT NAME
    `)
    .order('created_at', { ascending: false });

  if (error) console.error("Jobs Fetch Error:", error);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Active Jobs</h1>
        <p className="text-zinc-500">Update estimated costs to finalize project margins.</p>
      </header>

      {/* Pass the data to the Client Component table */}
      <JobsTable initialJobs={activeJobs || []} />
    </div>
  );
}