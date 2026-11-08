/**
 * Runtime configuration reader for the MarombApp Cloud Run BFF.
 * Reads environment variables lazily on each request so tests and Cloud Run
 * revisions observe current configuration without module reloads.
 */

export interface BffRuntimeConfig {
  port: number;
  revision: string;
  firestoreDatabase: string;
  allowedUid: string;
  googleCloudProject: string;
  googleCloudLocation: string;
  vertexGeminiModel: string;
}

/**
 * Resolves current BFF runtime settings from the provided environment map.
 * When optional variables are unset, returns safe defaults while keeping
 * ALLOWED_UID empty so authentication fails closed.
 */
export function getServerConfig(env: NodeJS.ProcessEnv = process.env): BffRuntimeConfig {
  const rawPort = Number(env.PORT);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 8080;
  const revision = (env.K_REVISION ?? '').trim() || 'local';
  const firestoreDatabase = (env.FIRESTORE_DATABASE_ID ?? '').trim() || '(default)';
  const allowedUid = (env.ALLOWED_UID ?? '').trim();
  const googleCloudProject = (env.GOOGLE_CLOUD_PROJECT ?? '').trim();
  const googleCloudLocation = (env.GOOGLE_CLOUD_LOCATION ?? 'global').trim();
  const vertexGeminiModel = (env.VERTEX_GEMINI_MODEL ?? 'gemini-3.8-flash').trim();

  return {
    port,
    revision,
    firestoreDatabase,
    allowedUid,
    googleCloudProject,
    googleCloudLocation,
    vertexGeminiModel,
  };
}
