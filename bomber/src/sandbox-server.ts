import { createForestServerSandbox } from "@forestadmin-experimental/agent-nodejs-testing";
import {SERVER_SANDBOX_PORT} from "./agent-setup";

createForestServerSandbox(SERVER_SANDBOX_PORT);
