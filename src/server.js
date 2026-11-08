import { createApp } from './http/app.js';
import { config } from './config.js';
import { createDatabase } from './db/connection.js';
import { createSqliteRepository } from './repositories/sqlite.js';

const repository = createSqliteRepository(createDatabase());
const server = createApp({ repository });
server.listen(config.port, () => {
  const address = server.address();
  console.log(`Event ticketing server listening on port ${typeof address === 'object' ? address.port : config.port}`);
});
