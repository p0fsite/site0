import { config, higgsfield } from "@higgsfield/client/v2";

const credentials = process.env.HF_CREDENTIALS;
if (!credentials || !/^[^:]+:[^:]+$/.test(credentials)) {
  console.error("HF_CREDENTIALS must be set in .env.local as key-id:key-secret.");
  process.exit(1);
}

config({
  credentials,
  maxPollTime: 15 * 60 * 1000,
});

const stopped = new Set(["failed", "canceled", "cancelled", "moderated", "nsfw"]);

try {
  const result = await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
    },
    withPolling: true,
  });

  if (result.status === "completed" && result.video?.url) {
    console.log(result.video.url);
    process.exit(0);
  }

  const status = result.status || "unknown";
  if (stopped.has(status) || status !== "completed") {
    console.error(`The generation did not succeed (${status}).`);
    process.exit(1);
  }

  console.error("The generation completed without a video URL.");
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : "The generation request failed.";
  console.error(message.replace(/[^\s:]{6,}:[^\s:]{6,}/g, "[redacted]"));
  process.exit(1);
}
