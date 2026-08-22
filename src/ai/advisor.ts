import { VertexAI } from "@google-cloud/vertexai";
import { config } from "../config.js";
import { EventProfile, DjGamePlan } from "../events/schema.js";

export async function generateAiGuidance(
  profile: EventProfile,
  gamePlan: DjGamePlan
): Promise<string | null> {
  if (!config.googleCloudProject) return null;

  const vertex = new VertexAI({
    project: config.googleCloudProject,
    location: config.googleCloudLocation,
  });
  const model = vertex.getGenerativeModel({ model: config.vertexModel });
  const prompt = [
    "You are a friendly event-planning assistant for customers.",
    "Give practical, warm guidance in simple language.",
    "Use only the customer's stated details. Do not stereotype based on culture or age.",
    "Do not invent vendors, prices, venues, or song requests.",
    "Return 5 to 8 short numbered suggestions covering schedule, music moments, and next decisions.",
    "Customer event profile:",
    JSON.stringify(profile),
    "Current generated music plan:",
    JSON.stringify(gamePlan),
  ].join("\n");

  const result = await model.generateContent(prompt);
  return result.response.candidates?.[0]?.content?.parts
    ?.map((part) => ("text" in part ? part.text : ""))
    .join("")
    .trim() || null;
}
