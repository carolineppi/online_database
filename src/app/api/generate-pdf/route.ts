import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createClient } from '@/utils/supabase/server';

const darkText = [50, 50, 50] as const;   // #323232
const redColor = [183, 0, 32] as const;   // #b70020
const lightGray = [243, 243, 243] as const; // #f3f3f3

export async function GET(req: NextRequest) {
  try {
    // 1. Grab variables from the URL query string instead of req.json()
    const searchParams = req.nextUrl.searchParams;
    const submittalId = searchParams.get('submittalId');
    const quoteIdsParam = searchParams.get('quoteIds');
    
    if (!submittalId || !quoteIdsParam) throw new Error("Missing parameters");
    
    // Convert the comma-separated string back to an array
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
      pdfDoc.addImage(logoBase64, 'PNG', 100, 300, 400, 50); 
      pdfDoc.restoreGraphicsState();
    };

    const checkPageBreak = (currentY: number, neededSpace: number) => {
      if (currentY + neededSpace > 750) {
        doc.addPage();
        applyWatermark(doc);
        return 60; // reset Y
      }
      return currentY;
    };

    const formatPhoneNumber = (phone?: string) => {
      if (!phone) return '';
      // Strip all non-digit characters just in case
      const cleaned = ('' + phone).replace(/\D/g, '');
      // Match 10 digits, optionally ignoring a leading '1' (US country code)
      const match = cleaned.match(/^(?:1)?(\d{3})(\d{3})(\d{4})$/);
      
      if (match) {
        // Returns with a leading space so you don't have to manually add it later
        return ` (${match[1]}) ${match[2]}-${match[3]}`;
      }
      // Fallback in case the number isn't 10 digits
      return ` ${phone}`; 
    };

    // --- RENDER PAGE 1 ---
    applyWatermark(doc);
    
    // 1. Header Area
    doc.addImage(logoBase64, 'PNG', 40, 40, 200, 25); 
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...darkText);
    doc.text("We Make it ", 99, 80, { align: 'center' });
    doc.setTextColor(...redColor);
    doc.text("Easy for Anyone ", 126, 80);
    doc.setTextColor(...darkText);
    doc.text("to Buy Toilet Partitions", 140, 95, { align: 'center' });

    // Header Right Info
    doc.setTextColor(0);
    const quoteDate = new Date(submittal.created_at || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.setFontSize(12);
    doc.text(quoteDate, 570, 45, { align: 'right' });
    doc.setFontSize(10);
    doc.text("341 Granary Road, Suite A-B", 570, 60, { align: 'right' });
    doc.text("Forest Hill, MD 21050", 570, 70, { align: 'right' });
    doc.text("+1-800-298-9696", 570, 80, { align: 'right' });
    doc.text("sales@partitionplus.com", 570, 90, { align: 'right' });

    // 2. Quote Info Box (Gray Background)
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

    // Check for the mask, fallback to the original
    const displayQuoteNumber = String(submittal.quote_number_mask || submittal.quote_number || "");

    // 1. Set the font size for the Quote Number so we can measure it accurately
    doc.setFontSize(14);
    const quoteNumWidth = doc.getTextWidth(displayQuoteNumber);

    // The grey box ends at X=570. We will use 560 as our safe right margin so it breathes.
    const rightMarginX = 560;

    // 2. Draw "Quote #: " dynamically positioned to the left of the Quote Number
    doc.setFontSize(12);
    doc.setTextColor(0); // Black text
    // We right-align this text just to the left of where the Quote Number will start
    doc.text("Quote #: ", rightMarginX - quoteNumWidth - 2, 127, { align: 'right' });

    // 3. Draw the actual Quote Number right-aligned against the margin
    doc.setFontSize(14);
    doc.setTextColor(...redColor); // Red text
    doc.text(displayQuoteNumber, rightMarginX, 127, { align: 'right' });

    // 3. Quote Details & Address
    let yPos = 175;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("We are pleased to enter our price on the following: ", 40, yPos);

    // Shipping Address
    yPos += 15;
    doc.setFont("helvetica", "bold");
    const addressText = submittal.shipping_address || 'Toilet Partitions shipping to:';
    const splitAddress = doc.splitTextToSize(addressText, 530);
    doc.text(splitAddress, 40, yPos);
    yPos += (splitAddress.length * 14) + 20;

    // Description
    // doc.setFont("helvetica", "bold");
    // doc.text("Description:", 40, yPos);
    // doc.setLineWidth(0.75);
    // doc.line(40, yPos + 2, 106, yPos + 2); // Underline Description
    // doc.setFont("helvetica", "normal");
    
    // const descText = submittal.description || 'Toilet Compartments are: ';
    // const splitDesc = doc.splitTextToSize(descText, 440);
    // doc.text(splitDesc, 113, yPos);
    // yPos += (splitDesc.length * 14) + 20;

    // 4. Materials Loop (Now contains Quantity and Color)
    options.forEach((opt: any) => {
      yPos = checkPageBreak(yPos, 60);

      // Material Title & Price
      doc.setTextColor(...redColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`${opt.material} Toilet Partitions`, 40, yPos);

      const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(opt.price);
      doc.text(priceFmt, 515, yPos, { align: 'center' });

      yPos += 14;
      doc.setTextColor(0);
      doc.setFontSize(10);
      let currentX = 40;

      // Manufacturer
      doc.setFont("helvetica", "bold");
      doc.text("Manufacturer: ", currentX, yPos);
      currentX += doc.getTextWidth("Manufacturer: ");

      doc.setFont("helvetica", "normal");
      const mfgText = opt.manufacturer || 'HADRIAN';
      doc.text(mfgText, currentX, yPos);

      currentX += doc.getTextWidth(mfgText) + 20;

      // Mounting Style
      doc.setFont("helvetica", "bold");
      doc.text("Mounting: ", currentX, yPos);
      currentX += doc.getTextWidth("Mounting: ");

      doc.setFont("helvetica", "normal");
      const mountingText = opt.details ? `${opt.mounting_style} for ${opt.details}"` : opt.mounting_style;
      doc.text(mountingText || '', currentX, yPos);
            
      doc.setFont("helvetica", "normal");
      doc.text(`** ${opt.shipping_included} **` || "** includes shipping **", 515, yPos, { align: 'center' });
      
      // Color
      yPos += 14;
      currentX = 40;
      doc.setFont("helvetica", "normal");
      doc.text("Color: ", currentX, yPos);
      currentX += doc.getTextWidth("Color: ");

      doc.setFont("helvetica", "bold");
      const colorText = opt.color || 'TBD';
      doc.text(colorText, currentX, yPos);
      currentX += doc.getTextWidth(colorText) + 20;

      // Itemized Quantity List
      doc.setFont("helvetica", "normal");
      doc.text("Quantity: ", currentX, yPos);
      currentX += doc.getTextWidth("Quantity: ");

      doc.setFont("helvetica", "bold");
      
      // Parse the JSON array into "(5) item name, (1) item name"
      let formattedQty = opt.quantity || "N/A";
      if (opt.itemized_breakdown && Array.isArray(opt.itemized_breakdown) && opt.itemized_breakdown.length > 0) {
         formattedQty = opt.itemized_breakdown.map((item: any) => `(${item.qty || item.quantity || 0}) ${item.item || item.name || 'item'}`).join(', ');
      }
      
      // Use splitTextToSize to gracefully wrap long lists of items
      const splitQty = doc.splitTextToSize(formattedQty, 450);
      doc.text(splitQty, currentX, yPos);
      
      yPos += (splitQty.length * 14) + 20; // Extra padding for next material
    });

    // Add-ons
    // if (addons && addons.length > 0) {
    //   yPos = checkPageBreak(yPos, 40 + (addons.length * 15));
    //   doc.setTextColor(0);
    //   doc.setFontSize(12);
    //   doc.setFont("helvetica", "bold");
    //   doc.text("ADDITIONAL ACCESSORIES / HARDWARE", 40, yPos);
      
    //   yPos += 15;
    //   doc.setTextColor(0);
    //   doc.setFontSize(10);
    //   doc.setFont("helvetica", "normal");
    //   addons.forEach((addon: any) => {
    //     doc.text(`${addon.quantity || 1}x ${addon.material}`, 40, yPos);
    //     const addonPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(addon.price);
    //     doc.text(addonPrice, 570, yPos, { align: 'right' });
    //     yPos += 15;
    //   });
    //   yPos += 15;
    // }

    // 5. Hardware Banner (Red Background, White Text)
    yPos = checkPageBreak(yPos, 40);
    yPos -= 10;
    doc.setFillColor(...redColor);
    doc.rect(40, yPos, 530, 25, 'F');
    doc.setTextColor(255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(submittal.description || "** All hardware needed for installation is included **", 305, yPos + 15, { align: 'center' });
    yPos += 30;

    // 6. Terms Box
    yPos = checkPageBreak(yPos, 180);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(0);
    yPos += 20;
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
    
    // 1. Sanitize the quote number to remove spaces, commas, and illegal characters
    const safeQuoteNumber = String(displayQuoteNumber).replace(/[^a-zA-Z0-9-_]/g, '_');

    return new NextResponse(Buffer.from(pdfOutput), {
      headers: {
        'Content-Type': 'application/pdf',
        // 2. Change "attachment" to "inline" to tell the browser to preview it!
        'Content-Disposition': `inline; filename="${safeQuoteNumber}_quote.pdf"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}