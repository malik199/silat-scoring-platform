import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { name, email, school, country, location, competitors, message } =
    await req.json();

  if (!name || !email || !school || !country || !location || !competitors) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS, // Gmail App Password (not account password)
    },
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

  await transporter.sendMail({
    from:    `"SilatScore Inquiries" <${process.env.GMAIL_USER}>`,
    to:      "silat.virginia@gmail.com",
    replyTo: email,
    subject: `Pricing Inquiry — ${school} (${competitors} competitors)`,
    text:    body,
  });

  return NextResponse.json({ ok: true });
}
