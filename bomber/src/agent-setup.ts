import { createForestAgentClient } from "@forestadmin-experimental/agent-nodejs-testing";
import dotenv from "dotenv";

dotenv.config({ quiet: true });


export const AGENT_PORT = process.env.AGENT_PORT as unknown as number || 3000;
export const SERVER_SANDBOX_PORT = process.env.SERVER_SANDBOX_PORT as unknown as number || 3311;

export function mountAgentClient() {
  return createForestAgentClient({
    agentForestEnvSecret: process.env.FOREST_ENV_SECRET as string,
    agentForestAuthSecret: process.env.FOREST_AUTH_SECRET as string,
    agentSchemaPath: "../.forestadmin-schema.json",
    agentUrl: `http://127.0.0.1:${AGENT_PORT}`,
    serverUrl: `http://127.0.0.1:${SERVER_SANDBOX_PORT}`,
  });
}
