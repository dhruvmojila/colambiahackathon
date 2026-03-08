/**
 * SignPulse AI — Google ADK Agent definition.
 *
 * Uses LlmAgent with Gemini for sign language interpretation,
 * environment awareness, multilingual translation, and emotive speech.
 */
import { LlmAgent, InMemoryRunner, InMemorySessionService } from "@google/adk";
import { SIGNPULSE_SYSTEM_PROMPT } from "./prompts.js";

// Get the Google Cloud project from the service account
function getProjectId() {
  try {
    const fs = require("fs");
    const saPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS || "service-account.json";
    const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
    return sa.project_id;
  } catch {
    return process.env.GOOGLE_CLOUD_PROJECT || "waybackhome-xh3x47hr3fc1viubuy";
  }
}

/**
 * Tool: Interpret sign language from a video frame description
 */
function interpretSign({ frameDescription, previousContext }) {
  // This tool is called by the LLM when it wants to formalize
  // its interpretation of sign language from the frame analysis
  return {
    status: "interpreted",
    description: frameDescription,
    context: previousContext || "none",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Tool: Analyze environment context from a video frame
 */
function analyzeEnvironment({ sceneDescription }) {
  return {
    status: "analyzed",
    scene: sceneDescription,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Tool: Translate interpreted text to a target language
 */
function translateText({ text, targetLanguage, emotion }) {
  return {
    status: "translate_requested",
    text,
    targetLanguage,
    emotion: emotion || "neutral",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Tool: Generate emotive speech parameters
 */
function generateEmotiveSpeech({ text, emotion, intensity }) {
  return {
    status: "speech_ready",
    text,
    emotion: emotion || "neutral",
    intensity: intensity || "medium",
    timestamp: new Date().toISOString(),
  };
}

// Tool schemas for the ADK agent
const tools = [
  {
    name: "interpretSign",
    description:
      "Interpret sign language gestures detected in a video frame. Call this to formalize your interpretation of what the signer is communicating.",
    parameters: {
      type: "object",
      properties: {
        frameDescription: {
          type: "string",
          description:
            "Description of the sign language gestures detected in the frame",
        },
        previousContext: {
          type: "string",
          description: "Previous conversation context to maintain continuity",
        },
      },
      required: ["frameDescription"],
    },
    fn: interpretSign,
  },
  {
    name: "analyzeEnvironment",
    description:
      "Analyze the environmental context visible in the video frame. Call this to detect the setting (hospital, cafe, office, etc.) and key objects.",
    parameters: {
      type: "object",
      properties: {
        sceneDescription: {
          type: "string",
          description:
            "Description of the environment and objects detected in the scene",
        },
      },
      required: ["sceneDescription"],
    },
    fn: analyzeEnvironment,
  },
  {
    name: "translateText",
    description:
      "Translate the interpreted sign language text to a target spoken language. Use for multilingual output.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to translate",
        },
        targetLanguage: {
          type: "string",
          description: "Target language code (e.g., 'es', 'fr', 'de', 'ja')",
        },
        emotion: {
          type: "string",
          description: "Emotional tone to preserve in translation",
        },
      },
      required: ["text", "targetLanguage"],
    },
    fn: translateText,
  },
  {
    name: "generateEmotiveSpeech",
    description:
      "Generate speech output parameters with emotional expression. Call this to produce natural, emotive speech from the interpreted text.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to speak",
        },
        emotion: {
          type: "string",
          description:
            "Emotional tone (e.g., neutral, excited, concerned, urgent, happy, sad)",
        },
        intensity: {
          type: "string",
          description: "Intensity level: low, medium, high",
        },
      },
      required: ["text"],
    },
    fn: generateEmotiveSpeech,
  },
];

/**
 * Create the SignPulse ADK agent.
 */
export function createSignPulseAgent() {
  const agent = new LlmAgent({
    name: "signpulse",
    model: "gemini-2.0-flash",
    instruction: SIGNPULSE_SYSTEM_PROMPT,
    tools: tools.map((t) => ({
      functionDeclaration: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
    description:
      "Real-time sign language interpretation agent with environmental awareness and emotive speech",
  });

  return agent;
}

// Tool execution lookup
const toolMap = Object.fromEntries(tools.map((t) => [t.name, t.fn]));

/**
 * Run the SignPulse agent with a user message.
 * Uses InMemoryRunner for session management.
 */
export async function runAgent(userMessage, sessionId = "default") {
  const agent = createSignPulseAgent();

  const sessionService = new InMemorySessionService();
  const runner = new InMemoryRunner({
    agent,
    sessionService,
    appName: "signpulse",
  });

  // Create or get session
  let session;
  try {
    session = await sessionService.getSession({
      appName: "signpulse",
      userId: "user",
      sessionId,
    });
  } catch {
    session = await sessionService.createSession({
      appName: "signpulse",
      userId: "user",
      sessionId,
    });
  }

  if (!session) {
    session = await sessionService.createSession({
      appName: "signpulse",
      userId: "user",
      sessionId,
    });
  }

  // Run the agent
  const events = [];
  for await (const event of runner.runAsync({
    userId: "user",
    sessionId: session.id,
    newMessage: {
      role: "user",
      parts: [{ text: userMessage }],
    },
  })) {
    events.push(event);
  }

  // Extract the final response
  const lastEvent = events[events.length - 1];
  let responseText = "";

  if (lastEvent?.content?.parts) {
    for (const part of lastEvent.content.parts) {
      if (part.text) {
        responseText += part.text;
      }
    }
  }

  return {
    response: responseText,
    events,
    sessionId: session.id,
  };
}
