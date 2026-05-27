import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createClient } from '@/utils/supabase/server';

const darkText = [50, 50, 50] as const;   // #323232
const redColor = [183, 0, 32] as const;   // #b70020
const lightGray = [243, 243, 243] as const; // #f3f3f3

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const submittalId = searchParams.get('submittalId');
    const quoteIdsParam = searchParams.get('quoteIds');
    
    // Capture potential overrides from the frontend modal
    const overrideMounting = searchParams.get('overrideMounting');
    const overrideColor = searchParams.get('overrideColor');
    const overrideQty = searchParams.get('overrideQty');
    
    if (!submittalId || !quoteIdsParam) throw new Error("Missing parameters");
    
    const quoteIds = quoteIdsParam.split(','); 

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

    if (!submittal || !options || options.length === 0) throw new Error("Data not found");

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
      pdfDoc.addImage(logoBase64, 'PNG', 100, 300, 400, 50); 
      pdfDoc.restoreGraphicsState();
    };

    const checkPageBreak = (currentY: number, neededSpace: number) => {
      if (currentY + neededSpace > 750) {
        doc.addPage();
        applyWatermark(doc);
        return 60; 
      }
      return currentY;
    };

    const formatPhoneNumber = (phone?: string) => {
      if (!phone) return '';
      const cleaned = ('' + phone).replace(/\D/g, '');
      const match = cleaned.match(/^(?:1)?(\d{3})(\d{3})(\d{4})$/);
      if (match) return ` (${match[1]}) ${match[2]}-${match[3]}`;
      return ` ${phone}`; 
    };

    const formatQtyStr = (opt: any) => {
      let formattedQty = opt.quantity || "N/A";
      if (opt.itemized_breakdown && Array.isArray(opt.itemized_breakdown) && opt.itemized_breakdown.length > 0) {
         formattedQty = opt.itemized_breakdown.map((item: any) => `(${item.qty || item.quantity || 0}) ${item.item || item.name || 'item'}`).join(', ');
      }
      return String(formattedQty);
    };

    // --- RENDER PAGE 1 ---
    applyWatermark(doc);
    
    doc.addImage(logoBase64, 'PNG', 40, 40, 200, 25); 
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...darkText);
    doc.text("We Make it ", 99, 80, { align: 'center' });
    doc.setTextColor(...redColor);
    doc.text("Easy for Anyone ", 126, 80);
    doc.setTextColor(...darkText);
    doc.text("to Buy Toilet Partitions", 140, 95, { align: 'center' });

    doc.setTextColor(0);
    const quoteDate = new Date(submittal.created_at || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.setFontSize(12);
    doc.text(quoteDate, 570, 45, { align: 'right' });
    doc.setFontSize(10);
    doc.text("341 Granary Road, Suite A-B", 570, 60, { align: 'right' });
    doc.text("Forest Hill, MD 21050", 570, 70, { align: 'right' });
    doc.text("+1-800-298-9696", 570, 80, { align: 'right' });
    doc.text("sales@partitionplus.com", 570, 90, { align: 'right' });

    doc.setFillColor(...lightGray);
    doc.rect(40, 110, 530, 45, 'F');
    
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    const firstName = submittal.linked_customer?.first_name || '';
    const lastName = submittal.linked_customer?.last_name || '';
    const phoneStr = formatPhoneNumber(submittal.linked_customer?.phone);

    doc.text(`Attention: ${firstName} ${lastName}${phoneStr}`, 50, 127);
    
    doc.setFontSize(12);
    doc.text(submittal.job_name || "PROPOSAL", 50, 145);

    const displayQuoteNumber = String(submittal.quote_number_mask || submittal.quote_number || "");
    doc.setFontSize(14);
    const quoteNumWidth = doc.getTextWidth(displayQuoteNumber);
    const rightMarginX = 560;

    doc.setFontSize(12);
    doc.setTextColor(0); 
    doc.text("Quote #: ", rightMarginX - quoteNumWidth - 2, 127, { align: 'right' });
    doc.setFontSize(14);
    doc.setTextColor(...redColor); 
    doc.text(displayQuoteNumber, rightMarginX, 127, { align: 'right' });

    let yPos = 175;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("We are pleased to enter our price on the following: ", 40, yPos);

    // --- SHIPPING ADDRESS ---
    yPos += 15;
    doc.setFont("helvetica", "bold");
    const addressText = submittal.shipping_address || 'Toilet Partitions shipping to:';
    const splitAddress = doc.splitTextToSize(addressText, 530);
    doc.text(splitAddress, 40, yPos);
    yPos += (splitAddress.length * 14) + 15;

    // Determine the global specifications based on selection or overrides
    const finalMounting = overrideMounting || options[0]?.mounting_style || "TBD";
    const finalColor = overrideColor || options[0]?.color || "TBD";
    const finalQty = overrideQty || formatQtyStr(options[0]);

    // --- DESCRIPTION ---
    doc.setFont("helvetica", "bold");
    doc.text("Description:", 40, yPos);
    const descWidth = doc.getTextWidth("Description:");
    doc.setLineWidth(0.75);
    doc.line(40, yPos + 2, 40 + descWidth, yPos + 2); // Underline Description
    
    doc.setFont("helvetica", "normal");
    
    // Conditionally set the description text
    const descText = finalMounting !== "Accessories Only" 
      ? `Toilet Compartments are: ${finalMounting}` 
      : (submittal.description || 'Bathroom Accessories');
      
    const splitDesc = doc.splitTextToSize(descText, 530 - (40 + descWidth + 5));
    doc.text(splitDesc, 40 + descWidth + 5, yPos);
    
    // Small gap right into the Colors and Quantity line
    yPos += (splitDesc.length * 14) + 5;

    // --- COLOR & QUANTITY ---
    doc.setFont("helvetica", "bold");
    doc.text("Color:", 40, yPos);
    const colorWidth = doc.getTextWidth("Color:");
    doc.setLineWidth(0.75);
    doc.line(40, yPos + 2, 40 + colorWidth, yPos + 2); // Underline Color

    doc.setFont("helvetica", "normal");
    doc.text(finalColor, 40 + colorWidth + 5, yPos);

    // Quantity (Shifted to the right to share the line)
    doc.setFont("helvetica", "bold");
    doc.text("Quantity:", 280, yPos);
    const qtyWidth = doc.getTextWidth("Quantity:");
    doc.setLineWidth(0.75);
    doc.line(280, yPos + 2, 280 + qtyWidth, yPos + 2); // Underline Quantity

    doc.setFont("helvetica", "normal");
    const splitFinalQty = doc.splitTextToSize(finalQty, 570 - (280 + qtyWidth + 5));
    doc.text(splitFinalQty, 280 + qtyWidth + 5, yPos);

    yPos += (splitFinalQty.length * 14) + 30;

// --- OPTIONS LOOP ---
    const OPTION_BLOCK_HEIGHT = 65; // Fixed height allocated for EACH option
    let itemsOnCurrentPage = 0;

    options.forEach((opt: any) => {
      // Check if this new option block will push us over the page limit
      const newY = checkPageBreak(yPos, OPTION_BLOCK_HEIGHT);
      
      // If checkPageBreak returned 60, it means it created a new page!
      if (newY === 60) {
        yPos = newY;
        itemsOnCurrentPage = 0; // Reset counter for the new page
      }

      doc.setTextColor(...redColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`${opt.material} Toilet Partitions`, 40, yPos);

      const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(opt.price);
      doc.text(priceFmt, 515, yPos, { align: 'center' });

      doc.setTextColor(0);
      doc.setFontSize(10);
      
      let currentX = 40;
      doc.setFont("helvetica", "bold");
      doc.text("Manufacturer: ", currentX, yPos + 14);
      currentX += doc.getTextWidth("Manufacturer: ");

      doc.setFont("helvetica", "normal");
      doc.text(opt.manufacturer || 'HADRIAN', currentX, yPos + 14);

      doc.setFont("helvetica", "normal");
      doc.text(`** ${opt.shipping_included || "Includes Shipping"} **`, 515, yPos + 14, { align: 'center' });
      
      // Advance by the strict, fixed block height
      yPos += OPTION_BLOCK_HEIGHT; 
      itemsOnCurrentPage++;
    });

    // PADDING LOGIC:
    // We want a max of 4 items per page. If there are fewer than 4 items 
    // on the current page, add "dummy padding" to simulate the missing items.
    // This pushes the hardware banner and terms down consistently.
    if (itemsOnCurrentPage > 0 && itemsOnCurrentPage < 4) {
        const missingItems = 4 - itemsOnCurrentPage;
        yPos += (missingItems * OPTION_BLOCK_HEIGHT); 
    }

    // --- HARDWARE BANNER ---
    // Double check that our artificial padding didn't push the banner off the page!
    yPos = checkPageBreak(yPos, 40); 
    
    // We remove the arbitrary yPos -= 10 here so it aligns perfectly with the grid
    doc.setFillColor(...redColor);
    doc.rect(40, yPos, 530, 25, 'F');
    doc.setTextColor(255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("** All hardware needed for installation is included **", 305, yPos + 15, { align: 'center' });
    yPos += 35; // Advance past the banner

    // --- TERMS AND CONDITIONS ---
    yPos = checkPageBreak(yPos, 180);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(0);
    yPos += 20;
    doc.text("Important terms of use information:", 40, yPos);
    
    yPos += 10;
    doc.setFillColor(...lightGray);
    doc.rect(40, yPos, 530, 180, 'F');
    
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
    
    doc.text("This offer is good for 60 days from the date of this quotation.", 305, yPos + 140, { align: 'center' });
    doc.text("Methods of payment are:", 305, yPos + 152, { align: 'center' });
    doc.text("Visa, MasterCard, Discover, AmEx, Wire, or Check.", 305, yPos + 164, { align: 'center' });

    yPos += 180;

    yPos = checkPageBreak(yPos, 40);
    doc.setFillColor(...redColor);
    doc.rect(40, yPos + 10, 530, 25, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Have Questions about your Partitions? - Give us a Call!", 305, yPos + 27, { align: 'center' });

    const pdfOutput = doc.output('arraybuffer');
    const safeQuoteNumber = String(displayQuoteNumber).replace(/[^a-zA-Z0-9-_]/g, '_');

    return new NextResponse(Buffer.from(pdfOutput), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeQuoteNumber}_quote.pdf"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}