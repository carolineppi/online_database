import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // 1. Get stored tokens - Ensure column names match your SQL setup
  const { data: tokens, error: dbError } = await supabase
    .from('settings')
    .select('rc_refresh_token')
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
    redirectUri: process.env.RC_REDIRECT_URI // ENSURE THIS IS PASSED HERE
  });

  const platform = rcsdk.platform();

  try {
    await platform.auth().setData({ refresh_token: tokens.rc_refresh_token });
    await platform.refresh();
    
    const authData = await platform.auth().data();

    // Explicitly convert expires_in to a Number to fix the build error
    const expiresIn = Number(authData.expires_in) || 3600; 

    await supabase
      .from('settings')
      .update({
        rc_access_token: authData.access_token,
        rc_refresh_token: authData.refresh_token,
        rc_token_expiry: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    // 4. Create the subscription
    // Inside your setup-webhook route
    const response = await platform.post('/restapi/v1.0/subscription', {
      eventFilters: [
        "/restapi/v1.0/account/~/telephony/sessions" // Broadened to the whole account
      ],
      deliveryMode: {
        transportType: "WebHook",
        address: "https://online-database-chi.vercel.app/api/webhooks/ringcentral"
      },
      expiresIn: 315360000 
    });

  const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "RingCentral API Error");
    }

    return NextResponse.json({ message: "Subscription Created!", details: result });
  } catch (error: any) {
    console.error("RC Subscription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}