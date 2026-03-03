import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  // 1. Check for the Validation-Token header IMMEDIATELY
  const validationToken = req.headers.get('Validation-Token');

  if (validationToken) {
    console.log("Handshake detected. Responding with token:", validationToken);
    return new Response(null, {
      status: 200,
      headers: { 
        'Validation-Token': validationToken,
        'Content-Type': 'application/json'
      }
    });
  }

  // 2. Only try to parse the body if it's NOT a handshake
  try {
    const body = await req.json();
    console.log("Webhook received data:", body);
    
    // Your logic to save the call to Supabase goes here...
    
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  } catch (err) {
    console.error("Webhook Body Error:", err);
    // Return a 200 anyway so RingCentral doesn't disable your webhook
    return new Response(JSON.stringify({ status: 'ignored' }), { status: 200 });
  }
}