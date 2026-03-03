import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  // 1. Check for the Validation-Token header IMMEDIATELY
  const validationToken = req.headers.get('Validation-Token');

  if (validationToken) {
    console.log("Handshake detected. Responding with token:", validationToken);
    return new Response(null, {
      status: 200,
      headers: { 
        'Validation-Token': validationToken,
        'Content-Type': 'application/json'
      }
    });
  }

  // 2. Only try to parse the body if it's NOT a handshake
  try {
    const body = await req.json();
    
    // Navigate the RingCentral JSON structure to find the phone number
    const party = body.body?.parties?.[0];
    const phoneNumber = party?.from?.phoneNumber || "Unknown";
    const callerName = party?.from?.name || "Unknown Caller";
    const status = party?.status?.code === 'Disconnected' ? 'processed' : 'active';

    const supabase = await createClient();

    const { error } = await supabase
      .from('ringcentral_calls')
      .insert([{
        phone_number: phoneNumber,
        caller_name: callerName,
        status: status,
        raw_data: body // Store everything just in case
      }]);

    if (error) throw error;

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 }); 
  }
}