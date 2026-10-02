export async function getHealth() {
  const r = await fetch("/health");
  if (!r.ok) throw new Error("health");
  return r.json() as Promise<{ status: string; ws_clients: number; db_ok: boolean; ticks: number }>;
}

export async function getConfig() {
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error("config");
  return r.json();
}

export async function putConfig(patch: Record<string, unknown>) {
  const r = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("config-put");
  return r.json();
}

export async function getHistoryEvents(hours = 24) {
  const r = await fetch(`/api/history/events?hours=${hours}`);
  if (!r.ok) throw new Error("history");
  return r.json() as Promise<{ hours: number; items: { id: string; ts: number; level: string; text: string; detail?: string }[] }>;
}

export async function getHistorySnapshots(hours = 24) {
  const r = await fetch(`/api/history/snapshots?hours=${hours}`);
  if (!r.ok) throw new Error("snapshots");
  return r.json() as Promise<{
    hours: number;
    items: { ts: number; trains: number; delays: number; load_avg: number; wagons: number }[];
  }>;
}

export async function graphql(query: string, variables?: Record<string, unknown>) {
  const r = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

export function openSimSocket() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return new WebSocket(`${proto}://${location.host}/ws`);
}
