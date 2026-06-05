import { flushSync } from "react-dom";

export async function streamImage(
  endpoint: string,
  body: Record<string, unknown>,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
  headers: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`Image gen failed: ${res.status} ${await res.text().catch(() => "")}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finalDataUrl = "";
  let lastDataUrl = "";
  let sawFinal = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const ev of events) {
        const lines = ev.split("\n");
        let eventName = "";
        let dataLine = "";
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
        }
        if (!dataLine) continue;
        if (
          eventName !== "image_generation.partial_image" &&
          eventName !== "image_generation.completed"
        )
          continue;
        try {
          const payload = JSON.parse(dataLine) as { b64_json?: string };
          if (!payload.b64_json) continue;
          const dataUrl = `data:image/png;base64,${payload.b64_json}`;
          const isFinal = eventName === "image_generation.completed";
          lastDataUrl = dataUrl;
          flushSync(() => onFrame(dataUrl, isFinal));
          if (isFinal) {
            finalDataUrl = dataUrl;
            sawFinal = true;
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error) {
    if (!lastDataUrl) throw error;
  }
  if (!sawFinal && lastDataUrl) {
    flushSync(() => onFrame(lastDataUrl, true));
    return lastDataUrl;
  }
  if (!sawFinal) throw new Error("Image stream ended without completion");
  return finalDataUrl;
}
