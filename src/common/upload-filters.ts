import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { FileFilterCallback } from 'multer';
import { ERROR_MESSAGES } from './messages';

/** Multer file filter: accepts only image/* mimetypes. */
export const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException(ERROR_MESSAGES.UPLOAD_IMAGE_ONLY));
  }
  cb(null, true);
};

/** Multer file filter: accepts only video/* mimetypes. */
export const videoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (!file.mimetype.startsWith('video/')) {
    return cb(new BadRequestException(ERROR_MESSAGES.UPLOAD_VIDEO_ONLY));
  }
  cb(null, true);
};

/** Multer file filter: accepts image/* or video/* (community gallery). */
export const imageOrVideoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
    return cb(new BadRequestException(ERROR_MESSAGES.UPLOAD_IMAGE_OR_VIDEO_ONLY));
  }
  cb(null, true);
};

/** Multer file filter for post attachments: images, videos, and common document/archive types. */
const POST_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
]);

export const postContentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    POST_DOCUMENT_MIMES.has(file.mimetype)
  ) {
    return cb(null, true);
  }
  cb(new BadRequestException(ERROR_MESSAGES.UPLOAD_FILE_TYPE_NOT_SUPPORTED));
};
