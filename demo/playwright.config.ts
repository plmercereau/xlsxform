import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	timeout: 30_000,
	use: {
		baseURL: "http://localhost:4173",
	},
	webServer: {
		command: "pnpm run preview --port 4173",
		port: 4173,
		reuseExistingServer: !process.env.CI,
	},
	projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
