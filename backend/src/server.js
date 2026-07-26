import app from "./app.js";
import { config, aiEnabled } from "./config/env.js";
import { connectDB } from "./config/db.js";

async function start() {
  await connectDB();

  app.listen(config.port, () => {
    console.log(
      `[DataInsight AI] Node backend listening on port ${config.port}`
    );

    console.log(
      `[DataInsight AI] AI mode: ${
        aiEnabled() ? "OpenAI-enhanced" : "local only"
      }`
    );
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});