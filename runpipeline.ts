import { runEvaluation } from './src/lib/ai';
import { runAutoPost } from './src/lib/autoPost';

async function main() {
  console.log('Running evaluation...');
  const evalResult = await runEvaluation('69a18802988740711e11d349');
  console.log('Eval result:', JSON.stringify(evalResult, null, 2));
  console.log('\nRunning autoPost...');
  const postResult = await runAutoPost('69a18802988740711e11d349');
  console.log('Post result:', JSON.stringify(postResult, null, 2));
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
