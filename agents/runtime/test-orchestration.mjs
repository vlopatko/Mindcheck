import dotenv from "dotenv";
dotenv.config({ path: ".env.local" })

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const orchestratorId =
  process.env.OPENAI_AGENT_ORCHESTRATOR_ID;

const juniorId =
  process.env.OPENAI_AGENT_JUNIOR_ID;

if (!orchestratorId || !juniorId) {
  throw new Error(
    "Missing OPENAI_AGENT_ORCHESTRATOR_ID or OPENAI_AGENT_JUNIOR_ID"
  );
}

console.log("Creating Orchestrator session...");

const events =
  await client.beta.agents.sessions.create({
    agent_id: orchestratorId,

    environment: {
      type: "none",
    },

    input: `
Classify the following development task.

TASK:
Find the Footer component and change the copyright year to 2027.

Do NOT modify any files.

Return ONLY this JSON:
{
  "developer": "JUNIOR" | "MIDDLE" | "SENIOR",
  "reason": "short reason"
}
`,

    stream: true,
  });

let output = "";

for await (const event of events) {
  if (event.type === "agent.session.turn.output_text.delta") {
    output += event.delta;
  }

  if (event.type === "agent.session.turn.completed") {
    console.log("\nORCHESTRATOR:");
    console.log(output);
  }
}