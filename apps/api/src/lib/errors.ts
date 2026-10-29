export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const Errors = {
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', 'لطفاً ابتدا وارد سامانه شوید'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'شما به این بخش دسترسی ندارید'),
  notFound: (what = 'مورد درخواستی') => new AppError(404, 'NOT_FOUND', `${what} یافت نشد`),
  csrf: () => new AppError(403, 'CSRF', 'نشست شما منقضی شده است؛ صفحه را دوباره بارگذاری کنید'),
  validation: (msg: string) => new AppError(400, 'VALIDATION', msg),
  tooMany: (msg = 'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد تلاش کنید') => new AppError(429, 'RATE_LIMIT', msg),
  conflict: (msg: string) => new AppError(409, 'CONFLICT', msg),
};
