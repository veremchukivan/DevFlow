import { healthResponseSchema, type HealthResponse } from "@devflow/shared";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getApiHealth(): Promise<HealthResponse> {
  try {
    const response = await fetch(`${apiUrl}/healthz`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`API health request failed with ${response.status}`);
    }

    return healthResponseSchema.parse(await response.json());
  } catch {
    return {
      service: "devflow-api",
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }
}

