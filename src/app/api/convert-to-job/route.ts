import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { quoteId, optionId, price } = await request.json();

  try {
    // 1. Create the Job record (Linking the winning option)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([{
          quote_id: quoteId,
          accepted_individual_quote: optionId,
          sale_amount: Number(price),
          estimated_cost: 0.01,
          actual_cost: 0,
      }])
      .select().single();

    if (jobError) throw jobError;

    // 2. FORCE the Status Update on quote_submittals
    // We explicitly log this to see if it fails
    const { error: submittalError } = await supabase
      .from('quote_submittals')
      .update({ status: 'Won' })
      .eq('id', quoteId);

    if (submittalError) {
      console.error("STATUS UPDATE FAILED:", submittalError.message);
      // We throw here so the catch block handles the response
      throw new Error(`Job created, but status update failed: ${submittalError.message}`);
    }

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}