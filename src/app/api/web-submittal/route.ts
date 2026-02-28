import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log(">>> [WEBHOOK] API Entry Point Reached");

  // Use the Service Role Key via the server client to bypass RLS
  const supabase = await createClient();

  try {
    // 1. Read the body ONCE
    const body = await request.json();
    console.log(">>> [DATA] Received from PHP:", body.email);

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

    // 2. Strict Phone Cleaning (BigInt compatibility)
    // Strips all non-numeric characters so (410) 702-5050 becomes 4107025050
    const rawPhone = phone ? phone.toString().replace(/\D/g, '') : '';
    const numericPhone = parseInt(rawPhone, 10);
    
    if (isNaN(numericPhone) || rawPhone.length < 10) {
        console.error(">>> [VALIDATION ERROR] Invalid phone format:", phone);
        return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
    }

    // 3. Get Next Quote Number from Sequence
    console.log(">>> [DB] Fetching sequence number...");
    const { data: nextSeq, error: seqError } = await supabase.rpc('get_next_quote_number');
    
    if (seqError) {
        console.error(">>> [DB ERROR] Sequence RPC failed:", seqError.message);
        throw new Error(`Sequence Error: ${seqError.message}`);
    }
    const quoteNumber = `${nextSeq}WB`;
    console.log(">>> [DB] Generated Quote Number:", quoteNumber);

    // 4. Customer Linking / Creation Logic
    console.log(">>> [DB] Checking for existing customer...");
    let { data: customer, error: findError } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${email},phone.eq.${numericPhone}`)
      .maybeSingle();

    if (findError) {
        console.error(">>> [DB ERROR] Customer lookup failed:", findError.message);
    }

    if (!customer) {
      console.log(">>> [DB] No customer found. Creating new record...");
      const { data: newCust, error: custError } = await supabase
        .from('customers')
        .insert([{
          first_name: first_name,
          last_name: last_name,
          email: email,
          phone: numericPhone
        }])
        .select()
        .single();
      
      if (custError) {
          console.error(">>> [DB ERROR] Customer creation failed:", custError.message);
          throw custError;
      }
      customer = newCust;
    }

    if (!customer?.id) {
        throw new Error("Critical Error: No customer ID available for linking.");
    }

    // 5. PDF Upload Logic (Optional based on payload)
    let pdfUrl = null;
    if (pdf_base64 && pdf_base64.length > 0) {
        console.log(">>> [STORAGE] Uploading PDF...");
        const fileName = `${quoteNumber}_request.pdf`;
        const buffer = Buffer.from(pdf_base64, 'base64');
        
        const { error: uploadError } = await supabase.storage
            .from('submittal-pdfs')
            .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('submittal-pdfs').getPublicUrl(fileName);
            pdfUrl = publicUrl;
            console.log(">>> [STORAGE] PDF available at:", pdfUrl);
        } else {
            console.error(">>> [STORAGE ERROR] PDF upload failed:", uploadError.message);
        }
    }

    // 6. FINAL INSERT: The Submittal Record
    console.log(">>> [DB] Inserting submittal record...");
    const { data: submittal, error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name: job_name || "Online Request",
        quote_number: quoteNumber,
        status: 'Pending',
        customer: customer.id, // Linking the BigInt ID
        pdf_url: pdfUrl,
        customer_first_name: first_name,
        customer_last_name: last_name,
        notes: notes || additional_notes || ""
      }])
      .select()
      .single();

    if (subError) {
        console.error(">>> [DB ERROR] Submittal insert failed:", subError.message);
        throw subError;
    }

    console.log(">>> [SUCCESS] Submittal created with ID:", submittal.id);
    return NextResponse.json({ 
        success: true, 
        quoteNumber: quoteNumber,
        id: submittal.id 
    });

  } catch (err: any) {
    console.error(">>> [CRITICAL ERROR]:", err.message);
    return NextResponse.json({ 
        error: "Internal Server Error", 
        details: err.message 
    }, { status: 500 });
  }
}