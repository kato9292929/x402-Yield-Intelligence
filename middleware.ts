// Route protection is handled per-route via the withX402 wrapper in
// app/api/yield/*. This no-op middleware intentionally matches nothing.
export function middleware() {}

export const config = { matcher: [] };
