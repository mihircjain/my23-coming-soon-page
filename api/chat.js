// File: api/chat.js
// -----------------
// API endpoint for OpenAI chat completions.
// It prepends a “last-7-days context” (nutrition + Strava + blood markers) as a system prompt,
// logs every prompt to Firestore, and then forwards everything to OpenAI’s Chat Completion endpoint.

import admin from "firebase-admin";

// ——————————————————————————————————————————————————————————————————————————————
// 1) Initialize the Admin SDK ONLY ONCE (per Cloud Function invocation).
//    This prevents “already initialized” errors when using Next.js / Vercel serverless.
// ——————————————————————————————————————————————————————————————————————————————
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

// ——————————————————————————————————————————————————————————————————————————————
// 2) The main handler: responds to POST /api/chat
// ——————————————————————————————————————————————————————————————————————————————
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

    // Validate that “messages” is an array
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request body: messages must be an array." });
    }

    // Ensure we have an OpenAI key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("No OPENAI_API_KEY in environment");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Build a “7-day snapshot” system prompt
    const contextPrompt = await buildContextPrompt(userId);

    // Prepend the generated contextPrompt as a “system” message
    const fullMsgs = [
      { role: "system", content: contextPrompt },
      ...messages,
    ];

    // Log what we’re sending (best-effort — swallow any logging errors)
    const userPrompt = messages.find((m) => m.role === "user")?.content || "";
    try {
      await logPrompt(userId, contextPrompt, userPrompt, source);
    } catch (loggingErr) {
      console.warn("Failed to log AI prompt:", loggingErr);
    }

    // Call OpenAI’s Chat Completions endpoint
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      "gpt-4o-mini",
        messages:   fullMsgs,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openAiResponse.ok) {
      // Forward a reasonably helpful error to the client
      const errJson = await openAiResponse.json().catch(() => ({}));
      const errMsg = openAiResponse.status === 429
        ? "Service temporarily busy"
        : "AI service error";
      return res.status(502).json({ error: errMsg, detail: errJson });
    }

    const data = await openAiResponse.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error("/api/chat error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}


// ——————————————————————————————————————————————————————————————————————————————
// Helper #1: Log each prompt into “ai_prompt_logs” (Firestore) for auditing.
// ——————————————————————————————————————————————————————————————————————————————
async function logPrompt(userId, systemPrompt, userPrompt, source) {
  await db.collection("ai_prompt_logs").add({
    userId,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    systemPrompt,
    userPrompt,
    model:  "gpt-4o-mini",
    source,
  });
}


// ——————————————————————————————————————————————————————————————————————————————
// Helper #2: Build a single “system” prompt containing last-7-days data.
//              - Nutrition from “nutritionLogs” (doc ID = YYYY-MM-DD).
//              - Strava from “strava_data” (ordered by start_date DESC).
//              - Blood markers from “blood_markers” (ordered by date DESC).
// ——————————————————————————————————————————————————————————————————————————————
async function buildContextPrompt(userId) {
  // A) Compute “today” @ midnight UTC, and “seven days ago” @ midnight UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  // We’ll treat “sevenDaysAgo” → “today” inclusive as exactly 7 days.

  // ──────────── 1) NUTRITION LAST 7 DAYS ────────────
  // Each nutritionLog doc’s ID = "YYYY-MM-DD". 
  // We also store { userId, date, totals: {calories, protein, carbs, fat, fiber}, … }.
  // We read exactly seven consecutive dates (sevenDaysAgo → today).

  const nutLines = [];
  for (let offset = 0; offset < 7; offset++) {
    const dt = new Date(sevenDaysAgo);
    dt.setDate(sevenDaysAgo.getDate() + offset);
    const dateStr = dt.toISOString().substring(0, 10); // "YYYY-MM-DD"

    // Attempt to read the document whose ID is dateStr
    const docRef = db.collection("nutritionLogs").doc(dateStr);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const t = data.totals || {};
      nutLines.push(
        `${dateStr} kcal:${t.calories ?? 0} pro:${t.protein ?? 0} carb:${t.carbs ?? 0} fat:${t.fat ?? 0}`
      );
    } else {
      // No log for that date → treat everything as zero
      nutLines.push(`${dateStr} kcal:0 pro:0 carb:0 fat:0`);
    }
  }

  // ──────────── 2) STRAVA LAST 7 DAYS ────────────
  // “strava_data” docs each have fields { userId, start_date (ISO), date (YYYY-MM-DD), type, duration, caloriesBurned,… }.
  // We query all items in the past 7 days (start_date >= sevenDaysAgo.toISOString()) in descending order.
  // Then we take the top 7, reverse them so oldest→newest.

  const stravaLines = [];
  {
    const stravaCollection = db.collection("strava_data");
    const stravaQuery = stravaCollection
      .where("userId", "==", userId)
      .where("start_date", ">=", sevenDaysAgo.toISOString())
      .orderBy("start_date", "desc") // requires composite index (userId ASC, start_date DESC)
      .limit(7);

    const stravaSnap = await stravaQuery.get();
    // stravaSnap.docs[0] is the **newest**; we want oldest first, so reverse:
    stravaSnap.docs.reverse().forEach((docSnapshot) => {
      const a = docSnapshot.data();
      // If you store a separate “date” (YYYY-MM-DD), use a.date; otherwise substring:
      const day = a.date || a.start_date.substring(0, 10);
      stravaLines.push(`${day} ${a.type} dur:${a.duration}m cal:${a.caloriesBurned}`);
    });
    // If there are fewer than 7, this simply returns as many as exist.
  }

  // ──────────── 3) LATEST BLOOD MARKERS ────────────
  // Firestore collection “blood_markers” has docs { userId, date: "YYYY-MM-DD", ldl, hdl, triglycerides, … }.
  // We grab exactly the most recent one by date DESC.

  let blood = {};
  {
    const bloodCollection = db.collection("blood_markers");
    const bloodQuery = bloodCollection
      .where("userId", "==", userId)
      .orderBy("date", "desc") // requires composite index (userId ASC, date DESC)
      .limit(1);

    const bloodSnap = await bloodQuery.get();
    if (!bloodSnap.empty) {
      blood = bloodSnap.docs[0].data();
      // Example: { userId: "mihir_jain", date: "2025-05-29", ldl: 120, hdl: 50, … }
    }
  }

  // ──────────── 4) ASSEMBLE THE FINAL PROMPT TEXT ────────────
  let prompt = `You are a personal health assistant. Use only the raw data below.\n\n`;

  prompt += `Nutrition last 7 days:\n${nutLines.join("\n")}\n\n`;
  prompt += `Activities last 7 days:\n${stravaLines.length ? stravaLines.join("\n") : "none"}\n\n`;
  prompt += `Latest blood markers:\n`;

  if (Object.keys(blood).length) {
    for (const [k, v] of Object.entries(blood)) {
      // Show each field (e.g. “ldl: 120”, “hdl: 50”, etc.)
      prompt += `${k}: ${v}\n`;
    }
  } else {
    prompt += `none\n`;
  }

  prompt +=
    `\nIf the user asks something not answerable from this data, reply "not enough data". ` +
    `Never invent numbers.`;

  return prompt;
}
