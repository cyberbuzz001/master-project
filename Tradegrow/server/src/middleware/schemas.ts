import { z } from 'zod';

// ---------------------------------------------------
// AUTH SCHEMAS
// ---------------------------------------------------
export const RegisterSchema = z.object({
  username: z.string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_ ]+$/, 'Username may contain letters, numbers, spaces and underscores')
    .optional(),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(100),
  phoneNumber: z.string()
    .trim()
    .min(10, 'Please enter a valid 10-digit mobile number')
    .max(16, 'Mobile number is too long')
    .regex(/^[+]?[0-9\s-]{10,16}$/, 'Please enter a valid mobile number (e.g. 9876543210 or +919876543210)'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(72, 'Password must be at most 72 characters'),
  otp: z.string()
    .trim()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must be 6 numeric digits')
    .optional()
});

export const LoginSchema = z.object({
  email: z.string().min(1, 'Email or username is required').max(100),
  password: z.string().min(1, 'Password is required').max(72),
  totp_code: z.string().length(6).optional()
});

export const TotpVerifySchema = z.object({
  code: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d{6}$/, 'TOTP code must be numeric')
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(72)
});

// ---------------------------------------------------
// ORDER SCHEMAS (Zod v3/v4 compatible)
// ---------------------------------------------------
export const SubmitOrderSchema = z.object({
  instrumentToken: z.string().min(1, 'Instrument token is required').max(100),
  exchange: z.enum(['NSE', 'BSE', 'NFO', 'BFO', 'MCX', 'CDS']),
  symbol: z.string().min(1).max(50),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.preprocess(
    (val) => typeof val === 'string' ? parseInt(val, 10) : val,
    z.number().int().positive('Quantity must be a positive integer').max(100000)
  ),
  price: z.preprocess(
    (val) => typeof val === 'string' ? parseFloat(val) : (val ?? 0),
    z.number().min(0).max(1000000)
  ).default(0),
  triggerPrice: z.preprocess(
    (val) => typeof val === 'string' ? parseFloat(val) : (val ?? 0),
    z.number().min(0).max(1000000)
  ).optional().default(0),
  orderType: z.enum(['MARKET', 'LIMIT', 'SL', 'SL_M']),
  productType: z.enum(['MIS', 'CNC', 'NRML'])
});

// ---------------------------------------------------
// WATCHLIST SCHEMAS
// ---------------------------------------------------
export const AddWatchlistItemSchema = z.object({
  watchlistId: z.string().min(1),
  instrumentToken: z.string().min(1).max(100),
  symbol: z.string().min(1).max(50),
  exchange: z.enum(['NSE', 'BSE', 'NFO', 'BFO', 'MCX', 'CDS'])
});

export const CreateWatchlistSchema = z.object({
  name: z.string().min(1, 'Watchlist name is required').max(50)
});

// ---------------------------------------------------
// ADMIN SCHEMAS
// ---------------------------------------------------
export const AdminAdjustBalanceSchema = z.object({
  amount: z.preprocess(
    (val) => typeof val === 'string' ? parseFloat(val) : val,
    z.number()
      .refine(v => v !== 0, 'Amount cannot be zero')
      .refine(v => Math.abs(v) <= 100_000_000, 'Amount cannot exceed ₹10 Crore')
  ),
  reason: z.string().min(1, 'Reason is required').max(200)
});

export const UpdateRiskSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(500)
});

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']),
  reason: z.string().max(200).optional()
});

export const UpdateUserRoleSchema = z.object({
  role: z.enum([
    'USER',
    'MANAGER',
    'FINANCE_MANAGER',
    'RISK_MANAGER',
    'OPERATIONS_MANAGER',
    'KYC_OFFICER',
    'DEALER',
    'SUPPORT_AGENT',
    'ANALYST',
    'READ_ONLY_AUDITOR',
    'ADMIN',
    'SUPER_ADMIN'
  ])
});

