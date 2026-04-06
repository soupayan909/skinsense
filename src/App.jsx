import { useState, useEffect, useRef } from "react";

// ── Fonts ──────────────────────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap";
  document.head.appendChild(link);
}

// ── Design Tokens ──────────────────────────────────────────────────────────────
const T = {
  bg: "#F6F2EC", surface: "#FFFFFF", card: "#FDFAF6",
  border: "#E0D5C4", sand: "#EBE1D2",
  sage: "#6B9E7E", sagePale: "#EBF4EF", sageDark: "#3D6650",
  terra: "#C8704A", terraPale: "#FBF0EA",
  ink: "#1C1710", muted: "#8A7B6A", muted2: "#B3A592",
  gold: "#C4964A", goldPale: "#FBF5E2",
  red: "#D04F4F", redPale: "#FDF1F1",
  teal: "#3A9E8F", tealPale: "#E8F5F3",
  blue: "#4A80C8", bluePale: "#EEF3FB",
  warn: "#E8A535",
};
const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'DM Sans', system-ui, sans-serif";

// ── Helpers ────────────────────────────────────────────────────────────────────
const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0; return h.toString(36); };
const avatarBg = (n = "") => ["#6B9E7E","#C8704A","#4A82C8","#9B6BB5","#C8944A","#4AACB4"][n.charCodeAt(0) % 6] || "#6B9E7E";
const getInitials = (n = "") => n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";
const has = (val, term) => { if (!val) return false; return (Array.isArray(val) ? val : [val]).some(v => v.toLowerCase().includes(term.toLowerCase())); };
const fmtAnswers = (a) => Object.entries(a).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ");

// ── Storage / DB ───────────────────────────────────────────────────────────────
const DB = {
  getUser: async (email) => { try { const r = await window.storage.get(`u:${email}`); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  saveUser: async (u) => { try { await window.storage.set(`u:${u.email}`, JSON.stringify(u)); } catch {} },
  getScans: async (email) => {
    try {
      const keys = await window.storage.list(`s:${email}:`);
      const out = [];
      for (const k of (keys?.keys || [])) { try { const r = await window.storage.get(k); if (r) out.push(JSON.parse(r.value)); } catch {} }
      return out.sort((a, b) => b.ts - a.ts);
    } catch { return []; }
  },
  saveScan: async (email, scan) => { try { await window.storage.set(`s:${email}:${scan.ts}`, JSON.stringify(scan)); } catch {} },
  getStats: async () => { try { const r = await window.storage.get("community", true); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  pushStats: async (skinType, concerns, scores, lifestyle) => {
    try {
      let s = {}; try { const r = await window.storage.get("community", true); if (r) s = JSON.parse(r.value); } catch {}
      s.total = (s.total || 0) + 1;
      s.types = s.types || {}; s.types[skinType] = (s.types[skinType] || 0) + 1;
      s.concerns = s.concerns || {}; (concerns || []).forEach(c => { s.concerns[c] = (s.concerns[c] || 0) + 1; });
      s.lifestyle = s.lifestyle || {}; (lifestyle || []).forEach(f => { s.lifestyle[f] = (s.lifestyle[f] || 0) + 1; });
      s.scores = s.scores || {};
      Object.entries(scores || {}).forEach(([k, v]) => { const p = s.scores[k] || { sum: 0, n: 0 }; s.scores[k] = { sum: p.sum + v, n: p.n + 1 }; });
      await window.storage.set("community", JSON.stringify(s), true);
    } catch {}
  },
};

// ── Questions ──────────────────────────────────────────────────────────────────
const QUESTIONS = [
  { id: "skinType",      q: "How would you describe your skin?",           hint: "Select all that apply",             opts: ["Dry", "Oily", "Combination", "Normal", "Not sure"] },
  { id: "sensitivity",  q: "How sensitive is your skin?",                  hint: "Select all that apply",             opts: ["Very sensitive", "Somewhat sensitive", "Not very sensitive", "Reacts to fragrances", "Reacts to acids", "Prone to redness"] },
  { id: "conditions",   q: "Do you experience any of these?",              hint: "Important for safe recommendations", opts: ["Rashes or hives", "Eczema / dry patches", "Acne / breakouts", "Rosacea-like redness", "Dandruff / flaky scalp", "Fungal skin issues", "Hyperpigmentation", "None"] },
  { id: "goal",         q: "What are your skincare goals?",                hint: "Pick as many as you like",          opts: ["Look fresher & brighter", "Fix rashes / irritation", "Control acne", "Deep hydration", "Even skin tone", "Dark spots", "Anti-aging", "Oil control", "Minimize pores", "Basic hygiene routine"] },
  { id: "allergies",    q: "Any known allergies?",                         hint: "Select all that apply",             opts: ["Fragrance", "Retinol / Retinoids", "Niacinamide", "AHAs / BHAs", "Vitamin C", "Essential oils", "Nut oils", "None known"] },
  { id: "lifestyle",    q: "Tell us about your lifestyle",                 hint: "These directly affect your skin",   opts: ["Poor sleep (under 6 hrs)", "High stress levels", "Smoke / around smokers", "Low water intake", "High sugar / junk food", "Outdoors / high UV", "Heavy makeup daily", "Rarely change pillowcase", "Phone touches face often", "Gym / sweating daily"] },
  { id: "routine",      q: "Your current skincare routine?",               hint: "Select all that apply",             opts: ["None at all", "Just water", "Cleanser only", "Cleanser + moisturiser", "SPF daily", "Serums / actives", "Full AM & PM routine"] },
  { id: "budget",       q: "Budget per product?",                          hint: "Select all that apply",             opts: ["Under ₹500", "₹500–1,500", "₹1,500–4,000", "₹4,000+"] },
  { id: "climate",      q: "Your environment?",                            hint: "Select all that apply",             opts: ["Humid", "Dry", "Cold", "High UV / sunny", "Urban / polluted", "Hard water area"] },
  { id: "pregnancy",    q: "Are you pregnant or breastfeeding?",           hint: "Affects ingredient safety",         opts: ["Yes", "No", "Prefer not to say"] },
];

// ── Ingredient rules ───────────────────────────────────────────────────────────
const getRecs = (scores = {}, answers = {}) => {
  const recs = new Set(), avoid = new Set();
  if ((scores.dryness || 0) > .35)          { recs.add("Ceramides"); recs.add("Hyaluronic acid"); recs.add("Glycerin"); }
  if ((scores.oiliness || 0) > .45)         { recs.add("Niacinamide"); recs.add("Salicylic acid (2%)"); }
  if ((scores.blemishTendency || 0) > .4)   { recs.add("Salicylic acid"); recs.add("Niacinamide"); recs.add("Benzoyl peroxide 2.5%"); }
  if ((scores.darkSpots || 0) > .3)         { recs.add("Vitamin C (10–15%)"); recs.add("Niacinamide"); recs.add("Azelaic acid"); }
  if ((scores.redness || 0) > .35)          { recs.add("Centella asiatica"); recs.add("Ceramides"); recs.add("Panthenol"); }
  if ((scores.unevenTone || 0) > .4)        { recs.add("Vitamin C"); recs.add("Alpha arbutin"); recs.add("Azelaic acid"); }
  if ((scores.texture || 0) > .4)           { recs.add("AHA glycolic acid 5–10%"); recs.add("PHA gluconolactone"); }
  recs.add("Broad-spectrum SPF 50");
  if (has(answers.sensitivity, "very sensitive") || has(answers.sensitivity, "somewhat")) { avoid.add("Fragrance"); avoid.add("High-concentration AHAs"); recs.add("Barrier-repair moisturiser"); }
  if (has(answers.pregnancy, "yes"))         { ["Retinoids / Retinol","High-dose salicylic acid","Hydroquinone","Benzoyl peroxide"].forEach(x => avoid.add(x)); recs.delete("Benzoyl peroxide 2.5%"); }
  const amap = { fragrance:"Fragrance", retinol:"Retinoids / Retinol", niacinamide:"Niacinamide", ahas:"AHA / BHA acids", "vitamin c":"Vitamin C (10–15%)", "essential oils":"Essential oils", "nut":"Nut oils" };
  (answers.allergies || []).forEach(a => { if (a === "None known") return; Object.entries(amap).forEach(([k, v]) => { if (a.toLowerCase().includes(k)) { avoid.add(v); recs.delete(v); } }); });
  return { recommended: [...recs], avoid: [...avoid] };
};

// ── Lifestyle tips engine ──────────────────────────────────────────────────────
const getTips = (answers = {}) => {
  const lf = answers.lifestyle || [], cl = answers.climate || [], tips = [];
  if (has(lf,"poor sleep"))           tips.push({ icon:"😴", title:"Get 7–8 hours of sleep", body:"Skin repairs itself overnight. Chronic under-sleeping raises cortisol, worsening breakouts, dullness, and puffiness. A consistent bedtime is one of the highest-impact changes for skin.", level:"high" });
  if (has(lf,"stress"))               tips.push({ icon:"🧘", title:"Manage stress actively", body:"Cortisol from stress increases oil production and inflammation — directly causing breakouts and redness. Even 10 min of daily walking, breathing exercises, or journalling makes a visible difference.", level:"high" });
  if (has(lf,"water"))                tips.push({ icon:"💧", title:"Drink 2–3 litres daily", body:"Dehydration shows on your face first — dullness, fine lines, and tight skin. Carry a 1L bottle and refill it twice. Coconut water and green tea count toward hydration.", level:"high" });
  if (has(lf,"pillowcase"))           tips.push({ icon:"🛏",  title:"Change pillowcase every 2–3 days", body:"Your pillowcase collects oil, dead skin, and bacteria each night. This single habit dramatically reduces breakouts, especially for acne-prone or sensitive skin.", level:"high" });
  if (has(lf,"phone"))                tips.push({ icon:"📱", title:"Wipe phone screen daily", body:"Phone screens carry significant bacteria that transfer every time you press it to your cheek. Use an alcohol wipe daily and switch to earphones. This alone can clear chin and cheek breakouts.", level:"medium" });
  if (has(lf,"sugar") || has(lf,"junk")) tips.push({ icon:"🥗", title:"Reduce sugar & processed foods", body:"High-glycaemic foods spike insulin, increasing sebum and inflammation. Swap one processed snack for nuts, fruit, or veg. Omega-3-rich foods (fish, flaxseeds, walnuts) actively improve skin barrier function.", level:"medium" });
  if (has(lf,"smoke"))                tips.push({ icon:"🚭", title:"Reduce smoke exposure", body:"Smoking reduces skin blood flow, causes premature wrinkles, dullness, and delays healing. Even reducing secondhand smoke exposure noticeably improves clarity and texture over weeks.", level:"high" });
  if (has(lf,"heavy makeup"))         tips.push({ icon:"🧴", title:"Double cleanse every night", body:"Heavy makeup left overnight clogs pores and causes congestion and dullness. Cleansing oil first, then a gentle foaming cleanser. Never sleep with SPF on — it's comedogenic overnight.", level:"medium" });
  if (has(lf,"gym") || has(lf,"sweat")) tips.push({ icon:"🏃", title:"Cleanse within 30 min post-workout", body:"Sweat mixed with oil creates the perfect environment for breakouts. Keep a gentle face wash in your gym bag and use a face-only clean towel.", level:"medium" });
  if (has(cl,"hard water"))           tips.push({ icon:"🚿", title:"Counter hard water with pH cleanser", body:"Hard water leaves minerals that disrupt your barrier, causing dryness and irritation. Use a pH-balanced gentle cleanser (avoid bar soaps) and a barrier-repair moisturiser consistently.", level:"medium" });
  if (has(cl,"polluted") || has(cl,"urban")) tips.push({ icon:"🏙",  title:"Antioxidants are essential in cities", body:"Urban pollution accelerates ageing and causes dullness. Vitamin C serum every morning acts as an antioxidant shield. Double cleanse at night to remove PM2.5 particles.", level:"medium" });
  if (has(cl,"high uv") || has(lf,"outdoors")) tips.push({ icon:"☀️", title:"Reapply SPF every 2 hours outdoors", body:"One morning SPF application isn't enough outdoors. Use SPF 50 PA++++ and reapply every 2 hours. A UV-protective face mist makes reapplication easy during the day.", level:"high" });
  tips.push({ icon:"🤲", title:"Wash hands before touching your face", body:"Your hands carry bacteria, oil, and pollutants that transfer every time you touch your face. This one habit can significantly reduce random breakouts within weeks.", level:"low" });
  tips.push({ icon:"🪥", title:"Clean makeup brushes weekly", body:"Brushes accumulate bacteria, oil, and dead skin. Wash with gentle shampoo weekly. Using dirty tools causes persistent breakouts that no skincare product can fix.", level:"low" });
  return tips;
};

const getConditionAlerts = (answers = {}) => {
  const cond = answers.conditions || [], alerts = [];
  if (has(cond,"rashes"))      alerts.push({ level:"warning", icon:"⚠️", title:"Rash guidance included", body:"We've filtered potentially irritating ingredients. If rashes persist beyond 2 weeks or spread, see a dermatologist — they may indicate an allergy or skin condition needing diagnosis." });
  if (has(cond,"eczema"))      alerts.push({ level:"info",    icon:"💡", title:"Eczema-safe routine", body:"We've avoided harsh actives and fragrance. Focus on ceramides and barrier-repair. Try the soak-and-seal method: moisturise within 3 minutes of bathing on damp skin." });
  if (has(cond,"rosacea"))     alerts.push({ level:"warning", icon:"🌹", title:"Rosacea-sensitive adjustments", body:"Strong AHAs, alcohol toners, and physical scrubs removed. Azelaic acid is included — clinically proven to help rosacea. Avoid very hot water, spicy food, and alcohol as triggers." });
  if (has(cond,"fungal"))      alerts.push({ level:"warning", icon:"🍄", title:"Potential fungal concern flagged", body:"Fungal issues require antifungal treatment, not standard skincare. Please see a dermatologist for diagnosis. Avoid heavy oils (coconut, argan) on affected areas." });
  if (has(cond,"dandruff"))    alerts.push({ level:"info",    icon:"❄️", title:"Scalp hygiene tips added", body:"Dandruff usually responds to zinc pyrithione or ketoconazole shampoos (Head & Shoulders, Selsun, Nizoral). Wash hair 3x/week. If it affects the face edges, use an antifungal cleanser." });
  return alerts;
};

// ── AI ─────────────────────────────────────────────────────────────────────────
const analyzeImage = async (b64, answers, description = "") => {
  const descNote = description ? `\n\nUSER'S ADDITIONAL DESCRIPTION:\n${description}` : "";
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1200,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
        { type: "text", text: `You are a comprehensive skin health AI. Analyse this photo for cosmetic AND hygiene/wellness signals. User: ${fmtAnswers(answers)}${descNote}\n\nReturn ONLY valid JSON (no markdown):\n{"scores":{"oiliness":0.0,"dryness":0.0,"redness":0.0,"unevenTone":0.0,"blemishTendency":0.0,"darkSpots":0.0,"texture":0.0,"poreVisibility":0.0,"underEyePigmentation":0.0},"skinType":"combination","primaryConcerns":["c1","c2","c3"],"explanation":"2-3 sentences covering cosmetic appearance AND the user's description — reference what they said if provided","needsDermatologist":false,"dermatologistReason":"","morningRoutine":[{"step":1,"category":"Gentle cleanser","ingredient":"Amino acid surfactants","brand":"Cetaphil Gentle Skin Cleanser","brandNote":"₹399–699 · Nykaa, pharmacies","note":"Removes buildup without stripping"},{"step":2,"category":"Vitamin C serum","ingredient":"L-Ascorbic acid 10%","brand":"Minimalist 10% Vitamin C","brandNote":"₹599 · Nykaa","note":"Brightens and protects"},{"step":3,"category":"Moisturiser","ingredient":"Ceramides + Glycerin","brand":"CeraVe Moisturising Cream","brandNote":"₹1,299–1,799 · Nykaa","note":"Seals in hydration"},{"step":4,"category":"Sunscreen","ingredient":"SPF 50 PA++++","brand":"Minimalist SPF 50","brandNote":"₹349 · Nykaa","note":"Essential every morning"}],"nightRoutine":[{"step":1,"category":"Micellar water","ingredient":"Gentle surfactants","brand":"Simple Micellar Water","brandNote":"₹299–499 · Nykaa","note":"Removes SPF and makeup","freq":"daily"},{"step":2,"category":"Treatment serum","ingredient":"Key active","brand":"Minimalist Azelaic Acid 10%","brandNote":"₹599 · Nykaa","note":"Targets main concern","freq":"3x per week"},{"step":3,"category":"Night moisturiser","ingredient":"Ceramides + Peptides","brand":"CeraVe PM Lotion","brandNote":"₹1,799 · Amazon India","note":"Overnight repair","freq":"daily"}],"topHygieneTips":["tip1","tip2","tip3"],"overallScore":72,"timeline":"Realistic timeline"}\n\nFor each routine step: brand = specific Indian market product, brandNote = ₹ price + where to buy. Prefer: Minimalist, Dot & Key, Plum, mCaffeine, CeraVe, Cetaphil, La Roche-Posay, Simple, Bioderma. Factor in the user's written description alongside the photo.` }
      ] }]
    }),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const d = await res.json();
  const text = d.content.filter(c => c.type === "text").map(c => c.text).join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

