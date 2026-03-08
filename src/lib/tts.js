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
 * Using Standard voices (guaranteed to exist in all projects).
 */
const VOICE_MAP = {
  en: { languageCode: "en-US", ssmlGender: "FEMALE" },
  es: { languageCode: "es-ES", ssmlGender: "FEMALE" },
  fr: { languageCode: "fr-FR", ssmlGender: "FEMALE" },
  de: { languageCode: "de-DE", ssmlGender: "FEMALE" },
  ja: { languageCode: "ja-JP", ssmlGender: "FEMALE" },
  ko: { languageCode: "ko-KR", ssmlGender: "FEMALE" },
  zh: { languageCode: "cmn-CN", ssmlGender: "FEMALE" },
  hi: { languageCode: "hi-IN", ssmlGender: "FEMALE" },
  ar: { languageCode: "ar-XA", ssmlGender: "FEMALE" },
  pt: { languageCode: "pt-BR", ssmlGender: "FEMALE" },
  ru: { languageCode: "ru-RU", ssmlGender: "FEMALE" },
  it: { languageCode: "it-IT", ssmlGender: "FEMALE" },
};

/**
 * Map emotion to speaking rate and pitch.
 */
function getEmotionParams(emotion) {
  const map = {
    neutral: { speakingRate: 1.0, pitch: 0 },
    happy: { speakingRate: 1.1, pitch: 2.0 },
    excited: { speakingRate: 1.2, pitch: 3.0 },
    sad: { speakingRate: 0.85, pitch: -3.0 },
    concerned: { speakingRate: 0.9, pitch: -1.0 },
    urgent: { speakingRate: 1.3, pitch: 1.5 },
    angry: { speakingRate: 1.1, pitch: -2.0 },
    confused: { speakingRate: 0.9, pitch: 1.0 },
    calm: { speakingRate: 0.85, pitch: -1.5 },
    surprised: { speakingRate: 1.15, pitch: 4.0 },
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

  // Clean the text — remove JSON artifacts, markdown, etc.
  let cleanText = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]*?\}/g, "")
    .replace(/[*_#]/g, "")
    .trim();

  if (cleanText.length === 0) return null;
  if (cleanText.length > 500) cleanText = cleanText.substring(0, 500);

  try {
    const client = getClient();
    const voiceConfig = VOICE_MAP[language] || VOICE_MAP.en;
    const emotionParams = getEmotionParams(emotion);

    const request = {
      input: { text: cleanText },
      voice: {
        languageCode: voiceConfig.languageCode,
        ssmlGender: voiceConfig.ssmlGender,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: emotionParams.speakingRate,
        pitch: emotionParams.pitch,
      },
    };

    console.log(
      `[TTS] Generating speech: lang=${language}, emotion=${emotion}, text="${cleanText.substring(0, 60)}..."`,
    );

    const [response] = await client.synthesizeSpeech(request);

    if (response.audioContent) {
      const audioBase64 =
        typeof response.audioContent === "string"
          ? response.audioContent
          : Buffer.from(response.audioContent).toString("base64");

      console.log(
        `[TTS] Audio generated: ${Math.round(audioBase64.length / 1024)}KB`,
      );
      return audioBase64;
    }

    console.warn("[TTS] No audio content in response");
    return null;
  } catch (error) {
    console.error("[TTS] Error:", error.code, error.message);
    return null;
  }
}
