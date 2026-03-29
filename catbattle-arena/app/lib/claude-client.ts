export async function askClaude(prompt: string): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Claude request failed");
  }

  return String(data.text || "");
}

