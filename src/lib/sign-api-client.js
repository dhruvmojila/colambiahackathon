/**
 * SignPulse AI — Sign Language Detection API Client.
 *
 * Connects to the deployed sign-api (FastAPI + I3D model) on Cloud Run.
 * Records 2-second video clips and sends them for ASL prediction.
 */

const API_URL =
  process.env.NEXT_PUBLIC_SIGNPULSE_API ||
  "https://signpulse-backend-973006952011.us-central1.run.app";

/**
 * @typedef {Object} SignPrediction
 * @property {string} intent - Predicted sign word
 * @property {number} confidence - Confidence score 0-1
 * @property {Array<{word: string, confidence: number}>} top5 - Top 5 predictions
 * @property {boolean} demo_mode - Whether running in demo mode
 */

/**
 * Record a video clip from a MediaStream and send to the sign-api for prediction.
 *
 * @param {MediaStream} stream - The camera MediaStream
 * @param {number} durationMs - Recording duration in ms (default 2000)
 * @returns {Promise<SignPrediction>} The prediction result
 */
export function captureAndPredict(stream, durationMs = 2000) {
  return new Promise((resolve, reject) => {
    if (!stream) return reject(new Error("No camera stream"));

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      return reject(new Error("MediaRecorder not supported"));
    }

    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64 = reader.result.split(",")[1];
          if (!base64) {
            return reject(new Error("Failed to encode video"));
          }

          try {
            const res = await fetch(`${API_URL}/predict`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ video_base64: base64 }),
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              return reject(
                new Error(err.detail || `Sign API error: ${res.status}`),
              );
            }

            const data = await res.json();
            resolve(data);
          } catch (e) {
            reject(new Error(`Sign API request failed: ${e.message}`));
          }
        };

        reader.readAsDataURL(blob);
      } catch (e) {
        reject(e);
      }
    };

    recorder.onerror = (e) => {
      reject(new Error("Recording error: " + e.error?.message));
    };

    recorder.start();
    setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, durationMs);
  });
}

/**
 * Check if the sign-api is healthy.
 */
export async function checkSignApiHealth() {
  try {
    const res = await fetch(`${API_URL}/`, { method: "GET" });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}
