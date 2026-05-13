import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchFAQs(): Promise<{ question: string; answer: string }[]> {
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_KNOWLEDGE_HUB;
  const url = `https://api.airtable.com/v0/${base}/${table}?filterByFormula=%7BType%7D%3D%22Support+FAQ%22&fields%5B%5D=Description&fields%5B%5D=Content`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status}`);
  const data = await res.json();
  return data.records
    .filter((r: any) => r.fields.Description && r.fields.Content)
    .map((r: any) => ({ question: r.fields.Description, answer: r.fields.Content }));
}

async function sendEscalationEmail(userMessage: string, userType: string, userEmail: string, summary: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: `[Support Ticket] ${userType} needs help`,
    text: `New support ticket from Pairascope.\n\nUser Type: ${userType}\nUser Email: ${userEmail || "Not provided"}\n\nUser Message:\n${userMessage}\n\nAI Summary:\n${summary}\n\n---\nReply to this email or log in to Airtable to follow up.`,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, userType, userEmail } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const faqs = await fetchFAQs();
    const faqBlock = faqs.map((f, i) => `Q${i + 1}: ${f.question}\nA${i + 1}: ${f.answer}`).join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `You are the Pairascope support assistant. Only answer questions about Pairascope. The user is a: ${userType || "user"}.\n\nUse ONLY the FAQ list below. If not clearly covered, return ESCALATE. Be conservative.\n\nFAQ LIST:\n${faqBlock}\n\nUser question: "${message}"\n\nRespond with either:\nANSWER: [1-3 sentence answer]\nor\nESCALATE: [one sentence summary of the issue]`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    if (raw.startsWith("ANSWER:")) {
      return NextResponse.json({ answer: raw.replace("ANSWER:", "").trim() });
    }

    if (raw.startsWith("ESCALATE:")) {
      const summary = raw.replace("ESCALATE:", "").trim();
      try {
        await sendEscalationEmail(message, userType || "Unknown", userEmail || "", summary);
      } catch (emailErr) {
        console.error("Escalation email failed:", emailErr);
      }
      return NextResponse.json({
        escalate: true,
        message: `I don't have a confident answer for that. I've flagged this for the Pairascope team and someone will follow up at ${userEmail || "your registered email"} shortly.`,
      });
    }

    return NextResponse.json({
      escalate: true,
      message: "I wasn't able to find a clear answer. The Pairascope team has been notified and will follow up shortly.",
    });
  } catch (err) {
    console.error("Support route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
