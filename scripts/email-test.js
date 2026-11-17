const { spawnSync } = require('child_process');

const args = process.argv.slice(2).filter(a => a !== '--');
const execArgs = args.length > 0 ? `"-Dexec.args=${args.join(' ')}"` : '';

const mvnCmd = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
const fullArgs = [
  '-pl', 'backend',
  'exec:java',
  '-Dexec.mainClass=com.red404.service.EmailTestSender',
  '-Dexec.classpathScope=test'
];

if (execArgs) {
  fullArgs.push(execArgs);
}

const result = spawnSync(mvnCmd, fullArgs, { stdio: 'inherit', shell: true });
process.exit(result.status || 0);
