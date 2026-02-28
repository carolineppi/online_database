import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { first_name, last_name, email, phone, job_name, pdf_base64 } = body;

  try {
    // 1. Logic for nextSeq and Customer Linking (Keep from previous step)
    const body = await request.json();
    const { first_name, last_name, email, phone, job_name, additional_notes } = body;

    // 1. Generate the sequential quote number
    // We use 'WEB' as the name_code suffix for online entries
// Inside your POST function
    console.log("Checking database connection...");

    const { data: nextSeq, error: seqError } = await supabase.rpc('get_next_quote_number');

    if (seqError) {
      console.error("RPC Error Details:", seqError.message, seqError.details, seqError.hint);
      return NextResponse.json({ error: "Database sequence error", details: seqError.message }, { status: 500 });
    }

    console.log("Next sequence number obtained:", nextSeq);
    const quoteNumber = `${nextSeq}WEB`;

    // 2. Format phone to pure numeric (bigint compatibility)
    const rawPhone = phone.replace(/\D/g, '');
    const numericPhone = parseInt(rawPhone, 10);

    // 3. Check for existing customer to maintain CRM integrity
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${email},phone.eq.${numericPhone}`)
      .maybeSingle();

    // 4. Create new customer if no match found
    if (!customer) {
      const { data: newCust, error: custError } = await supabase
        .from('customers')
        .insert([{
          first_name,
          last_name,
          email,
          phone: numericPhone
        }])
        .select()
        .single();
      
      if (custError) throw new Error(`Customer creation failed: ${custError.message}`);
      if (!newCust) throw new Error("Customer creation returned no data.");
      
      customer = newCust;
    }
  // 5. Final Safety Check (This satisfies the TypeScript compiler)
  if (!customer?.id) {
    throw new Error("Unable to link or create a customer for this submittal.");
  }

// 2. Upload PDF to Supabase Storage if provided
    let pdfUrl = null;
    if (pdf_base64) {
      const fileName = `${quoteNumber}_original_request.pdf`;
      const buffer = Buffer.from(pdf_base64, 'base64');
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('submittal-pdfs')
        .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('submittal-pdfs').getPublicUrl(fileName);
        pdfUrl = publicUrl;
      }
    }

    // 6. Create the Quote Submittal
    const { data: submittal, error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name,
        quote_number: quoteNumber,
        status: 'Pending',
        customer: customer.id, // TS now knows customer.id exists
        pdf_url: pdfUrl,
        customer_first_name: first_name,
        customer_last_name: last_name,
        notes: additional_notes 
      }])
      .select()
      .single();

    return NextResponse.json({ success: true, quoteNumber });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}