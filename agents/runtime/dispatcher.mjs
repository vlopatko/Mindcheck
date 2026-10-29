import dotenv from "dotenv";
import OpenAI from "openai";
import { spawn } from "node:child_process";

dotenv.config({ path: ".env.local", quiet: true });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ORCHESTRATOR_ID =
  process.env.OPENAI_AGENT_ORCHESTRATOR_ID;

const EXECUTOR_API_KEY =
  process.env.OPENAI_EXECUTOR_API_KEY;

const WORKSPACE = process.cwd();

const DEVELOPERS = {
  JUNIOR: {
    agentId: process.env.OPENAI_AGENT_JUNIOR_ID,
    label: "DEV-JUNIOR",
  },

  MIDDLE: {
    agentId: process.env.OPENAI_AGENT_MIDDLE_ID,
    label: "DEV-MIDDLE",
  },

  SENIOR: {
    agentId: process.env.OPENAI_AGENT_SENIOR_ID,
    label: "DEV-SENIOR",
  },
};

const REVIEWERS = {
  CODE_REVIEW: {
    agentId: process.env.OPENAI_AGENT_CODE_REVIEW_ID,
    label: "CODE-REVIEW",
  },

  SECURITY_REVIEW: {
    agentId: process.env.OPENAI_AGENT_SECURITY_REVIEW_ID,
    label: "SECURITY-REVIEW",
  },
};

for (const [type, reviewer] of Object.entries(REVIEWERS)) {
  if (!reviewer.agentId) {
    throw new Error(`Missing agent ID for ${type}`);
  }
};


// ============================================================
// Validate configuration
// ============================================================

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY");
}

if (!EXECUTOR_API_KEY) {
  throw new Error("Missing OPENAI_EXECUTOR_API_KEY");
}

if (!ORCHESTRATOR_ID) {
  throw new Error("Missing OPENAI_AGENT_ORCHESTRATOR_ID");
}

for (const [level, developer] of Object.entries(DEVELOPERS)) {
  if (!developer.agentId) {
    throw new Error(
      `Missing agent ID for ${level}`
    );
  }
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY");
}

if (!EXECUTOR_API_KEY) {
  throw new Error("Missing OPENAI_EXECUTOR_API_KEY");
}

// ============================================================
// Collect simple Agent output
// ============================================================

async function collectOutput(events) {
  let output = "";

  for await (const event of events) {
    if (
      event.type ===
      "agent.session.turn.output_text.delta"
    ) {
      output += event.delta;
    }
  }

  return output.trim();
}


// ============================================================
// ORCHESTRATOR
// ============================================================

async function classifyTask(task) {
  console.log("🧠 ORCHESTRATOR: classifying task...");

  const events =
    await client.beta.agents.sessions.create({
      agent_id: ORCHESTRATOR_ID,

      environment: {
        type: "none",
      },

      input: `
Classify this development task using only its description.

Do not solve the task.
Do not inspect the repository.
Do not use tools.

TASK:
${task}

Routing:
- JUNIOR: simple, localized, low-risk
- MIDDLE: non-trivial, multi-file, integration, debugging
- SENIOR: architecture/security/high-risk/deeply complex
`,

      stream: true,
    });

  const output = await collectOutput(events);

  try {
    // Сначала пробуем чистый JSON
    return JSON.parse(output);
  } catch {
    // Если модель добавила текст — извлекаем последний JSON object
    const match = output.match(
      /\{\s*"developer"\s*:\s*"(?:JUNIOR|MIDDLE|SENIOR)"[\s\S]*?\}/g
    );

    if (!match?.length) {
      throw new Error(
        `Orchestrator returned no valid routing JSON:\n${output}`
      );
    }

    const route = JSON.parse(match.at(-1));

    if (
      !["JUNIOR", "MIDDLE", "SENIOR"].includes(route.developer)
    ) {
      throw new Error(
        `Invalid developer returned: ${route.developer}`
      );
    }

    return route;
  }
}


// ============================================================
// EXECUTOR
// ============================================================

