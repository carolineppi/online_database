import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const supabase = await createClient();

  if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });

  const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.RC_CLIENT_ID,
    clientSecret: process.env.RC_CLIENT_SECRET,
    redirectUri: process.env.RC_REDIRECT_URI
  });

  try {
    // 1. Exchange the code for actual tokens
    const loginResponse = await rcsdk.platform().login({
      code: code,
      redirect_uri: process.env.RC_REDIRECT_URI
    });

    const tokenData = await loginResponse.json();

    // 2. FIX: Robust Expiry Calculation
    // Use Number() to prevent type errors and default to 3600s if missing
    const expiresInSeconds = Number(tokenData.expires_in) || 3600;

    // 3. Save to the fixed ID with the new logic
    const { error: dbError } = await supabase
      .from('settings')
      .update({
        rc_access_token: tokenData.access_token,
        rc_refresh_token: tokenData.refresh_token,
        // Calculate future ISO string: Current Time + Expiry
        rc_token_expiry: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    if (dbError) throw new Error(`Database Update Failed: ${dbError.message}`);

    // 4. Success Redirect
    return NextResponse.redirect(new URL('/settings', req.url)); 
  } catch (error: any) {
    console.error("RC Auth Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}