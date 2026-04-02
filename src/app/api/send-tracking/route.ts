import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    // 1. Extract the payload from the TrackingMailer component
    const { 
      customer_email, 
      po_number, 
      tracking_number, 
      freight_website, 
      freight_phone 
    } = await req.json();

    if (!customer_email || !po_number || !tracking_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Configure the SMTP Transporter (Using your Gmail settings)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, 
      auth: {
        user: 'tracking@partitionplus.com',
        pass: 'annmlhcntvtmgtrg', // Temporarily hardcoded
      },
    });

    // 3. Build the HTML Email Body (Matches your legacy PHP template)
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
        <p>Your recent order with Partition Plus has shipped! Find additional details on the freight carrier's website using the following information:</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong>Carrier's Website:</strong> <a href="${freight_website}" target="_blank">${freight_website}</a><br>
          <strong>PRO# / Tracking#:</strong> ${tracking_number}<br>
          <strong>Carrier's Phone:</strong> ${freight_phone}
        </div>
        
        <p><strong>1. Call the carrier to confirm delivery date and time.</strong><br>
        Contact the carrier, using the phone number above, to arrange your delivery. Verify that the carrier has the correct address and make sure the delivery site is accessible at the scheduled date and time.</p>
        
        <p><strong>2. Prepare to unload partitions from the truck.</strong><br>
        Plan for two or three people to unload the partitions by hand. Typically, <strong>the truck driver will park the vehicle where you designate, but will not assist with unloading.</strong> If you require a lift gate, please call us right away to make arrangements. The carrier will charge roughly $125 for the service.</p>
        
        <p><strong>3. Inspect the delivery thoroughly.</strong><br>
        Inspect all components at the time of delivery, while the driver is still present. Hand unloading makes this convenient. <strong>Damaged material signed for as "damaged" is replaced at no charge to you.</strong> Don't refuse a delivery that's damaged - this may result in re-delivery charges. If damage occurred in transit, but isn't noted at delivery, any replacement items may be your responsibility.</p>
        
        <p><strong>4. Contact us with any questions about your delivery or your order.</strong><br>
        Feel free to ask us questions by phone and email - we're available to help and we want you to have a great delivery experience!</p>
        
        <p>Thank You!<br><br>
        <strong>Customer Service at Partition Plus</strong><br>
        800-298-9696<br>
        <a href="mailto:sales@partitionplus.com">sales@partitionplus.com</a></p>
      </div>
    `;

    // 4. Send the Email
    const info = await transporter.sendMail({
      from: '"Partition Plus Order Tracking" <tracking@partitionplus.com>',
      to: customer_email,
      replyTo: 'tracking@partitionplus.com',
      bcc: [
        'ted@partitionplus.com', 
        'bill@partitionplus.com', 
        'tim@partitionplus.com'
      ],
      subject: `Your Partition Plus order has shipped - ${po_number}`,
      text: `Your Partition Plus order has shipped. Carrier website: ${freight_website} PRO/Tracking: ${tracking_number} Carrier phone: ${freight_phone}`,
      html: htmlBody,
    });

    console.log("Message sent: %s", info.messageId);

    // 5. Return Success
    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error("Email Sending Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}