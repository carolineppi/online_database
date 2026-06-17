import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// --- WOOCOMMERCE CORS HEADERS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wc-webhook-topic',
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
  
  // NEW: Grab the webhook topic from the headers to handle race conditions
  const topic = request.headers.get('x-wc-webhook-topic') || ''; 

  // 1. BULLETPROOF PAYLOAD PARSING
  try {
    const rawText = await request.text();
    
    if (!rawText) {
      console.log(">>> [WOOCOMMERCE] Empty payload received. Acknowledging.");
      return NextResponse.json({ message: "Empty payload" }, { status: 200, headers: corsHeaders });
    }

    body = JSON.parse(rawText);
  } catch (parseError: any) {
    console.error(">>> [WOOCOMMERCE] JSON Parse Error:", parseError);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  // 2. VALIDATE REQUIRED WOOCOMMERCE FIELDS
  if (!body || !body.id) {
    console.log(">>> [WOOCOMMERCE] Missing body.id. Acknowledging.");
    return NextResponse.json({ message: "No ID, ignoring" }, { status: 200, headers: corsHeaders });
  }

  const validStatuses = ['processing', 'completed', 'on-hold', 'pending'];
  if (!validStatuses.includes(body.status)) {
    console.log(`>>> [WOOCOMMERCE] Order ${body.id} status is '${body.status}'. Ignoring.`);
    return NextResponse.json({ message: "Status ignored" }, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = await createClient();

    // --- STEP 3: SEARCH FOR EXISTING QUOTE ---
    const quoteNumber = `${body.id}WC`;

    // NEW: If this is an update webhook, pause for 2 seconds. 
    // This allows concurrent 'order.created' webhooks to finish inserting first, eliminating duplicates.
    if (topic === 'order.updated') {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // FIX: Included 'WC' in the ilike query to prevent Order #12 from matching Order #1234WC
    const { data: existingSubmittals, error: searchError } = await supabase
      .from('quote_submittals')
      .select('id, quote_number')
      .ilike('quote_number', `${quoteNumber}%`);

    if (searchError) throw searchError;

    // --- STEP 4: UPDATE EXISTING QUOTE ---
    if (existingSubmittals && existingSubmittals.length > 0) {
      console.log(`>>> [WOOCOMMERCE] Found existing quote for Order ${body.id}. Updating status only.`);
      
      let dbStatus = 'PENDING';
      if (['processing', 'completed'].includes(body.status)) dbStatus = 'WON';

      const { error: updateError } = await supabase
        .from('quote_submittals')
        .update({ status: dbStatus })
        .eq('id', existingSubmittals[0].id);

      if (updateError) throw updateError;
      return NextResponse.json({ success: true, message: "Status updated" }, { headers: corsHeaders });
    }

    // --- STEP 5: CREATING A NEW QUOTE ---
    console.log(`>>> [WOOCOMMERCE] Order ${body.id} not found in DB. Verifying age before creation...`);

    // NEW: Prevent year-old orders from ghost-creating new quotes
    if (body.date_created) {
      const orderDate = new Date(body.date_created);
      const now = new Date();
      const daysOld = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);

      if (daysOld > 14) { 
        console.log(`>>> [WOOCOMMERCE] Order ${body.id} is ${Math.round(daysOld)} days old. Ignoring creation to prevent ghost quotes.`);
        return NextResponse.json({ message: "Order too old to create new quote" }, { status: 200, headers: corsHeaders });
      }
    }

    // --- Proceed with creation ---
    const metaInfo = body.meta_data || [];
    
    const quoteSource = getMetaValue(metaInfo, ['_quote_source', 'quote_source']) || 'Organic / Direct';
    const campaignSource = getMetaValue(metaInfo, ['_campaign_source', 'campaign_source']);
    const termSource = getMetaValue(metaInfo, ['_term_source', 'term_source']);
    const contentSource = getMetaValue(metaInfo, ['_content_source', 'content_source']);
    const sourceUrl = getMetaValue(metaInfo, ['_source_url', 'source_url']);
    
    let dbStatus = 'PENDING';
    if (['processing', 'completed'].includes(body.status)) dbStatus = 'WON';

    const lineItems = body.line_items || [];
    const itemizedBreakdown = lineItems.map((item: any) => ({
      item: item.name,
      qty: item.quantity
    }));
    
    const totalQuantity = lineItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    const total = body.total || 0;

    const billing = body.billing || {};
    const shipping = body.shipping || {};
    const company = billing.company || shipping.company;
    const firstName = billing.first_name || shipping.first_name || 'Online';
    const lastName = billing.last_name || shipping.last_name || 'Customer';
    
    const jobName = company ? `${company} - WooCommerce` : `${firstName} ${lastName} - WooCommerce`;

    const shippingAddress = [
      shipping.address_1,
      shipping.address_2,
      shipping.city ? `${shipping.city},` : '',
      shipping.state,
      shipping.postcode
    ].filter(Boolean).join(' ').trim() || 'No shipping address provided';

    const customerNotes = body.customer_note ? `Customer Note: ${body.customer_note}` : '';
    const formattedNotes = [
      customerNotes,
      `Payment Method: ${body.payment_method_title || 'Unknown'}`
    ].filter(Boolean).join('\n\n');

    // --- STEP 6: UPSERT CUSTOMER ---
    let { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', billing.email || 'no-email@woocommerce.com')
      .single();

    if (!customer) {
      const { data: newCustomer, error: createCustError } = await supabase
        .from('customers')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          email: billing.email || 'no-email@woocommerce.com',
          phone: billing.phone || null
        }])
        .select('id')
        .single();
        
      if (createCustError) throw createCustError;
      customer = newCustomer;
    }

    // --- STEP 7: CREATE THE NEW SUBMITTAL ---
    const { data: newSubmittal, error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name: jobName,
        quote_number: quoteNumber, 
        quote_number_mask: quoteNumber,
        status: dbStatus,
        customer: customer!.id,
        notes: formattedNotes,
        zip_code: shipping?.postcode || billing?.postcode || null,
        shipping_address: shippingAddress,
        quote_source: quoteSource,
        campaign_source: campaignSource,
        term_source: termSource,
        content_source: contentSource,
        source_url: sourceUrl,
        source: 'WooCommerce'
      }])
      .select('id')
      .single();

    if (subError) throw subError;

    // --- STEP 8: CREATE AUTOMATIC QUOTE OPTION ---
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
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}