import path from 'path';
import fs from 'fs';
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
    'application/pdf',
    'application/octet-stream'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (allowedExts.includes(ext) || allowedMimeTypes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid document format (${file.originalname}). Only JPG, PNG, WEBP, and PDF files are allowed.`));
  }
};

export const kycUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB max size per file
  },
  fileFilter,
});

