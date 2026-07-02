# 旅游小镇微信小程序 - 后端运行指南

## 📋 目录
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [运行服务](#运行服务)
- [测试接口](#测试接口)
- [常见问题](#常见问题)

---

## 🔧 环境要求

### 必需环境
- **Node.js**: >= 14.x (推荐 16.x 或 18.x)
- **MySQL**: >= 8.0
- **npm**: >= 6.x

### 可选环境
- **Redis**: >= 6.x (用于缓存，可选)

### 检查环境版本
```bash
# 检查 Node.js 版本
node -v

# 检查 npm 版本
npm -v

# 检查 MySQL 版本
mysql --version

# 检查 Redis 版本（可选）
redis-cli --version
```

---

## 🚀 快速开始

### 步骤 1: 安装依赖

```bash
# 进入后端目录
cd backend

# 安装项目依赖
npm install
```

### 步骤 2: 配置数据库

#### 2.1 创建数据库
```bash
# 登录 MySQL
mysql -u root -p

# 在 MySQL 命令行中执行
CREATE DATABASE tourist_town CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 退出 MySQL
EXIT;
```

#### 2.2 修改数据库配置

编辑 `config/config.default.js` 文件，修改以下配置：

```javascript
config.sequelize = {
  dialect: 'mysql',
  host: 'localhost',        // MySQL 主机地址
  port: 3306,              // MySQL 端口
  database: 'tourist_town', // 数据库名称
  username: 'root',        // 数据库用户名
  password: 'root',        // 数据库密码（请修改为你的密码）
  timezone: '+08:00',
  // ... 其他配置
};
```

### 步骤 3: 初始化数据库

```bash
# 导入数据库结构和初始数据
mysql -u root -p tourist_town < database.sql

# 或者使用 MySQL 客户端工具（如 Navicat、MySQL Workbench）导入 database.sql 文件
```

### 步骤 4: 启动服务

```bash
# 开发模式启动（支持热重载）
npm run dev

# 或者生产模式启动
npm start
```

服务将在 `http://localhost:7001` 启动

### 步骤 5: 验证服务

访问 `http://localhost:7001`，如果看到以下内容说明启动成功：

```json
{
  "message": "Tourist Town API is running!",
  "version": "1.0.0"
}
```

---

## ⚙️ 详细配置

### 1. 数据库配置

推荐通过环境变量配置数据库连接信息，在 `.env` 文件中设置：

```bash
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=tourist_town
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

`config/config.default.js` 中会从上述环境变量读取配置，未配置时使用开发环境默认值。

### 2. Redis 配置（可选）

如果需要使用 Redis 缓存功能：

#### 2.1 安装 Redis
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# 下载并安装 Redis for Windows
# https://github.com/microsoftarchive/redis/releases
```

#### 2.2 验证 Redis 运行
```bash
redis-cli ping
# 应该返回：PONG
```

#### 2.3 配置 Redis 连接

在 `config/config.default.js` 中：

```javascript
config.redis = {
  client: {
    port: 6379,
    host: '127.0.0.1',
    password: '',  // 如果设置了密码，填写密码
    db: 0,
  },
};
```

### 3. 微信小程序配置

在 `.env` 文件中配置你的小程序信息，`config/config.default.js` 会从环境变量读取：

```bash
WECHAT_APP_ID=your_app_id       # 你的小程序 AppID
WECHAT_APP_SECRET=your_app_secret  # 你的小程序 AppSecret
```

### 4. 物流轨迹说明（演示版）

本项目的订单物流轨迹在演示环境下为**本地生成的模拟数据**，用于展示“商家发货 → 用户收货”的物流时间轴效果，不依赖第三方快递查询服务或真实运单号。

### 5. JWT 配置

JWT 用于用户认证，建议在 `.env` 中配置密钥，`config/config.default.js` 会从环境变量读取：

```bash
JWT_SECRET=your_strong_jwt_secret   # 请使用足够复杂的随机字符串
```

未设置时，系统仅在开发环境使用内置的 `dev_only_jwt_secret`。

---

## 🔒 接口响应规范与安全注意事项

### 1. 接口响应格式

所有业务接口统一采用以下 JSON 响应格式：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

- `code`: 业务状态码，`200` 表示成功，`4xx/5xx` 表示各类业务或系统错误。
- `message`: 人类可读的提示信息。
- `data`: 实际业务数据，可以是对象、数组或 `null`。

Controller 层推荐使用 `ctx.success(data, message)`、`ctx.error(message, code)` 和 `ctx.paginate(list, pagination)` 统一输出格式。

### 2. 安全配置建议

- 开发环境下当前启用了宽松的 CORS 与关闭 CSRF，便于调试。
- 生产环境部署时，建议：
  - 限制 CORS 允许的来源为前端部署域名；
  - 为管理端账号设置强密码，并通过环境变量配置；
  - 按需开启 CSRF 防护和登录失败次数限制等机制。

### 6. 跨域配置

如果需要修改跨域设置：

```javascript
config.cors = {
  origin: '*',                    // 允许的源（生产环境建议设置具体域名）
  allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH'
};
```

### 7. 端口配置

修改服务端口，可在 `config/config.default.js` 中添加：

```javascript
config.cluster = {
  listen: {
    port: 7001,  // 修改为其他端口
    hostname: '0.0.0.0',
  }
};
```

---

## 🏃 运行服务

### 开发模式

```bash
npm run dev
```

特点：
- 支持热重载（文件修改自动重启）
- 详细的日志输出
- 适合开发调试

### 生产模式

```bash
# 启动服务
npm start

# 停止服务
npm stop

# 重启服务
npm restart
```

### 后台运行

```bash
# 使用 PM2 运行（推荐用于生产环境）
npm install -g pm2

# 启动
pm2 start app.js --name tourist-town

# 查看日志
pm2 logs tourist-town

# 停止
pm2 stop tourist-town

# 重启
pm2 restart tourist-town
```

---

## 🧪 测试接口

### 1. 健康检查

```bash
curl http://localhost:7001
```

### 2. 用户登录

```bash
curl -X POST http://localhost:7001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "wx_login_code",
    "userInfo": {
      "nickName": "测试用户",
      "avatarUrl": "https://example.com/avatar.jpg"
    }
  }'
```

### 3. 获取景点列表

```bash
curl http://localhost:7001/api/scenic/list?page=1&pageSize=10
```

### 4. 获取路线列表

```bash
curl http://localhost:7001/api/route/list
```

### 5. 获取商品列表

```bash
curl http://localhost:7001/api/product/list?page=1&pageSize=10
```

---

## 📚 主要 API 接口

### 用户相关
- `POST /api/user/login` - 用户登录
- `GET /api/user/info` - 获取用户信息
- `PUT /api/user/info` - 更新用户信息

### 景点相关
- `GET /api/scenic/list` - 获取景点列表
- `GET /api/scenic/detail/:id` - 获取景点详情
- `POST /api/scenic/create` - 创建景点（管理员）
- `PUT /api/scenic/update/:id` - 更新景点（管理员）

### 路线相关
- `GET /api/route/list` - 获取路线列表
- `GET /api/route/detail/:id` - 获取路线详情
- `POST /api/route/create` - 创建路线（管理员）

### 订单相关
- `POST /api/order/create` - 创建订单
- `GET /api/order/list` - 获取订单列表
- `GET /api/order/detail/:id` - 获取订单详情
- `POST /api/order/pay` - 订单支付

完整 API 文档请查看项目文档或代码注释。

---

## ❓ 常见问题

### 1. 端口被占用

**问题**: `Error: listen EADDRINUSE: address already in use :::7001`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :7001

# 杀死进程
kill -9 <PID>

# 或者修改配置文件中的端口
```

### 2. 数据库连接失败

**问题**: `Access denied for user 'root'@'localhost'`

**解决方案**:
- 检查数据库用户名和密码是否正确
- 确认 MySQL 服务是否启动
- 确认数据库已创建

```bash
# 检查 MySQL 状态
sudo systemctl status mysql  # Linux
brew services list | grep mysql  # macOS

# 启动 MySQL
sudo systemctl start mysql  # Linux
brew services start mysql    # macOS
```

### 3. 依赖安装失败

**问题**: `npm install` 失败

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 如果还失败，尝试使用 cnpm 或 yarn
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### 4. Sequelize 数据库表不存在

**问题**: `Table 'tourist_town.xxx' doesn't exist`

**解决方案**:
```bash
# 重新导入数据库
mysql -u root -p tourist_town < database.sql

# 或者手动执行 SQL 文件中的表创建语句
```

### 5. JWT Token 过期

**问题**: 返回 401 Unauthorized

**解决方案**:
- 重新登录获取新 Token
- 或修改 `config.jwt.expiresIn` 延长有效期

### 6. 跨域问题

**问题**: 前端请求后端报跨域错误

**解决方案**:
- 检查 `config.cors.origin` 配置
- 开发环境设置为 `*`
- 生产环境设置为具体域名

### 7. Redis 连接失败

**问题**: `Redis connection failed`

**解决方案**:
```bash
# 检查 Redis 是否启动
redis-cli ping

# 启动 Redis
redis-server

# 如果不需要 Redis 功能，可以在 config/plugin.js 中注释掉 redis 配置
```

---

## 📁 项目结构

```
backend/
├── app.js                    # 应用入口
├── database.sql              # 数据库初始化脚本
├── package.json              # 依赖配置
├── config/
│   ├── config.default.js    # 应用配置
│   └── plugin.js            # 插件配置
├── app/
│   ├── router.js            # 路由配置
│   ├── controller/          # 控制器
│   ├── service/             # 服务层
│   ├── model/               # 数据模型
│   ├── middleware/          # 中间件
│   └── schedule/            # 定时任务
└── logs/                    # 日志目录（自动生成）
```

---

## 🔐 安全建议

### 生产环境注意事项

1. **修改 JWT Secret**
   ```javascript
   config.jwt = {
     secret: 'your_very_strong_random_secret_key_here',
     expiresIn: '7d'
   };
   ```

2. **修改数据库密码**
   - 使用强密码
   - 限制数据库访问权限

3. **配置 CORS**
   ```javascript
   config.cors = {
     origin: 'https://your-domain.com',  // 具体域名
     allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH'
   };
   ```

4. **启用 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书

5. **环境变量**
   - 敏感信息使用环境变量
   - 不要将配置文件提交到 Git

---

## 📞 技术支持

如遇到问题，请检查：
1. Node.js 和 MySQL 版本是否符合要求
2. 配置文件是否正确
3. 数据库是否已初始化
4. 端口是否被占用
5. 依赖是否完整安装

---

**文档版本**: v1.0  
**更新时间**: 2026年2月20日  
**维护者**: 项目组
