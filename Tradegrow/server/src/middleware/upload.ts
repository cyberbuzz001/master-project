import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import multer from 'multer';
import { generateUUID } from '../utils/crypto';

// Ensure protected non-public KYC uploads directory exists
const getUploadsDir = () => {
  const dir = process.env.UPLOADS_DIR 
    ? path.resolve(process.env.UPLOADS_DIR, 'kyc')
    : path.resolve(process.cwd(), 'uploads', 'kyc');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = getUploadsDir();
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueName = `kyc_doc_${Date.now()}_${generateUUID()}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf', '.webp', '.heic', '.heif'];
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (allowedExts.includes(ext) || allowedMimeTypes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid document format (${file.originalname}). Only JPG, PNG, WEBP, and PDF files are allowed.`));
  }
};

/** Validate magic bytes after multer has written the file to disk. */
export async function validateStoredKycFile(file: Express.Multer.File): Promise<boolean> {
  const header = await fsp.readFile(file.path).then((buf) => buf.subarray(0, 32)).catch(() => null);
  if (!header) return false;
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') return header.subarray(0, 5).toString('ascii') === '%PDF-';
  if (ext === '.jpg' || ext === '.jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (ext === '.png') return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === '.webp') return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  if (ext === '.heic' || ext === '.heif') {
    const brand = header.subarray(8, 16).toString('ascii');
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1'].includes(brand);
  }
  return false;
}

export const kycUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB max size per file
  },
  fileFilter,
});

