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

// --- HELPER: EXTRACT METADATA ---
const getMetaValue = (metaArray: any[], keysToFind: string[]) => {
  if (!metaArray || !Array.isArray(metaArray)) return null;
  const found = metaArray.find((m: any) => keysToFind.includes(m.key));
  return found ? found.value : null;
};

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
      customer_note,
      meta_data
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

    // --- STEP 5: DATA PREPARATION ---
    
    // Map the cart items into the exact JSON array expected by AddOptionModal
    const itemizedBreakdown = line_items?.map((item: any) => ({
      item: item.name,
      qty: item.quantity
    })) || [];

    // Calculate the total item quantity
    const totalQuantity = itemizedBreakdown.reduce((sum: number, i: any) => sum + (Number(i.qty) || 0), 0);

    // Keep the general notes clean, stripping out the cart items since they will be their own quote option now
    const formattedNotes = `WOOCOMMERCE CART QUOTE REQUEST
Order ID: #${order_id}

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

    // Attribution Parsing
    const quoteSource = getMetaValue(meta_data, ['_wc_order_attribution_utm_source', '_wc_order_attribution_source_type', 'utm_source']) || 'WooCommerce / Direct';
    const campaignSource = getMetaValue(meta_data, ['_wc_order_attribution_utm_campaign', 'utm_campaign', 'gad_campaignid']);
    const termSource = getMetaValue(meta_data, ['_wc_order_attribution_utm_term', 'utm_term']);
    const contentSource = getMetaValue(meta_data, ['_wc_order_attribution_utm_content', 'utm_content']);
    const sourceUrl = getMetaValue(meta_data, ['_wc_order_attribution_session_entry', 'submission_url']);

// --- STEP 6: INSERT RECORD ---
    // Added `.select().single()` to return the new ID
    const { data: newSubmittal, error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name: jobName,
        quote_number: quoteNumber,
        status: 'Pending',
        customer: customer!.id,
        notes: formattedNotes,
        zip_code: shipping?.postcode || billing?.postcode || null,
        shipping_address: shippingAddress,
        quote_source: quoteSource,
        campaign_source: campaignSource,
        term_source: termSource,
        content_source: contentSource,
        source_url: sourceUrl,
        source: 'WooCommerce' // <-- Added this line to trigger your frontend logic!
      }])
      .select('id')
      .single();

    if (subError) throw subError;

    // --- STEP 7: CREATE AUTOMATIC QUOTE OPTION ---
    if (newSubmittal && itemizedBreakdown.length > 0) {
      const { error: quoteError } = await supabase
        .from('individual_quotes')
        .insert([{
          quote_id: newSubmittal.id,
          material: "Bathroom Accessories per Attached Submittal",
          mounting_style: "Accessories Only",
          manufacturer: "Partition Plus",
          details: null,
          color: null,
          shipping_included: "Includes Shipping",
          itemized_breakdown: itemizedBreakdown,
          quantity: totalQuantity,
          price: Number(total) || 0
        }]);
        
      if (quoteError) throw quoteError;
    }

    return NextResponse.json({ success: true, quoteNumber }, { headers: corsHeaders });

  } catch (err: any) {
    console.error(">>> [WOOCOMMERCE DB ERROR]:", err.message);
    return NextResponse.json({ error: "Database operation failed, check Vercel logs" }, { status: 200, headers: corsHeaders });
  }
}