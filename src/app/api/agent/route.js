/**
 * SignPulse AI — Agent REST API route.
 *
 * POST /api/agent
 * Body: { message: string, sessionId?: string }
 * Returns: { response: string, sessionId: string }
 */
import { NextResponse } from "next/server";
import { analyzeFrame, analyzeEnvironmentFromFrame } from "@/lib/gemini-live";

export async function POST(request) {
  try {
    const body = await request.json();
    const { frame, language, previousContext, action } = body;

    if (action === "environment" && frame) {
      const env = await analyzeEnvironmentFromFrame(frame);
      return NextResponse.json({ environment: env });
    }

    if (action === "interpret" && frame) {
      const result = await analyzeFrame(frame, language, previousContext);
      return NextResponse.json({
        interpretation: result.interpretation,
        emotion: result.emotion,
        environment: result.environment,
        confidence: result.confidence,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'interpret' or 'environment'." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Agent API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
