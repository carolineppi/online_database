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

  // 2. Fetch selected Material Options (individual_quotes)
  const { data: selectedQuotes } = await supabase
    .from('individual_quotes')
    .select('*')
    .in('id', quoteIds);

  // 3. Fetch selected Add-ons (add_ons)
  const { data: selectedAddons } = await supabase
    .from('add_ons')
    .select('*')
    .in('id', quoteIds);

  if (!submittal) {
    return NextResponse.json({ error: 'Submittal not found' }, { status: 404 });
  }

  // Initialize PDF
  const doc = new jsPDF();
  
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

  let currentY = 85;

  // --- MATERIAL OPTIONS LOOP ---
  if (selectedQuotes && selectedQuotes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("MATERIAL OPTIONS", 20, currentY);
    currentY += 10;

    selectedQuotes.forEach((quote, index) => {
      if (currentY > 250) { doc.addPage(); currentY = 20; }

      doc.setFillColor(245, 245, 245);
      doc.rect(20, currentY, 170, 30, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`OPTION ${index + 1}: ${quote.material}`, 25, currentY + 10);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Manufacturer: ${quote.manufacturer} | Style: ${quote.mounting_style}`, 25, currentY + 18);
      doc.text(`Quantity: ${quote.quantity}`, 25, currentY + 23);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`$${Number(quote.price).toLocaleString()}`, 185, currentY + 15, { align: "right" });

      currentY += 35;
    });
  }

  // --- ADD-ONS LOOP ---
  if (selectedAddons && selectedAddons.length > 0) {
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    
    currentY += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ADD-ON ITEMS", 20, currentY);
    currentY += 10;

    selectedAddons.forEach((addon) => {
      if (currentY > 260) { doc.addPage(); currentY = 20; }

      doc.setDrawColor(230, 230, 230);
      doc.line(20, currentY, 190, currentY); // Divider line

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(addon.material, 25, currentY + 8);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Reason: ${addon.reason || 'N/A'}`, 25, currentY + 14);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`+ $${Number(addon.price).toLocaleString()}`, 185, currentY + 10, { align: "right" });

      currentY += 20;
    });
  }

  // --- Summary Total ---
  const total = [...(selectedQuotes || []), ...(selectedAddons || [])]
    .reduce((sum, item) => sum + Number(item.price), 0);

  if (currentY > 260) { doc.addPage(); currentY = 20; }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`ESTIMATED TOTAL: $${total.toLocaleString()}`, 185, currentY + 10, { align: "right" });

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Terms: 50% deposit required. Quote valid for 30 days.", 105, 285, { align: "center" });

  const pdfBuffer = doc.output('arraybuffer');
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Quote_${submittal.quote_number}.pdf"`,
    },
  });
}