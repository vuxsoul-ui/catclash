import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing ANTHROPIC_API_KEY" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system:
        "You are helping design and audit a mobile-first game UI called CatClash. Be concise, practical, and avoid fluff. Focus on UX, hierarchy, and game feel. Output in short structured bullets.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((chunk) => chunk.type === "text")
      .map((chunk) => chunk.text)
      .join("\n")
      .trim();

    return NextResponse.json({ ok: true, text });
  } catch (error: any) {
    const isDev = process.env.NODE_ENV !== "production";
    const configuredBaseURL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
    const requestURL = `${configuredBaseURL.replace(/\/+$/, "")}/v1/messages`;
    const upstreamStatus =
      Number(error?.status) ||
      Number(error?.response?.status) ||
      Number(error?.statusCode) ||
      500;
    const status = Math.min(Math.max(upstreamStatus, 400), 599);
    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : "Claude request failed";
    const rawHeaders =
      error?.headers ||
      error?.response?.headers ||
      null;
    const headers: Record<string, string> = {};
    if (rawHeaders && typeof rawHeaders.forEach === "function") {
      rawHeaders.forEach((value: string, key: string) => {
        const lower = String(key || "").toLowerCase();
        if (lower === "authorization" || lower === "x-api-key" || lower === "api-key") return;
        headers[key] = String(value);
      });
    } else if (rawHeaders && typeof rawHeaders === "object") {
      for (const [key, value] of Object.entries(rawHeaders)) {
        const lower = String(key || "").toLowerCase();
        if (lower === "authorization" || lower === "x-api-key" || lower === "api-key") continue;
        headers[key] = String(value);
      }
    }
    const upstreamBody =
      error?.error ??
      error?.response?.data ??
      error?.response?.body ??
      error?.body ??
      null;

    console.error("[/api/claude] upstream failure", {
      requestURL,
      env: {
        hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
        hasBaseURL: Boolean(process.env.ANTHROPIC_BASE_URL),
        nodeEnv: process.env.NODE_ENV,
      },
      status,
      message,
      upstreamBody,
      headers,
    });

    if (isDev) {
      return NextResponse.json(
        {
          ok: false,
          error: message,
          status,
          upstream: upstreamBody ?? null,
          debug: {
            requestURL,
            hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
            hasBaseURL: Boolean(process.env.ANTHROPIC_BASE_URL),
            nodeEnv: process.env.NODE_ENV,
          },
        },
        { status }
      );
    }

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
