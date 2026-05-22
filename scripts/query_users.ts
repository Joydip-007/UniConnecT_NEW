import { db } from './apps/api/src/config/db';
async function run() {
  const users = await db('users').select('*');
  console.log('USERS:', users);
  const unis = await db('universities').select('id', 'domain');
  console.log('UNIS:', unis);
  process.exit(0);
}
run();
