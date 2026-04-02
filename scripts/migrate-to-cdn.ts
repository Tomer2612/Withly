/**
 * Migration script: Upload all local /uploads/ files to Cloudflare R2 CDN
 * and update database records to use CDN URLs.
 *
 * Run on the server:
 *   cd ~/Withly
 *   npx ts-node scripts/migrate-to-cdn.ts
 *
 * Requires .env with R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_CDN_URL, DATABASE_URL
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.R2_BUCKET || '';
const CDN_URL = process.env.R2_CDN_URL || ''; // e.g. https://cdn.withly.co.il
const UPLOADS_DIR = './uploads';

let uploaded = 0;
let skipped = 0;
let failed = 0;
let dbUpdates = 0;

function isLocalPath(url: string | null | undefined): boolean {
  return !!url && url.startsWith('/uploads/');
}

async function uploadToCdn(localPath: string): Promise<string | null> {
  // localPath = "/uploads/communities/abc123.jpg"
  const filePath = `.${localPath}`; // "./uploads/communities/abc123.jpg"

  if (!existsSync(filePath)) {
    console.warn(`  ⚠ File not found: ${filePath}`);
    failed++;
    return null;
  }

  const key = localPath.replace(/^\/uploads\//, ''); // "communities/abc123.jpg"
  const buffer = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    uploaded++;
    const cdnUrl = `${CDN_URL}/${key}`;
    console.log(`  ✓ ${localPath} → ${cdnUrl}`);
    return cdnUrl;
  } catch (err) {
    console.error(`  ✗ Failed to upload ${localPath}:`, err);
    failed++;
    return null;
  }
}

async function migrateStringField(
  model: string,
  field: string,
  getId: (record: any) => string,
  updateFn: (id: string, value: string) => Promise<any>,
  records: any[],
) {
  for (const record of records) {
    const value = record[field];
    if (!isLocalPath(value)) continue;

    const cdnUrl = await uploadToCdn(value);
    if (cdnUrl) {
      await updateFn(getId(record), cdnUrl);
      dbUpdates++;
    }
  }
}

async function migrateArrayField(
  model: string,
  field: string,
  getId: (record: any) => string,
  updateFn: (id: string, value: string[]) => Promise<any>,
  records: any[],
) {
  for (const record of records) {
    const arr: string[] = record[field] || [];
    const localPaths = arr.filter(isLocalPath);
    if (localPaths.length === 0) continue;

    const newArr = [...arr];
    let changed = false;
    for (let i = 0; i < newArr.length; i++) {
      if (isLocalPath(newArr[i])) {
        const cdnUrl = await uploadToCdn(newArr[i]);
        if (cdnUrl) {
          newArr[i] = cdnUrl;
          changed = true;
        }
      }
    }

    if (changed) {
      await updateFn(getId(record), newArr);
      dbUpdates++;
    }
  }
}

async function migrateJsonArrayFiles(
  model: string,
  field: string,
  getId: (record: any) => string,
  updateFn: (id: string, value: any[]) => Promise<any>,
  records: any[],
) {
  // Json[] fields contain objects like { url: "/uploads/...", name: "...", ... }
  for (const record of records) {
    const arr: any[] = record[field] || [];
    const hasLocal = arr.some((item: any) => isLocalPath(item?.url));
    if (!hasLocal) continue;

    const newArr = [...arr];
    let changed = false;
    for (let i = 0; i < newArr.length; i++) {
      if (isLocalPath(newArr[i]?.url)) {
        const cdnUrl = await uploadToCdn(newArr[i].url);
        if (cdnUrl) {
          newArr[i] = { ...newArr[i], url: cdnUrl };
          changed = true;
        }
      }
    }

    if (changed) {
      await updateFn(getId(record), newArr);
      dbUpdates++;
    }
  }
}

async function main() {
  console.log('=== CDN Migration Script ===');
  console.log(`CDN URL: ${CDN_URL}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log('');

  if (!CDN_URL || !BUCKET) {
    console.error('Missing R2_CDN_URL or R2_BUCKET in .env');
    process.exit(1);
  }

  // --- User ---
  console.log('--- Users ---');
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { profileImage: { startsWith: '/uploads/' } },
        { coverImage: { startsWith: '/uploads/' } },
      ],
    },
  });
  console.log(`Found ${users.length} users with local images`);
  await migrateStringField('User', 'profileImage', (r) => r.id, (id, val) => prisma.user.update({ where: { id }, data: { profileImage: val } }), users);
  await migrateStringField('User', 'coverImage', (r) => r.id, (id, val) => prisma.user.update({ where: { id }, data: { coverImage: val } }), users);

  // --- Community ---
  console.log('\n--- Communities ---');
  const communities = await prisma.community.findMany();
  const localCommunities = communities.filter(
    (c) => isLocalPath(c.image) || isLocalPath(c.logo) || (c.galleryImages || []).some(isLocalPath) || (c.galleryVideos || []).some(isLocalPath),
  );
  console.log(`Found ${localCommunities.length} communities with local files`);
  await migrateStringField('Community', 'image', (r) => r.id, (id, val) => prisma.community.update({ where: { id }, data: { image: val } }), localCommunities);
  await migrateStringField('Community', 'logo', (r) => r.id, (id, val) => prisma.community.update({ where: { id }, data: { logo: val } }), localCommunities);
  await migrateArrayField('Community', 'galleryImages', (r) => r.id, (id, val) => prisma.community.update({ where: { id }, data: { galleryImages: val } }), localCommunities);
  await migrateArrayField('Community', 'galleryVideos', (r) => r.id, (id, val) => prisma.community.update({ where: { id }, data: { galleryVideos: val } }), localCommunities);

  // --- Post ---
  console.log('\n--- Posts ---');
  try {
    const posts = await prisma.post.findMany();
    const localPosts = posts.filter(
      (p) => (p.images || []).some(isLocalPath) || ((p as any).videos || []).some(isLocalPath) || ((p.files as any[]) || []).some((f: any) => isLocalPath(f?.url)),
    );
    console.log(`Found ${localPosts.length} posts with local files`);
    await migrateArrayField('Post', 'images', (r) => r.id, (id, val) => prisma.post.update({ where: { id }, data: { images: val } }), localPosts);
    try {
      await migrateArrayField('Post', 'videos', (r) => r.id, (id, val) => prisma.post.update({ where: { id }, data: { videos: val } as any }), localPosts);
    } catch { console.log('  ⚠ Post.videos column not found, skipping'); }
    await migrateJsonArrayFiles('Post', 'files', (r) => r.id, (id, val) => prisma.post.update({ where: { id }, data: { files: val } }), localPosts);
  } catch (err: any) {
    if (err?.meta?.column?.includes('videos')) {
      // videos column doesn't exist yet — query without it
      console.log('  ⚠ Post.videos column not in DB, querying without it');
      const posts = await prisma.$queryRaw<any[]>`SELECT id, images, files FROM "Post"`;
      const localPosts = posts.filter(
        (p: any) => ((p.images as string[]) || []).some(isLocalPath) || ((p.files as any[]) || []).some((f: any) => isLocalPath(f?.url)),
      );
      console.log(`Found ${localPosts.length} posts with local files`);
      await migrateArrayField('Post', 'images', (r: any) => r.id, (id, val) => prisma.$executeRaw`UPDATE "Post" SET images = ${val}::text[] WHERE id = ${id}`, localPosts);
      // For jsonb[] we cast each element individually
      for (const post of localPosts) {
        const arr: any[] = post.files || [];
        const hasLocal = arr.some((item: any) => isLocalPath(item?.url));
        if (!hasLocal) continue;
        const newArr = [...arr];
        let changed = false;
        for (let i = 0; i < newArr.length; i++) {
          if (isLocalPath(newArr[i]?.url)) {
            const cdnUrl = await uploadToCdn(newArr[i].url);
            if (cdnUrl) { newArr[i] = { ...newArr[i], url: cdnUrl }; changed = true; }
          }
        }
        if (changed) {
          // Build PostgreSQL jsonb array literal: ARRAY['{...}'::jsonb, '{...}'::jsonb]
          const elements = newArr.map((item: any) => `'${JSON.stringify(item).replace(/'/g, "''")}'::jsonb`).join(', ');
          await prisma.$executeRawUnsafe(`UPDATE "Post" SET files = ARRAY[${elements}] WHERE id = '${post.id}'`);
          dbUpdates++;
        }
      }
    } else {
      throw err;
    }
  }

  // --- Event ---
  console.log('\n--- Events ---');
  const events = await prisma.event.findMany({
    where: { coverImage: { startsWith: '/uploads/' } },
  });
  console.log(`Found ${events.length} events with local images`);
  await migrateStringField('Event', 'coverImage', (r) => r.id, (id, val) => prisma.event.update({ where: { id }, data: { coverImage: val } }), events);

  // --- Course ---
  console.log('\n--- Courses ---');
  const courses = await prisma.course.findMany({
    where: { image: { startsWith: '/uploads/' } },
  });
  console.log(`Found ${courses.length} courses with local images`);
  await migrateStringField('Course', 'image', (r) => r.id, (id, val) => prisma.course.update({ where: { id }, data: { image: val } }), courses);

  // --- Lesson ---
  console.log('\n--- Lessons ---');
  const lessons = await prisma.lesson.findMany();
  const localLessons = lessons.filter(
    (l) => isLocalPath(l.videoUrl) || (l.images || []).some(isLocalPath) || ((l.files as any[]) || []).some((f: any) => isLocalPath(f?.url)),
  );
  console.log(`Found ${localLessons.length} lessons with local files`);
  await migrateStringField('Lesson', 'videoUrl', (r) => r.id, (id, val) => prisma.lesson.update({ where: { id }, data: { videoUrl: val } }), localLessons);
  await migrateArrayField('Lesson', 'images', (r) => r.id, (id, val) => prisma.lesson.update({ where: { id }, data: { images: val } }), localLessons);
  await migrateJsonArrayFiles('Lesson', 'files', (r) => r.id, (id, val) => prisma.lesson.update({ where: { id }, data: { files: val } }), localLessons);

  // --- Summary ---
  console.log('\n=== Migration Complete ===');
  console.log(`Files uploaded to R2: ${uploaded}`);
  console.log(`Files skipped (not found): ${failed}`);
  console.log(`DB records updated: ${dbUpdates}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
