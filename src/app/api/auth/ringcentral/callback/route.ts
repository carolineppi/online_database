import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';

export async function refreshRCToken() {
  const supabase = await createClient();

  // 1. Fetch current tokens from Supabase
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (!settings?.rc_refresh_token) throw new Error("No refresh token found");

  // 2. Initialize the SDK
  const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.RC_CLIENT_ID,
    clientSecret: process.env.RC_CLIENT_SECRET,
    redirectUri: process.env.RC_REDIRECT_URI
  });

  const platform = rcsdk.platform();

  // 3. Set the current (stale) tokens into the platform object
  await platform.auth().setData({
    access_token: settings.rc_access_token,
    refresh_token: settings.rc_refresh_token
  });

  try {
    // 4. Perform the refresh
    const response = await platform.refresh();
    const newData = await response.json();

    // 5. CRITICAL: Save the NEW refresh token immediately
    // If you don't do this, the old one is "burned" and useless
    const { error: updateError } = await supabase
      .from('settings')
      .update({
        rc_access_token: newData.access_token,
        rc_refresh_token: newData.refresh_token,
        rc_token_expiry: new Date(Date.now() + newData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    if (updateError) throw updateError;
    
    return newData.access_token;
  } catch (error: any) {
    console.error("Token Refresh Failed:", error.message);
    throw error;
  }
}