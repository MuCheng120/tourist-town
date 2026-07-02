'use strict';

const Controller = require('egg').Controller;
const fs = require('fs');
const path = require('path');

/**
 * 上传控制器
 * 图片与资质文件使用同一套接口，按 type 区分存储子目录：
 * - type=image（默认）：存 uploads/{module}/images/，仅允许图片
 * - type=file：存 uploads/{module}/files/，允许图片+PDF
 */
class UploadController extends Controller {
  /** 解析并校验上传模块（query 或 body） */
  getModule() {
    const { ctx } = this;
    const modules = this.app.config.upload.modules || [ 'common' ];
    const defaultModule = this.app.config.upload.defaultModule || 'common';
    const raw = (ctx.query.module || ctx.request.body?.module || defaultModule).trim().toLowerCase();
    return modules.includes(raw) ? raw : defaultModule;
  }

  /** 根据 type=image|file 返回存储子目录名：images 或 files */
  getUploadSubdir() {
    const type = (this.ctx.query.type || '').toLowerCase();
    return type === 'file' ? 'files' : 'images';
  }

  /** 根据 type=image|file 获取允许的 MIME 与大小限制 */
  getUploadLimit() {
    const { ctx } = this;
    const uploadConfig = this.app.config.upload || {};
    const isFileMode = (ctx.query.type || '').toLowerCase() === 'file';
    if (isFileMode) {
      return {
        allowedTypes: uploadConfig.allowedFileTypes || uploadConfig.allowedImageTypes || [ 'image/jpeg', 'image/png', 'image/gif', 'application/pdf' ],
        maxSize: uploadConfig.maxFileSize != null ? uploadConfig.maxFileSize : 10 * 1024 * 1024,
        typeLabel: '图片或PDF',
      };
    }
    return {
      allowedTypes: uploadConfig.allowedImageTypes || [ 'image/jpeg', 'image/png', 'image/jpg', 'image/gif' ],
      maxSize: uploadConfig.maxImageSize != null ? uploadConfig.maxImageSize : 5 * 1024 * 1024,
      typeLabel: '图片',
    };
  }

