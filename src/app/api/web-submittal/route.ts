import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log(">>> [WEBHOOK] API Entry Point Reached");

  const supabase = await createClient();

  try {
    const body = await request.json();
    const { 
      first_name, 
      last_name, 
      email, 
      phone, 
      job_name, 
      notes, 
      additional_notes,
      pdf_base64 
    } = body;

    // 1. Strict Phone Cleaning
    const rawPhone = phone ? phone.toString().replace(/\D/g, '') : '';
    const numericPhone = parseInt(rawPhone, 10);
    
    if (isNaN(numericPhone) || rawPhone.length < 10) {
        return NextResponse.json({ error: "Invalid phone format" }, { status: 400 });
    }

    // 2. Get Next Quote Number
    const { data: nextSeq, error: seqError } = await supabase.rpc('get_next_quote_number');
    if (seqError) throw new Error(`Sequence Error: ${seqError.message}`);
    
    const quoteNumber = `${nextSeq}WEB`;

    // 3. Customer Linking / Creation (The "Single Source of Truth")
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${email},phone.eq.${numericPhone}`)
      .maybeSingle();

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
      
      if (custError) throw custError;
      customer = newCust;
    }

    // 4. PDF Upload Logic
    let pdfUrl = null;
    if (pdf_base64) {
        const fileName = `${quoteNumber}_request.pdf`;
        const buffer = Buffer.from(pdf_base64, 'base64');
        const { error: uploadError } = await supabase.storage
            .from('submittal-pdfs')
            .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('submittal-pdfs').getPublicUrl(fileName);
            pdfUrl = publicUrl;
        }
    }

    // 5. INSERT: Notice we only send the 'customer' ID link now
    const { data: submittal, error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name: job_name || "Online Request",
        quote_number: quoteNumber,
        status: 'Pending',
        customer: customer!.id, // The Foreign Key link
        pdf_url: pdfUrl,
        notes: notes || additional_notes || ""
      }])
      .select()
      .single();

    if (subError) throw subError;

    console.log(">>> [SUCCESS] Submittal created:", quoteNumber);
    return NextResponse.json({ success: true, quoteNumber });

  } catch (err: any) {
    console.error(">>> [CRITICAL ERROR]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}