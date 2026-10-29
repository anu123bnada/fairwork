import original from "./playwright.config";
export default { ...original, workers: 1, reporter: process.env.GITHUB_ACTIONS ? [["line"], ["github"]] : "line", // failures become annotations that are readable without signing in to read the job log
   use: { ...original.use, baseURL: "http://localhost:3101" }, webServer: undefined, outputDir: "test-results/day2-e2e" };
