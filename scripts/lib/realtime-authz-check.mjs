// Authorization checks for the proposed per-user Realtime channels (batch 7, section C). Pure logic over injected clients so it can be unit-tested; the runner
// (scripts/verify-hosted-realtime.mjs) supplies real Supabase clients for two dedicated test accounts. Nothing here publishes data or touches records.
export const TOPIC = uid => `user:${uid}`;

export function joinStatus(client, topic, timeoutMs = 8000) {
  return new Promise(resolve => {
    let done = false;
    const channel = client.channel(topic, { config: { private: true } });
    const finish = status => { if (done) return; done = true; Promise.resolve(client.removeChannel(channel)).catch(() => undefined).finally(() => resolve(status)); };
    const timer = setTimeout(() => finish("TIMED_OUT"), timeoutMs);
    channel.subscribe(status => { if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) { clearTimeout(timer); finish(status); } });
  });
}

export async function publishResult(client, topic, timeoutMs = 8000) {
  return new Promise(resolve => {
    let done = false;
    const channel = client.channel(topic, { config: { private: true } });
    const finish = value => { if (done) return; done = true; Promise.resolve(client.removeChannel(channel)).catch(() => undefined).finally(() => resolve(value)); };
    const timer = setTimeout(() => finish("not_subscribed"), timeoutMs);
    channel.subscribe(async status => {
      if (status !== "SUBSCRIBED") { if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) { clearTimeout(timer); finish("not_subscribed"); } return; }
      clearTimeout(timer);
      try { finish(await channel.send({ type: "broadcast", event: "changed", payload: { area: "work" } })); } catch { finish("error"); }
    });
  });
}

// Returns [{ name, pass, detail }]. `a` and `b` are { client, uid } for two distinct signed-in test accounts; `anonymous` is a client with no session.
export async function checkRealtimeAuthorization({ a, b, anonymous, timeoutMs = 8000 }) {
  if (!a?.uid || !b?.uid || a.uid === b.uid) throw new Error("Two distinct test accounts are required.");
  const results = [];
  const expect = async (name, run, pass) => { const value = await run(); results.push({ name, pass: pass(value), detail: String(value) }); };
  const joined = v => v === "SUBSCRIBED", refused = v => v !== "SUBSCRIBED";
  await expect("A can join A's own channel", () => joinStatus(a.client, TOPIC(a.uid), timeoutMs), joined);
  await expect("B can join B's own channel", () => joinStatus(b.client, TOPIC(b.uid), timeoutMs), joined);
  await expect("B cannot join A's channel", () => joinStatus(b.client, TOPIC(a.uid), timeoutMs), refused);
  await expect("A cannot join B's channel", () => joinStatus(a.client, TOPIC(b.uid), timeoutMs), refused);
  for (const topic of ["user:*", "user:", "user:%", "user", "realtime:user:" + a.uid]) await expect(`A cannot join "${topic}"`, () => joinStatus(a.client, topic, timeoutMs), refused);
  await expect("An account with no session cannot join A's channel", () => joinStatus(anonymous, TOPIC(a.uid), timeoutMs), refused);
  await expect("A cannot publish on its own channel", () => publishResult(a.client, TOPIC(a.uid), timeoutMs), v => v !== "ok");
  return results;
}

// Payload privacy for anything received while listening: exactly { area } from the allowed list, nothing else.
export const AREAS = ["notifications", "offers", "agreements", "work", "cases", "passport"];
export function payloadViolations(messages) {
  return messages.filter(m => !m || typeof m !== "object" || Object.keys(m).length !== 1 || !AREAS.includes(m.area));
}
