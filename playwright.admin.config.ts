import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"tests/admin-browser",testMatch:"*.spec.ts",workers:1,outputDir:"test-results/admin-browser",use:{baseURL:"http://127.0.0.1:3113",trace:"retain-on-failure"}});
