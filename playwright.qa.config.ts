import original from "./playwright.config";
export default { ...original, workers: 1, use: { ...original.use, baseURL: "http://localhost:3111" }, webServer: undefined, outputDir: "test-results/day2-e2e" };