const chatAI = async (messages, ctx) => {
  const sys = `You are Skinsense — a warm, expert skin health assistant. Help with: skincare routines, rashes and irritation, hygiene habits (pillowcase, phone, brush cleaning), lifestyle changes (sleep, diet, stress, hydration), ingredient questions, when to see a dermatologist, and product recommendations.\n\nUSER: ${ctx.skinType} skin, score ${ctx.overallScore}/100. Concerns: ${(ctx.primaryConcerns||[]).join(", ")}. Conditions: ${(ctx.answers?.conditions||[]).join(", ")||"none"}. Lifestyle flags: ${(ctx.answers?.lifestyle||[]).join(", ")||"none"}.\nMorning: ${(ctx.morning||[]).map(s=>`${s.category}(${s.brand})`).join(", ")}\nNight: ${(ctx.night||[]).map(s=>`${s.category}(${s.brand})`).join(", ")}\nRecommended: ${(ctx.recommended||[]).join(", ")}\nAvoid: ${(ctx.avoid||[]).join(", ")}\n\nRULES: Recommend Indian brands (Minimalist, Dot & Key, Plum, CeraVe, Cetaphil, La Roche-Posay, Simple, Bioderma) with ₹ pricing and Nykaa/Amazon India/Flipkart. For rashes: give helpful guidance AND suggest seeing a doctor if persistent. Never diagnose medically. Be warm and concise.`;
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 700, system: sys, messages: messages.map(m => ({ role: m.role, content: m.text })) }),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const d = await res.json();
  return d.content.filter(c => c.type === "text").map(c => c.text).join("");
};

const FALLBACK = (answers) => ({
  scores: { oiliness: .45, dryness: .4, redness: .32, unevenTone: .42, blemishTendency: .38, darkSpots: .28, texture: .35, poreVisibility: .42, underEyePigmentation: .3 },
  skinType: has(answers.skinType,"oily") ? "oily" : has(answers.skinType,"dry") ? "dry" : "combination",
  primaryConcerns: ["Uneven skin tone", "Mild oiliness in T-zone", "Pore appearance"],
  explanation: "Based on your questionnaire, I've built a personalised plan covering skincare, hygiene habits, and lifestyle changes.",
  needsDermatologist: false, dermatologistReason: "",
  morningRoutine: [
    { step:1, category:"Gentle cleanser",  ingredient:"Amino acid surfactants", brand:"Cetaphil Gentle Skin Cleanser",  brandNote:"₹399–699 · Nykaa, pharmacies",  note:"Clean without stripping" },
    { step:2, category:"Vitamin C serum",  ingredient:"L-Ascorbic acid 10%",   brand:"Minimalist 10% Vitamin C",       brandNote:"₹599 · Nykaa, Amazon India",   note:"Brightens and protects" },
    { step:3, category:"Niacinamide",      ingredient:"Niacinamide 10% + Zinc", brand:"Minimalist Niacinamide 10%",     brandNote:"₹599 · Nykaa, Amazon India",   note:"Minimises pores and evens tone" },
    { step:4, category:"Moisturiser",      ingredient:"Ceramides + Glycerin",   brand:"CeraVe Moisturising Cream",      brandNote:"₹1,299–1,799 · Nykaa",         note:"Supports skin barrier" },
    { step:5, category:"Sunscreen",        ingredient:"SPF 50 PA++++",          brand:"Minimalist SPF 50",              brandNote:"₹349 · Nykaa, Amazon India",   note:"Apply generously every morning" },
  ],
  nightRoutine: [
    { step:1, category:"Micellar water",   ingredient:"Gentle surfactants",     brand:"Simple Kind to Skin Micellar",  brandNote:"₹299–499 · Nykaa",            note:"Dissolves SPF and makeup",      freq:"daily" },
    { step:2, category:"Gentle cleanser",  ingredient:"Mild surfactants",       brand:"Cetaphil Gentle Skin Cleanser",  brandNote:"₹399–699 · pharmacies",        note:"Second cleanse",                 freq:"daily" },
    { step:3, category:"Azelaic acid",     ingredient:"Azelaic acid 10%",       brand:"Minimalist Azelaic Acid 10%",    brandNote:"₹599 · Nykaa",                 note:"Fades dark spots and calms redness", freq:"3x/week" },
    { step:4, category:"Night moisturiser",ingredient:"Ceramides + Peptides",   brand:"CeraVe PM Facial Lotion",        brandNote:"₹1,799–2,299 · Amazon India",  note:"Deep overnight barrier repair",  freq:"daily" },
  ],
  topHygieneTips: ["Change your pillowcase every 2–3 days","Clean your phone screen daily with an alcohol wipe","Wash hands before touching your face"],
  overallScore: 70,
  timeline: "With consistent routine use and hygiene habit changes, expect cleaner, more even skin within 3–4 weeks. Dark spots and texture improve over 8–12 weeks.",
});

