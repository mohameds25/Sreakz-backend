import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Steakz API running on http://localhost:${env.port}`);
});
