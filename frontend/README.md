# HeatSight 前端

## 项目概述

HeatSight 前端是一个React应用，提供热门话题分析和内容创作辅助功能。

## 开发指南

### 代码规范

1. **组件文件命名**：
   - 所有React组件文件统一使用 `.jsx` 后缀
   - 组件名使用大驼峰命名法（PascalCase），如 `ContentWorkshop.jsx`
   - 组件文件名应与导出的组件名一致

2. **组件目录结构**：
   - `src/pages` - 页面级组件，如 `Dashboard.jsx`、`ContentWorkshop.jsx`
   - `src/components` - 可复用UI组件，如 `Header.jsx`、`Footer.jsx`
   - `src/components/layouts` - 布局相关组件，如 `MainLayout.jsx`

### 环境变量配置

项目使用环境变量来配置不同环境下的API地址和其他设置：

1. `.env` - 默认环境变量，适用于所有环境
2. `.env.development` - 开发环境特定变量（会覆盖.env中的同名变量）
3. `.env.production` - 生产环境特定变量（会覆盖.env中的同名变量）

主要环境变量：

- `REACT_APP_API_BASE_URL` - API基础URL（开发: http://localhost:8080/api，生产: /api）
- `REACT_APP_API_TIMEOUT` - API请求超时时间，单位毫秒
- `REACT_APP_ENABLE_DEBUG_LOGS` - 是否启用API调试日志

部署到新环境时，可以通过修改这些环境变量文件或在构建/启动时提供环境变量来适配不同环境。

### API调用

所有对后端API的请求需要注意以下几点：

1. **使用完整URL**：为避免开发服务器的代理问题，请在API请求中使用完整的URL路径，例如：
   ```javascript
   // 推荐 - 使用完整URL
   axios.get('http://localhost:8080/api/topics/hot', { ... })
   
   // 不推荐 - 使用相对路径
   axios.get('/api/topics/hot', { ... })
   ```

2. **API文件组织**：
   - `src/api/api.jsx` - 统一的API抽象层，包含所有API请求函数
   - 可以使用两种方式导入API函数：
     ```javascript
     // 方式1：导入特定函数
     import { fetchHotTopics, fetchCategories } from '../api/api';
     
     // 方式2：导入API对象
     import api from '../api/api';
     // 然后使用 api.topics.getHotTopics() 或 api.content.generateContent()
     ```

3. **API架构**：
   - `topicsApi` - 与话题相关的API请求，如获取热门话题、话题分类等
   - `contentApi` - 与内容生成相关的API请求，如生成内容建议等
   - 所有API函数均支持标准错误处理

4. **API配置获取**：
   - 可以通过导入 `apiConfig` 来访问当前的API配置：
     ```javascript
     import { apiConfig } from '../api/api';
     console.log('当前API基础URL:', apiConfig.baseURL);
     ```

### 启动开发服务器

```bash
# 启动开发服务器
npm start

# 或使用项目提供的脚本
bash start-frontend.sh
```

## 目录结构

- `src/pages` - 主要页面组件（.jsx）
- `src/components` - 可复用的UI组件（.jsx）
- `src/utils` - 工具函数和辅助方法
- `src/api` - API调用抽象层（.jsx）
- `src/styles` - CSS和样式相关文件 