// ── Text-only analysis (no photo needed) ──────────────────────────────────────
const analyzeTextOnly = async (description, answers) => {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1200,
      messages: [{ role: "user", content: `You are a comprehensive skin health AI. A user has described their skin situation in text — there is no photo. Build a full personalised plan based on their description and questionnaire answers.\n\nUSER'S DESCRIPTION:\n${description}\n\nQUESTIONNAIRE ANSWERS:\n${fmtAnswers(answers)}\n\nReturn ONLY valid JSON (no markdown):\n{"scores":{"oiliness":0.4,"dryness":0.35,"redness":0.3,"unevenTone":0.38,"blemishTendency":0.35,"darkSpots":0.25,"texture":0.3,"poreVisibility":0.38,"underEyePigmentation":0.25},"skinType":"combination","primaryConcerns":["derive from description"],"explanation":"2-3 sentences summarising what the user described and key recommendations based on it — reference what they actually said","needsDermatologist":false,"dermatologistReason":"","morningRoutine":[{"step":1,"category":"Gentle cleanser","ingredient":"Amino acid surfactants","brand":"Cetaphil Gentle Skin Cleanser","brandNote":"₹399–699 · Nykaa, pharmacies","note":"Cleans without stripping"},{"step":2,"category":"Treatment serum","ingredient":"Key active for their concern","brand":"Minimalist / Dot & Key","brandNote":"₹499–799 · Nykaa","note":"Targets their primary issue"},{"step":3,"category":"Moisturiser","ingredient":"Ceramides + Glycerin","brand":"CeraVe Moisturising Cream","brandNote":"₹1,299–1,799 · Nykaa","note":"Restores barrier"},{"step":4,"category":"Sunscreen","ingredient":"SPF 50 PA++++","brand":"Minimalist SPF 50","brandNote":"₹349 · Nykaa","note":"Daily protection"}],"nightRoutine":[{"step":1,"category":"Micellar water","ingredient":"Gentle surfactants","brand":"Simple Micellar Water","brandNote":"₹299–499 · Nykaa","note":"Removes SPF and makeup","freq":"daily"},{"step":2,"category":"Treatment","ingredient":"Key active","brand":"Minimalist / Plum","brandNote":"₹499–799 · Nykaa","note":"Addresses described concern","freq":"3x per week"},{"step":3,"category":"Night moisturiser","ingredient":"Ceramides + Peptides","brand":"CeraVe PM Lotion","brandNote":"₹1,799 · Amazon India","note":"Overnight repair","freq":"daily"}],"topHygieneTips":["Most relevant hygiene tip based on their description","Second tip","Third tip"],"overallScore":68,"timeline":"Realistic improvement timeline based on what they described"}\n\nBase all recommendations on the description. Infer scores from what they described. If they described rashes, set needsDermatologist appropriately. Use Indian brands in ₹.` }]
    }),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const d = await res.json();
  const text = d.content.filter(c => c.type === "text").map(c => c.text).join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

// ── Describe-mode intake chatbot ───────────────────────────────────────────────
const describeIntakeAI = async (messages) => {
  const sys = `You are a friendly skin intake assistant for Skinsense AI. Your job is to understand the user's skin situation through natural conversation so we can build them a personalised plan.

Ask warm, specific follow-up questions to clarify:
- WHERE exactly (cheeks, forehead, T-zone, chin, body?)
- WHEN it started and how long it's been happening
- TRIGGERS (food, stress, products, weather, hormones?)
- What they've already tried
- Whether it's painful, itchy, or just visual

Keep questions short — one focused question at a time. After the user has given 2–3 messages worth of detail, end your response with exactly this line on a new line: [READY_TO_CONTINUE]

Don't mention [READY_TO_CONTINUE] until you have enough to build a personalised plan. Be warm and supportive — skin concerns can feel frustrating.`;

  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, system: sys, messages: messages.map(m => ({ role: m.role, content: m.text })) }),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const d = await res.json();
  return d.content.filter(c => c.type === "text").map(c => c.text).join("");
};

// ── Shared UI Components ───────────────────────────────────────────────────────
function Avatar({ name = "", size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: avatarBg(name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * .36, fontWeight: 500, color: "#fff", flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

function Tag({ text, color = T.sage, bg = T.sagePale, small }) {
  return <span style={{ display: "inline-block", background: bg, color, borderRadius: 99, padding: small ? "2px 9px" : "4px 12px", fontSize: small ? 11 : 12, fontWeight: 500, border: `1px solid ${color}28` }}>{text}</span>;
}

function AlertBox({ icon, title, body, level = "info" }) {
  const colors = { warning: { bg: T.goldPale, border: T.gold, text: T.ink }, info: { bg: T.bluePale, border: T.blue, text: T.ink }, danger: { bg: T.redPale, border: T.red, text: T.red } };
  const cl = colors[level] || colors.info;
  return (
    <div style={{ background: cl.bg, border: `1px solid ${cl.border}28`, borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div><div style={{ fontSize: 14, fontWeight: 500, color: cl.text, marginBottom: 4 }}>{title}</div><div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{body}</div></div>
    </div>
  );
}

function BuyBtn({ label, url, color, bg }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg, color, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 500, textDecoration: "none", border: `1px solid ${color}30`, fontFamily: SANS }}>
      {label}
    </a>
  );
}

function ScoreBar({ label, value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct > 60 ? T.terra : pct > 35 ? T.warn : T.sage;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: T.ink }}>
        <span>{label}</span><span style={{ color: T.muted }}>{pct}%</span>
      </div>
      <div style={{ background: T.border, borderRadius: 99, height: 6 }}>
        <div style={{ background: color, width: `${pct}%`, height: "100%", borderRadius: 99, transition: "width 1.2s ease" }} />
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder, error, icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 6 }}>{label}</div>}
      <div style={{ position: "relative" }}>
        {icon && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: T.muted }}>{icon}</span>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ width: "100%", boxSizing: "border-box", padding: `13px ${icon ? "42px" : "16px"} 13px ${icon ? "42px" : "16px"}`, border: `1.5px solid ${error ? T.red : focused ? T.sage : T.border}`, borderRadius: 12, fontSize: 15, fontFamily: SANS, background: T.surface, color: T.ink, outline: "none", transition: "border-color .2s" }} />
      </div>
      {error && <div style={{ fontSize: 12, color: T.red, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ── Splash ─────────────────────────────────────────────────────────────────────
function Splash({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, []);
  return (
    <div style={{ minHeight: "100vh", background: T.sageDark, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, fontFamily: SANS }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ animation: "fadeUp .9s ease forwards", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <ellipse cx="22" cy="22" rx="14" ry="17" stroke="white" strokeWidth="1.8" strokeDasharray="4 3"/>
            <circle cx="22" cy="15" r="3" fill="white" opacity=".9"/>
            <path d="M15 26 Q22 32 29 26" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 400, color: "#fff", margin: "0 0 8px" }}>Skin<em>sense</em></h1>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>AI Skin &amp; Wellness Intelligence</p>
      </div>
      <div style={{ width: 30, height: 30, border: "2px solid rgba(255,255,255,.18)", borderTopColor: "rgba(255,255,255,.85)", borderRadius: "50%", animation: "spin .85s linear infinite" }} />
    </div>
  );
}

// ── Auth ───────────────────────────────────────────────────────────────────────
function Welcome({ onLogin, onSignup }) {
  const features = ["📸 AI Skin Scan","🧴 Personalised Routines","🏥 Rash & Irritation Guidance","💧 Hygiene Habit Coaching","🌿 Lifestyle Change Plan","🛍 Shop Nykaa / Amazon India","💬 AI Skincare Chat","📈 Progress Tracking"];
  return (
    <div style={{ minHeight: "100vh", background: T.sageDark, fontFamily: SANS, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px 20px", textAlign: "center" }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <svg width="38" height="38" viewBox="0 0 44 44" fill="none"><ellipse cx="22" cy="22" rx="14" ry="17" stroke="white" strokeWidth="1.8" strokeDasharray="4 3"/><circle cx="22" cy="15" r="3" fill="white" opacity=".9"/><path d="M15 26 Q22 32 29 26" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg>
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 400, color: "#fff", margin: "0 0 12px" }}>Skin<em>sense</em></h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 15, margin: "0 0 32px", lineHeight: 1.7, maxWidth: 290 }}>Your complete skin health companion — not just cosmetics. Routines, hygiene, lifestyle, and AI guidance.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {features.map((f, i) => <span key={i} style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)", borderRadius: 99, padding: "5px 13px", fontSize: 12, border: "1px solid rgba(255,255,255,.15)" }}>{f}</span>)}
        </div>
      </div>
      <div style={{ padding: "0 24px 48px", display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={onSignup} style={{ background: "#fff", color: T.sageDark, border: "none", borderRadius: 14, padding: "15px", fontSize: 16, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>Create free account</button>
        <button onClick={onLogin} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.22)", borderRadius: 14, padding: "15px", fontSize: 16, cursor: "pointer", fontFamily: SANS }}>Sign in</button>
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: 11, textAlign: "center", margin: "6px 0 0", lineHeight: 1.6 }}>Your skin data is encrypted and never shared or sold.</p>
      </div>
    </div>
  );
}

function Signup({ onBack, onSuccess }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [confirm, setConfirm] = useState(""); const [age, setAge] = useState(""); const [errors, setErrors] = useState({}); const [loading, setLoading] = useState(false);
  const submit = async () => {
    const e = {};
    if (!name.trim()) e.name = "Full name required";
    if (!email.includes("@")) e.email = "Enter a valid email";
    if (pass.length < 6) e.pass = "Min. 6 characters";
    if (pass !== confirm) e.confirm = "Passwords don't match";
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    const existing = await DB.getUser(email.toLowerCase());
    if (existing) { setErrors({ email: "Account already exists" }); setLoading(false); return; }
    const user = { name: name.trim(), email: email.toLowerCase(), hash: hashStr(pass), age, created: Date.now(), scans: 0 };
    await DB.saveUser(user);
    onSuccess(user);
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS }}>
      <div style={{ background: T.sageDark, padding: "20px 20px 28px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.65)", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 14, fontFamily: SANS }}>← Back</button>
        <h2 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: "#fff", margin: "0 0 4px" }}>Create account</h2>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 14, margin: 0 }}>Start your skin health journey</p>
      </div>
      <div style={{ padding: "24px 24px 40px", maxWidth: 440, margin: "0 auto" }}>
        <Input label="Full name" value={name} onChange={setName} placeholder="Priya Sharma" icon="👤" error={errors.name} />
        <Input label="Email address" type="email" value={email} onChange={setEmail} placeholder="priya@example.com" icon="✉" error={errors.email} />
        <Input label="Age (optional)" type="number" value={age} onChange={setAge} placeholder="25" icon="🎂" />
        <Input label="Password" type="password" value={pass} onChange={setPass} placeholder="Min. 6 characters" icon="🔒" error={errors.pass} />
        <Input label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" icon="🔒" error={errors.confirm} />
        <button onClick={submit} disabled={loading} style={{ width: "100%", background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS, opacity: loading ? .7 : 1, marginTop: 4 }}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <div style={{ marginTop: 14, background: T.sagePale, borderRadius: 12, padding: "11px 14px", fontSize: 12, color: T.sageDark, lineHeight: 1.6 }}>🔐 Data encrypted. We never sell or share your information.</div>
      </div>
    </div>
  );
}

