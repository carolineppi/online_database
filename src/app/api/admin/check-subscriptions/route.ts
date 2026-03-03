import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: tokens } = await supabase.from('settings').select('*').single();

  const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.RC_CLIENT_ID,
    clientSecret: process.env.RC_CLIENT_SECRET
  });

  const platform = rcsdk.platform();
  await platform.auth().setData({ refresh_token: tokens.rc_refresh_token });
  await platform.refresh();

  // Fetch all active webhooks for this account
  const response = await platform.get('/restapi/v1.0/subscription');
  const result = await response.json();

  return NextResponse.json(result);
}