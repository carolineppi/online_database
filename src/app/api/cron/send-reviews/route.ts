import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// --- CRITICAL FIX: PREVENT NEXT.JS CACHING ---
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Secure the route: Only allow authorized requests
  // Vercel sends a specific authorization header with cron jobs
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Initialize Supabase Admin Client
  // CRON jobs don't have user cookies, so we MUST use the Service Role Key to bypass RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // 3. Find pending emails where the scheduled time has arrived or passed
    const { data: pendingReviews, error } = await supabaseAdmin
      .from("review_emails")
      .select(
        "id, customer_email, additional_email, jobs(quote_submittals(job_name))",
      )
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
      // Safely extract the job name, accounting for Supabase returning arrays on joins
      const jobData: any = Array.isArray(review.jobs)
        ? review.jobs[0]
        : review.jobs;
      const submittalData: any = jobData
        ? Array.isArray(jobData.quote_submittals)
          ? jobData.quote_submittals[0]
          : jobData.quote_submittals
        : null;
      const jobName = submittalData?.job_name || "your recent project";

      // Format the recipients list. If additional_email exists, append it.
      const recipients = review.additional_email
        ? `${review.customer_email}, ${review.additional_email}`
        : review.customer_email;

      // Build the email body
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
          <h2>How did we do?</h2>
          <p>Hi there,</p>
          <p>We hope everything went smoothly with your delivery for <strong>${jobName}</strong>. If you have a moment, we'd love it if you could share your experience by leaving us a Google Review!</p>
          <p><a href="YOUR_GOOGLE_REVIEW_LINK_HERE" style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Leave a Review</a></p>
          <p>Thank you for choosing Partition Plus!</p>
        </div>
      `;

      await transporter.sendMail({
        from: '"Partition Plus" <tracking@partitionplus.com>',
        to: recipients, 
        subject: "How was your experience with Partition Plus?",
        html: htmlBody,
      });

      // Mark the database row as successfully sent
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