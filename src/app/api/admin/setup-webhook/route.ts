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
    redirectUri: process.env.RC_REDIRECT_URI // Crucial for the refresh handshake
  });

  const platform = rcsdk.platform();
  await platform.auth().setData({ refresh_token: tokens.rc_refresh_token });
  await platform.refresh(); // This will now work because the Redirect URI matches

  // Inside your setup-webhook GET function...
  try {
    await platform.auth().setData({ refresh_token: tokens.rc_refresh_token });
    await platform.refresh();

    // 1. FETCH existing subscriptions
    const subsResponse = await platform.get('/restapi/v1.0/subscription');
    const subsData = await subsResponse.json();

    // 2. DELETE all existing subscriptions to clear the slate
    if (subsData.records && subsData.records.length > 0) {
      for (const sub of subsData.records) {
        await platform.delete(`/restapi/v1.0/subscription/${sub.id}`);
        console.log(`Deleted old subscription: ${sub.id}`);
      }
    }

    // 3. CREATE the new account-wide subscription
    const response = await platform.post('/restapi/v1.0/subscription', {
      eventFilters: [
        "/restapi/v1.0/account/~/telephony/sessions" // Account-wide filter
      ],
      deliveryMode: {
        transportType: "WebHook",
        address: "https://online-database-chi.vercel.app/api/webhooks/ringcentral"
      },
      expiresIn: 315360000 
    });

    const result = await response.json();
    return NextResponse.json({ message: "Old subscriptions cleared and new one created!", details: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}