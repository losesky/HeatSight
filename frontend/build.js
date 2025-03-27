// 构建React应用的脚本
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('开始构建React应用...');

try {
  // 运行React构建命令
  console.log('执行npm build...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('构建完成，检查build目录...');
  
  // 检查build目录是否存在
  const buildDir = path.join(__dirname, 'build');
  if (!fs.existsSync(buildDir)) {
    throw new Error('构建目录不存在，构建可能失败');
  }
  
  // 检查build目录中是否包含index.html和静态资源
  const indexHtmlPath = path.join(buildDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error('index.html文件不存在，构建可能不完整');
  }
  
  console.log('构建成功！');
  console.log('---------------------------------------------------');
  console.log('现在可以通过以下方式运行应用:');
  console.log('1. node simple-server.js - 使用Express服务器启动');
  console.log('2. npm start - 使用开发服务器启动（热重载）');
  console.log('---------------------------------------------------');
  console.log('生产部署:');
  console.log('将build目录中的文件部署到Web服务器');
  
} catch (error) {
  console.error('构建过程中出错:', error);
  process.exit(1);
} 