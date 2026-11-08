/**
 * Lazy-initialized Vertex AI Gemini client adapter for the MarombApp BFF.
 * Keeps SDK instantiation out of module import paths so health checks and
 * rejected unauthenticated requests never construct or call Vertex AI.
 */

import { GoogleGenAI } from '@google/genai';
import { getServerConfig } from '../config.js';

export interface VertexRuntimeConfig {
  project: string;
  location: string;
  model: string;
}

let cachedVertexClient: GoogleGenAI | null = null;
let cachedProject = '';
let cachedLocation = '';

/**
 * Reads Vertex AI configuration values without instantiating the SDK client.
 */
export function getVertexConfig(env: NodeJS.ProcessEnv = process.env): VertexRuntimeConfig {
  const config = getServerConfig(env);
  return {
    project: config.googleCloudProject,
    location: config.googleCloudLocation,
    model: config.vertexGeminiModel,
  };
}

/**
 * Reports whether Vertex AI project and location settings are present.
 * Never performs network I/O or constructs a GoogleGenAI instance.
 */
export function isVertexAiReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const { project, location } = getVertexConfig(env);
  return Boolean(project && location);
}

/**
 * Returns the shared Vertex AI GoogleGenAI client instance.
 * If GOOGLE_CLOUD_PROJECT is missing, throws a configuration error before SDK calls.
 */
export function getVertexClient(env: NodeJS.ProcessEnv = process.env): GoogleGenAI {
  const { project, location } = getVertexConfig(env);
  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required to initialize Vertex AI client');
  }
  const resolvedLocation = location || 'global';
  if (!cachedVertexClient || cachedProject !== project || cachedLocation !== resolvedLocation) {
    cachedVertexClient = new GoogleGenAI({
      vertexai: true,
      project,
      location: resolvedLocation,
    });
    cachedProject = project;
    cachedLocation = resolvedLocation;
  }
  return cachedVertexClient;
}

/**
 * Clears the cached Vertex AI client between unit tests.
 */
export function resetVertexClientForTesting(): void {
  cachedVertexClient = null;
  cachedProject = '';
  cachedLocation = '';
}
