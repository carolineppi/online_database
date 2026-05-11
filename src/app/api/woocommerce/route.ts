import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// --- WOOCOMMERCE CORS HEADERS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- PREFLIGHT HANDLER ---
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  console.log(">>> [WOOCOMMERCE WEBHOOK] Hit Received");

  let body;

  // 1. BULLETPROOF PAYLOAD PARSING
  try {
    const rawText = await request.text();
    
    if (!rawText) {
      console.log(">>> [WOOCOMMERCE] Empty payload received. Acknowledging.");
      return NextResponse.json({ message: "Empty payload" }, { status: 200, headers: corsHeaders });
    }

    body = JSON.parse(rawText);
  } catch (e) {
    console.error(">>> [WOOCOMMERCE PARSE ERROR]: Could not parse JSON.", e);
    // Return 200 so WooCommerce doesn't disable the webhook due to a parsing failure on a weird ping
    return NextResponse.json({ message: "Unprocessable payload, but acknowledged" }, { status: 200, headers: corsHeaders });
  }

  // 2. HANDLE WOOCOMMERCE PING EVENT
  if (body?.webhook_id) {
    console.log(">>> [WOOCOMMERCE] Webhook Ping Successful! ID:", body.webhook_id);
    return NextResponse.json({ message: "Webhook ping received" }, { status: 200, headers: corsHeaders });
  }

  // 3. IGNORE NON-ACTIONABLE ORDERS
  if (body?.status === 'failed' || body?.status === 'cancelled') {
    return NextResponse.json({ message: "Ignored order status" }, { status: 200, headers: corsHeaders });
  }

  // Ensure it's a real order payload before hitting the database
  if (!body?.id || !body?.billing?.email) {
    return NextResponse.json({ message: "Missing order_id or email, ignoring." }, { status: 200, headers: corsHeaders });
  }

  // --- SAFE DATABASE OPERATIONS BEGIN HERE ---
  try {
    const supabase = await createClient();

    const { 
      id: order_id, 
      billing, 
      shipping, 
      line_items, 
      total, 
      customer_note 
    } = body;

    const rawPhone = billing.phone ? billing.phone.toString().replace(/\D/g, '') : '';
    const numericPhone = rawPhone.length >= 10 ? parseInt(rawPhone, 10) : null;

    // Generate Base Number (YY-XXXX)
    const now = new Date();
    const yearSuffix = now.getFullYear().toString().slice(-2); 

    const { data: lastQuote } = await supabase
      .from('quote_submittals')
      .select('quote_number')
      .ilike('quote_number', `${yearSuffix}-%`)
      .order('quote_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSequence = 1;
    if (lastQuote?.quote_number) {
      const parts = lastQuote.quote_number.split('-');
      if (parts.length > 1) {
        const numericMatch = parts[1].match(/^\d{4}/);
        if (numericMatch) nextSequence = parseInt(numericMatch[0]) + 1;
      }
    }

    const paddedSeq = nextSequence.toString().padStart(4, '0');
    const quoteNumber = `${yearSuffix}-${paddedSeq}`;

    // Customer Linking / Creation
    const emailFilter = `email.eq."${billing.email}"`;
    const phoneFilter = numericPhone ? `,phone.eq.${numericPhone}` : '';

    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .or(`${emailFilter}${phoneFilter}`)
      .maybeSingle();

    if (!customer) {
      const { data: newCust, error: custError } = await supabase
        .from('customers')
        .insert([{
          first_name: billing.first_name || 'Web',
          last_name: billing.last_name || 'Customer',
          email: billing.email,
          phone: numericPhone
        }])
        .select()
        .single();
      
      if (custError) throw custError;
      customer = newCust;
    }

    // Format Cart Items
    const cartDetails = line_items?.map((item: any) => {
        return `• ${item.quantity}x ${item.name} (Subtotal: $${item.total})`;
    }).join('\n') || 'No items found.';

    const formattedNotes = `WOOCOMMERCE CART QUOTE REQUEST
Order ID: #${order_id}
Order Total: $${total}

--- CART ITEMS ---
${cartDetails}

--- CUSTOMER NOTES ---
${customer_note || 'None provided.'}`;

    const shippingAddress = shipping?.address_1 
      ? `${shipping.address_1}${shipping.address_2 ? ' ' + shipping.address_2 : ''}, ${shipping.city}, ${shipping.state} ${shipping.postcode}`
      : null;

    // Check for duplicate order submissions
    const jobName = `WooCommerce Order #${order_id}`;
    const { data: existingSubmittal } = await supabase
        .from('quote_submittals')
        .select('id')
        .eq('job_name', jobName)
        .maybeSingle();

    if (existingSubmittal) {
        return NextResponse.json({ message: "Order already exists" }, { status: 200, headers: corsHeaders });
    }

    // Insert Submittal
    const { error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name: jobName,
        quote_number: quoteNumber,
        status: 'PENDING',
        customer: customer!.id,
        notes: formattedNotes,
        zip_code: shipping?.postcode || billing?.postcode || null,
        shipping_address: shippingAddress,
        quote_source: 'WooCommerce',
      }]);

    if (subError) throw subError;

    return NextResponse.json({ success: true, quoteNumber }, { headers: corsHeaders });

  } catch (err: any) {
    // If the database fails, log it to Vercel but still return a 200 so WooCommerce doesn't disable the webhook
    console.error(">>> [WOOCOMMERCE DB ERROR]:", err.message);
    return NextResponse.json({ error: "Database operation failed, check Vercel logs" }, { status: 200, headers: corsHeaders });
  }
}