Here is the updated route.ts. I have translated the specific layouts, grid borders, underlines, and inline variable placements from the pdf.php script into pure native jsPDF commands.

This includes the 2x2 bordered info table, the specific "Description", "Quantity", and "Color" formatting with underlines, and the dynamic spacing for the materials list.

TypeScript
import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createClient } from '@/utils/supabase/server';

const blueColor = [50, 50, 50] as const; 
const redColor = [183, 0, 32] as const;  

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
      pdfDoc.addImage(logoBase64, 'PNG', 100, 250, 400, 50); 
      pdfDoc.restoreGraphicsState();
    };

    // --- RENDER PAGE 1 ---
    applyWatermark(doc);
    
    // Header Logo
    doc.addImage(logoBase64, 'PNG', 40, 40, 180, 25); 
    
    // Branding Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...blueColor);
    doc.text("We Make it ", 40, 85);
    doc.setTextColor(...redColor);
    doc.text("Easy for Anyone ", 95, 85);
    doc.setTextColor(...blueColor);
    doc.text("to Buy Toilet Partitions", 175, 85);

    // Company Contact Info (Stacked Right Aligned)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text("341 Granary Road, Suite A-B", 570, 50, { align: 'right' });
    doc.text("Forest Hill, MD 21050", 570, 63, { align: 'right' });
    doc.text("+1-800-298-9696", 570, 76, { align: 'right' });
    doc.setTextColor(...redColor);
    doc.text("sales@partitionplus.com", 570, 89, { align: 'right' });

    // ---------------------------------------------------------
    // TABLE 1: Attention, Date, Job, Quote # (Matches PHP HTML)
    // ---------------------------------------------------------
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    
    // Grid Lines
    doc.rect(40, 110, 530, 46); // Outer border
    doc.line(40, 133, 570, 133); // Horizontal divider
    doc.line(380, 110, 380, 156); // Vertical divider

    doc.setTextColor(0);
    doc.setFontSize(11);
    
    // Row 1
    doc.setFont("helvetica", "normal");
    doc.text("Attn: ", 45, 126);
    doc.setFont("helvetica", "bold");
    doc.text(`${submittal.linked_customer?.first_name || ''} ${submittal.linked_customer?.last_name || ''}`, 75, 126);
    
    doc.setFont("helvetica", "bold");
    const quoteDate = new Date(submittal.created_at || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.text(quoteDate, 475, 126, { align: 'center' }); // Centered in right column

    // Row 2
    doc.setFont("helvetica", "normal");
    doc.text("Job: ", 45, 149);
    doc.setFont("helvetica", "bold");
    doc.text(submittal.job_name || "PROPOSAL", 70, 149);

    doc.setFont("helvetica", "normal");
    doc.text("Quote #: ", 385, 149);
    doc.setFont("helvetica", "bold");
    doc.text(submittal.quote_number, 435, 149);

    // ---------------------------------------------------------
    // TEXT BLOCKS (Matches PHP $text1, $text2, $text3, $text4)
    // ---------------------------------------------------------
    let yPos = 185;
    
    // Text 1
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("We are pleased to enter our price on the following: ", 40, yPos);
    doc.setFont("helvetica", "bold");
    const pleasedName = submittal.pleased_name || submittal.job_name || ""; 
    doc.text(pleasedName, 305, yPos); 

    // Text 2 & 3 (Description)
    yPos += 25;
    doc.setFont("helvetica", "bold");
    doc.text("Description:", 40, yPos);
    doc.setLineWidth(0.75);
    doc.line(40, yPos + 2, 107, yPos + 2); // Underline

    yPos += 15;
    doc.setFont("helvetica", "normal");
    const descText = `${submittal.description || ''} ${submittal.mounting_style || ''}`.trim() || 'Toilet Compartments are: Floor Mounted w/ Overhead Brace';
    doc.text(descText, 40, yPos);

    // Text 4 (Quantity & Color)
    yPos += 25;
    doc.setFont("helvetica", "bold");
    doc.text("Quantity:", 40, yPos);
    doc.line(40, yPos + 2, 92, yPos + 2); // Underline
    doc.setFont("helvetica", "normal");
    doc.text(submittal.quantity || '(3) toilet stalls and (3) urinal screens', 97, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Color:", 380, yPos);
    doc.line(380, yPos + 2, 415, yPos + 2); // Underline
    doc.setFont("helvetica", "normal");
    doc.text(submittal.color || 'Black', 420, yPos);

    // ---------------------------------------------------------
    // MATERIALS LOOP
    // ---------------------------------------------------------
    yPos += 50;
    
    options.forEach((opt: any) => {
      if (yPos > 600) {
        doc.addPage();
        applyWatermark(doc);
        yPos = 60;
      }

      // Material Title (Underlined, Bold)
      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(opt.material, 40, yPos);
      const textWidth = doc.getTextWidth(opt.material);
      doc.line(40, yPos + 2, 40 + textWidth, yPos + 2); // Dynamic Underline

      // Price
      const priceFmt = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(opt.price);
      doc.text(priceFmt, 570, yPos, { align: 'right' });

      // Manufacturer & Includes Shipping
      yPos += 15;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Manufacturer: ", 40, yPos);
      doc.setFont("helvetica", "bold");
      doc.text(opt.manufacturer || 'HADRIAN', 115, yPos);
      
      doc.setFont("helvetica", "bold");
      doc.text("** includes shipping **", 570, yPos, { align: 'right' });

      yPos += 45; // Spacing for next option
    });

    // Add-ons handling (Optional, retaining your previous addition)
    if (addons && addons.length > 0) {
      if (yPos > 550) { doc.addPage(); applyWatermark(doc); yPos = 60; }
      yPos += 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("ADDITIONAL ACCESSORIES / HARDWARE", 40, yPos);
      doc.line(40, yPos + 2, 280, yPos + 2);
      
      yPos += 15;
      doc.setFont("helvetica", "normal");
      addons.forEach((addon: any) => {
        doc.text(`${addon.quantity || 1}x ${addon.material}`, 40, yPos);
        const addonPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(addon.price);
        doc.text(addonPrice, 570, yPos, { align: 'right' });
        yPos += 18;
      });
      yPos += 20;
    }

    // ---------------------------------------------------------
    // TERMS & CONDITIONS (Replaces quoteTerms.jpg)
    // ---------------------------------------------------------
    if (yPos > 480) {
      doc.addPage();
      applyWatermark(doc);
      yPos = 60;
    } else {
      yPos = 520; // Pin to bottom-ish if on the first page to match layout
    }

    // Centered Hardware Notice
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("** All hardware needed for installation is included **", 305, yPos, { align: 'center' });
    doc.line(160, yPos + 2, 450, yPos + 2); // Underline for the center text

    yPos += 40;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Important terms of use information:", 40, yPos);
    
    yPos += 15;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const terms1 = '**** Damaged material that is signed for as "damaged" is replaced at NO CHARGE. ****';
    doc.text(terms1, 40, yPos);

    doc.setFont("helvetica", "normal");
    const terms2 = "Although damage is unlikely please inspect all material for possible damage at time of delivery, while the driver is still there so that you can sign for it as damaged. Do not refuse the delivery as this may cause a re-delivery fee. If material is damaged and not signed for accordingly we will not be able to file a claim against the freight company and it will be the customer's responsibility for payment of replacement items. Our contract with the carriers allows for a full inspection of all material regardless of the time it takes.";
    const splitTerms2 = doc.splitTextToSize(terms2, 530);
    doc.text(splitTerms2, 40, yPos + 15);

    doc.setFont("helvetica", "bold");
    doc.text("Terms of Offer", 40, yPos + 80);
    doc.setFont("helvetica", "normal");
    const terms3 = "By completing/paying for your order, you agree with and have verified the measurements we have provided on our shop drawings. This offer is good for 60 days from the date of this quotation.";
    doc.text(doc.splitTextToSize(terms3, 530), 40, yPos + 95);

    const terms4 = "Methods of payment are: Visa, MasterCard, Discover, AmEx, Wire, or Check.";
    doc.text(terms4, 40, yPos + 125);

    // Final Call-to-Action Footer
    doc.setFillColor(...redColor);
    doc.rect(40, 720, 530, 25, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text("Have Questions about your Partitions? - Give us a Call!", 305, 737, { align: 'center' });

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