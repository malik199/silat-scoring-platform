import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { email, type, message } = await req.json();

  if (!email || !type || !message?.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const body = `
Admin Feedback — SilatScore

From:    ${email}
Type:    ${type}

${message.trim()}
  `.trim();

  try {
    await transporter.sendMail({
      from:    `"SilatScore Feedback" <${user}>`,
      to:      "silat.virginia@gmail.com",
      replyTo: email,
      subject: `[${type}] Admin Feedback from ${email}`,
      text:    body,
    });
  } catch (err) {
    console.error("feedback sendMail error:", err);
    return NextResponse.json({ error: "Failed to send." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
