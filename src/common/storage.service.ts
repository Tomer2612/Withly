import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';

@Injectable()
export class StorageService {
  private s3: S3Client | null = null;
  private bucket: string;
  private cdnUrl: string;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.bucket = process.env.R2_BUCKET || '';
    this.cdnUrl = process.env.R2_CDN_URL || ''; // e.g. https://cdn.withly.co.il

    if (this.isProduction) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT || '',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      });
    }
  }

  /**
   * Upload a file. In production, uploads to S3 and returns CloudFront URL.
   * In development, saves to local disk and returns /uploads/... path.
   * 
   * @param file - Multer file (with buffer from memoryStorage, or path from diskStorage)
   * @param folder - Subfolder name: 'communities', 'posts', 'profiles', 'events', 'courses', 'lessons'
   * @returns The URL/path to access the file
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    const randomName = randomBytes(16).toString('hex');
    const ext = extname(file.originalname);
    const filename = `${randomName}${ext}`;
    const key = `${folder}/${filename}`;

    if (this.isProduction && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return `${this.cdnUrl}/${key}`;
    }

    // Development: save to local disk
    const dir = `./uploads/${folder}`;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(`${dir}/${filename}`, file.buffer);
    return `/uploads/${folder}/${filename}`;
  }

  /**
   * Upload multiple files at once.
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder: string,
  ): Promise<string[]> {
    return Promise.all(files.map((file) => this.uploadFile(file, folder)));
  }

  /**
   * Delete a file by its URL/path. Works for both S3 and local files.
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    if (this.isProduction && this.s3 && fileUrl.startsWith(this.cdnUrl)) {
      // Extract S3 key from CDN URL
      const key = fileUrl.replace(`${this.cdnUrl}/`, '');
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } else if (fileUrl.startsWith('/uploads/')) {
      // Local file
      const localPath = `.${fileUrl}`;
      if (existsSync(localPath)) {
        unlinkSync(localPath);
      }
    }
  }
}
