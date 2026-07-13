import { Resend } from "resend";

let resend: Resend | null = null;

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY!);
  }

  return resend;
}