function startExecutor(remoteUrl, environmentId) {
  console.log("🔌 Starting local Codex executor...");

  let executor;

  if (process.platform === "win32") {
    executor = spawn(
      "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "codex",
        "exec-server",
        "--remote",
        remoteUrl,
        "--environment-id",
        environmentId,
      ],
      {
        cwd: WORKSPACE,

        env: {
          ...process.env,
          CODEX_API_KEY: EXECUTOR_API_KEY,
        },

        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }
    );
  } else {
    executor = spawn(
      "codex",
      [
        "exec-server",
        "--remote",
        remoteUrl,
        "--environment-id",
        environmentId,
      ],
      {
        cwd: WORKSPACE,

        env: {
          ...process.env,
          CODEX_API_KEY: EXECUTOR_API_KEY,
        },

        stdio: ["ignore", "pipe", "pipe"],
      }
    );
  }

  executor.stdout.on("data", (data) => {
    const text = data.toString().trim();

    if (
      text.includes("error") ||
      text.includes("Error")
    ) {
      console.log(`[executor] ${text}`);
    }
  });

  executor.stderr.on("data", (data) => {
    const text = data.toString().trim();

    if (text) {
      console.error(`[executor] ${text}`);
    }
  });

  executor.on("error", (error) => {
    console.error(
      "❌ Failed to start Codex executor:",
      error.message
    );
  });

  executor.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(
        `❌ Codex executor exited with code ${code}`
      );
    }
  });

  return executor;
}

