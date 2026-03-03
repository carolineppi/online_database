import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const body = await req.json();

  // Validate this is a RingCentral Telephony Session event
  const phoneNumber = body.body?.parties?.[0]?.from?.phoneNumber;
  const callerName = body.body?.parties?.[0]?.from?.name;

  if (phoneNumber) {
    await supabase.from('ringcentral_calls').insert([{
      call_id: body.body.telephonySessionId,
      phone_number: phoneNumber,
      caller_name: callerName
    }]);
  }

  return NextResponse.json({ ok: true });
}