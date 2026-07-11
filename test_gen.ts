import { runQuizGeneration, runLearningPathGeneration } from './apps/api/src/workers/ai-content.worker'
import { db } from './apps/api/src/config/db'

async function test() {
  const uni = await db('universities').first()
  if (!uni) {
    console.log('No university found')
    process.exit(1)
  }
  
  console.log('Testing quiz generation for uni:', uni.id)
  await runQuizGeneration(uni.id)
  console.log('Done quiz gen')
  
  console.log('Testing path generation for uni:', uni.id)
  await runLearningPathGeneration(new Date(), uni.id)
  console.log('Done path gen')
  
  process.exit(0)
}

test().catch(console.error)
