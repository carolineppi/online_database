import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// Ensure this is a named export of GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const supabase = await createClient();

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.RC_CLIENT_ID,
    clientSecret: process.env.RC_CLIENT_SECRET,
    redirectUri: process.env.RC_REDIRECT_URI
  });

  try {
    const loginResponse = await rcsdk.platform().login({
      code: code,
      redirect_uri: process.env.RC_REDIRECT_URI
    });

    const tokenData = await loginResponse.json();
    const expiresInSeconds = Number(tokenData.expires_in) || 3600;

    const { error: dbError } = await supabase
      .from('settings')
      .update({
        rc_access_token: tokenData.access_token,
        rc_refresh_token: tokenData.refresh_token,
        rc_token_expiry: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    if (dbError) throw new Error(`Database Update Failed: ${dbError.message}`);

    return NextResponse.redirect(new URL('/settings', req.url));
  } catch (error: any) {
    console.error("RC Auth Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}