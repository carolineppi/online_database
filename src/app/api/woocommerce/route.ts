import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log(">>> [WOOCOMMERCE WEBHOOK] Order Received");

  const supabase = await createClient();

  try {
    const body = await request.json();

    // 1. Ignore Failed or Cancelled Orders
    if (body.status === 'failed' || body.status === 'cancelled') {
      return NextResponse.json({ message: "Ignored order status" }, { status: 200 });
    }

    // WooCommerce Payload Extraction
    const { 
      id: order_id, 
      billing, 
      shipping, 
      line_items, 
      total, 
      customer_note 
    } = body;

    if (!order_id || !billing?.email) {
      return NextResponse.json({ error: "Invalid WooCommerce Payload" }, { status: 400 });
    }

    // 2. Strict Phone Cleaning
    const rawPhone = billing.phone ? billing.phone.toString().replace(/\D/g, '') : '';
    const numericPhone = rawPhone.length >= 10 ? parseInt(rawPhone, 10) : null;

    // --- STEP 3: GENERATE BASE NUMBER (YY-XXXX) ---
    const now = new Date();
    const yearSuffix = now.getFullYear().toString().slice(-2); 

    const { data: lastQuote } = await supabase
      .from('quote_submittals')
      .select('quote_number')
      .ilike('quote_number', `${yearSuffix}-%`)
      .order('quote_number', { ascending: false })
      .limit(1)
      .single();

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

    // --- STEP 4: CUSTOMER LINKING / CREATION ---
    // Search by email first, fallback to phone
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${billing.email}${numericPhone ? `,phone.eq.${numericPhone}` : ''}`)
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

    // --- STEP 5: FORMAT CART ITEMS FOR DASHBOARD ---
    // Maps the WooCommerce cart array into a clean, readable string
    const cartDetails = line_items?.map((item: any) => {
        return `• ${item.quantity}x ${item.name} (Subtotal: $${item.total})`;
    }).join('\n');

    const formattedNotes = `WOOCOMMERCE CART ABANDONMENT / QUOTE REQUEST
Order ID: #${order_id}
Order Total: $${total}

--- CART ITEMS ---
${cartDetails}

--- CUSTOMER NOTES ---
${customer_note || 'None provided.'}`;

    // Format shipping address cleanly
    const shippingAddress = shipping?.address_1 
      ? `${shipping.address_1}${shipping.address_2 ? ' ' + shipping.address_2 : ''}, ${shipping.city}, ${shipping.state} ${shipping.postcode}`
      : null;

    // --- STEP 6: INSERT RECORD ---
    // Check to prevent duplicates if WooCommerce sends multiple events for the same order
    const jobName = `WooCommerce Order #${order_id}`;
    const { data: existingSubmittal } = await supabase
        .from('quote_submittals')
        .select('id')
        .eq('job_name', jobName)
        .maybeSingle();

    if (existingSubmittal) {
        return NextResponse.json({ message: "Order already exists in pipeline" }, { status: 200 });
    }

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

    return NextResponse.json({ success: true, quoteNumber });

  } catch (err: any) {
    console.error(">>> [WOOCOMMERCE ERROR]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}