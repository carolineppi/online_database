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
  // 1. Manually set the refresh token into the platform's auth data
  const auth = platform.auth();
  await auth.setData({
    refresh_token: tokens.rc_refresh_token,
  });

  // 2. Perform a refresh instead of a login
  // This automatically uses the refresh_token to get a new access_token
  await platform.refresh();

  // 3. Register the Webhook
  const response = await platform.post('/restapi/v1.0/subscription', {
    eventFilters: [
      "/restapi/v1.0/account/~/extension/~/telephony/sessions"
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