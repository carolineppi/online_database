import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  
  try {
    // 1. Fetch the RingCentral tokens from your settings table
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    if (!settings?.rc_access_token) {
      throw new Error("RingCentral account not linked. Please link your account first.");
    }

    // 2. Register the Webhook with RingCentral
    const rcResponse = await fetch('https://platform.ringcentral.com/restapi/v1.0/subscription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.rc_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventFilters: ["/restapi/v1.0/account/~/telephony/sessions"], // Monitor all calls
        deliveryMode: {
          transportType: "WebHook",
          // Point this to your verified webhook handler
          address: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/ringcentral` 
        },
        expiresIn: 630720000 // 20 years
      })
    });

    const result = await rcResponse.json();

    if (result.errorCode) {
      throw new Error(result.message || "RingCentral API Error");
    }

    return NextResponse.json({ message: "Webhook Registered Successfully!", details: result });
  } catch (error: any) {
    console.error("Webhook Setup Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}