"use strict";

// Sends YOU an email when someone signs up or logs in.
// Needs two settings in the server environment:
//   RESEND_API_KEY  - from resend.com (free account)
//   NOTIFY_EMAIL    - the address that should receive the alerts
// Optional:
//   NOTIFY_FROM     - sender, default "LinguaApp <onboarding@resend.dev>"
//   NOTIFY_ON_LOGIN - set to "false" to be emailed only about new sign-ups
//
// Never throws: a failed email must never stop someone from logging in.

const TIMEOUT_MS = 4000;

function enabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL);
}

async function notifyOwner(subject, lines) {
  if (!enabled()) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.NOTIFY_FROM || "LinguaApp <onboarding@resend.dev>",
        to: [process.env.NOTIFY_EMAIL],
        subject,
        text: lines.filter(Boolean).join("\n"),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(
        "Email not sent:",
        res.status,
        (await res.text()).slice(0, 200),
      );
    }
  } catch (err) {
    console.error("Email not sent:", String(err.message).slice(0, 200));
  }
}

function clientInfo(req) {
  const forwarded = String(req.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim();
  return {
    ip: forwarded || req.ip || "unknown",
    device: String(req.get("user-agent") || "unknown").slice(0, 120),
  };
}

const when = () => new Date().toUTCString();

// Await these before sending the response: on Vercel the server is paused
// as soon as the response goes out, which would cancel a half-sent email.
async function notifyLogin(req, user) {
  if (String(process.env.NOTIFY_ON_LOGIN).toLowerCase() === "false") return;
  const { ip, device } = clientInfo(req);
  await notifyOwner(`LinguaApp login: ${user.username}`, [
    `${user.name || user.username} (@${user.username}) just logged in.`,
    "",
    `Time:   ${when()}`,
    `IP:     ${ip}`,
    `Device: ${device}`,
  ]);
}

async function notifySignup(req, user, inviteLabel) {
  const { ip, device } = clientInfo(req);
  await notifyOwner(`LinguaApp: new sign-up ${user.username}`, [
    `${user.name || user.username} (@${user.username}) just created an account.`,
    "",
    `Invite code: ${inviteLabel || "(unlabelled)"}`,
    `Time:        ${when()}`,
    `IP:          ${ip}`,
    `Device:      ${device}`,
  ]);
}

module.exports = { notifyLogin, notifySignup };
