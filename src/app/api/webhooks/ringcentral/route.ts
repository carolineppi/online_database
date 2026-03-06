import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  const validationToken = req.headers.get('Validation-Token');
  if (validationToken) {
    return new Response(null, { status: 200, headers: { 'Validation-Token': validationToken } });
  }

  try {
    const body = await req.json();
    
    
    // 1. Find the Session ID (Check multiple possible locations in the RC JSON)
    const sessionId = body.body?.telephonySessionId || body.telephonySessionId;
    
    

    if (!sessionId) {
      console.error(">>> [WEBHOOK ERROR] No telephonySessionId found in payload:", JSON.stringify(body));
      return new Response('Missing Session ID', { status: 200 });
    }


    // 2. Extract Caller Info
    const party = body.body?.parties?.[0] || body.parties?.[0];
    const rawPhone = party?.from?.phoneNumber || "Unknown";
    const callerName = party?.from?.name || "Unknown Caller";
    const direction = body.body?.parties?.[0]?.direction || body.parties?.[0]?.direction;
    const callStatus = party?.status?.code || "Active";
    const calledNumber = party?.to?.phoneNumber || "Unknown";


    if (direction && direction !== 'Inbound') {
    console.log(`>>> [WEBHOOK] Blocking ${direction} call.`);
    return new Response('Inbound calls only', { status: 200 });
    }
    const adKeywords = ['Performance Max', 'Broad Match'];
    const isPaidAd = adKeywords.some(keyword => 
      callerName.toLowerCase().includes(keyword.toLowerCase())
    );

    const supabase = await createClient();

    // 3. Perform the UPSERT
    const { data, error } = await supabase
      .from('ringcentral_calls')
      .upsert({
        telephony_session_id: sessionId, // This is our unique key
        phone_number: rawPhone,
        caller_name: callerName,
        called_number: calledNumber, // Store the employee's number
        is_paid_ad: isPaidAd,        // Store the ad flag
        status: callStatus === 'Disconnected' ? 'processed' : 'active',
        raw_data: body,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'telephony_session_id',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error(">>> [SUPABASE ERROR]", error.message);
      // We return 200 so RC doesn't disable the webhook
      return new Response('Database Error', { status: 200 });
    }

    console.log(`>>> [SUCCESS] Call Logged/Updated: ${sessionId}`);
    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });

  } catch (err: any) {
    console.error(">>> [CRITICAL WEBHOOK CRASH]", err.message);
    return new Response('Internal Error', { status: 200 });
  }
}