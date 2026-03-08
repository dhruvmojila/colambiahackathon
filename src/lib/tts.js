/**
 * SignPulse AI — Google Cloud Text-to-Speech integration.
 *
 * Generates emotive speech audio from interpreted sign language text.
 * Uses service account credentials for authentication.
 */
import textToSpeech from "@google-cloud/text-to-speech";
import { resolve } from "path";

let ttsClient = null;

/**
 * Initialize the TTS client with service account.
 */
function getClient() {
  if (ttsClient) return ttsClient;

  const saPath = resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "service-account.json",
  );

  ttsClient = new textToSpeech.TextToSpeechClient({
    keyFilename: saPath,
  });

  return ttsClient;
}

/**
 * Language → voice config mapping.
 * Each entry has a languageCode, voice name, and SSML gender.
 */
const VOICE_MAP = {
  en: { languageCode: "en-US", name: "en-US-Journey-F", gender: "FEMALE" },
  es: { languageCode: "es-ES", name: "es-ES-Wavenet-C", gender: "FEMALE" },
  fr: { languageCode: "fr-FR", name: "fr-FR-Wavenet-C", gender: "FEMALE" },
  de: { languageCode: "de-DE", name: "de-DE-Wavenet-C", gender: "FEMALE" },
  ja: { languageCode: "ja-JP", name: "ja-JP-Wavenet-B", gender: "FEMALE" },
  ko: { languageCode: "ko-KR", name: "ko-KR-Wavenet-A", gender: "FEMALE" },
  zh: { languageCode: "cmn-CN", name: "cmn-CN-Wavenet-A", gender: "FEMALE" },
  hi: { languageCode: "hi-IN", name: "hi-IN-Wavenet-A", gender: "FEMALE" },
  ar: { languageCode: "ar-XA", name: "ar-XA-Wavenet-A", gender: "FEMALE" },
  pt: { languageCode: "pt-BR", name: "pt-BR-Wavenet-A", gender: "FEMALE" },
  ru: { languageCode: "ru-RU", name: "ru-RU-Wavenet-C", gender: "FEMALE" },
  it: { languageCode: "it-IT", name: "it-IT-Wavenet-A", gender: "FEMALE" },
};

/**
 * Map emotion to SSML speaking rate and pitch adjustments.
 */
function getEmotionParams(emotion) {
  const map = {
    neutral: { rate: 1.0, pitch: 0 },
    happy: { rate: 1.15, pitch: 2.0 },
    excited: { rate: 1.25, pitch: 3.0 },
    sad: { rate: 0.85, pitch: -3.0 },
    concerned: { rate: 0.9, pitch: -1.0 },
    urgent: { rate: 1.3, pitch: 1.5 },
    angry: { rate: 1.1, pitch: -2.0 },
    confused: { rate: 0.9, pitch: 1.0 },
    calm: { rate: 0.85, pitch: -1.5 },
    surprised: { rate: 1.2, pitch: 4.0 },
  };
  return map[emotion?.toLowerCase()] || map.neutral;
}

/**
 * Generate speech audio from text with emotion.
 *
 * @param {string} text - Text to speak
 * @param {string} language - Language code (en, es, fr, etc.)
 * @param {string} emotion - Emotion for tonal adjustment
 * @returns {Promise<string|null>} Base64 encoded MP3 audio, or null on error
 */
export async function generateSpeech(
  text,
  language = "en",
  emotion = "neutral",
) {
  if (!text || text.trim().length === 0) return null;

  try {
    const client = getClient();
    const voiceConfig = VOICE_MAP[language] || VOICE_MAP.en;
    const emotionParams = getEmotionParams(emotion);

    // Build SSML for emotive speech
    const ssml = `<speak>
  <prosody rate="${emotionParams.rate}" pitch="${emotionParams.pitch >= 0 ? "+" : ""}${emotionParams.pitch}st">
    ${escapeXml(text)}
  </prosody>
</speak>`;

    const [response] = await client.synthesizeSpeech({
      input: { ssml },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
        ssmlGender: voiceConfig.gender,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0, // Handled in SSML prosody
        pitch: 0, // Handled in SSML prosody
        volumeGainDb: 0,
        effectsProfileId: ["small-bluetooth-speaker-class-device"],
      },
    });

    if (response.audioContent) {
      // Convert to base64
      const audioBase64 =
        typeof response.audioContent === "string"
          ? response.audioContent
          : Buffer.from(response.audioContent).toString("base64");
      return audioBase64;
    }

    return null;
  } catch (error) {
    console.error("TTS error:", error.message);

    // If the voice name doesn't exist, try with just languageCode
    if (
      error.message?.includes("voice") ||
      error.message?.includes("not found")
    ) {
      try {
        const client = getClient();
        const voiceConfig = VOICE_MAP[language] || VOICE_MAP.en;

        const [response] = await client.synthesizeSpeech({
          input: { text },
          voice: {
            languageCode: voiceConfig.languageCode,
            ssmlGender: voiceConfig.gender,
          },
          audioConfig: {
            audioEncoding: "MP3",
          },
        });

        if (response.audioContent) {
          return typeof response.audioContent === "string"
            ? response.audioContent
            : Buffer.from(response.audioContent).toString("base64");
        }
      } catch (fallbackErr) {
        console.error("TTS fallback error:", fallbackErr.message);
      }
    }

    return null;
  }
}

/**
 * Escape XML special characters for SSML.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
