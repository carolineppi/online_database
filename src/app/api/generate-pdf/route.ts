import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createClient } from '@/utils/supabase/server';

const blueColor = [50, 50, 50] as const; 
const redColor = [183, 0, 32] as const;  
const lightGray = [243, 243, 243] as const;

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
    doc.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 570, 50, { align: 'right' });
    doc.text("341 Granary Road, Suite A-B", 570, 65, { align: 'right' });
    doc.text("Forest Hill, MD 21050", 570, 78, { align: 'right' });
    doc.text("+1-800-298-9696", 570, 91, { align: 'right' });
    doc.setTextColor(...redColor);
    doc.text("sales@partitionplus.com", 570, 104, { align: 'right' });

    // Quote Info Box
    doc.setFillColor(...lightGray);
    doc.rect(40, 120, 530, 45, 'F');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Attention: ${submittal.linked_customer?.first_name} ${submittal.linked_customer?.last_name}`, 50, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(submittal.job_name || "PROPOSAL", 50, 155);
    
    doc.setFontSize(12);
    doc.text("Quote #: ", 440, 147);
    doc.setTextColor(...redColor);
    doc.text(submittal.quote_number, 495, 147);

    // Intro Text
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const intro = `We are pleased to enter our price on the following: ${submittal.job_name}`;
    doc.text(doc.splitTextToSize(intro, 500), 40, 195);

    // Section Header
    doc.setFont("helvetica", "bold");
    doc.text("Description:", 40, 220);

    // Pricing Options Loop
    let yPos = 240;
    options.forEach((opt: any) => {
      if (yPos > 650) {
        doc.addPage();
        applyWatermark(doc);
        yPos = 60;
      }

      // Material Title
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(opt.material, 40, yPos);

      // Price
      const priceFmt = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(opt.price);
      doc.setFontSize(12);
      doc.text(priceFmt, 570, yPos, { align: 'right' });

      // Manufacturer & Includes Shipping
      yPos += 14;
      doc.setTextColor(80);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Manufacturer: ${opt.manufacturer}`, 40, yPos);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...redColor);
      doc.text("** includes shipping **", 570, yPos, { align: 'right' });

      yPos += 35; 
    });

    // Add-ons
    if (addons && addons.length > 0) {
      if (yPos > 600) { doc.addPage(); applyWatermark(doc); yPos = 60; }
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("** All hardware needed for installation is included **", 40, yPos);
      yPos += 25;
    }

    // Terms & Conditions Block
    if (yPos > 500) {
      doc.addPage();
      applyWatermark(doc);
      yPos = 60;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Important terms of use information:", 40, yPos);
    
    yPos += 10;
    doc.setFillColor(...lightGray);
    doc.rect(40, yPos, 530, 160, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const terms1 = '**** Damaged material that is signed for as "damaged" is replaced at NO CHARGE. ****';
    doc.text(terms1, 50, yPos + 20);

    doc.setFont("helvetica", "normal");
    const terms2 = "Although damage is unlikely please inspect all material for possible damage at time of delivery, while the driver is still there so that you can sign for it as damaged. Do not refuse the delivery as this may cause a re-delivery fee. If material is damaged and not signed for accordingly we will not be able to file a claim against the freight company and it will be the customer's responsibility for payment of replacement items. Our contract with the carriers allows for a full inspection of all material regardless of the time it takes.";
    const splitTerms2 = doc.splitTextToSize(terms2, 510);
    doc.text(splitTerms2, 50, yPos + 40);

    doc.setFont("helvetica", "bold");
    doc.text("Terms of Offer", 50, yPos + 105);
    doc.setFont("helvetica", "normal");
    const terms3 = "By completing/paying for your order, you agree with and have verified the measurements we have provided on our shop drawings. This offer is good for 60 days from the date of this quotation.";
    doc.text(doc.splitTextToSize(terms3, 510), 50, yPos + 120);

    const terms4 = "Methods of payment are: Visa, MasterCard, Discover, AmEx, Wire, or Check.";
    doc.text(terms4, 50, yPos + 145);

    // Footer
    doc.setFillColor(...redColor);
    doc.rect(40, 720, 530, 25, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text("Have Questions about your Partitions? - Give us a Call!", 305, 737, { align: 'center' });

    const pdfOutput = doc.output('arraybuffer');
    return new NextResponse(Buffer.from(pdfOutput), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Proposal_${submittal.quote_number}.pdf`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}