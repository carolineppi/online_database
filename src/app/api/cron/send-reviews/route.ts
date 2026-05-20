import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// --- CRITICAL FIX: PREVENT NEXT.JS CACHING ---
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Secure the route: Only allow authorized requests
  // Vercel sends a specific authorization header with cron jobs
  const authHeader = req.headers.get("authorization");
// Allows the real CRON_SECRET *or* our temporary Colab secret
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== `Bearer TEMP_COLAB_TEST_99`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Initialize Supabase Admin Client
  // CRON jobs don't have user cookies, so we MUST use the Service Role Key to bypass RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!, // <-- Updated to the new variable name!
  );

  try {
    // 3. Find pending emails where the scheduled time has arrived or passed
  const { data: pendingReviews, error } = await supabaseAdmin
      .from("review_emails")
      .select(`
        id, 
        customer_email, 
        additional_email, 
        jobs(
          quote_submittals(
            job_name,
            customers(first_name)
          )
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString());

    if (error) throw error;

    // If nothing is queued, exit early
    if (!pendingReviews || pendingReviews.length === 0) {
      return NextResponse.json({
        message: "No reviews scheduled for right now.",
      });
    }

    // 4. Configure the SMTP Transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: "tracking@partitionplus.com",
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // 5. Send emails and update the database
    let sentCount = 0;

for (const review of pendingReviews) {
      // 1. Safely extract the job name and customer first name
      const jobData: any = Array.isArray(review.jobs)
        ? review.jobs[0]
        : review.jobs;
      
      const submittalData: any = jobData
        ? Array.isArray(jobData.quote_submittals)
          ? jobData.quote_submittals[0]
          : jobData.quote_submittals
        : null;
        
      const jobName = submittalData?.job_name || "your recent project";
      
      // NEW: Extract first name, fallback to "there" if it's missing
      const firstName = submittalData?.customers?.first_name || "there";

      // 2. Format the recipients list
      const recipients = review.additional_email
        ? `${review.customer_email}, ${review.additional_email}`
        : review.customer_email;

      // 3. The Fancy HTML Template
      // Make sure to swap YOUR_GOOGLE_REVIEW_LINK_HERE!
      const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave a Review</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                    <img src="https://partitionplus.com/wp-content/uploads/2023/06/cropped-cropped-Logo-Number-No-Background-1-e1687733418964.webp">
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Hi <strong>${firstName}</strong>,</p>
                    
                    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                      Thank you for your recent purchase with Partition Plus. We truly appreciate your business. 
                    </p>
                    
                    <p style="margin: 0 0 32px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                      Here at Partition Plus we value customer satisfaction. So, we want to know what you think about your experience. If you would take a few minutes to leave a Google Review for us, we would be so excited to hear from you.
                    </p>

                    <p style="margin: 0 0 32px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                      To give us a review, just click the link below:
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="https://g.page/r/CRPncZt_9o8jEBM/review" target="_blank" style="display: inline-block; padding: 16px 36px; background-color: #b70020; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                            Leave a Review
                          </a>
                        </td>
                      </tr>
                    </table>
                      <p style="margin: 32px 0 32px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                     Less than satisfied with your purchase or your experience? Give us a chance to make it right! Contact your sales rep today with any questions or concerns you have.
                    </p>

                    <p style="margin: 0 0 32px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                      Thanks in advance for taking time to review us. We look forward to hearing from you!
                    </p>
                  </td>
                </tr>
                
                <tr>
                
                  <td style="padding: 30px 40px; background-color: #fafafa; text-align: center; border-top: 1px solid #f0f0f0;">
                    <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">Thank you for choosing Partition Plus!</p>
                    <p style="margin: 0; color: #a1a1aa; font-size: 12px;">This is an automated email regarding your recent project.</p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

      // 4. Send the email
      await transporter.sendMail({
        from: '"Partition Plus" <tracking@partitionplus.com>',
        to: recipients,
        subject: "How was your experience with Partition Plus?",
        html: htmlBody,
      });

      // 5. Mark the database row as successfully sent
      await supabaseAdmin
        .from("review_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", review.id);

      sentCount++;
    }

    return NextResponse.json({ success: true, sentCount });
  } catch (err: any) {
    console.error("Cron Job Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}