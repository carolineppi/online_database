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
    redirectUri: process.env.RC_REDIRECT_URI // This one is camelCase for the constructor
  });

  try {
    // 1. Exchange the code for actual tokens
    // Exchange code for token
    const loginResponse = await rcsdk.platform().login({
      code: code,
      redirect_uri: process.env.RC_REDIRECT_URI // MUST be snake_case
    });

    const tokenData = await loginResponse.json();

    // Save to the fixed ID
    await supabase
      .from('settings')
      .update({
        rc_access_token: tokenData.access_token,
        rc_refresh_token: tokenData.refresh_token,
        rc_token_expiry: new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Success Redirect
    return NextResponse.redirect(new URL('/calls', req.url)); 
  } catch (error: any) {
    console.error("RC Auth Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}