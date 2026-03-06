import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // 1. Get stored tokens - Added select('*') to get the existing expiry
  const { data: tokens, error: dbError } = await supabase
    .from('settings')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (dbError || !tokens?.rc_refresh_token) {
    return NextResponse.json({ 
      error: "No refresh token found in database. Please link your account in Settings first." 
    }, { status: 400 });
  }

  const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.RC_CLIENT_ID,
    clientSecret: process.env.RC_CLIENT_SECRET,
    redirectUri: process.env.RC_REDIRECT_URI
  });

  const platform = rcsdk.platform();

  try {
    // 2. CONSOLIDATED REFRESH LOGIC
    await platform.auth().setData({ refresh_token: tokens.rc_refresh_token });
    await platform.refresh();
    
    // 3. PERSISTENCE LOGIC
    const authData = await platform.auth().data();
    const expiresInSeconds = Number(authData.expires_in) || 3600;

    await supabase
      .from('settings')
      .update({
        rc_access_token: authData.access_token,
        rc_refresh_token: authData.refresh_token,
        rc_token_expiry: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    // 4. FETCH existing subscriptions
    const subsResponse = await platform.get('/restapi/v1.0/subscription');
    const subsData = await subsResponse.json();

    // 5. DELETE all existing subscriptions to clear the slate
    if (subsData.records && subsData.records.length > 0) {
      for (const sub of subsData.records) {
        await platform.delete(`/restapi/v1.0/subscription/${sub.id}`);
      }
    }

    // 6. CREATE the new account-wide subscription
    const response = await fetch('https://platform.ringcentral.com/restapi/v1.0/subscription', {
      method: 'POST',
      headers: {
        // FIX: Use authData.access_token instead of the undefined access_token
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventFilters: [
          "/restapi/v1.0/account/~/telephony/sessions?direction=Inbound"
        ],
        deliveryMode: {
          transportType: "WebHook",
          address: process.env.RC_WEBHOOK_URL
        },
        expiresIn: 315360000 
      })
    });

    const result = await response.json();
    
    // Success handling: RingCentral returns a 200/201 on success
    return NextResponse.json({ 
      message: "Slate cleared and Inbound-only webhook activated!", 
      details: result 
    });
  } catch (error: any) {
    console.error("Setup Webhook Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}