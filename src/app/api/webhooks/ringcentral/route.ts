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
    
    // 1. Extract the unique Session ID
    const sessionId = body.body?.telephonySessionId;
    if (!sessionId) return new Response('No session ID', { status: 200 });

    // 2. Extract party info
    const party = body.body?.parties?.[0];
    const phoneNumber = party?.from?.phoneNumber || "Unknown";
    const callerName = party?.from?.name || "Unknown Caller";
    const callStatus = party?.status?.code; // e.g., 'Setup', 'Connected', 'Disconnected'

    const supabase = await createClient();

    // 3. Use UPSERT instead of INSERT
    // onConflict: 'telephony_session_id' tells Supabase to update if ID matches
    const { error } = await supabase
      .from('ringcentral_calls')
      .upsert({
        telephony_session_id: sessionId,
        phone_number: phoneNumber,
        caller_name: callerName,
        status: callStatus === 'Disconnected' ? 'processed' : 'active',
        raw_data: body,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'telephony_session_id' 
      });

    if (error) throw error;

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error' }), { status: 200 });
  }
}