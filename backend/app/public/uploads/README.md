# 上传文件目录（按 module 区分）

**图片与资质文件使用同一套接口**，按 `type` 区分存储子目录。

## 目录结构

每个 module 下区分图片与文件：

- **图片**（`?type=image` 或默认）→ `uploads/{module}/images/{filename}`
- **文件**（`?type=file`）→ `uploads/{module}/files/{filename}`

示例（merchant）：

- `uploads/merchant/images/` — 营业执照照片等图片
- `uploads/merchant/files/` — 资质文件（如 PDF）

## 接口与参数

- `POST /api/upload?module=xxx` 单文件上传
- `POST /api/upload/multiple?module=xxx` 多文件上传
- 返回 URL：`/uploads/{module}/images/{filename}` 或 `/uploads/{module}/files/{filename}`

## 校验模式（type 参数）

| 模式 | 参数 | 存储子目录 | 允许类型 | 大小限制 |
|------|------|------------|----------|----------|
| 图片 | 默认或 `?type=image` | `images/` | jpeg/png/gif | 5MB |
| 文件 | `?type=file` | `files/` | 图片 + PDF | 10MB |

静态资源访问前缀：`/uploads`。
