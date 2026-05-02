import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const REGIONAL_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"];
const GLOBAL_MODELS = ["gemini-3-flash-preview", "gemini-3.1-pro-preview"];

async function testModel(project: string, location: string, modelId: string): Promise<string> {
  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  const result = await ai.models.generateContent({
    model: modelId,
    contents: "Reply with pong",
    config: { maxOutputTokens: 32 },
  });

  return (result.text ?? "").trim();
}

function classifyError(error: unknown): string {
  const msg = String(error);
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return "403 permission denied";
  }
  if (msg.includes("404") || msg.includes("NOT_FOUND")) {
    return "404 not found";
  }
  return msg.slice(0, 160);
}

export async function GET() {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const regionalLocation = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";
  const allowGlobalFallback = process.env.GOOGLE_VERTEX_ALLOW_GLOBAL_FALLBACK === "true";

  if (!project) {
    return NextResponse.json({ error: "GOOGLE_VERTEX_PROJECT not set" });
  }

  const results: Record<string, string> = {};

  for (const modelId of REGIONAL_MODELS) {
    const key = `${regionalLocation}/${modelId}`;
    try {
      const text = await testModel(project, regionalLocation, modelId);
      if (text) {
        results[key] = "OK";
        return NextResponse.json({
          working: { location: regionalLocation, model: modelId, scope: "regional" },
          credentials: creds ?? "not set",
          configuredLocation: regionalLocation,
          globalFallbackEnabled: allowGlobalFallback,
          allResults: results,
          note: "Hermes now prefers the configured regional Vertex endpoint for local processing.",
        });
      }
      results[key] = "Empty response";
    } catch (err) {
      results[key] = classifyError(err);
    }
  }

  for (const modelId of GLOBAL_MODELS) {
    const key = `global/${modelId}`;
    try {
      const text = await testModel(project, "global", modelId);
      if (text) {
        results[key] = "OK";
        return NextResponse.json({
          working: { location: "global", model: modelId, scope: "global" },
          credentials: creds ?? "not set",
          configuredLocation: regionalLocation,
          globalFallbackEnabled: allowGlobalFallback,
          allResults: results,
          note: "Regional models failed, but the same credentials work against the global Gemini preview endpoint.",
        });
      }
      results[key] = "Empty response";
    } catch (err) {
      results[key] = classifyError(err);
    }
  }

  return NextResponse.json({
    working: null,
    credentials: creds ?? "not set",
    configuredLocation: regionalLocation,
    globalFallbackEnabled: allowGlobalFallback,
    allResults: results,
    suggestion: "No working model found. Check that Vertex AI API is enabled, the service account has Vertex AI User, and the configured region supports Gemini 2.5 models.",
  });
}
