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
      first_name, last_name, name, 
      email, phone, 
      job_name, project_name,  
      notes, additional_notes, message,       
      zip_code,       // NEW: Dedicated zip code field
      pdf_base64, file_base64, file_name, // Legacy single-file fields
      files,          // NEW: Array of multiple files [{ file_name, file_base64 }]
      submission_url 
    } = body;

    // --- FIELD NORMALIZATION ---
    let finalFirstName = first_name;
    let finalLastName = last_name;
    if (!finalFirstName && !finalLastName && name) {
      const nameParts = name.trim().split(/\s+/);
      finalFirstName = nameParts[0];
      finalLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }

    const finalJobName = job_name || project_name || "Online Layout Request";
    const finalNotes = [notes, additional_notes, message].filter(Boolean).join('\n\n');
    const finalZip = zip_code || null;

    const adData = parseAdSource(submission_url);

    const rawPhone = phone ? phone.toString().replace(/\D/g, '') : '';
    const numericPhone = parseInt(rawPhone, 10);
    
    if (isNaN(numericPhone) || rawPhone.length < 10) {
        return NextResponse.json({ error: "Invalid phone format" }, { status: 400 });
    }

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

    // --- STEP 4: CUSTOMER LINKING ---
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .or(`email.eq.${email},phone.eq.${numericPhone}`)
      .maybeSingle();

    if (!customer) {
      const { data: newCust, error: custError } = await supabase
        .from('customers')
        .insert([{
          first_name: finalFirstName,
          last_name: finalLastName,
          email,
          phone: numericPhone
        }])
        .select()
        .single();
      
      if (custError) throw custError;
      customer = newCust;
    }

    // --- STEP 5: FILE UPLOAD LOGIC ---
    let fileUrls: string[] = [];

    // Helper to process base64 and push to Supabase storage
    const uploadBase64File = async (base64Data: string, originalName: string | null, suffix: string) => {
        let buffer: Buffer;
        let contentType = 'application/pdf'; 
        let ext = 'pdf'; 

        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
            contentType = matches[1];
            buffer = Buffer.from(matches[2], 'base64');
            ext = contentType.split('/')[1] || 'pdf'; 
            if (ext === 'jpeg') ext = 'jpg';
        } else {
            buffer = Buffer.from(base64Data, 'base64');
        }

        if (originalName) {
            const parts = originalName.split('.');
            if (parts.length > 1) ext = parts.pop()!.toLowerCase();
        }

        const storageName = `${quoteNumber}_request${suffix}.${ext}`;
        
        const { error } = await supabase.storage
            .from('submittal-pdfs')
            .upload(storageName, buffer, { contentType, upsert: false });

        if (!error) {
            const { data: { publicUrl } } = supabase.storage.from('submittal-pdfs').getPublicUrl(storageName);
            return publicUrl;
        }
        return null;
    };

    // A. Handle Legacy Single File (from your first form)
    const legacyBase64 = pdf_base64 || file_base64; 
    if (legacyBase64) {
        const url = await uploadBase64File(legacyBase64, file_name, '');
        if (url) fileUrls.push(url);
    }

    // B. Handle New Multi-File Uploads
    if (files && Array.isArray(files)) {
        for (let i = 0; i < files.length; i++) {
            const fileObj = files[i];
            if (fileObj.file_base64) {
                // Suffixes them as _layout_1, _layout_2, etc.
                const url = await uploadBase64File(fileObj.file_base64, fileObj.file_name, `_layout_${i+1}`);
                if (url) fileUrls.push(url);
            }
        }
    }

    // --- STEP 6: INSERT RECORD ---
    const { data: submittal, error: subError } = await supabase
      .from('quote_submittals')
      .insert([{
        job_name: finalJobName,
        quote_number: quoteNumber,
        status: 'Pending',
        customer: customer!.id,
        pdf_url: fileUrls.length > 0 ? fileUrls[0] : null, // Backwards compatibility for the primary file
        file_urls: fileUrls, // NEW: Saves the array of all uploaded URLs
        zip_code: finalZip,  // NEW: Dedicated zip code storage
        notes: finalNotes,
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