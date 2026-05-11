import fs from 'fs';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_CLIENT = 'sqlite';

  const testDb = path.resolve('.tmp/test.db');
  if (fs.existsSync(testDb)) {
    fs.unlinkSync(testDb);
  }
}
