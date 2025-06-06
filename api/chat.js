// API endpoint for OpenAI chat completions
// Adds last‑7‑days nutrition, Strava and blood‑marker context
// Logs each prompt in Firestore

import { db } from "../src/lib/firebaseConfig.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";

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

    /* ─── build 7‑day context prompt ─── */
    const contextPrompt = await buildContextPrompt(userId);

    /* prepend context to caller‑supplied messages */
    const fullMsgs = [
      { role: "system", content: contextPrompt },
      ...messages,
    ];

    /* log prompt (best‑effort) */
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

/* ───────────────── helpers ───────────────── */
async function logPrompt(userId, systemPrompt, userPrompt, source) {
  await addDoc(collection(db, "ai_prompt_logs"), {
    userId,
    timestamp: serverTimestamp(),
    systemPrompt,
    userPrompt,
    model: "gpt-4o-mini",
    source,
  });
}

async function buildContextPrompt(userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const startISO = sevenDaysAgo.toISOString().substring(0, 10);

  /* nutritionLogs – flat docs named yyyy-mm-dd */
  const nutSnap = await getDocs(
    query(
      collection(db, "nutritionLogs"),
      where("userId", "==", userId),
      where("date", ">=", startISO),
      orderBy("date", "asc")
    )
  );
  const nutLines = nutSnap.docs.slice(-7).map((d) => {
    const t = d.data().totals || {};
    return `${d.id} kcal:${t.calories ?? 0} pro:${t.protein ?? 0} carb:${
      t.carbs ?? 0
    } fat:${t.fat ?? 0}`;
  });

  /* strava_data – start_date ISO */
  const stravaSnap = await getDocs(
    query(
      collection(db, "strava_data"),
      where("userId", "==", userId),
      where("start_date", ">=", sevenDaysAgo.toISOString()),
      orderBy("start_date", "asc"),
      limit(100)
    )
  );
  const stravaLines = stravaSnap.docs.slice(-7).map((d) => {
    const a = d.data();
    return `${a.date ?? a.start_date.substring(0, 10)} ${a.type} dur:${
      a.duration
    }m cal:${a.caloriesBurned}`;
  });

  /* blood markers */
  const bloodDoc = await getDoc(doc(db, "blood_markers", userId));
  const blood = bloodDoc.exists() ? bloodDoc.data() : {};

  let prompt = `You are a personal health assistant. Use only the raw data below.\n\n`;
  prompt += `Nutrition last 7 days:\n${nutLines.join("\n") || "none"}\n\n`;
  prompt += `Activities last 7 days:\n${stravaLines.join("\n") || "none"}\n\n`;
  prompt += `Latest blood markers:\n`;
  if (Object.keys(blood).length) {
    for (const [k, v] of Object.entries(blood)) prompt += `${k}: ${v}\n`;
  } else {
    prompt += `none\n`;
  }
  prompt +=
    "\nIf the user asks something not answerable from this data, reply 'not enough data'. Never invent numbers.";

  return prompt;
}
