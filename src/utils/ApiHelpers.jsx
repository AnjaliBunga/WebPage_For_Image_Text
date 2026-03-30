// const HF_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;

// TEXT ENHANCEMENT — Model IDs change by API version; unversioned names (e.g. gemini-1.5-flash) often 404.
// Optional override: VITE_GEMINI_MODEL=gemini-2.5-flash (must exist for your key).
// Otherwise we call models.list and pick a model that supports generateContent.

const PREFERRED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash-002",
  "gemini-1.5-flash-001",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash"
];

let cachedGeminiModelId = null;

function modelIdFromResourceName(name) {
  if (!name || typeof name !== "string") return "";
  return name.replace(/^models\//, "");
}

function modelSupportsGenerateContent(m) {
  const methods =
    m.supportedGenerationMethods || m.supported_generation_methods || [];
  return Array.isArray(methods) && methods.includes("generateContent");
}

/**
 * Picks a model id that exists for this API key and supports generateContent.
 * @param {Set<string>} exclude — ids to skip (e.g. after 404)
 */
async function resolveGeminiModelId(apiKey, exclude = new Set()) {
  const explicit = import.meta.env.VITE_GEMINI_MODEL?.trim();
  if (explicit && !exclude.has(explicit)) {
    return explicit;
  }

  if (cachedGeminiModelId && !exclude.has(cachedGeminiModelId)) {
    return cachedGeminiModelId;
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(apiKey)}`;
  const listRes = await fetch(listUrl);
  const listData = await listRes.json();

  if (!listRes.ok) {
    console.error("GEMINI listModels:", listData);
    const fallback = PREFERRED_GEMINI_MODELS.find((id) => !exclude.has(id));
    return fallback || "gemini-2.5-flash";
  }

  const available = new Set();
  for (const m of listData.models || []) {
    if (!modelSupportsGenerateContent(m)) continue;
    const id = modelIdFromResourceName(m.name);
    if (id) available.add(id);
  }

  for (const pref of PREFERRED_GEMINI_MODELS) {
    if (exclude.has(pref)) continue;
    if (available.has(pref)) {
      cachedGeminiModelId = pref;
      return pref;
    }
  }

  const flash = [...available].find((id) => id.includes("flash"));
  if (flash && !exclude.has(flash)) {
    cachedGeminiModelId = flash;
    return flash;
  }

  const first = [...available].find((id) => !exclude.has(id));
  if (first) {
    cachedGeminiModelId = first;
    return first;
  }

  const fallback = PREFERRED_GEMINI_MODELS.find((id) => !exclude.has(id));
  return fallback || "gemini-2.5-flash";
}

async function geminiGenerateContent(apiKey, modelId, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { res, data };
}

export async function enhanceText(prompt) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const trimmed = typeof prompt === "string" ? prompt.trim() : "";

  if (!key) {
    return "Missing VITE_GEMINI_API_KEY. Add it to your .env file.";
  }
  if (!trimmed) {
    return "Enter a prompt to enhance.";
  }

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Enhance this image prompt with cinematic style, lighting, realism, and details. Reply with only the enhanced prompt text, no preamble:\n\n${trimmed}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  try {
    const tried = new Set();
    let modelId = await resolveGeminiModelId(key, tried);
    let { res, data } = await geminiGenerateContent(key, modelId, requestBody);

    if (
      !res.ok &&
      res.status === 404 &&
      data?.error?.status === "NOT_FOUND"
    ) {
      tried.add(modelId);
      cachedGeminiModelId = null;
      modelId = await resolveGeminiModelId(key, tried);
      ({ res, data } = await geminiGenerateContent(key, modelId, requestBody));
    }

    if (!res.ok) {
      const msg = data?.error?.message || res.statusText || "Request failed";
      console.error("GEMINI error:", data);
      return `Enhancement failed: ${msg}`;
    }

    const parts = data.candidates?.[0]?.content?.parts;
    const text = parts?.map((p) => p.text).join("")?.trim();
    if (text) {
      return text;
    }

    const block = data.promptFeedback?.blockReason;
    if (block) {
      return `Prompt was blocked (${block}). Try different wording.`;
    }

    return `A highly detailed, cinematic, realistic image of ${trimmed}, 4k, dramatic lighting, professional photography`;
  } catch (err) {
    console.error(err);
    return "Error enhancing text";
  }
}

// Same-origin path avoids CORS. Vite proxies /hf-inference → https://router.huggingface.co/hf-inference (current HF Inference API).
// Production: set VITE_HF_INFERENCE_BASE (e.g. https://router.huggingface.co/hf-inference) only if your host mirrors that path; otherwise use a proxy.
const HF_INFERENCE_BASE = (
  import.meta.env.VITE_HF_INFERENCE_BASE || "/hf-inference"
).replace(/\/$/, "");

function hfInferenceUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${HF_INFERENCE_BASE}${p}`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 =
        typeof dataUrl === "string" ? dataUrl.split(",")[1] || "" : "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Same Gemini API + model picker as enhanceText; multimodal (image + text). */
async function analyzeImageWithGemini(file, key) {
  const base64 = await readFileAsBase64(file);
  if (!base64) {
    return { error: "Could not read the image file." };
  }

  const mimeType = file.type || "image/jpeg";
  const requestBody = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          {
            text: "Describe this image briefly and vividly for use as a prompt to generate similar images. Reply with one English paragraph only, no preamble."
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 512
    }
  };

  try {
    const tried = new Set();
    let modelId = await resolveGeminiModelId(key, tried);
    let { res, data } = await geminiGenerateContent(key, modelId, requestBody);

    if (
      !res.ok &&
      res.status === 404 &&
      data?.error?.status === "NOT_FOUND"
    ) {
      tried.add(modelId);
      cachedGeminiModelId = null;
      modelId = await resolveGeminiModelId(key, tried);
      ({ res, data } = await geminiGenerateContent(key, modelId, requestBody));
    }

    if (!res.ok) {
      const msg = data?.error?.message || `Caption failed (${res.status})`;
      console.error("GEMINI vision:", data);
      return { error: msg };
    }

    const parts = data.candidates?.[0]?.content?.parts;
    const text = parts?.map((p) => p.text).join("")?.trim();
    if (text) {
      return { caption: text };
    }

    const block = data.promptFeedback?.blockReason;
    if (block) {
      return { error: `Image blocked (${block}). Try another image.` };
    }

    return { error: "Could not describe this image." };
  } catch (err) {
    console.error(err);
    return {
      error: err instanceof Error ? err.message : "Image analysis failed"
    };
  }
}

async function analyzeImageWithHfBlip(file, hfKey) {
  const res = await fetch(
    hfInferenceUrl("/models/Salesforce/blip-image-captioning-base"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": file.type || "image/jpeg"
      },
      body: file
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const msg =
      typeof data?.error === "string"
        ? data.error
        : data?.error || `Caption failed (${res.status})`;
    console.error("HF BLIP:", data);
    return { error: String(msg) };
  }

  const caption = Array.isArray(data)
    ? data[0]?.generated_text
    : data?.generated_text;
  if (caption) {
    return { caption };
  }

  return { error: "Could not read caption from the model response." };
}

// IMAGE GENERATION (Hugging Face — image bytes or JSON errors)
export async function generateImage(prompt) {
  const hfKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
  const trimmed = typeof prompt === "string" ? prompt.trim() : "";

  if (!hfKey) {
    return {
      urls: [],
      error: "Missing VITE_HUGGINGFACE_API_KEY. Add it to your .env file."
    };
  }
  if (!trimmed) {
    return { urls: [], error: "No prompt to generate from." };
  }

  try {
    const res = await fetch(
      hfInferenceUrl("/models/stabilityai/stable-diffusion-xl-base-1.0"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: trimmed })
      }
    );

    const raw = await res.arrayBuffer();
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const text = new TextDecoder().decode(raw);

    if (!res.ok) {
      try {
        const err = JSON.parse(text);
        const msg =
          err.error ||
          err.detail ||
          (typeof err.estimated_time === "number"
            ? `Model is loading; try again in ~${Math.ceil(err.estimated_time)}s`
            : null) ||
          text ||
          `HTTP ${res.status}`;
        return { urls: [], error: String(msg) };
      } catch {
        return { urls: [], error: text || `HTTP ${res.status}` };
      }
    }

    if (contentType.includes("application/json")) {
      try {
        const err = JSON.parse(text);
        const msg =
          err.error ||
          (typeof err.estimated_time === "number"
            ? `Model is loading; try again in ~${Math.ceil(err.estimated_time)}s`
            : null) ||
          text;
        return { urls: [], error: String(msg) };
      } catch {
        return { urls: [], error: text || "Unexpected JSON from image API" };
      }
    }

    const blob = new Blob([raw], {
      type: contentType.includes("image/") ? contentType : "image/png"
    });
    return { urls: [URL.createObjectURL(blob)] };
  } catch (err) {
    console.error(err);
    return {
      urls: [],
      error: err instanceof Error ? err.message : "Image generation failed"
    };
  }
}

/**
 * @returns {Promise<{ caption: string } | { error: string }>}
 */
export async function analyzeImage(file) {
  if (!file) {
    return { error: "Select an image file first." };
  }

  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (geminiKey) {
    return analyzeImageWithGemini(file, geminiKey);
  }

  const hfKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
  if (hfKey) {
    return analyzeImageWithHfBlip(file, hfKey);
  }

  return {
    error:
      "Add VITE_GEMINI_API_KEY to describe images with Gemini (same as Text workflow), or VITE_HUGGINGFACE_API_KEY for BLIP. Generating images still needs VITE_HUGGINGFACE_API_KEY."
  };
}
