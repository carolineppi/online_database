import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { submittalId, quoteIds } = await req.json();

  // 1. Fetch Submittal and Customer Data
  const { data: submittal } = await supabase
    .from('quote_submittals')
    .select('*, customers(*)')
    .eq('id', submittalId)
    .single();

  // 2. Fetch ONLY the selected Individual Quotes
  const { data: selectedQuotes } = await supabase
    .from('individual_quotes')
    .select('*')
    .in('id', quoteIds);

  if (!submittal || !selectedQuotes) {
    return NextResponse.json({ error: 'Data not found' }, { status: 404 });
  }

  // 3. Initialize PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header Section ---
  doc.setFontSize(20);
  doc.text("PROPOSAL / SUBMITTAL", 105, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Quote #: ${submittal.quote_number}`, 150, 35);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, 40);

  // --- Customer & Job Info ---
  doc.setFont("helvetica", "bold");
  doc.text("Customer Information:", 20, 55);
  doc.setFont("helvetica", "normal");
  doc.text(`${submittal.customers.first_name} ${submittal.customers.last_name}`, 20, 60);
  doc.text(submittal.customers.email, 20, 65);

  doc.setFont("helvetica", "bold");
  doc.text("Project:", 120, 55);
  doc.setFont("helvetica", "normal");
  doc.text(submittal.job_name, 120, 60);

  // --- DYNAMIC QUOTES LOOP ---
  // This removes the 4-quote limit by iterating through the checked array
  let currentY = 85;

  selectedQuotes.forEach((quote, index) => {
    // Check for page overflow
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(245, 245, 245);
    doc.rect(20, currentY, 170, 30, 'F'); // Background box for option

    doc.setFont("helvetica", "bold");
    doc.text(`OPTION ${index + 1}: ${quote.material}`, 25, currentY + 10);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Manufacturer: ${quote.manufacturer} | Style: ${quote.mounting_style}`, 25, currentY + 18);
    doc.text(`Quantity: ${quote.quantity}`, 25, currentY + 23);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const priceText = `$${Number(quote.price).toLocaleString()}`;
    doc.text(priceText, 185, currentY + 15, { align: "right" });

    currentY += 35; // Move Y down for the next option
  });

  // --- Footer / Terms ---
  doc.setFontSize(8);
  doc.text("Terms: 50% deposit required. Quote valid for 30 days.", 105, 285, { align: "center" });

  // 4. Output as Buffer
  const pdfBuffer = doc.output('arraybuffer');

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Quote_${submittal.quote_number}.pdf"`,
    },
  });
}