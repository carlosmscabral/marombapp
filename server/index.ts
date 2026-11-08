/**
 * Cloud Run HTTP server entrypoint for MarombApp (`marombapp-serving`).
 * Binds 0.0.0.0 on PORT (default 8080) and handles graceful container shutdown.
 */

import { createBffServer } from './app.js';
import { getServerConfig } from './config.js';

const { port } = getServerConfig();
const server = createBffServer();

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`marombapp-serving listening on http://0.0.0.0:${port}\n`);
});

/**
 * Closes the active HTTP listener when Cloud Run sends a termination signal.
 */
function shutdown(signal: string): void {
  process.stdout.write(`Received ${signal}, shutting down HTTP server\n`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
