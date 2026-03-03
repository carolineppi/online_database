import { SDK } from '@ringcentral/sdk';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Fetch tokens with an error guard
    const { data: tokens, error: dbError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (dbError) throw new Error(`Database Query Failed: ${dbError.message}`);
    if (!tokens?.rc_refresh_token) {
      return NextResponse.json({ 
        error: "No tokens found. Please go to Settings and 'Link Account' first." 
      }, { status: 400 });
    }

    // 2. Validate Environment Variables
    if (!process.env.RC_CLIENT_ID || !process.env.RC_CLIENT_SECRET) {
      throw new Error("Missing RC_CLIENT_ID or RC_CLIENT_SECRET in environment variables.");
    }

    const rcsdk = new SDK({
      server: 'https://platform.ringcentral.com',
      clientId: process.env.RC_CLIENT_ID,
      clientSecret: process.env.RC_CLIENT_SECRET
    });

    const platform = rcsdk.platform();

    // 3. Auth Refresh with Error Handling
    try {
      await platform.auth().setData({ refresh_token: tokens.rc_refresh_token });
      await platform.refresh();
    } catch (authErr: any) {
      return NextResponse.json({ 
        error: "Auth Refresh Failed", 
        details: authErr.message,
        suggestion: "Your session might be dead. Re-link your account in Settings."
      }, { status: 401 });
    }

    // 4. Fetch Subscriptions
    const response = await platform.get('/restapi/v1.0/subscription');
    const result = await response.json();

    return NextResponse.json({
      status: "Success",
      count: result.records?.length || 0,
      subscriptions: result.records
    });

  } catch (error: any) {
    console.error("DEBUG: check-subscriptions crash:", error.message);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}