function Login({ onBack, onSuccess, onSignup }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(""); if (!email || !pass) { setError("Please fill in all fields"); return; }
    setLoading(true);
    const user = await DB.getUser(email.toLowerCase());
    if (!user || user.hash !== hashStr(pass)) { setError("Invalid email or password"); setLoading(false); return; }
    onSuccess(user);
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS }}>
      <div style={{ background: T.sageDark, padding: "20px 20px 28px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.65)", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 14, fontFamily: SANS }}>← Back</button>
        <h2 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: "#fff", margin: "0 0 4px" }}>Welcome back</h2>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 14, margin: 0 }}>Sign in to your Skinsense account</p>
      </div>
      <div style={{ padding: "24px 24px 32px", maxWidth: 440, margin: "0 auto" }}>
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="your@email.com" icon="✉" />
        <Input label="Password" type="password" value={pass} onChange={setPass} placeholder="Your password" icon="🔒" />
        {error && <div style={{ background: T.redPale, border: `1px solid ${T.red}28`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.red, marginBottom: 14 }}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS, opacity: loading ? .7 : 1 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: T.muted }}>
          No account? <button onClick={onSignup} style={{ background: "none", border: "none", color: T.sage, fontSize: 14, cursor: "pointer", fontWeight: 500, fontFamily: SANS }}>Sign up free</button>
        </p>
      </div>
    </div>
  );
}

// ── Plain-language explanations for every questionnaire option ─────────────────
const EXPLAIN = {
  "Dry":"Your skin feels tight, rough, or flaky — it doesn't produce enough natural oil.","Oily":"Your skin produces excess oil and often looks shiny, especially on your forehead, nose, and chin.","Combination":"Some parts are oily (usually forehead, nose, chin) and other parts are normal or dry (like cheeks).","Normal":"Your skin is well-balanced — not too oily, not too dry, and rarely reacts badly.","Not sure":"You're unsure how to categorise your skin — totally fine, the scan will help figure it out.",
  "Very sensitive":"Your skin reacts quickly — redness, stinging, or breakouts happen easily with new products or weather changes.","Somewhat sensitive":"You get occasional reactions to products or environmental changes, but not all the time.","Not very sensitive":"Your skin is fairly resilient and doesn't react much to new products or the environment.","Reacts to fragrances":"Perfumed products — even natural scents — cause redness, itching, or irritation on your skin.","Reacts to acids":"Products with chemical exfoliants or Vitamin C cause burning, stinging, or breakouts for you.","Prone to redness":"Your skin frequently looks red or flushed, especially on your cheeks or nose area.",
  "Rashes or hives":"Raised, red, itchy patches or bumps that appear on your skin, sometimes suddenly.","Eczema / dry patches":"Rough, flaky, or intensely itchy areas that can crack or become inflamed — usually on the same spots repeatedly.","Acne / breakouts":"Pimples, blackheads, whiteheads, or cysts that appear on your face or body.","Rosacea-like redness":"Persistent flushing or redness in the centre of your face (cheeks, nose, chin) that doesn't go away on its own.","Dandruff / flaky scalp":"White or yellowish flakes from your scalp — can also affect your forehead or eyebrows.","Fungal skin issues":"Skin problems caused by a fungal infection — can look like discoloured patches, itchy circular rashes, or acne-like bumps.","Hyperpigmentation":"Dark patches or spots on your skin — often from sun exposure, old acne marks, or hormonal changes.","None":"You don't currently experience any of these skin conditions.",
  "Look fresher & brighter":"You want your skin to look more glowing, healthy, and less dull or tired-looking.","Fix rashes / irritation":"You have visible redness, bumps, or irritated areas you want to calm and heal.","Control acne":"You want to reduce pimples, blackheads, and breakouts.","Deep hydration":"Your skin feels tight or dry and you want it to feel plump, soft, and well-moisturised.","Even skin tone":"You want your skin colour to look consistent with fewer red patches or discolouration.","Dark spots":"You want to fade marks left by past pimples, sun damage, or hormonal changes.","Anti-aging":"You want to reduce fine lines and wrinkles and keep skin looking firm and youthful.","Oil control":"You want to reduce shine and greasiness, especially in your T-zone (forehead, nose, chin).","Minimize pores":"You want your pores to look smaller and less visible.","Basic hygiene routine":"You want simple daily habits to keep your skin clean and healthy — a great starting point.",
  "Fragrance":"Scented ingredients in skincare — even natural ones — cause reactions like redness or itching on your skin.","Retinol / Retinoids":"Vitamin A-based ingredients used for anti-aging and acne. Powerful but can cause irritation for some people.","Niacinamide":"A form of Vitamin B3 used to brighten skin and minimise pores. Rarely causes reactions, but some people are sensitive to it.","AHAs / BHAs":"Chemical exfoliants — glycolic acid (AHA) removes surface dead skin, salicylic acid (BHA) unclogs pores. Can be too strong for sensitive skin.","Vitamin C":"A brightening antioxidant ingredient. Some forms can tingle or irritate sensitive skin.","Essential oils":"Plant-derived oils like tea tree, lavender, or rosemary used in skincare — common allergens for sensitive skin types.","Nut oils":"Oils like argan, almond, or macadamia — can cause reactions if you have nut-related sensitivities.","Latex":"Natural rubber found in some gloves and certain products — can cause skin or contact reactions.","None known":"You don't have any known allergies or intolerances to skincare ingredients.",
  "Poor sleep (under 6 hrs)":"Consistently sleeping fewer than 6 hours per night. Lack of sleep raises stress hormones which cause breakouts and dullness.","High stress levels":"Feeling frequently stressed or anxious. Stress increases oil production and skin inflammation.","Smoke / around smokers":"You smoke or regularly spend time near cigarette smoke. Smoke damages skin collagen and causes premature aging and dullness.","Low water intake":"You drink less than 2 litres of water daily. Dehydration shows directly on your skin as dullness and tightness.","High sugar / junk food":"Your diet includes a lot of sugary drinks, fast food, or processed snacks. High sugar triggers inflammation and worsens breakouts.","Outdoors / high UV":"You spend significant time in direct sunlight. A major cause of dark spots, uneven tone, and premature aging.","Heavy makeup daily":"You wear foundation or full-coverage makeup most days. This requires thorough cleansing every single night.","Rarely change pillowcase":"You change your pillowcase less than once a week. It collects oil and bacteria that transfer to your face while you sleep.","Phone touches face often":"You press your phone to your cheek or touch your face often. Phones carry significant bacteria that cause breakouts.","Gym / sweating daily":"You exercise intensely and sweat regularly. Sweat left on skin clogs pores if not cleansed promptly after working out.",
  "No routine at all":"You don't currently do any skincare — no washing, no moisturiser, nothing. Starting simple is great.","Just water":"You only rinse your face with water — no cleanser or other products yet.","Cleanser only":"You wash your face with a face wash but don't apply any moisturiser or treatments after.","Cleanser + moisturiser":"You wash your face and apply a moisturiser — a solid basic foundation to build on.","SPF daily":"You apply sunscreen every morning. This is one of the most impactful skincare habits you can have.","Serums / actives":"You use treatment products like serums — e.g. niacinamide, Vitamin C, retinol, or acids.","Full AM & PM routine":"You have a complete morning and night skincare routine with multiple steps.",
  "Under ₹500":"You prefer affordable products — great options exist at every price point.","₹500–1,500":"Mid-range budget — most well-known Indian skincare brands like Minimalist and Dot & Key fall here.","₹1,500–4,000":"You're open to premium products — international brands like CeraVe, La Roche-Posay, or Bioderma.","₹4,000+":"You're happy to invest in luxury skincare — no restrictions on budget.",
  "Dry climate":"Low moisture in the air — common in air-conditioned spaces or arid climates. Causes tightness and flakiness.","Humid":"High moisture in the air — common in coastal or tropical areas. Can make skin feel more oily and pores more visible.","Cold":"Cold temperatures reduce skin moisture levels and can cause chapping, redness, and barrier damage.","High UV / sunny":"Intense sunlight exposure. UV is the number one cause of dark spots, premature aging, and uneven skin tone.","Urban / polluted":"City air pollution. Pollution particles land on skin, damage the barrier, and cause dullness and congestion.","Hard water area":"Your tap water has high mineral content (like in Delhi or Mumbai). Hard water can disrupt skin's natural balance and cause dryness.",
  "Yes":"You are currently pregnant or breastfeeding. Certain skincare ingredients aren't safe during this time — we'll automatically filter them out for you.","No":"You are not pregnant or breastfeeding.","Prefer not to say":"You prefer not to share this — we'll default to the safest ingredient recommendations.",
};

