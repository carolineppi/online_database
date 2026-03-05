import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// 1. Helper function to ensure we always have a fresh token
async function getFreshToken(supabase: any) {
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (!settings?.rc_refresh_token) throw new Error("No refresh token in database");

  const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.RC_CLIENT_ID,
    clientSecret: process.env.RC_CLIENT_SECRET,
    redirectUri: process.env.RC_REDIRECT_URI
  });

  const platform = rcsdk.platform();

  // Load existing tokens into the SDK
  await platform.auth().setData({
    access_token: settings.rc_access_token,
    refresh_token: settings.rc_refresh_token
  });

  try {
    // Attempt the refresh
    const refreshResponse = await platform.refresh();
    const newData = await refreshResponse.json();

    // CRITICAL: Save the NEW refresh token immediately to prevent "Token Revoked" errors
    await supabase
      .from('settings')
      .update({
        rc_access_token: newData.access_token,
        rc_refresh_token: newData.refresh_token,
        rc_token_expiry: new Date(Date.now() + newData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    return newData.access_token;
  } catch (error: any) {
    console.error("Self-Healing Refresh Failed:", error.message);
    throw new Error("Auth Refresh Failed: Re-link account in Settings");
  }
}

export async function GET(req: Request) {
  const supabase = await createClient();

  try {
    // 2. Get the authenticated token
    const accessToken = await getFreshToken(supabase);

    // 3. Check RingCentral Subscriptions
    const rcResponse = await fetch('https://platform.ringcentral.com/restapi/v1.0/subscription', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!rcResponse.ok) {
      const errorData = await rcResponse.json();
      throw new Error(`RC API Error: ${errorData.message || rcResponse.statusText}`);
    }

    const data = await rcResponse.json();

    return NextResponse.json({
      status: "Success",
      count: data.records?.length || 0,
      subscriptions: data.records || []
    });

  } catch (error: any) {
    console.error("Check Subscriptions Error:", error.message);
    return NextResponse.json({ 
      error: error.message,
      suggestion: "If refresh failed, manually re-link in /settings" 
    }, { status: 500 });
  }
}