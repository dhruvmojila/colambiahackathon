/**
 * SignPulse AI — Gemini API client for vision analysis.
 *
 * Uses Google Cloud Vertex AI with service account credentials
 * for sign language interpretation and environment analysis.
 */
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  SIGN_INTERPRETATION_PROMPT,
  ENVIRONMENT_ANALYSIS_PROMPT,
  SIGNPULSE_SYSTEM_PROMPT,
} from "./prompts.js";

let vertexAI = null;
let model = null;

/**
 * Get service account credentials and initialize Vertex AI.
 */
function getVertexAI() {
  if (vertexAI) return vertexAI;

  const saPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "service-account.json";
  const resolvedPath = resolve(process.cwd(), saPath);

  let projectId;
  let location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  try {
    const sa = JSON.parse(readFileSync(resolvedPath, "utf-8"));
    projectId = sa.project_id;
  } catch (e) {
    projectId =
      process.env.GOOGLE_CLOUD_PROJECT || "waybackhome-xh3x47hr3fc1viubuy";
  }

  // Set env for Google Auth
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;

  vertexAI = new VertexAI({
    project: projectId,
    location,
  });

  return vertexAI;
}

/**
 * Get the generative model (Gemini).
 */
function getModel() {
  if (model) return model;

  const vai = getVertexAI();
  model = vai.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
      topP: 0.9,
    },
  });

  return model;
}

/**
 * Analyze a video frame for sign language interpretation.
 * @param {string} base64Frame - Base64 encoded JPEG image
 * @param {string} language - Target language code
 * @param {object|null} previousContext - Previous conversation context
 * @returns {Promise<object>} Interpretation result
 */
export async function analyzeFrame(
  base64Frame,
  language = "en",
  previousContext = null,
) {
  const genModel = getModel();

  const contextPrompt = previousContext
    ? `\n\nPrevious conversation context: ${JSON.stringify(previousContext)}`
    : "";

  const languageInstruction =
    language !== "en"
      ? `\n\nIMPORTANT: Translate your interpretation to ${getLanguageName(language)} (${language}).`
      : "";

  const prompt = `${SIGNPULSE_SYSTEM_PROMPT}${contextPrompt}${languageInstruction}

Analyze this video frame from a sign language conversation. Provide your interpretation as JSON.`;

  try {
    const result = await genModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Frame,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const response = result.response;
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Try to parse as JSON
    try {
      const cleaned = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        interpretation: text,
        emotion: "neutral",
        environment: null,
        confidence: "medium",
      };
    }
  } catch (error) {
    console.error("Gemini frame analysis error:", error.message);
    return {
      interpretation: null,
      error: error.message,
      confidence: "low",
    };
  }
}

/**
 * Analyze environment only from a frame.
 */
export async function analyzeEnvironmentFromFrame(base64Frame) {
  const genModel = getModel();

  try {
    const result = await genModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Frame,
              },
            },
            { text: ENVIRONMENT_ANALYSIS_PROMPT },
          ],
        },
      ],
    });

    const text =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    try {
      const cleaned = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return { type: "unknown", label: "Unknown", detail: text };
    }
  } catch (error) {
    console.error("Environment analysis error:", error.message);
    return { type: "unknown", label: "Analyzing...", detail: error.message };
  }
}

/**
 * Get language name from code.
 */
function getLanguageName(code) {
  const names = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    hi: "Hindi",
    ar: "Arabic",
    pt: "Portuguese",
    ru: "Russian",
    it: "Italian",
  };
  return names[code] || code;
}
