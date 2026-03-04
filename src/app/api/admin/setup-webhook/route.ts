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
    
    // 3. PERSISTENCE LOGIC: Fix "Immediate Expiry"
    const authData = await platform.auth().data();
    
    // Force expires_in to a number and provide a 1-hour fallback
    const expiresInSeconds = Number(authData.expires_in) || 3600;

    await supabase
      .from('settings')
      .update({
        rc_access_token: authData.access_token,
        rc_refresh_token: authData.refresh_token, // Store the new rotation token
        // Robust calculation: Now + (seconds * 1000)
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
    const response = await platform.post('/restapi/v1.0/subscription', {
      eventFilters: [
        "/restapi/v1.0/account/~/telephony/sessions"
      ],
      deliveryMode: {
        transportType: "WebHook",
        address: "https://online-database-chi.vercel.app/api/webhooks/ringcentral"
      },
      expiresIn: 315360000 
    });

    const result = await response.json();
    return NextResponse.json({ message: "Tokens updated and webhook activated!", details: result });
  } catch (error: any) {
    console.error("Setup Webhook Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}