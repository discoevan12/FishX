/* ═══════════════════════════════════════════════════════════════
   ai.js — Gemini Vision Fish Grader
   ═══════════════════════════════════════════════════════════════
   SETUP: Replace YOUR_GEMINI_API_KEY in js/shared.js
   ═══════════════════════════════════════════════════════════════ */

const AI = (() => {

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function gradeFish(files) {
    if (!files || files.length === 0) throw new Error("No files provided");

    const mimeType   = files[0].type || "image/jpeg";
    const base64List = await Promise.all(Array.from(files).map(f => fileToBase64(f)));

    const imageParts = base64List.map(b64 => ({
      inlineData: { mimeType, data: b64 }
    }));

    const prompt = `You are FishX's expert fish grader. Analyze the fish in the photo(s) and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

Return exactly this shape:
{
  "species": "Common name",
  "scientificName": "Scientific name",
  "grade": "S",
  "rarity": "Legendary",
  "condition": "Pristine",
  "estimatedValue": 500,
  "suggestedPrice": 650,
  "description": "Two sentence listing description.",
  "gradeReason": "Why this grade was assigned."
}

Grade rubric:
- S: Trophy/legendary specimen — extremely rare, pristine condition
- A: Rare species or exceptional specimen in excellent shape
- B: Uncommon species or good-condition common fish
- C: Common species, average or below-average condition

Respond ONLY with the JSON object.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [...imageParts, { text: prompt }] }]
        })
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Gemini API error");
    }

    const data    = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = rawText.replace(/```json|```/gi, "").trim();
    return JSON.parse(cleaned);
  }

  return { gradeFish };
})();
