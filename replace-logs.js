const fs = require('fs');
const path = require('path');

const files = [
  'src/services/taskService.js',
  'src/services/queueService.js',
  'src/services/cacheService.js',
  'src/middlewares/rateLimiter.js',
  'src/middlewares/errorHandler.js',
  'src/config/redis.js',
  'src/config/database.js',
  'worker/index.js',
  'server.js'
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Determine relative path back to root src/utils/logger
  // src/config/database.js -> depth 2 -> ../../utils/logger
  // worker/index.js -> depth 1 -> ../src/utils/logger
  // server.js -> depth 0 -> ./src/utils/logger
  let loggerPath = '';
  if (file === 'server.js') loggerPath = './src/utils/logger';
  else if (file.startsWith('worker/')) loggerPath = '../src/utils/logger';
  else if (file.startsWith('src/')) {
      const depth = file.split('/').length - 2; // src is depth 0
      loggerPath = depth === 0 ? './utils/logger' : '../'.repeat(depth) + 'utils/logger';
  }
  
  // Add require if not exists and there is a console call
  if ((content.includes('console.log') || content.includes('console.error') || content.includes('console.warn')) && !content.includes("require('../utils/logger')") && !content.includes("require('./utils/logger')") && !content.includes("require('../src/utils/logger')")) {
      content = `const logger = require('${loggerPath}');\n` + content;
  }
  
  content = content.replace(/console\.log/g, 'logger.info');
  content = content.replace(/console\.error/g, 'logger.error');
  content = content.replace(/console\.warn/g, 'logger.warn');
  
  fs.writeFileSync(fullPath, content);
});
console.log('Successfully replaced standard console traces with struct-level Pino handlers!');
