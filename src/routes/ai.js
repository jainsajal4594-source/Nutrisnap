const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Anyone (including guests) can use the AI features, same as the original
// demo — but rate-limited per IP so a public deployment can't be used to
// silently burn through your Gemini quota. Tighten/loosen as you like.
router.use(optionalAuth);
router.use(rateLimit({ windowMs: 60 * 60 * 1000, max: 30 })); // 30 requests / hour / IP

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Server is missing GEMINI_API_KEY. Set it in your .env file.');
  }
  return key;
}

async function callGemini(body) {
  const response = await fetch(`${GEMINI_URL}?key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Gemini API error.');
  }
  const candidate = data.candidates && data.candidates[0];
  if (!candidate) {
    throw new Error('No response from Gemini — the content may have been blocked by safety filters.');
  }
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
    throw new Error('Gemini declined to process this request.');
  }
  const text = candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
}

router.post('/analyze-food', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required.' });
    }

    const prompt = `Analyze this food image. Return ONLY a JSON object with no markdown fences:
{"name":"Food name","description":"One sentence description","servingSize":"e.g. 1 plate (~300g)","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0,"insights":["insight 1","insight 2","insight 3"],"badges":[{"label":"High protein","type":"green"}]}
Badge types: green=healthy/good, amber=moderate, red=limit. Use realistic estimates.`;

    const rawText = await callGemini({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      }]
    });

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    let food;
    try {
      food = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(502).json({ error: 'Could not parse the AI response. Please try again.' });
    }
    res.json({ food });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Could not analyze the image.' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, history, lastFoodResult } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required.' });
    }

    let systemContext = `You are NutriSnap Assistant, a friendly, knowledgeable nutrition and healthy-eating helper embedded in a calorie-tracking app. Keep answers concise (a few sentences, or a short list when helpful), warm, and practical. You are not a doctor; for medical concerns suggest consulting a professional.`;

    if (lastFoodResult && lastFoodResult.name) {
      systemContext += `\n\nThe user most recently scanned this meal:
Name: ${lastFoodResult.name}
Description: ${lastFoodResult.description || ''}
Serving size: ${lastFoodResult.servingSize || ''}
Calories: ${lastFoodResult.calories}
Protein: ${lastFoodResult.protein}g, Carbs: ${lastFoodResult.carbs}g, Fat: ${lastFoodResult.fat}g, Fiber: ${lastFoodResult.fiber}g, Sugar: ${lastFoodResult.sugar}g, Sodium: ${lastFoodResult.sodium}mg
If the user asks about "this meal", "it", or similar, assume they mean this scanned item.`;
    }

    const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
    const contents = [
      { role: 'user', parts: [{ text: systemContext }] },
      { role: 'model', parts: [{ text: "Understood — I'll keep responses concise and reference the scanned meal when relevant." }] },
      ...safeHistory.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const replyText = await callGemini({ contents });
    res.json({ reply: replyText.trim() });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Could not get a response from the assistant.' });
  }
});

module.exports = router;
