import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createClient } from '@/utils/supabase/server';

// Define fixed tuples for TypeScript to avoid spread operator errors
const blueColor = [50, 50, 50] as const;  // #323232
const redColor = [183, 0, 32] as const;   // #b70020
const lightGray = [243, 243, 243] as const; // #f3f3f3

export async function POST(req: NextRequest) {
  try {
    const { submittalId, quoteIds } = await req.json();
    const supabase = await createClient();

    // 1. Fetch Submittal and Individual Quote data
    const { data: submittal } = await supabase
      .from('quote_submittals')
      .select('*, linked_customer:customers!customer (*)')
      .eq('id', submittalId)
      .single();

    const { data: options } = await supabase
      .from('individual_quotes')
      .select('*')
      .in('id', quoteIds);

    const { data: addons } = await supabase
      .from('add_ons')
      .select('*')
      .eq('quote_id', submittalId)
      .is('deleted_at', null);

    if (!submittal || !options) throw new Error("Data not found");

    // 2. Initialize jsPDF (Standard Letter Size in Points)
    const doc = new jsPDF({ 
      orientation: 'portrait',
      unit: 'pt', 
      format: 'letter' 
    });

    // 3. Prepare Logo (Converted to Base64 for PDF embedding)
    const logoUrl = "https://partitionplus.com/wp-content/uploads/2020/02/Partition-Plus-Bathroom-Stalls-Nationwide-Toilet-Partitions-Logo-1.png";
    const logoResponse = await fetch(logoUrl);
    const logoBuffer = await logoResponse.arrayBuffer();
    const logoBase64 = `data:image/png;base64,${Buffer.from(logoBuffer).toString('base64')}`;

    // 4. Centralized Watermark Helper (0.03 Opacity)
    const applyWatermark = (pdfDoc: jsPDF) => {
      pdfDoc.saveGraphicsState();
      // Set faint opacity to match legacy mPDF settings
      pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.03 }));
      // Position logo in center background
      pdfDoc.addImage(logoBase64, 'PNG', 100, 250, 400, 100); 
      pdfDoc.restoreGraphicsState();
    };

    // --- RENDER PAGE 1 ---
    applyWatermark(doc);
    
    // Header Logo (Full Opacity)
    doc.addImage(logoBase64, 'PNG', 40, 40, 180, 45); 
    
    // Branding Text (Matches PHP $header)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...blueColor);
    doc.text("We Make it ", 40, 100);
    doc.setTextColor(...redColor);
    doc.text("Easy for Anyone ", 95, 100);
    doc.setTextColor(...blueColor);
    doc.text("to Buy Toilet Partitions", 175, 100);

    // Company Contact Info (Right Aligned)
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(new Date().toLocaleDateString(), 570, 50, { align: 'right' });
    doc.text("341 Granary Road, Suite A-B", 570, 65, { align: 'right' });
    doc.text("Forest Hill, MD 21050", 570, 78, { align: 'right' });
    doc.text("+1-800-298-9696", 570, 91, { align: 'right' });

    // Quote Info Box (Matches PHP $quoteinfo)
    doc.setFillColor(...lightGray);
    doc.rect(40, 120, 530, 40, 'F');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Attention: ${submittal.linked_customer?.first_name} ${submittal.linked_customer?.last_name}`, 50, 137);
    doc.setFont("helvetica", "bold");
    doc.text(submittal.job_name, 50, 152);
    
    doc.setFontSize(14);
    doc.text("Quote #: ", 450, 145);
    doc.setTextColor(...redColor);
    doc.text(submittal.quote_number, 505, 145);

    // Intro Text (Matches PHP $quotedetails)
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const intro = `We are pleased to enter our price on the following: ${submittal.job_name}`;
    doc.text(doc.splitTextToSize(intro, 500), 40, 185);

    // Pricing Options Loop
    let yPos = 230;
    options.forEach((opt: any) => {
      // Check for page overflow
      if (yPos > 680) {
        doc.addPage();
        applyWatermark(doc);
        yPos = 60;
      }

      // Material Title (Red)
      doc.setTextColor(...redColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(opt.material, 40, yPos);

      // Formatted Price
      const priceFmt = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(opt.price);
      doc.text(priceFmt, 570, yPos, { align: 'right' });

      // Manufacturer Subtext
      yPos += 15;
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Manufacturer: ${opt.manufacturer}`, 40, yPos);
      doc.setFont("helvetica", "bold");
      doc.text("INCLUDES SHIPPING", 570, yPos, { align: 'right' });

      yPos += 45; // Spacing for next option
    });
    // 3. ADD-ONS TABLE (Matches the new request)
    if (addons && addons.length > 0) {
      if (yPos > 600) { doc.addPage(); applyWatermark(doc); yPos = 60; }

      doc.setFillColor(...lightGray);
      doc.rect(40, yPos, 530, 20, 'F');
      doc.setTextColor(...blueColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("ADDITIONAL ACCESSORIES / HARDWARE", 50, yPos + 14);

      yPos += 30;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      addons.forEach((addon: any) => {
        doc.text(`${addon.quantity || 1}x ${addon.material}`, 50, yPos);
        const addonPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(addon.price);
        doc.text(addonPrice, 570, yPos, { align: 'right' });
        yPos += 18;
      });
      yPos += 20;
    }
    // Terms & Conditions Block (Matches PHP $terms)
    if (yPos > 550) {
      doc.addPage();
      applyWatermark(doc);
      yPos = 60;
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text("Important terms of use information:", 40, yPos);
    
    doc.setFillColor(...lightGray);
    doc.rect(40, yPos + 8, 530, 110, 'F');
    
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    const termsText = "Although damage is unlikely please inspect all material for possible damage at time of delivery, while the driver is still there so that you can sign for it as damaged... Methods of payment are: Visa, MasterCard, Discover, AmEx, Wire, or Check.";
    doc.text(doc.splitTextToSize(termsText, 500), 55, yPos + 30);

    // Final Red Call-to-Action Footer
    doc.setFillColor(...redColor);
    doc.rect(40, 720, 530, 25, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text("Have Questions about your Partitions? - Give us a Call!", 305, 737, { align: 'center' });

    // Output the PDF as an ArrayBuffer for the NextResponse
    const pdfOutput = doc.output('arraybuffer');

    return new NextResponse(Buffer.from(pdfOutput), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Proposal_${submittal.quote_number}.pdf`,
      },
    });

  } catch (error: any) {
    console.error("PDF Generation Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}