// ── Camera — selfie / gallery (with post-capture description) ─────────────────
// Detect if running inside a sandboxed iframe (e.g. Claude.ai artifact preview)
const IN_SANDBOX = typeof window !== "undefined" && (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

function Camera({ onCapture, onDescribeReady, user }) {
  const videoRef = useRef(null); const canvasRef = useRef(null);
  const [mode, setMode] = useState("gallery"); // default to gallery — camera needs real app context
  const [permState, setPermState] = useState("idle");
  const [ready, setReady] = useState(false);
  const [lighting, setLighting] = useState("good");
  const [captured, setCaptured] = useState(null);
  const [description, setDescription] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const streamRef = useRef(null);

  const requestAndStartCamera = async (facing = "user") => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setPermState("requesting"); setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) { setPermState("denied"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current.play().then(() => { setPermState("granted"); setReady(true); }).catch(() => setPermState("denied")); };
      }
    } catch (err) {
      setPermState(err.name === "NotAllowedError" || err.name === "PermissionDeniedError" ? "denied" : "denied");
    }
  };

  useEffect(() => {
    if (mode === "selfie") requestAndStartCamera(facingMode);
    else { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); setPermState("idle"); setReady(false); }
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, [mode, facingMode]);

  useEffect(() => {
    if (!ready || captured || mode !== "selfie") return;
    const id = setInterval(() => {
      try {
        const c = document.createElement("canvas"); c.width = 40; c.height = 30;
        const ctx = c.getContext("2d"); ctx.drawImage(videoRef.current, 0, 0, 40, 30);
        const d = ctx.getImageData(0, 0, 40, 30).data;
        let b = 0; for (let i = 0; i < d.length; i += 4) b += (d[i] + d[i + 1] + d[i + 2]) / 3;
        setLighting(b / (d.length / 4) < 55 ? "dark" : b / (d.length / 4) > 210 ? "bright" : "good");
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [ready, captured, mode]);

  const doCapture = () => {
    const canvas = canvasRef.current; const video = videoRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (facingMode === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0);
    const b64 = canvas.toDataURL("image/jpeg", .88).split(",")[1];
    const prev = canvas.toDataURL("image/jpeg", .65);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCaptured({ b64, prev });
  };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result; const img = new Image();
      img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); setCaptured({ b64: c.toDataURL("image/jpeg", .88).split(",")[1], prev: src }); };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleProceed = () => onCapture({ ...captured, description: description.trim() });

  const lightMsg = lighting === "dark" ? "💡 Move to brighter lighting" : lighting === "bright" ? "😎 Reduce direct light slightly" : null;
  const TABS = [["selfie","📷","Selfie"],["gallery","🖼","Upload"]];

  // ── Confirmation + description screen ──
  if (captured) return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS, display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.sageDark, padding: "18px 20px 22px" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,.45)", marginBottom: 4 }}>Step 1 of 2</div>
        <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: "#fff", margin: 0 }}>Confirm &amp; describe</h2>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, margin: "4px 0 0" }}>Add any context that's hard to see in the photo</p>
      </div>
      <div style={{ flex: 1, padding: "18px 20px 40px", maxWidth: 460, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Photo preview */}
        <div style={{ borderRadius: 20, overflow: "hidden", border: `2px solid ${T.sage}`, marginBottom: 18, position: "relative" }}>
          <img src={captured.prev} style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "cover" }} />
          <button onClick={() => setCaptured(null)} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,.55)", border: "none", borderRadius: 99, padding: "5px 12px", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: SANS }}>Retake ↩</button>
        </div>

        {/* Description box */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 6 }}>Describe your skin situation <span style={{ color: T.muted, fontWeight: 400 }}>(optional)</span></div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.6 }}>Mention anything that may not be visible in the photo — rashes, dryness, irritation after a product, hormonal breakouts, or any specific concern you have.</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. I've been getting red bumpy patches on my cheeks after switching moisturisers. My skin also feels very tight and dry in the mornings even though I use a heavy cream at night…"
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.border}`, borderRadius: 14, padding: "13px 15px", fontSize: 14, fontFamily: SANS, background: T.surface, color: T.ink, resize: "none", outline: "none", lineHeight: 1.6 }}
            onFocus={e => e.target.style.borderColor = T.sage}
            onBlur={e => e.target.style.borderColor = T.border}
          />
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6, textAlign: "right" }}>{description.length}/500 characters</div>
        </div>

        {/* Example prompts */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Quick examples — tap to add</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {["Red patches on my cheeks","Breaking out on my chin every month","Skin feels tight after washing","Dark spots that won't fade","Rash after using a new product","Very oily by midday"].map((ex, i) => (
              <button key={i} onClick={() => setDescription(d => d ? d + ". " + ex : ex)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99, padding: "5px 12px", fontSize: 12, color: T.muted, cursor: "pointer", fontFamily: SANS }}>
                + {ex}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleProceed} style={{ width: "100%", background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>
          Continue to questions →
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: T.muted, marginTop: 10 }}>The description helps personalise your plan — even a few words make a difference</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS, display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.sageDark, padding: "18px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,.45)", marginBottom: 3 }}>New Skin Scan</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: "#fff", margin: 0 }}>Capture your skin</h2>
          </div>
          <Avatar name={user?.name} size={36} />
        </div>
        <div style={{ display: "flex", background: "rgba(0,0,0,.22)", borderRadius: 13, padding: 4, gap: 4 }}>
          {TABS.map(([m, icon, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, background: mode === m ? "#fff" : "transparent", color: mode === m ? T.sageDark : "rgba(255,255,255,.65)", border: "none", borderRadius: 10, padding: "9px 4px", fontSize: 13, fontWeight: mode === m ? 500 : 400, cursor: "pointer", fontFamily: SANS, transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "16px 20px 32px", maxWidth: 460, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>

        {/* ── SELFIE ── */}
        {mode === "selfie" && (
          <>
            {/* Sandbox / iframe detected — camera not available in preview */}
            {IN_SANDBOX && (permState === "idle" || permState === "denied") && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center", padding: "24px 0" }}>
                <div style={{ width: 80, height: 80, borderRadius: 20, background: T.goldPale, border: `2px solid ${T.gold}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>📱</div>
                <div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: T.ink, margin: "0 0 10px" }}>Live camera in the full app</h3>
                  <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.7, margin: "0 0 10px", maxWidth: 320 }}>Camera access isn't available in this preview window — it's a browser security restriction for embedded demos. In the real Skinsense app, the camera works perfectly.</p>
                  <p style={{ fontSize: 13, color: T.sage, fontWeight: 500, margin: 0 }}>For this demo, upload a photo using the button below — full functionality is identical.</p>
                </div>
                <button onClick={() => setMode("gallery")} style={{ background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "14px 32px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>
                  🖼  Upload a photo instead
                </button>
                <div style={{ background: T.bluePale, border: `1px solid ${T.blue}22`, borderRadius: 12, padding: "12px 16px", maxWidth: 320 }}>
                  <div style={{ fontSize: 12, color: T.blue, fontWeight: 500, marginBottom: 4 }}>ℹ️ For investors & reviewers</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>The full Skinsense app (deployed via Vercel or installed on device) has a fully working live camera with oval guide, lighting detection, and front/rear camera flip.</div>
                </div>
              </div>
            )}

            {/* Non-sandbox: permission idle / requesting */}
            {!IN_SANDBOX && (permState === "idle" || permState === "requesting") && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "30px 0" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: T.sagePale, border: `2px solid ${T.sage}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📷</div>
                <div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: T.ink, margin: "0 0 8px" }}>Camera access needed</h3>
                  <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.65, margin: 0 }}>Skinsense needs your camera to take a skin photo. Your photo is only sent to our AI for analysis — it's never stored without your permission.</p>
                </div>
                {permState === "requesting" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.muted, fontSize: 14 }}>
                    <div style={{ width: 18, height: 18, border: `2px solid ${T.sage}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    Waiting for permission…
                  </div>
                ) : (
                  <button onClick={() => requestAndStartCamera(facingMode)} style={{ background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "14px 32px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>
                    Allow camera access
                  </button>
                )}
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {/* Non-sandbox: permission denied */}
            {!IN_SANDBOX && permState === "denied" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: "30px 0" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: T.redPale, border: `2px solid ${T.red}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🚫</div>
                <div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: T.ink, margin: "0 0 8px" }}>Camera blocked</h3>
                  <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.65, margin: 0 }}>Camera access was denied. Open your browser settings → Camera permissions for this page → set to "Allow". Then tap retry.</p>
                </div>
                <button onClick={() => requestAndStartCamera(facingMode)} style={{ background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>Retry camera access</button>
                <div style={{ color: T.muted, fontSize: 13 }}>or</div>
                <button onClick={() => setMode("gallery")} style={{ background: T.surface, color: T.ink, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: "12px 24px", fontSize: 14, cursor: "pointer", fontFamily: SANS }}>🖼 Upload a photo instead</button>
              </div>
            )}

            {/* Camera live */}
            {permState === "granted" && (
              <>
                <div style={{ background: T.sagePale, borderRadius: 12, padding: "9px 14px", fontSize: 13, color: T.sageDark, lineHeight: 1.7, marginBottom: 13 }}>
                  {["Look straight at the camera","Remove glasses or hats","Use even, natural lighting"].map((t, i) => <div key={i}>✓ {t}</div>)}
                </div>
                <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", background: "#0a0a0a", marginBottom: 13 }}>
                  <video ref={videoRef} style={{ width: "100%", display: "block", transform: facingMode === "user" ? "scaleX(-1)" : "none" }} muted playsInline />
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 360 300" preserveAspectRatio="xMidYMid meet">
                    <defs><mask id="oval"><rect width="360" height="300" fill="white" /><ellipse cx="180" cy="148" rx="115" ry="135" fill="black" /></mask></defs>
                    <rect width="360" height="300" fill="rgba(0,0,0,.42)" mask="url(#oval)" />
                    <ellipse cx="180" cy="148" rx="115" ry="135" fill="none" stroke={lighting === "good" ? "#6B9E7E" : "#E8A535"} strokeWidth="2.5" strokeDasharray="8 5" />
                    <text x="180" y="296" fill="rgba(255,255,255,.45)" fontSize="11" textAnchor="middle" fontFamily={SANS}>Position face in oval</text>
                  </svg>
                  {lightMsg && <div style={{ position: "absolute", top: 12, left: 0, right: 0, textAlign: "center", background: "rgba(0,0,0,.72)", color: T.warn, fontSize: 12, padding: "8px", fontFamily: SANS }}>{lightMsg}</div>}
                  {!ready && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontFamily: SANS }}>Starting camera…</div>}
                  <button onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")} style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.28)", borderRadius: "50%", width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 17, color: "#fff" }}>🔄</button>
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <button onClick={doCapture} disabled={!ready} style={{ width: "100%", background: !ready ? T.border : T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontSize: 16, fontWeight: 500, cursor: !ready ? "not-allowed" : "pointer", fontFamily: SANS, transition: "background .2s" }}>
                  {ready ? "📸  Take photo" : "Starting camera…"}
                </button>
              </>
            )}
          </>
        )}

        {/* ── GALLERY ── */}
        {mode === "gallery" && (
          <>
            <label style={{ display: "block", border: `2px dashed ${T.sage}`, borderRadius: 22, padding: "44px 20px", textAlign: "center", cursor: "pointer", background: T.sagePale, marginBottom: 14 }}>
              <div style={{ fontSize: 50, marginBottom: 12 }}>🖼</div>
              <div style={{ fontFamily: SERIF, fontSize: 22, color: T.sageDark, marginBottom: 5 }}>Upload a photo</div>
              <p style={{ fontSize: 13, color: T.muted, margin: "0 0 16px", lineHeight: 1.6 }}>Choose a clear, well-lit selfie from your gallery.<br />Your face should be clearly visible.</p>
              <span style={{ display: "inline-block", background: T.sage, color: "#fff", borderRadius: 12, padding: "11px 22px", fontSize: 14, fontWeight: 500, fontFamily: SANS }}>Choose from gallery</span>
              <input type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: "none" }} />
            </label>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 8 }}>📌 Tips for best results</div>
              {["Clear photo in good natural lighting","Face fills most of the frame","No heavy filters or edits","Taken recently — ideally today"].map((t, i) => <div key={i} style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>· {t}</div>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Questionnaire ──────────────────────────────────────────────────────────────
function Questionnaire({ onComplete }) {
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState({}); const [selected, setSelected] = useState([]);
  const [openExplain, setOpenExplain] = useState(null); // which option's explanation is open
  const q = QUESTIONS[step];
  useEffect(() => { setSelected(answers[q.id] || []); setOpenExplain(null); }, [step]);
  const toggle = opt => setSelected(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
  const toggleExplain = (e, opt) => { e.stopPropagation(); setOpenExplain(prev => prev === opt ? null : opt); };
  const next = () => {
    if (!selected.length) return;
    const updated = { ...answers, [q.id]: selected };
    setAnswers(updated);
    if (step + 1 >= QUESTIONS.length) onComplete(updated); else setStep(s => s + 1);
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS, display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.sageDark, padding: "18px 20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.65)", cursor: "pointer", fontSize: 14, padding: 0, fontFamily: SANS }}>←</button>}
          <div style={{ flex: 1, background: "rgba(255,255,255,.18)", borderRadius: 99, height: 3 }}>
            <div style={{ background: "#fff", width: `${(step / QUESTIONS.length) * 100}%`, height: "100%", borderRadius: 99, transition: "width .4s ease" }} />
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{step + 1}/{QUESTIONS.length}</span>
        </div>
        <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: "#fff", margin: "0 0 4px", lineHeight: 1.3 }}>{q.q}</h2>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, margin: 0 }}>{q.hint}</p>
      </div>
      <div style={{ flex: 1, padding: "18px 20px 32px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
          {q.opts.map(opt => {
            const on = selected.includes(opt);
            const explanation = EXPLAIN[opt];
            const isOpen = openExplain === opt;
            return (
              <div key={opt} style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${on ? T.sage : T.border}`, background: on ? T.sagePale : T.surface, transition: "all .15s" }}>
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", cursor: "pointer" }} onClick={() => toggle(opt)}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${on ? T.sage : T.border}`, background: on ? T.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
                    {on && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ flex: 1, fontSize: 15, color: on ? T.sageDark : T.ink, lineHeight: 1.3 }}>{opt}</span>
                  {explanation && (
                    <button onClick={e => toggleExplain(e, opt)} title="What does this mean?" style={{ background: isOpen ? T.sage : "rgba(0,0,0,.06)", border: "none", borderRadius: 99, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all .2s", color: isOpen ? "#fff" : T.muted, fontSize: 13, fontFamily: SANS }}>
                      {isOpen ? "✕" : "?"}
                    </button>
                  )}
                </div>
                {/* Explanation dropdown */}
                {isOpen && explanation && (
                  <div style={{ padding: "0 14px 13px 48px", borderTop: `1px solid ${on ? T.sage + "30" : T.border}` }}>
                    <div style={{ marginTop: 10, background: on ? "rgba(61,102,80,.08)" : T.sand, borderRadius: 10, padding: "10px 13px", fontSize: 13, color: on ? T.sageDark : T.ink, lineHeight: 1.65 }}>
                      {explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={next} disabled={!selected.length} style={{ width: "100%", background: !selected.length ? T.border : T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 500, cursor: !selected.length ? "not-allowed" : "pointer", fontFamily: SANS, transition: "background .2s" }}>
          {step + 1 >= QUESTIONS.length ? "Get my full skin analysis →" : "Continue →"}
        </button>
        {!selected.length && <p style={{ fontSize: 12, color: T.muted, textAlign: "center", marginTop: 10 }}>Select at least one option to continue</p>}
      </div>
    </div>
  );
}

// ── Processing ─────────────────────────────────────────────────────────────────
function Processing() {
  const msgs = ["Analysing skin signals…","Checking hygiene impact…","Evaluating lifestyle factors…","Matching ingredient safety…","Building your personalised plan…"];
  const [idx, setIdx] = useState(0);
  useEffect(() => { const id = setInterval(() => setIdx(i => (i + 1) % msgs.length), 1900); return () => clearInterval(id); }, []);
  return (
    <div style={{ minHeight: "100vh", background: T.sageDark, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, fontFamily: SANS }}>
      <style>{`@keyframes rp{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.1);opacity:.18}}`}</style>
      <div style={{ position: "relative", width: 100, height: 100 }}>
        {[0, 1, 2, 3].map(i => <div key={i} style={{ position: "absolute", inset: i * 12, borderRadius: "50%", border: `1.5px solid rgba(255,255,255,${.55 - i * .1})`, animation: `rp ${2.4 + i * .2}s ease-in-out infinite`, animationDelay: `${i * .3}s` }} />)}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 44 44" fill="none"><ellipse cx="22" cy="22" rx="14" ry="17" stroke="rgba(255,255,255,.9)" strokeWidth="1.8" strokeDasharray="4 3" /><circle cx="22" cy="15" r="3" fill="rgba(255,255,255,.9)" /></svg>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, margin: "0 0 10px", color: "#fff" }}>Analysing your skin</h2>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, margin: 0 }}>{msgs[idx]}</p>
      </div>
    </div>
  );
}

// ── Results ────────────────────────────────────────────────────────────────────
const SCORE_LABELS = [["oiliness","Oiliness"],["dryness","Dryness"],["redness","Redness"],["unevenTone","Uneven tone"],["blemishTendency","Blemish tendency"],["darkSpots","Dark spots"],["texture","Texture"],["poreVisibility","Pore visibility"],["underEyePigmentation","Under-eye"]];
const CHAT_PROMPTS = ["Why was niacinamide recommended?","How to treat a rash from a new product?","I'm allergic to Vitamin C — rebuild my routine","Budget options under ₹500?","What lifestyle change helps most?","Is this safe during pregnancy?","Indian alternatives to CeraVe?","When should I see a dermatologist?"];

function Results({ img, answers, analysis, ingredients, user, onNewScan }) {
  const [tab, setTab] = useState("profile"); const [showShare, setShowShare] = useState(false);
  const [chatMessages, setChatMessages] = useState(null); const [chatInput, setChatInput] = useState(""); const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null); const chatTaRef = useRef(null);
  const scores = analysis?.scores || {};
  const lifestyleTips = getTips(answers || {});
  const condAlerts = getConditionAlerts(answers || {});
  const tabs = [["profile","Profile"],["routine","Routine"],["wellness","Wellness"],["products","Ingredients"],["chat","✦ Chat"]];

  const chatCtx = { skinType: analysis?.skinType, overallScore: analysis?.overallScore, primaryConcerns: analysis?.primaryConcerns, explanation: analysis?.explanation, answers, morning: analysis?.morningRoutine, night: analysis?.nightRoutine, recommended: ingredients?.recommended, avoid: ingredients?.avoid };

  useEffect(() => {
    if (tab === "chat" && !chatMessages) {
      setChatMessages([{ role: "assistant", text: `Hi ${user?.name?.split(" ")[0] || "there"}! 👋 I've reviewed your full skin profile.\n\nI can help with your routine, rashes and irritation, hygiene habits, ingredient questions, lifestyle changes, or anything skin-related. What's on your mind?` }]);
    }
  }, [tab]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, chatLoading]);

  const sendChat = async (override) => {
    const txt = (override || chatInput).trim(); if (!txt || chatLoading) return;
    setChatInput(""); if (chatTaRef.current) chatTaRef.current.style.height = "auto";
    const next = [...(chatMessages || []), { role: "user", text: txt }];
    setChatMessages(next); setChatLoading(true);
    try { const reply = await chatAI(next.slice(1), chatCtx); setChatMessages(p => [...p, { role: "assistant", text: reply }]); }
    catch { setChatMessages(p => [...p, { role: "assistant", text: "Sorry, trouble connecting. Please try again." }]); }
    setChatLoading(false);
  };

  const shareText = `✨ My Skinsense Skin Report\n\n👤 ${user?.name}\n🔬 Skin Type: ${analysis?.skinType}\n📊 Score: ${analysis?.overallScore}/100\n🎯 Concerns: ${(analysis?.primaryConcerns || []).join(", ")}\n\n☀️ Morning:\n${(analysis?.morningRoutine || []).map(s => `${s.step}. ${s.category} — ${s.brand}`).join("\n")}\n\n🌙 Night:\n${(analysis?.nightRoutine || []).map(s => `${s.step}. ${s.category} — ${s.brand}`).join("\n")}\n\n💧 Top Hygiene Tips:\n${(analysis?.topHygieneTips || []).map(t => `• ${t}`).join("\n")}\n\nGenerated by Skinsense AI ⚕️`;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS, paddingBottom: 80 }}>
      <div style={{ background: T.sageDark, padding: "16px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          {img && <img src={img} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2.5px solid rgba(255,255,255,.4)" }} />}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, margin: 0, color: "#fff" }}>{user?.name?.split(" ")[0]}'s skin report</h2>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, margin: "2px 0 0", textTransform: "capitalize" }}>{analysis?.skinType || "Combination"} skin · Score {analysis?.overallScore || 70}/100</p>
          </div>
          <button onClick={() => setShowShare(true)} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 10, padding: "7px 13px", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: SANS }}>Share</button>
        </div>
        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flexShrink: 0, background: "none", border: "none", borderBottom: `2.5px solid ${tab === id ? "#fff" : "transparent"}`, padding: "10px 12px", fontSize: 13, fontWeight: tab === id ? 500 : 400, color: tab === id ? "#fff" : "rgba(255,255,255,.45)", cursor: "pointer", fontFamily: SANS, transition: "all .2s", whiteSpace: "nowrap" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 20px", maxWidth: 520, margin: "0 auto" }}>
        {tab === "profile" && (
          <div>
            {analysis?.needsDermatologist && <AlertBox icon="🏥" title="Consider seeing a dermatologist" body={analysis.dermatologistReason || "Our AI flagged something that may benefit from professional evaluation."} level="warning" />}
            {condAlerts.map((a, i) => <AlertBox key={i} icon={a.icon} title={a.title} body={a.body} level={a.level} />)}
            {analysis?.explanation && (
              <div style={{ background: T.sagePale, borderRadius: 16, padding: "15px 18px", marginBottom: 18, border: `1px solid ${T.sage}28` }}>
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: T.sage, marginBottom: 6 }}>AI Observation</div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: T.sageDark, fontFamily: SERIF, fontStyle: "italic" }}>"{analysis.explanation}"</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px", textAlign: "center" }}>
                <div style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: T.sageDark }}>{analysis?.overallScore || 70}</div>
                <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>Skin Score</div>
              </div>
              <div style={{ flex: 2, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
                <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Primary Concerns</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{(analysis?.primaryConcerns || []).map((c, i) => <Tag key={i} text={c} color={T.terra} bg={T.terraPale} small />)}</div>
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px", marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Skin Signal Scores</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {SCORE_LABELS.map(([k, label]) => <ScoreBar key={k} label={label} value={scores[k]} />)}
              </div>
            </div>
            <div onClick={() => setTab("wellness")} style={{ background: T.tealPale, borderRadius: 12, padding: "14px 16px", marginBottom: 14, border: `1px solid ${T.teal}28`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 13, fontWeight: 500, color: T.teal }}>💧 {lifestyleTips.length} hygiene &amp; lifestyle tips</div><div style={{ fontSize: 12, color: T.muted }}>Personalised habits to improve your skin</div></div>
              <span style={{ color: T.teal, fontSize: 18 }}>›</span>
            </div>
            <div style={{ background: T.goldPale, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: T.muted, lineHeight: 1.6, border: `1px solid ${T.gold}28` }}>⚕️ Cosmetic &amp; wellness guidance — <strong>not a medical diagnosis</strong>. For rashes, infections, or persistent skin conditions, please consult a dermatologist.</div>
          </div>
        )}

        {tab === "routine" && (
          <div>
            {["Morning routine","Night routine"].map((title, ti) => {
              const steps = ti === 0 ? analysis?.morningRoutine || [] : analysis?.nightRoutine || [];
              const emoji = ti === 0 ? "☀️" : "🌙";
              return (
                <div key={ti} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 20, marginBottom: 14 }}>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, margin: "0 0 18px", color: T.ink }}>{emoji} {title}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {steps.map((s, i) => {
                      const q = encodeURIComponent(s.brand || s.category || "");
                      return (
                        <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.sagePale, border: `2px solid ${T.sage}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: T.sageDark, flexShrink: 0, marginTop: 2 }}>{s.step}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 500, color: T.ink, marginBottom: 3 }}>{s.category}</div>
                            <div style={{ fontSize: 12, color: T.sageDark, marginBottom: 8 }}>★ {s.ingredient || s.keyIngredient}</div>
                            {s.brand && (
                              <div style={{ background: T.terraPale, border: `1px solid ${T.terra}20`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: T.terra, marginBottom: 3 }}>🛍 {s.brand}</div>
                                {s.brandNote && <div style={{ fontSize: 12, color: T.muted, marginBottom: 9 }}>{s.brandNote}</div>}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                                  <BuyBtn label="Nykaa ↗" url={`https://www.nykaa.com/search/result/?q=${q}`} color="#FC2779" bg="#FFF0F6" />
                                  <BuyBtn label="Amazon ↗" url={`https://www.amazon.in/s?k=${q}`} color="#FF9900" bg="#FFF8EE" />
                                  <BuyBtn label="Flipkart ↗" url={`https://www.flipkart.com/search?q=${q}`} color="#2874F0" bg="#EEF3FF" />
                                </div>
                              </div>
                            )}
                            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>{s.note}</div>
                            {s.freq && s.freq !== "daily" && <span style={{ display: "inline-block", marginTop: 5, fontSize: 11, background: T.sand, color: T.muted, borderRadius: 99, padding: "2px 9px", border: `1px solid ${T.border}` }}>{s.freq}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {analysis?.timeline && (
              <div style={{ background: T.sagePale, borderRadius: 12, padding: "14px 16px", border: `1px solid ${T.sage}28` }}>
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: T.sage, marginBottom: 6 }}>Expected Timeline</div>
                <p style={{ margin: 0, fontSize: 13, color: T.sageDark, lineHeight: 1.6 }}>{analysis.timeline}</p>
              </div>
            )}
          </div>
        )}

        {tab === "wellness" && (
          <div>
            {condAlerts.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Skin condition flags</div>
                {condAlerts.map((a, i) => <AlertBox key={i} icon={a.icon} title={a.title} body={a.body} level={a.level} />)}
              </div>
            )}
            {(analysis?.topHygieneTips || []).length > 0 && (
              <div style={{ background: T.tealPale, border: `1px solid ${T.teal}28`, borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: T.teal, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>AI's top hygiene priorities for you</div>
                {(analysis.topHygieneTips).map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < analysis.topHygieneTips.length - 1 ? 10 : 0 }}>
                    <span style={{ color: T.teal, fontWeight: 500, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{tip}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Personalised lifestyle &amp; hygiene tips</div>
            {lifestyleTips.map((tip, i) => {
              const lvlColor = { high: T.terra, medium: T.warn, low: T.sage }[tip.level] || T.sage;
              const lvlBg    = { high: T.terraPale, medium: T.goldPale, low: T.sagePale }[tip.level] || T.sagePale;
              return (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${lvlColor}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>{tip.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>{tip.title}</div>
                      <span style={{ fontSize: 10, background: lvlBg, color: lvlColor, borderRadius: 99, padding: "2px 8px", textTransform: "uppercase", letterSpacing: 1 }}>{tip.level === "high" ? "High impact" : tip.level === "medium" ? "Medium impact" : "Good habit"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.65, paddingLeft: 34 }}>{tip.body}</div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "products" && (
          <div>
            <div style={{ fontSize: 12, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Recommended ingredients</div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px", marginBottom: 20 }}>
              {(ingredients?.recommended || []).map((ing, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.sage, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: T.ink }}>{ing}</span>
                </div>
              ))}
            </div>
            {(ingredients?.avoid || []).length > 0 && (
              <>
                <div style={{ fontSize: 12, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Avoid for now</div>
                <div style={{ background: T.card, border: `1px solid ${T.terra}22`, borderRadius: 16, padding: "14px", marginBottom: 18 }}>
                  {ingredients.avoid.map((ing, i, arr) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: i < arr.length - 1 ? `1px solid ${T.terra}14` : "none" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.terra, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: T.terra }}>{ing}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ background: T.sand, borderRadius: 12, padding: "12px 16px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>💡 Introduce one product at a time. Patch test on inner forearm for 24–48 hours first.</div>
          </div>
        )}

        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 360 }}>
            <style>{`@keyframes bnc{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}`}</style>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
              {(chatMessages || []).map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-start" }}>
                  {m.role === "assistant" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.sagePale, border: `2px solid ${T.sage}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✦</div>}
                  <div style={{ maxWidth: "78%", background: m.role === "user" ? T.sage : T.surface, color: m.role === "user" ? "#fff" : T.ink, borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "12px 16px", fontSize: 14, lineHeight: 1.65, border: m.role === "assistant" ? `1px solid ${T.border}` : "none", whiteSpace: "pre-wrap" }}>{m.text}</div>
                  {m.role === "user" && <Avatar name={user?.name} size={32} />}
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.sagePale, border: `2px solid ${T.sage}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✦</div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "18px 18px 18px 4px", padding: "12px 18px", display: "flex", gap: 5, alignItems: "center" }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.sage, animation: "bnc 1.2s ease-in-out infinite", animationDelay: `${i * .2}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
            <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
                {CHAT_PROMPTS.map((p, i) => <button key={i} onClick={() => sendChat(p)} disabled={chatLoading} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 99, padding: "6px 13px", fontSize: 12, color: T.muted, cursor: "pointer", fontFamily: SANS, whiteSpace: "nowrap", flexShrink: 0 }}>{p}</button>)}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea ref={chatTaRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                  onFocus={e => e.target.style.borderColor = T.sage} onBlur={e => e.target.style.borderColor = T.border}
                  placeholder="Ask about rashes, hygiene, ingredients, lifestyle…" rows={1}
                  style={{ flex: 1, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: "12px 16px", fontSize: 14, fontFamily: SANS, background: T.surface, color: T.ink, resize: "none", outline: "none", lineHeight: 1.5 }} />
                <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: chatInput.trim() && !chatLoading ? T.sage : T.border, color: "#fff", fontSize: 18, cursor: chatInput.trim() && !chatLoading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>↑</button>
              </div>
              <p style={{ fontSize: 11, color: T.muted, textAlign: "center", margin: "8px 0 0" }}>Skin health guidance — not a substitute for medical care ⚕️</p>
            </div>
          </div>
        )}
      </div>

      {showShare && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.52)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 999 }} onClick={() => setShowShare(false)}>
          <div style={{ background: T.surface, borderRadius: "24px 24px 0 0", padding: "24px 24px 48px", width: "100%", maxWidth: 480, boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: T.border, borderRadius: 99, margin: "0 auto 20px" }} />
            <h3 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, margin: "0 0 6px", color: T.ink }}>Share your skin report</h3>
            <p style={{ color: T.muted, fontSize: 14, margin: "0 0 16px" }}>Share your full routine and hygiene plan with friends or save for later</p>
            <div style={{ background: T.bg, borderRadius: 12, padding: 14, fontSize: 12, color: T.ink, lineHeight: 1.7, maxHeight: 200, overflowY: "auto", marginBottom: 16, whiteSpace: "pre-wrap", fontFamily: "monospace", border: `1px solid ${T.border}` }}>{shareText}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {typeof navigator !== "undefined" && navigator.share && <button onClick={() => navigator.share({ title: "My Skinsense Report", text: shareText })} style={{ width: "100%", background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>Share via…</button>}
              <button onClick={async () => { try { await navigator.clipboard.writeText(shareText); } catch {} }} style={{ width: "100%", background: T.surface, color: T.ink, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: SANS }}>Copy to clipboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Community ──────────────────────────────────────────────────────────────────
function Community() {
  const [stats, setStats] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { DB.getStats().then(s => { setStats(s); setLoading(false); }); }, []);
  const types = stats?.types || {}; const total = Math.max(Object.values(types).reduce((a, b) => a + b, 0), 1);
  const concerns = Object.entries(stats?.concerns || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const lifestyle = Object.entries(stats?.lifestyle || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS, paddingBottom: 80 }}>
      <div style={{ background: T.sageDark, padding: "20px 20px 26px" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: "#fff", margin: "0 0 5px" }}>Community Insights</h2>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, margin: 0 }}>Anonymous data from {stats?.total || 0} skin scans — improving recommendations for everyone</p>
      </div>
      <div style={{ padding: "20px 20px", maxWidth: 500, margin: "0 auto" }}>
        {loading ? <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>Loading…</div> : !stats ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🌱</div>
            <h3 style={{ fontFamily: SERIF, fontSize: 22, color: T.ink, fontWeight: 400, margin: "0 0 10px" }}>Be the first!</h3>
            <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.65 }}>Complete your first scan to start building community insights. As more users join, we learn from aggregated anonymous data to improve recommendations for everyone.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              {[[stats.total?.toLocaleString() || "0","Total Scans","📊"],[Object.keys(types).length,"Skin Types","🔬"],[Object.keys(stats.concerns || {}).length,"Concerns","🎯"],[Object.keys(stats.lifestyle || {}).length,"Lifestyle Flags","💧"]].map(([val, label, icon], i) => (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: T.sageDark }}>{val}</div>
                  <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px", marginBottom: 14 }}>
              <h4 style={{ fontSize: 13, fontWeight: 500, color: T.ink, margin: "0 0 16px", textTransform: "uppercase", letterSpacing: 1 }}>Skin type distribution</h4>
              {Object.entries(types).map(([type, count]) => { const pct = Math.round(count / total * 100); return (
                <div key={type} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, color: T.ink }}><span style={{ textTransform: "capitalize" }}>{type}</span><span style={{ color: T.muted }}>{pct}% ({count})</span></div>
                  <div style={{ background: T.border, borderRadius: 99, height: 7 }}><div style={{ background: T.sage, width: `${pct}%`, height: "100%", borderRadius: 99 }} /></div>
                </div>
              ); })}
            </div>
            {concerns.length > 0 && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px", marginBottom: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 500, color: T.ink, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 1 }}>Most common concerns</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{concerns.map(([c, n], i) => <div key={c} style={{ background: i < 3 ? T.terraPale : T.sand, borderRadius: 99, padding: "5px 13px", display: "flex", gap: 5, alignItems: "center" }}><span style={{ fontSize: 12, fontWeight: 500, color: i < 3 ? T.terra : T.ink }}>{c}</span><span style={{ fontSize: 11, color: T.muted }}>({n})</span></div>)}</div>
              </div>
            )}
            {lifestyle.length > 0 && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px", marginBottom: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 500, color: T.ink, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 1 }}>Common lifestyle factors</h4>
                {lifestyle.map(([flag, count]) => <div key={flag} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.ink, marginBottom: 8 }}><span>{flag}</span><Tag text={`${count} users`} color={T.muted} bg={T.sand} small /></div>)}
              </div>
            )}
            <div style={{ background: T.goldPale, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.gold}28`, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>🔐 All community data is fully anonymised — no names, photos, or identifying details.</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────────
function Profile({ user, onLogout, onNewScan }) {
  const [scans, setScans] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { DB.getScans(user.email).then(s => { setScans(s); setLoading(false); }); }, []);
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS, paddingBottom: 80 }}>
      <div style={{ background: T.sageDark, padding: "20px 20px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <Avatar name={user.name} size={56} />
          <div><h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: "#fff", margin: 0 }}>{user.name}</h2><p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, margin: "3px 0 0" }}>{user.email}</p></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[[scans.length,"Scans","📊"],[user.age || "—","Age","🎂"],[new Date(user.created).toLocaleDateString("en-IN",{month:"short",year:"numeric"}),"Member","📅"]].map(([val, label, icon], i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "10px", textAlign: "center", border: "1px solid rgba(255,255,255,.14)" }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: "#fff" }}>{val}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 20px", maxWidth: 500, margin: "0 auto" }}>
        <button onClick={onNewScan} style={{ width: "100%", background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS, marginBottom: 20 }}>+ New skin scan</button>
        <h3 style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: T.muted, margin: "0 0 14px" }}>Scan History</h3>
        {loading ? <div style={{ textAlign: "center", color: T.muted, padding: "30px 0" }}>Loading…</div> : scans.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.muted }}><div style={{ fontSize: 44, marginBottom: 10 }}>📈</div><p style={{ margin: "0 0 6px", fontSize: 15 }}>No scans yet</p><p style={{ margin: 0, fontSize: 13 }}>Complete your first scan to start tracking</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            {scans.map((scan, i) => (
              <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                {scan.thumbnail && <img src={scan.thumbnail} style={{ width: 50, height: 50, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>{new Date(scan.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                    {scan.score && <Tag text={`${scan.score}/100`} color={T.sageDark} bg={T.sagePale} small />}
                  </div>
                  {scan.skinType && <div style={{ fontSize: 12, color: T.muted, marginBottom: 5, textTransform: "capitalize" }}>{scan.skinType} skin</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{(scan.concerns || []).slice(0, 3).map((c, j) => <Tag key={j} text={c} color={T.terra} bg={T.terraPale} small />)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onLogout} style={{ width: "100%", background: "none", border: `1.5px solid ${T.red}38`, borderRadius: 14, padding: "13px", fontSize: 15, color: T.red, cursor: "pointer", fontFamily: SANS }}>Sign out</button>
        <p style={{ textAlign: "center", fontSize: 11, color: T.muted2, marginTop: 14 }}>Skinsense v1.0 · © 2025 · All data encrypted</p>
      </div>
    </div>
  );
}

// ── Home ───────────────────────────────────────────────────────────────────────
function Home({ user, lastScan, onNewScan, onViewReport }) {
  const h = new Date().getHours(); const gr = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const features = [["📸","AI Skin Scan","9-signal facial analysis"],["🧴","Custom Routine","AM & PM with Indian brand picks"],["🏥","Rash Guidance","Non-medical help + when to see a doctor"],["💧","Hygiene Coach","Pillowcase, phone, brush habits"],["🌿","Lifestyle Plan","Sleep, diet, stress, hydration"],["💬","AI Chat","Personalised skin health Q&A"],["🛍","Shop in India","Nykaa, Amazon India, Flipkart"],["📈","Track Progress","Compare scans over time"]];
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: SANS, paddingBottom: 80 }}>
      <div style={{ background: T.sageDark, padding: "24px 20px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div><p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, margin: "0 0 3px" }}>{gr},</p><h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: "#fff", margin: 0 }}>{user?.name?.split(" ")[0]} 👋</h2></div>
          <Avatar name={user?.name} size={44} />
        </div>
        {lastScan ? (
          <div style={{ background: "rgba(255,255,255,.1)", borderRadius: 16, padding: "16px 18px", border: "1px solid rgba(255,255,255,.14)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.42)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Last scan · {new Date(lastScan.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {lastScan.thumbnail && <img src={lastScan.thumbnail} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />}
              <div style={{ flex: 1 }}><div style={{ fontFamily: SERIF, fontSize: 26, color: "#fff" }}>{lastScan.score || 70}<span style={{ fontSize: 14, color: "rgba(255,255,255,.45)" }}>/100</span></div><div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", textTransform: "capitalize" }}>{lastScan.skinType} skin</div></div>
              <button onClick={onViewReport} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: SANS }}>View →</button>
            </div>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,.1)", borderRadius: 16, padding: "16px 18px", border: "1px solid rgba(255,255,255,.14)" }}>
            <p style={{ color: "rgba(255,255,255,.8)", fontSize: 14, margin: "0 0 12px", lineHeight: 1.65 }}>Get your complete skin health plan — routines, hygiene coaching, and lifestyle guidance — in 2 minutes.</p>
            <button onClick={onNewScan} style={{ background: "#fff", color: T.sageDark, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>Start first scan →</button>
          </div>
        )}
      </div>
      <div style={{ padding: "22px 20px", maxWidth: 500, margin: "0 auto" }}>
        <h3 style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: T.muted, margin: "0 0 14px" }}>Everything Skinsense does for you</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
          {features.map(([icon, title, sub], i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 14px" }}>
              <div style={{ fontSize: 22, marginBottom: 7 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>{sub}</div>
            </div>
          ))}
        </div>
        <button onClick={onNewScan} style={{ width: "100%", background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: SANS }}>{lastScan ? "Scan again →" : "Get started →"}</button>
      </div>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────────
function BottomNav({ active, onTab }) {
  const tabs = [["home","Home","🏠"],["scan","Scan","📸"],["community","Community","🌍"],["profile","Profile","👤"]];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 100 }}>
      {tabs.map(([id, label, icon]) => (
        <button key={id} onClick={() => onTab(id)} style={{ flex: 1, background: "none", border: "none", padding: "10px 4px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: SANS }}>
          <span style={{ fontSize: id === "scan" ? 22 : 18 }}>{icon}</span>
          <span style={{ fontSize: 10, color: active === id ? T.sageDark : T.muted2, fontWeight: active === id ? 500 : 400 }}>{label}</span>
          {active === id && <div style={{ width: 20, height: 2, background: T.sage, borderRadius: 99 }} />}
        </button>
      ))}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState("splash");
  const [authScreen, setAuthScreen] = useState("welcome");
  const [user, setUser] = useState(null);
  const [navTab, setNavTab] = useState("home");
  const [scanState, setScanState] = useState("camera");
  const [captured, setCaptured] = useState(null);
  const [answers, setAnswers] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [ingredients, setIngredients] = useState(null);
  const [lastScan, setLastScan] = useState(null);

  useEffect(() => { const t = setTimeout(() => setAppState("auth"), 2600); return () => clearTimeout(t); }, []);

  const handleLogin = async (u) => {
    setUser(u);
    const scans = await DB.getScans(u.email);
    if (scans.length > 0) setLastScan(scans[0]);
    setAppState("app"); setNavTab("home");
  };

  const handleLogout = () => { setUser(null); setAppState("auth"); setAuthScreen("welcome"); setAnalysis(null); setLastScan(null); };

  const startScan = () => { setScanState("camera"); setAnalysis(null); setCaptured(null); setNavTab("scan"); };

  const handleCapture = (img) => { setCaptured(img); setScanState("questionnaire"); };

  const handleDescribeReady = (description) => {
    setCaptured({ b64: null, prev: null, description, textOnly: true });
    setScanState("questionnaire");
  };

  const handleQuestionnaire = async (ans) => {
    setAnswers(ans); setScanState("processing");
    let result;
    try {
      if (captured?.textOnly) {
        result = await analyzeTextOnly(captured.description, ans);
      } else {
        result = await analyzeImage(captured.b64, ans, captured.description || "");
      }
    } catch { result = FALLBACK(ans); }
    setAnalysis(result);
    setIngredients(getRecs(result.scores, ans));
    const scan = { ts: Date.now(), scores: result.scores, skinType: result.skinType, concerns: result.primaryConcerns, score: result.overallScore, thumbnail: captured?.prev || null, textOnly: !!captured?.textOnly };
    await DB.saveScan(user.email, scan);
    await DB.pushStats(result.skinType, result.primaryConcerns, result.scores, ans.lifestyle || []);
    const updated = { ...user, scans: (user.scans || 0) + 1 };
    await DB.saveUser(updated); setUser(updated); setLastScan(scan);
    setScanState("results"); setNavTab("scan");
  };

  if (appState === "splash") return <Splash onDone={() => setAppState("auth")} />;

  if (appState === "auth") {
    if (authScreen === "welcome") return <Welcome onLogin={() => setAuthScreen("login")} onSignup={() => setAuthScreen("signup")} />;
    if (authScreen === "login")   return <Login onBack={() => setAuthScreen("welcome")} onSuccess={handleLogin} onSignup={() => setAuthScreen("signup")} />;
    if (authScreen === "signup")  return <Signup onBack={() => setAuthScreen("welcome")} onSuccess={handleLogin} />;
  }

  if (appState === "app") return (
    <div style={{ fontFamily: SANS }}>
      {navTab === "home" && <Home user={user} lastScan={lastScan} onNewScan={startScan} onViewReport={() => analysis ? setNavTab("scan") : startScan()} />}
      {navTab === "scan" && (
        <>
          {scanState === "camera"        && <Camera onCapture={handleCapture} onDescribeReady={handleDescribeReady} user={user} />}
          {scanState === "questionnaire" && <Questionnaire onComplete={handleQuestionnaire} />}
          {scanState === "processing"    && <Processing />}
          {scanState === "results" && analysis && <Results img={captured?.prev} answers={answers} analysis={analysis} ingredients={ingredients} user={user} onNewScan={startScan} />}
          {scanState === "results" && !analysis && <Home user={user} lastScan={lastScan} onNewScan={startScan} onViewReport={() => {}} />}
        </>
      )}
      {navTab === "community" && <Community />}
      {navTab === "profile"   && <Profile user={user} onLogout={handleLogout} onNewScan={startScan} />}
      {scanState !== "processing" && <BottomNav active={navTab} onTab={t => { setNavTab(t); if (t === "scan" && !analysis) startScan(); }} />}
    </div>
  );

  return null;
}
