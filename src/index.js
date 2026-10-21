import { createApp } from "./app.js";

const env = process.env;
const port = Number(env.PORT || 4000);
const host = env.HOST || undefined;

const { app } = createApp({
  delayMs: Number(env.MOCK_DELAY_MS || 0),
  frontendUrl: env.FRONTEND_URL || "http://localhost:5173",
  adminApiKey: env.ADMIN_API_KEY || "mock-admin-key",
});

const ready = () => {
  console.log(`Soulinspire Mock API on http://${host ?? "localhost"}:${port}/api (dummy data, in memory)`);
  console.log(`Admin key: ${env.ADMIN_API_KEY ? "(from ADMIN_API_KEY)" : "mock-admin-key"}`);
};
host ? app.listen(port, host, ready) : app.listen(port, ready);
