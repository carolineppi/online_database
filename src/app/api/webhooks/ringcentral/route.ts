import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  const validationToken = req.headers.get('Validation-Token');
  if (validationToken) {
    return new Response(null, {
      status: 200,
      headers: { 'Validation-Token': validationToken }
    });
  }

  try {
    const body = await req.json();
    const supabase = await createClient();

    // Safely extract data using optional chaining
    const party = body.body?.parties?.[0];
    const phoneNumber = party?.from?.phoneNumber || "Unknown";
    const callerName = party?.from?.name || "Unknown Caller";
    
    // Logic: If status is 'Disconnected', mark it as 'processed'
    const status = party?.status?.code === 'Disconnected' ? 'processed' : 'active';

    const { error } = await supabase
      .from('ringcentral_calls')
      .insert([{
        phone_number: phoneNumber,
        caller_name: callerName,
        status: status,
        raw_data: body // This matches the new column
      }]);

    if (error) {
      console.error("Supabase Insert Error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
  } catch (err: any) {
    console.error("Webhook Logic Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}