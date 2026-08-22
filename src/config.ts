import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export const config = {
  get youtubeApiKey(): string {
    return requireEnv("YOUTUBE_API_KEY");
  },
  get knowledgeBaseBucket(): string | undefined {
    return process.env.KNOWLEDGE_BASE_BUCKET || undefined;
  },
  get knowledgeBaseObject(): string {
    return process.env.KNOWLEDGE_BASE_OBJECT || "knowledge-base.json";
  },
  get googleCloudProject(): string | undefined {
    return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  },
  get googleCloudLocation(): string {
    return process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  },
  get vertexModel(): string {
    return process.env.VERTEX_AI_MODEL || "gemini-2.0-flash-001";
  },
};
