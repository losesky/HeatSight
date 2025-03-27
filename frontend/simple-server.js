// 使用Express创建一个简单的服务器来托管React应用
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

// 如果没有express，需要先安装 npm install express
try {
  require.resolve('express');
} catch (e) {
  console.error('Express未安装，请先运行: npm install express');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_PORT = 8080;
const BACKEND_HOST = 'localhost';
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

// 确保public目录存在（用于放置静态资源）
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

// 为开发模式设置静态文件路径
// 在生产模式下，这会指向build文件夹
const staticPaths = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'build')
];

// 注册静态文件目录
staticPaths.forEach(dirPath => {
  if (fs.existsSync(dirPath)) {
    app.use(express.static(dirPath));
  }
});

// 添加API代理功能，转发到后端API
app.use('/api', createProxyMiddleware({ 
  target: BACKEND_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // 保持路径不变
  },
  logLevel: 'warn'
}));

// 确保index.html文件存在，用于单页应用
const indexHtmlPath = path.join(__dirname, 'public', 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  // 尝试从build目录找index.html
  const buildIndexPath = path.join(__dirname, 'build', 'index.html');
  if (fs.existsSync(buildIndexPath)) {
    console.log('使用build目录中的index.html');
    // 不需要复制，因为我们已经添加了build为静态目录
  } else {
    // 创建一个基础的index.html
    const indexHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HeatSight - 热点追踪与内容创作助手</title>
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <link rel="stylesheet" href="/static/css/main.css">
</head>
<body>
  <div id="root"></div>
  <script src="/static/js/main.js"></script>
</body>
</html>
    `.trim();
    fs.writeFileSync(indexHtmlPath, indexHtml);
    console.log('已创建基本的index.html文件');
  }
}

// 所有其他请求路由到React应用（支持客户端路由）
app.get('*', (req, res, next) => {
  // 如果是API请求或静态资源请求，继续下一个中间件
  if (req.url.startsWith('/api') || 
      req.url.includes('.') ||  // 包含扩展名的请求（css, js, png等）
      req.url.startsWith('/static')) {
    return next();
  }
  
  // 发送index.html以支持React Router
  const htmlFile = fs.existsSync(path.join(__dirname, 'build', 'index.html')) 
    ? path.join(__dirname, 'build', 'index.html')
    : indexHtmlPath;
    
  res.sendFile(htmlFile);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
===================================================
🚀 HeatSight前端服务已启动!
---------------------------------------------------
📌 本地访问: http://localhost:${PORT}
📌 单页应用模式已启用，所有路由将由React Router处理
📌 API代理: http://localhost:${PORT}/api -> ${BACKEND_URL}/api
---------------------------------------------------
ℹ️ 前端开发服务器就绪
===================================================
  `);
}); 