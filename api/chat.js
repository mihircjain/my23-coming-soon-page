// api/chat.js
// API endpoint for OpenAI chat completions
// Adds last-7-days nutrition, Strava and blood-marker context
// Logs each prompt in Firestore

import admin from "firebase-admin";

// one-liner guard so we don’t re-initialise on every invocation
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      messages,
      userId = "mihir_jain",
      source = "lets-jam-chatbot",
    } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    /* ─── build 7-day context prompt ─── */
    const contextPrompt = await buildContextPrompt(userId);

    /* prepend context to caller-supplied messages */
    const fullMsgs = [
      { role: "system", content: contextPrompt },
      ...messages,
    ];

    /* log prompt (best-effort) */
    const userPrompt = messages.find((m) => m.role === "user")?.content || "";
    try {
      await logPrompt(userId, contextPrompt, userPrompt, source);
    } catch (_) {}

    /* ─── OpenAI call ─── */
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: fullMsgs,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = resp.status === 429 ? "Service busy" : "AI service error";
      return res.status(502).json({ error: msg, detail: err });
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("/api/chat", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ───────────────── helper: log each prompt to Firestore ───────────────── */
async function logPrompt(userId, systemPrompt, userPrompt, source) {
  await db.collection("ai_prompt_logs").add({
    userId,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    systemPrompt,
    userPrompt,
    model: "gpt-4o-mini",
    source,
  });
}

/* ─────────── helper: buildContextPrompt(userId) ─────────── */
async function buildContextPrompt(userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const startISO = sevenDaysAgo.toISOString().substring(0, 10);

  // ── 1) Fetch last-7-day nutrition logs (flat docs named by yyyy-mm-dd) ──
  const nutSnap = await db
    .collection("nutritionLogs")
    .where("userId", "==", userId)
    .where("date", ">=", startISO)
    .orderBy("date", "asc")
    .get();

  const nutLines = nutSnap.docs
    .slice(-7)
    .map((d) => {
      const t = d.data().totals || {};
      return `${d.id} kcal:${t.calories ?? 0} pro:${t.protein ?? 0} carb:${t.carbs ?? 0} fat:${t.fat ?? 0}`;
    });

  // ── 2) Fetch last-7-day Strava activities ──
  const stravaSnap = await db
    .collection("strava_data")
    .where("userId", "==", userId)
    .where("start_date", ">=", sevenDaysAgo.toISOString())
    .orderBy("start_date", "asc")
    .limit(100)
    .get();

  const stravaLines = stravaSnap.docs
    .slice(-7)
    .map((d) => {
      const a = d.data();
      const day = a.date ?? a.start_date.substring(0, 10);
      return `${day} ${a.type} dur:${a.duration}m cal:${a.caloriesBurned}`;
    });

  // ── 3) Fetch latest blood markers ──
  const bloodDoc = await db.collection("blood_markers").doc(userId).get();
  const blood = bloodDoc.exists ? bloodDoc.data() : {};

  // ── 4) Build the consolidated prompt text ──
  let prompt = `You are a personal health assistant. Use only the raw data below.\n\n`;
  prompt += `Nutrition last 7 days:\n${nutLines.join("\n") || "none"}\n\n`;
  prompt += `Activities last 7 days:\n${stravaLines.join("\n") || "none"}\n\n`;
  prompt += `Latest blood markers:\n`;
  if (Object.keys(blood).length) {
    for (const [k, v] of Object.entries(blood)) {
      prompt += `${k}: ${v}\n`;
    }
  } else {
    prompt += `none\n`;
  }
  prompt +=
    "\nIf the user asks something not answerable from this data, reply 'not enough data'. Never invent numbers.";

  return prompt;
}