  /**
   * 上传（单文件）
   * 支持 ?module=xxx & ?type=image|file；图片存 {module}/images/，文件存 {module}/files/
   * 使用 egg-multipart 需先 saveRequestFiles() 才会得到 ctx.request.files
   */
  async upload() {
    const { ctx } = this;

    try {
      const { allowedTypes, maxSize, typeLabel } = this.getUploadLimit();
      const sizeLimit = maxSize;
      await ctx.saveRequestFiles({ limits: { fileSize: sizeLimit } });

      const files = ctx.request.files;
      const file = Array.isArray(files) && files.length > 0 ? files[0] : null;
      if (!file || !file.filepath) {
        ctx.body = { code: 400, message: '请选择要上传的文件' };
        return;
      }

      const fileSize = file.size != null ? file.size : (fs.existsSync(file.filepath) ? fs.statSync(file.filepath).size : 0);
      const isFileMode = (ctx.query.type || '').toLowerCase() === 'file';
      let ext = path.extname(file.filename || '').toLowerCase();
      const allowedExts = [ '.pdf', '.jpg', '.jpeg', '.png', '.gif' ];
      const mimeOk = allowedTypes.includes(file.mime);
      // 微信常传 application/octet-stream，或 PDF 无扩展名；type=file 时按扩展名或 MIME 放行
      const octetStreamByExt = isFileMode && file.mime === 'application/octet-stream' && allowedExts.includes(ext);
      const pdfMimeNoExt = isFileMode && (file.mime === 'application/pdf' || file.mime === 'application/octet-stream') && !ext;
      if (!mimeOk && !octetStreamByExt && !pdfMimeNoExt) {
        fs.unlinkSync(file.filepath);
        ctx.body = { code: 400, message: `只支持上传${typeLabel}文件` };
        return;
      }
      if (pdfMimeNoExt) ext = '.pdf';
      if (fileSize > maxSize) {
        fs.unlinkSync(file.filepath);
        const maxMB = Math.round(maxSize / (1024 * 1024));
        ctx.body = { code: 400, message: `文件大小不能超过${maxMB}MB` };
        return;
      }

      const moduleName = this.getModule();
      const subdir = this.getUploadSubdir();
      const uploadRoot = path.join(this.app.config.baseDir, 'app/public/uploads');
      const targetDir = path.join(uploadRoot, moduleName, subdir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const safeExt = ext || path.extname(file.filename || '').toLowerCase() || '';
      const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${safeExt}`;
      const targetPath = path.join(targetDir, filename);
      fs.renameSync(file.filepath, targetPath);
      const fileUrl = `/uploads/${moduleName}/${subdir}/${filename}`;

      ctx.body = {
        code: 200,
        message: '上传成功',
        data: { url: fileUrl, filename, size: fileSize },
      };
    } catch (error) {
      ctx.logger.error('文件上传失败:', error);
      const msg = (error && (error.message || error.original && error.original.message || error.parent && error.parent.message)) || '';
      const isDbError = /SQL syntax|ER_|near\s*'/.test(msg);
      ctx.body = { code: 500, message: isDbError ? '操作失败，请稍后重试' : '文件上传失败' };
    }
  }

  /**
   * 批量上传
   * 支持 ?module=xxx & ?type=image|file；图片存 {module}/images/，文件存 {module}/files/
   */
  async uploadMultiple() {
    const { ctx } = this;

    try {
      const files = ctx.request.files;
      if (!files || files.length === 0) {
        ctx.body = { code: 400, message: '请选择要上传的文件' };
        return;
      }
      const maxCount = this.app.config.upload.maxFileCount != null ? this.app.config.upload.maxFileCount : 9;
      if (files.length > maxCount) {
        files.forEach(f => { try { if (f && f.filepath) fs.unlinkSync(f.filepath); } catch (e) { /* ignore */ } });
        ctx.body = { code: 400, message: `最多上传${maxCount}个文件` };
        return;
      }

      const moduleName = this.getModule();
      const subdir = this.getUploadSubdir();
      const uploadRoot = path.join(this.app.config.baseDir, 'app/public/uploads');
      const targetDir = path.join(uploadRoot, moduleName, subdir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const { allowedTypes, maxSize } = this.getUploadLimit();
      const uploadedFiles = [];

      for (const file of files) {
        if (!allowedTypes.includes(file.mime) || file.size > maxSize) {
          try { if (file && file.filepath) fs.unlinkSync(file.filepath); } catch (e) { /* ignore */ }
          continue;
        }
        const ext = path.extname(file.filename);
        const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
        const targetPath = path.join(targetDir, filename);
        fs.renameSync(file.filepath, targetPath);
        uploadedFiles.push({
          url: `/uploads/${moduleName}/${subdir}/${filename}`,
          filename,
          size: file.size,
        });
      }

      ctx.body = {
        code: 200,
        message: '上传成功',
        data: { files: uploadedFiles, count: uploadedFiles.length },
      };
    } catch (error) {
      ctx.logger.error('批量上传失败:', error);
      ctx.body = { code: 500, message: '批量上传失败' };
    }
  }

  /**
   * 删除已上传文件（URL 格式：/uploads/{module}/images|files/{filename}）
   */
  async delete() {
    const { ctx } = this;
    try {
      const { url } = ctx.request.body;
      if (!url) {
        ctx.body = { code: 400, message: '请提供要删除的文件URL' };
        return;
      }
      if (!url.startsWith('/uploads/')) {
        ctx.body = { code: 400, message: 'URL 格式须为 /uploads/{module}/images|files/{filename}' };
        return;
      }
      const relativePath = url.replace(/^\/uploads\/?/, '');
      const filePath = path.join(this.app.config.baseDir, 'app/public/uploads', relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      ctx.body = { code: 200, message: '删除成功' };
    } catch (error) {
      ctx.logger.error('删除文件失败:', error);
      ctx.body = { code: 500, message: '删除文件失败' };
    }
  }
}

module.exports = UploadController;
