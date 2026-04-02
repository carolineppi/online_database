import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createClient } from '@/utils/supabase/server';

const darkText = [50, 50, 50] as const;   // #323232
const redColor = [183, 0, 32] as const;   // #b70020
const lightGray = [243, 243, 243] as const; // #f3f3f3

export async function POST(req: NextRequest) {
  try {
    const { submittalId, quoteIds } = await req.json();
    const supabase = await createClient();

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

    const doc = new jsPDF({ 
      orientation: 'portrait',
      unit: 'pt', 
      format: 'letter' 
    });

    const logoUrl = "https://partitionplus.com/wp-content/uploads/2020/02/Partition-Plus-Bathroom-Stalls-Nationwide-Toilet-Partitions-Logo-1.png";
    const logoResponse = await fetch(logoUrl);
    const logoBuffer = await logoResponse.arrayBuffer();
    const logoBase64 = `data:image/png;base64,${Buffer.from(logoBuffer).toString('base64')}`;

    const applyWatermark = (pdfDoc: jsPDF) => {
      pdfDoc.saveGraphicsState();
      pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.03 }));
      // Adjust watermark position to roughly match the PHP template
      pdfDoc.addImage(logoBase64, 'PNG', 100, 300, 400, 50); 
      pdfDoc.restoreGraphicsState();
    };

    const checkPageBreak = (currentY: number, neededSpace: number) => {
      if (currentY + neededSpace > 700) {
        doc.addPage();
        applyWatermark(doc);
        return 60; // reset Y
      }
      return currentY;
    };

    // --- RENDER PAGE 1 ---
    applyWatermark(doc);
    
    // 1. Header Area
    doc.addImage(logoBase64, 'PNG', 40, 40, 200, 25); 
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...darkText);
    doc.text("We Make it ", 40, 85);
    doc.setTextColor(...redColor);
    doc.text("Easy for Anyone ", 97, 85);
    doc.setTextColor(...darkText);
    doc.text("to Buy Toilet Partitions", 40, 100);

    // Header Right Info
    doc.setTextColor(0);
    const quoteDate = new Date(submittal.created_at || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.setFontSize(12);
    doc.text(quoteDate, 570, 45, { align: 'right' });
    doc.setFontSize(10);
    doc.text("341 Granary Road, Suite A-B", 570, 60, { align: 'right' });
    doc.text("Forest Hill, MD 21050", 570, 75, { align: 'right' });
    doc.text("+1-800-298-9696", 570, 90, { align: 'right' });
    doc.text("sales@partitionplus.com", 570, 105, { align: 'right' });

    // 2. Quote Info Box (Gray Background)
    doc.setFillColor(...lightGray);
    doc.rect(40, 125, 530, 45, 'F');
    
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Attention: ${submittal.linked_customer?.first_name || ''} ${submittal.linked_customer?.last_name || ''}`, 50, 142);
    
    doc.setFontSize(12);
    doc.text(submittal.job_name || "PROPOSAL", 50, 160);

    doc.setFontSize(12);
    doc.text("Quote #: ", 420, 142);
    doc.setFontSize(14);
    doc.setTextColor(...redColor);
    doc.text(submittal.quote_number, 475, 142);

    // 3. Quote Details
    let yPos = 200;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("We are pleased to enter our price on the following: ", 40, yPos);
    doc.setFont("helvetica", "bold");
    doc.text(submittal.pleased_name || submittal.job_name || "", 290, yPos);

    yPos += 25;
    doc.setFont("helvetica", "bold");
    doc.text("Description:", 40, yPos);
    doc.setLineWidth(0.75);
    doc.line(40, yPos + 2, 106, yPos + 2); // Underline Description
    
    doc.setFont("helvetica", "normal");
    const descText = `${submittal.description || ''} ${submittal.mounting_style || ''}`.trim() || 'Toilet Compartments are: Floor Mounted w/ Overhead Brace';
    doc.text(descText, 113, yPos);

    yPos += 25;
    doc.setFont("helvetica", "bold");
    doc.text("Quantity:", 40, yPos);
    doc.line(40, yPos + 2, 90, yPos + 2); // Underline Quantity
    doc.setFont("helvetica", "normal");
    doc.text(submittal.quantity || '(3) toilet stalls and (3) urinal screens', 95, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Color:", 340, yPos);
    doc.line(340, yPos + 2, 375, yPos + 2); // Underline Color
    doc.setFont("helvetica", "normal");
    doc.text(submittal.color || 'Black', 380, yPos);

    // 4. Materials Loop
    yPos += 40;
    
    options.forEach((opt: any) => {
      yPos = checkPageBreak(yPos, 50);

      // Material Title & Price (Both Red & Bold in new PHP)
      doc.setTextColor(...redColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(opt.material, 40, yPos);

      const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(opt.price);
      doc.text(priceFmt, 515, yPos, { align: 'center' });

      // Manufacturer & Shipping Subtext
      yPos += 16;
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Manufacturer: ", 40, yPos);
      doc.setFont("helvetica", "bold");
      doc.text(opt.manufacturer || 'HADRIAN', 105, yPos);
      
      doc.text("** includes shipping **", 515, yPos, { align: 'center' });

      yPos += 30; // Padding for next item
    });

    // Add-ons
    if (addons && addons.length > 0) {
      yPos = checkPageBreak(yPos, 40 + (addons.length * 15));
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ADDITIONAL ACCESSORIES / HARDWARE", 40, yPos);
      
      yPos += 15;
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      addons.forEach((addon: any) => {
        doc.text(`${addon.quantity || 1}x ${addon.material}`, 40, yPos);
        const addonPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(addon.price);
        doc.text(addonPrice, 570, yPos, { align: 'right' });
        yPos += 15;
      });
      yPos += 15;
    }

    // 5. Hardware Banner (Red Background, White Text)
    yPos = checkPageBreak(yPos, 40);
    yPos += 10;
    doc.setFillColor(...redColor);
    doc.rect(40, yPos, 530, 22, 'F');
    doc.setTextColor(255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("** All hardware needed for installation is included **", 305, yPos + 15, { align: 'center' });
    yPos += 45;

    // 6. Terms Box
    yPos = checkPageBreak(yPos, 180);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Important terms of use information:", 40, yPos);
    
    yPos += 10;
    doc.setFillColor(...lightGray);
    doc.rect(40, yPos, 530, 180, 'F');
    
    // Terms Content (Centered)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);
    
    doc.setFont("helvetica", "bold");
    const terms1 = '**** Damaged material that is signed for as "damaged" is replaced at NO CHARGE. ****';
    doc.text(terms1, 305, yPos + 20, { align: 'center' });
    const t1Width = doc.getTextWidth(terms1);
    doc.setLineWidth(0.5);
    doc.line(305 - (t1Width/2), yPos + 22, 305 + (t1Width/2), yPos + 22);

    doc.setFont("helvetica", "normal");
    const terms2 = "Although damage is unlikely please inspect all material for possible damage at time of delivery, while the driver is still there so that you can sign for it as damaged. Do not refuse the delivery as this may cause a re-delivery fee. If material is damaged and not signed for accordingly we will not be able to file a claim against the freight company and it will be the customer's responsibility for payment of replacement items. Our contract with the carriers allows for a full inspection of all material regardless of the time it takes.";
    const splitTerms2 = doc.splitTextToSize(terms2, 500);
    doc.text(splitTerms2, 305, yPos + 45, { align: 'center' });

    doc.text("Terms of Offer", 305, yPos + 105, { align: 'center' });
    
    const terms3 = "By completing/paying for your order, you agree with and have verified the measurements we have provided on our shop drawings.";
    doc.text(doc.splitTextToSize(terms3, 500), 305, yPos + 115, { align: 'center' });
    const t3Width = doc.getTextWidth(terms3);
    // doc.line(305 - (t3Width/2), yPos + 122, 305 + (t3Width/2), yPos + 122);

    doc.text("This offer is good for 60 days from the date of this quotation.", 305, yPos + 140, { align: 'center' });
    doc.text("Methods of payment are:", 305, yPos + 152, { align: 'center' });
    doc.text("Visa, MasterCard, Discover, AmEx, Wire, or Check.", 305, yPos + 164, { align: 'center' });

    yPos += 180;

    // 7. Footer CTA
    yPos = checkPageBreak(yPos, 40);
    doc.setFillColor(...redColor);
    doc.rect(40, yPos + 10, 530, 25, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Have Questions about your Partitions? - Give us a Call!", 305, yPos + 27, { align: 'center' });

    // Output
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