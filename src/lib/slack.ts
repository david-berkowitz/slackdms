import crypto from "crypto";

const slackBaseUrl = "https://slack.com/api";

export function verifySlackSignature({
  signingSecret,
  timestamp,
  signature,
  rawBody,
}: {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
}) {
  if (!timestamp || !signature) {
    return false;
  }

  const fiveMinutes = 60 * 5;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > fiveMinutes) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(sigBaseString, "utf8")
    .digest("hex");
  const computed = `v0=${hmac}`;

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  );
}

export async function slackApi<T>({
  token,
  method,
  body,
}: {
  token?: string;
  method: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${slackBaseUrl}/${method}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T;
  return data;
}

export async function slackGet<T>({
  token,
  method,
  params,
}: {
  token: string;
  method: string;
  params?: Record<string, string>;
}): Promise<T> {
  const url = new URL(`${slackBaseUrl}/${method}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return (await res.json()) as T;
}
