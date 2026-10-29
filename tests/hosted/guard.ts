// Safety rails shared by every hosted test: staging or loopback only, never the production host, credentials only from the environment.
const allowed = [/^https:\/\/oryqen-staging\.vercel\.app$/, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/];
export function assertSafeOrigin(origin: string) {
  if (!allowed.some(rule => rule.test(origin))) throw new Error(`Refusing to run authenticated tests against ${origin}: only the staging origin or a loopback origin is allowed.`);
}
export const writesAllowed = () => process.env.ORYQEN_HOSTED_WRITES === "1";
export function credentials() {
  const email = process.env.ORYQEN_TEST_EMAIL, password = process.env.ORYQEN_TEST_PASSWORD;
  if (!email || !password) throw new Error("ORYQEN_TEST_EMAIL and ORYQEN_TEST_PASSWORD are not set. Use scripts/run-hosted-browser-journeys.mjs, which prompts for them.");
  return { email, password };
}
