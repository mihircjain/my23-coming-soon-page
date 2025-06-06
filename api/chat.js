// api/chat.js
// API endpoint for OpenAI chat completions
// Adds last-7-days nutrition, Strava and blood-marker context
// Logs each prompt in Firestore

import admin from "firebase-admin";

// Prevent re-initializing Admin SDK on every invocation
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

    // ─── Build the 7-day context prompt ───
    const contextPrompt = await buildContextPrompt(userId);

    // Prepend that context as a “system” message to whatever the client sent:
    const fullMsgs = [
      { role: "system", content: contextPrompt },
      ...messages,
    ];

    // Log the prompt to Firestore (best-effort):
    const userPrompt = messages.find((m) => m.role === "user")?.content || "";
    try {
      await logPrompt(userId, contextPrompt, userPrompt, source);
    } catch (__) {
      // If logging fails, we swallow the error and proceed
    }

    // ─── Call OpenAI’s Chat Completion endpoint ───
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

// ────────────────────────────────────────────────────────────────────────────────
// Helper: log each prompt to the “ai_prompt_logs” collection
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

// ────────────────────────────────────────────────────────────────────────────────
// Build a single “system‐prompt” string containing raw data from the last 7 days
async function buildContextPrompt(userId) {
  // Today at midnight UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Seven days ago (inclusive)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const startISO = sevenDaysAgo.toISOString().substring(0, 10); // "YYYY-MM-DD"

  // ── 1) LAST-7-DAYS NUTRITION LOGS ──
  // We assume each nutrition log is stored under collection “nutritionLogs”
  // with a document ID equal to the date string ("YYYY-MM-DD").
  // Also fields: { userId, date: "YYYY-MM-DD", totals: { calories, protein, carbs, fat, fiber }, … }
  const nutCollection = db.collection("nutritionLogs");
  const nutQuery = nutCollection
    .where("userId", "==", userId)
    .where("date", ">=", startISO)
    .orderBy("date", "asc");
  const nutSnap = await nutQuery.get();

  // Take only the last seven snapshots (in ascending order, so slice(-7)):
  const nutLines = nutSnap.docs.slice(-7).map((d) => {
    const t = d.data().totals || {};
    const dayId = d.id; // should equal the date string
    return `${dayId} kcal:${t.calories ?? 0} pro:${t.protein ?? 0} carb:${t.carbs ?? 0} fat:${t.fat ?? 0}`;
  });

  // ── 2) LAST-7-DAYS STRAVA DATA ──
  // We assume “strava_data” collection has documents with fields:
  // { userId, start_date: "<ISO string>", date: "YYYY-MM-DD", type, duration, caloriesBurned, … }
  // We query any document with start_date >= sevenDaysAgo.toISOString()

  const stravaCollection = db.collection("strava_data");
  const stravaQuery = stravaCollection
    .where("userId", "==", userId)
    .where("start_date", ">=", sevenDaysAgo.toISOString())
    .orderBy("start_date", "asc")
    .limit(100);
  const stravaSnap = await stravaQuery.get();

  const stravaLines = stravaSnap.docs.slice(-7).map((d) => {
    const a = d.data();
    // If your document stores `date` ("YYYY-MM-DD") separately, use a.date; otherwise substring from start_date
    const day = a.date || a.start_date.substring(0, 10);
    return `${day} ${a.type} dur:${a.duration}m cal:${a.caloriesBurned}`;
  });

  // ── 3) LATEST BLOOD MARKERS ──
  // We now query “blood_markers” by userId, ordered descending on "date" field, limit 1.
  // Each blood‐marker doc might look like: { userId, date: "YYYY-MM-DD", ldl, hdl, triglycerides, … }

  const bloodCollection = db.collection("blood_markers");
  const bloodQuery = bloodCollection
    .where("userId", "==", userId)
    .orderBy("date", "desc")
    .limit(1);
  const bloodSnap = await bloodQuery.get();

  let blood = {};
  if (!bloodSnap.empty) {
    blood = bloodSnap.docs[0].data();
  }

  // ── 4) ASSEMBLE THE FINAL PROMPT TEXT ──
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
