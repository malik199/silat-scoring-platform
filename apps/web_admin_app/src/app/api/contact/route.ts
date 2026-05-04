import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { name, email, school, country, location, competitors, message } =
    await req.json();

  if (!name || !email || !school || !country || !location || !competitors) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    console.error("Missing GMAIL_USER or GMAIL_PASS env vars");
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const body = `
New pricing inquiry from SilatScore.com

Name:                 ${name}
Email:                ${email}
School / Organization: ${school}
Country:              ${country}
Location / City:      ${location}
Number of competitors: ${competitors}

Message:
${message || "(none)"}
  `.trim();

  try {
    await transporter.sendMail({
      from:    `"SilatScore Inquiries" <${user}>`,
      to:      "silat.virginia@gmail.com",
      replyTo: email,
      subject: `Pricing Inquiry — ${school} (${competitors} competitors)`,
      text:    body,
    });
  } catch (err) {
    console.error("sendMail error:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
