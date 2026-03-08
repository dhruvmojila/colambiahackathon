/**
 * SignPulse AI — Real-time streaming API route.
 *
 * POST /api/live
 * Accepts video frames, returns sign interpretation, environment, and audio.
 */
import { NextResponse } from "next/server";
import { analyzeFrame, analyzeEnvironmentFromFrame } from "@/lib/gemini-live";
import { generateSpeech } from "@/lib/tts";
import { existsSync } from "fs";
import { resolve } from "path";

// In-memory session state (per user session)
const sessions = new Map();

// Validate service account on cold start
const saPath = resolve(
  process.cwd(),
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "service-account.json",
);
if (!existsSync(saPath)) {
  console.warn(
    `⚠️  Service account not found at ${saPath}. API calls will fail.`,
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, data, language, sessionId = "default" } = body;

    // Initialize session
    if (type === "config") {
      sessions.set(sessionId, {
        language: language || "en",
        messageHistory: [],
        environment: null,
        frameCount: 0,
        lastEnvironmentCheck: 0,
      });

      return NextResponse.json({
        type: "status",
        status: "connected",
        sessionId,
      });
    }

    // Process a video frame
    if (type === "frame" && data) {
      let session = sessions.get(sessionId);
      if (!session) {
        session = {
          language: language || "en",
          messageHistory: [],
          environment: null,
          frameCount: 0,
          lastEnvironmentCheck: 0,
        };
        sessions.set(sessionId, session);
      }

      // Update language if changed mid-session
      if (language && language !== session.language) {
        session.language = language;
      }

      session.frameCount++;
      const results = [];

      // Check environment every 5 frames
      const checkEnvironment =
        session.frameCount - session.lastEnvironmentCheck >= 5;

      // Run interpretation and environment analysis in parallel
      const [interpretation, envResult] = await Promise.all([
        analyzeFrame(
          data,
          session.language,
          session.messageHistory.length > 0
            ? {
                lastMessages: session.messageHistory.slice(-3),
                environment: session.environment,
              }
            : null,
        ),
        checkEnvironment
          ? analyzeEnvironmentFromFrame(data)
          : Promise.resolve(null),
      ]);

      // Process interpretation
      if (interpretation && interpretation.interpretation) {
        const userMsg = {
          role: "user",
          text: interpretation.interpretation,
          emotion: interpretation.emotion || "neutral",
          timestamp: Date.now(),
        };

        session.messageHistory.push(userMsg);

        results.push({
          type: "transcript",
          role: "user",
          text: interpretation.interpretation,
          emotion: interpretation.emotion || "neutral",
          confidence: interpretation.confidence,
        });

        // Generate agent response (contextual voice output)
        if (interpretation.confidence !== "low") {
          const agentResponse = generateAgentResponse(interpretation, session);
          session.messageHistory.push({
            role: "agent",
            text: agentResponse.text,
            emotion: agentResponse.emotion,
            timestamp: Date.now(),
          });

          results.push({
            type: "transcript",
            role: "agent",
            text: agentResponse.text,
            emotion: agentResponse.emotion,
          });

          // Generate TTS audio for the agent response
          const audioBase64 = await generateSpeech(
            agentResponse.text,
            session.language,
            agentResponse.emotion,
          );

          if (audioBase64) {
            results.push({
              type: "audio",
              audioData: audioBase64,
              mimeType: "audio/mpeg",
              emotion: agentResponse.emotion,
            });
          }
        }
      }

      // Process environment
      if (envResult) {
        session.environment = envResult;
        session.lastEnvironmentCheck = session.frameCount;
        results.push({
          type: "environment",
          environment: envResult,
        });
      }

      // Keep message history manageable
      if (session.messageHistory.length > 20) {
        session.messageHistory = session.messageHistory.slice(-15);
      }

      return NextResponse.json({ results });
    }

    // End session
    if (type === "end") {
      sessions.delete(sessionId);
      return NextResponse.json({ type: "status", status: "disconnected" });
    }

    return NextResponse.json(
      { error: "Unknown message type" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Live API error:", error);

    let userMessage = error.message || "Internal server error";
    let status = 500;

    if (
      error.message?.includes("PERMISSION_DENIED") ||
      error.message?.includes("403")
    ) {
      userMessage =
        "Service account lacks permissions. Enable Vertex AI & Text-to-Speech APIs in GCP.";
      status = 403;
    } else if (
      error.message?.includes("RESOURCE_EXHAUSTED") ||
      error.message?.includes("429")
    ) {
      userMessage = "API quota exceeded. Please wait a moment and try again.";
      status = 429;
    } else if (
      error.message?.includes("NOT_FOUND") ||
      error.message?.includes("404")
    ) {
      userMessage =
        "Model or API not found. Enable Vertex AI & Text-to-Speech APIs in GCP.";
      status = 404;
    }

    return NextResponse.json(
      { error: userMessage, details: error.message },
      { status },
    );
  }
}

/**
 * Generate a contextual agent response based on interpretation and environment.
 */
function generateAgentResponse(interpretation, session) {
  const env = session.environment;
  let text = interpretation.interpretation;
  let emotion = interpretation.emotion || "neutral";

  // Add environmental context if available
  if (env && env.type) {
    const envContextMap = {
      hospital: { prefix: "In this medical setting: ", tone: "concerned" },
      cafe: { prefix: "", tone: "casual" },
      office: { prefix: "", tone: "professional" },
      restaurant: { prefix: "", tone: "casual" },
      school: { prefix: "", tone: "clear" },
      store: { prefix: "", tone: "helpful" },
    };

    const ctx = envContextMap[env.type?.toLowerCase()];
    if (ctx && ctx.prefix) {
      text = ctx.prefix + text;
    }
  }

  return { text, emotion };
}
