# Fix: Auth Session Not Persisting — Root Cause Found

## Diagnosis (from Playwright browser test)

### What works:
1. ✅ Backend `Set-Cookie` header is **perfectly correct**:
   ```
   __Secure-better-auth.session_token=...; Domain=.onecurrency.tech; Path=/; HttpOnly; Secure; SameSite=Lax
   ```
2. ✅ Backend returns session **when cookie is sent** (verified via curl)
3. ✅ **Manual `fetch(..., { credentials: "include" })` works perfectly** in a real Chromium browser — returns full session

### What fails:
4. ❌ **Better Auth's internal `$fetch` does NOT send the cookie** — the `GET /get-session` from `useSession()` arrives at the backend **without** the `Cookie` header, so the backend returns `null`

### The gap:
Better Auth's `createAuthClient` source **claims** to set `credentials: "include"` by default. The built bundle **contains** `credentials: "include"` in the minified output. Yet the actual browser request **does not** include the cookie.

This points to one of two issues:
- **A)** Better Auth's `@better-fetch/fetch` wrapper strips or loses the `credentials` option before passing to native `fetch`
- **B)** Turbopack/Next.js 16 bundler optimizes away the `credentials` property because it's not explicitly read in JS code (it's only consumed by the browser's native `fetch` API)

## Fix: Custom `fetch` wrapper

Replace Better Auth's native `fetch` with an explicit wrapper that **forces** `credentials: "include"` on every request, bypassing any library or bundler quirk.

### File: `frontend/lib/auth-client.ts`

Add a `fetchWithCredentials` wrapper and pass it via `fetchOptions.customFetchImpl`:

```typescript
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * Wrapper around native fetch that forces credentials: "include".
 * This ensures cross-origin cookies are always sent — bypassing any
 * bundler or library quirks that might strip the credentials option.
 */
function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
  });
}

export const authClient = createAuthClient({
  baseURL: `${env.NEXT_PUBLIC_API_URL}/api/v1/auth`,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    twoFactorClient({
      onTwoFactorRedirect() {
        const search = window.location.search;
        window.location.href = `/two-factor${search}`;
      },
    }),
  ],
  fetchOptions: {
    customFetchImpl: fetchWithCredentials,
    onError: (context) => {
      if (context.response.status === HTTP_TOO_MANY_REQUESTS) {
        const retryAfter = context.response.headers.get("X-Retry-After");
        const seconds = retryAfter ? Number(retryAfter) : null;
        toast.error(
          seconds
            ? `Too many attempts. Try again in ${seconds}s.`
            : "Too many attempts. Please wait before trying again."
        );
      }
    },
  },
});
```

### Why this works:

Better Auth's `createFetch` uses `getFetch(opts)` to resolve the actual fetch implementation:
```js
function getFetch(options) {
  if (options?.customFetchImpl) return options.customFetchImpl;
  // fallback to global fetch
}
```

By passing `customFetchImpl` in `fetchOptions`, it overrides the default `globalThis.fetch` and **guarantees** `credentials: "include"` is set on every outgoing request, regardless of what the config merging logic does.

### Already applied (from previous session):
- `frontend/app/(auth)/login/page.tsx` — removed `callbackURL` from `signIn.email()`, uses `window.location.href` for hard reload
- `frontend/app/(main)/layout.tsx` — added unauthenticated redirect to `/login`

### Next steps after implementing:
1. `pnpm lint` + `pnpm build`
2. Deploy to Vercel
3. Test login
