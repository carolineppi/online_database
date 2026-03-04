import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// Helper function to parse the UTM sources
function parseAdSource(rawUrl: string | null) {
  if (!rawUrl) return { source_url: null, quote_source: 'Organic / Direct' };
  
  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;

    return {
      source_url: rawUrl,
      // Map UTM params to your specific database columns
      quote_source: params.get('utm_source') || 'Organic / Direct',
      campaign_source: params.get('utm_campaign') || params.get('gad_campaignid') || null,
      term_source: params.get('utm_term') || null,
      content_source: params.get('utm_content') || null
    };
  } catch (e) {
    return { source_url: rawUrl, quote_source: 'Unknown' };
  }
}

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
      pdf_base64,
      submission_url // Ensure your website sends this field
    } = body;

    // 1. URL Parsing Logic
    const adData = parseAdSource(submission_url);

    // 2. Strict Phone Cleaning
    const rawPhone = phone ? phone.toString().replace(/\D/g, '') : '';
    const numericPhone = parseInt(rawPhone, 10);
    
    if (isNaN(numericPhone) || rawPhone.length < 10) {
        return NextResponse.json({ error: "Invalid phone format" }, { status: 400 });
    }

    // 3. Get Next Quote Number
    const { data: nextSeq, error: seqError } = await supabase.rpc('get_next_quote_number');
    if (seqError) throw new Error(`Sequence Error: ${seqError.message}`);
    
    const quoteNumber = `${nextSeq}WEB`;

    // 4. Customer Linking / Creation
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

    // 5. PDF Upload Logic
    let pdfUrl = null;
    if (pdf_base64) {
        const fileName = `${quoteNumber}_request.pdf`;
        const buffer = Buffer.from(pdf_base64, 'base64');
        
        const { error: uploadError } = await supabase.storage
            .from('submittal-pdfs')
            .upload(fileName, buffer, { 
                contentType: 'application/pdf', 
                upsert: false
            });

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('submittal-pdfs').getPublicUrl(fileName);
            pdfUrl = publicUrl;
        }
    }

    // 6. INSERT: Now including UTM and Source data
    const { data: submittal, error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name: job_name || "Online Request",
        quote_number: quoteNumber,
        status: 'Pending',
        customer: customer!.id,
        pdf_url: pdfUrl,
        notes: notes || additional_notes || "",
        // New Marketing Columns
        source_url: adData.source_url,
        quote_source: adData.quote_source,
        campaign_source: adData.campaign_source,
        term_source: adData.term_source,
        content_source: adData.content_source
      }])
      .select()
      .single();

    if (subError) throw subError;

    return NextResponse.json({ success: true, quoteNumber });

  } catch (err: any) {
    console.error(">>> [CRITICAL ERROR]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}