function stopExecutor(executor) {
  if (!executor || executor.killed) {
    return;
  }

  console.log("🛑 Stopping local executor...");

  if (process.platform === "win32") {
    const killer = spawn(
      "taskkill",
      [
        "/PID",
        String(executor.pid),
        "/T",
        "/F",
      ],
      {
        stdio: "ignore",
        windowsHide: true,
      }
    );

    return new Promise((resolve) => {
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
  }

  executor.kill("SIGTERM");

  return new Promise((resolve) => {
    executor.once("exit", resolve);

    setTimeout(() => {
      if (!executor.killed) {
        executor.kill("SIGKILL");
      }

      resolve();
    }, 2000);
  });
}


// ============================================================
// DEV-JUNIOR
// ============================================================

async function runDeveloper(level, task) {
  const developer = DEVELOPERS[level];

  if (!developer) {
    throw new Error(`Unknown developer level: ${level}`);
  }

  console.log(`👨‍💻 ${developer.label}: creating session...`);

  const events = await client.beta.agents.sessions.create({
    agent_id: developer.agentId,

    environment: {
      type: "self_hosted",
      workspace_directory: WORKSPACE,
    },

    input: `
TASK:
${task}

Work only within the scope of this task.

Follow your saved agent instructions and team policy.

Return a concise result containing:
- status
- files inspected/changed
- verification performed
- blockers or risks
`,

    stream: true,
  });

  let output = "";
  let executor = null;
  let executorStarted = false;
  let environmentConnected = false;

  try {
    for await (const event of events) {

      if (event.type === "agent.session.created") {
        const session = event.session;
        const environment = session.environment;

        console.log(`   Session: ${session.id}`);
        console.log(`   Environment: ${environment.id}`);

        if (environment.remote_url && !executorStarted) {
          executorStarted = true;

          executor = startExecutor(
            environment.remote_url,
            environment.id
          );
        }

        continue;
      }

      if (
        event.type === "agent.session.environment.connected"
      ) {
        if (!environmentConnected) {
          environmentConnected = true;

          console.log("✅ Local environment connected.");
          console.log(`👨‍💻 ${developer.label}: working...`);
        }
        continue;
      }

      if (
        event.type ===
        "agent.session.turn.output_text.delta"
      ) {
        output += event.delta;
        continue;
      }

      if (
        event.type ===
        "agent.session.turn.completed"
      ) {
        console.log(`✅ ${developer.label} completed.`);
        continue;
      }

      if (
        event.type ===
        "agent.session.environment.failed"
      ) {
        throw new Error(
          `${developer.label} environment failed`
        );
      }

      if (
        event.type ===
        "agent.session.turn.failed"
      ) {
        throw new Error(
          `${developer.label} turn failed`
        );
      }
    }

    return output.trim();

  } finally {
    await stopExecutor(executor);
  }
}

async function runReviewer(type, reviewPacket) {
  const reviewer = REVIEWERS[type];

  if (!reviewer) {
    throw new Error(`Unknown reviewer: ${type}`);
  }

  console.log(`🔎 ${reviewer.label}: creating session...`);

  const events = await client.beta.agents.sessions.create({
    agent_id: reviewer.agentId,

    environment: {
      type: "self_hosted",
      workspace_directory: WORKSPACE,
    },

    input: `
Review the completed development task.

You are a reviewer only.

DO NOT:
- modify files
- apply patches
- implement fixes
- run unrelated tests
- expand the scope

ORIGINAL TASK:
${reviewPacket.task}

DEVELOPER:
${reviewPacket.developer}

DEVELOPER RESULT:
${reviewPacket.developerResult}

Review the current repository state and the git diff relevant to this task.

Return your review using your configured response schema.
`,

    stream: true,
  });

  let output = "";
  let executor = null;
  let executorStarted = false;
  let environmentConnected = false;

  try {
    for await (const event of events) {
      if (event.type === "agent.session.created") {
        const session = event.session;
        const environment = session.environment;

        console.log(`   Session: ${session.id}`);

        if (
          environment.remote_url &&
          !executorStarted
        ) {
          executorStarted = true;

          executor = startExecutor(
            environment.remote_url,
            environment.id
          );
        }

        continue;
      }

      if (
        event.type ===
        "agent.session.environment.connected" &&
        !environmentConnected
      ) {
        environmentConnected = true;

        console.log(
          `🔎 ${reviewer.label}: reviewing...`
        );

        continue;
      }

      if (
        event.type ===
        "agent.session.turn.output_text.delta"
      ) {
        output += event.delta;
        continue;
      }

      if (
        event.type ===
        "agent.session.turn.completed"
      ) {
        console.log(
          `✅ ${reviewer.label} completed.`
        );

        continue;
      }

      if (
        event.type === "agent.session.turn.failed" ||
        event.type ===
        "agent.session.environment.failed"
      ) {
        throw new Error(`${reviewer.label} failed`);
      }
    }

    return JSON.parse(output.trim());
  } finally {
    await stopExecutor(executor);
  }
}


// ============================================================
// MAIN
// ============================================================

async function main() {
  const task =
    process.argv.slice(2).join(" ").trim();

  if (!task) {
    console.error(
      'Usage: pnpm agents:run "your task"'
    );

    process.exit(1);
  }

  console.log();
  console.log(
    "════════════════════════════════"
  );
  console.log(
    "       AI DEVELOPMENT TEAM"
  );
  console.log(
    "════════════════════════════════"
  );
  console.log();

  console.log(`📁 ${WORKSPACE}`);
  console.log(`📋 ${task}`);
  console.log();


  // ----------------------------------------------------------
  // Route task
  // ----------------------------------------------------------

  const route =
    await classifyTask(task);

  console.log();

  console.log(
    `➡️  Assigned: ${route.developer}`
  );

  console.log(
    `   Reason: ${route.reason}`
  );

  console.log();


  // ----------------------------------------------------------
  // Developer
  // ----------------------------------------------------------

  const developer = DEVELOPERS[route.developer];

  if (!developer) {
    throw new Error(
      `ORCHESTRATOR returned unknown developer: ${route.developer}`
    );
  }

  const result = await runDeveloper(
    route.developer,
    task
  );

  console.log();
  console.log("════════════════════════════════");
  console.log(`       ${developer.label} RESULT`);
  console.log("════════════════════════════════");
  console.log();

  console.log(result || "(no text output)");

  const reviewPacket = {
    task,
    developer: developer.label,
    developerResult: result,
  };

  console.log();
  console.log("──────────── REVIEWS ────────────");
  console.log();

  const codeReview = await runReviewer(
    "CODE_REVIEW",
    reviewPacket
  );

  const securityReview = await runReviewer(
    "SECURITY_REVIEW",
    reviewPacket
  );

  console.log();
  console.log("════════════════════════════════");
  console.log("          REVIEW RESULT");
  console.log("════════════════════════════════");

  console.log(
    `Code Review:     ${codeReview.status}`
  );

  console.log(
    `Security Review: ${securityReview.status}`
  );
}

// const reviewPassed =
//   codeReview.status === "PASS" &&
//   securityReview.status === "PASS";

//   if (reviewPassed) {
//     console.log();
//     console.log("✅ ALL REVIEWS PASSED");
//     return;
//   }



main().catch((error) => {
  console.error();
  console.error(
    "❌ AI TEAM ERROR:"
  );
  console.error(error);
  process.exit(1);
});