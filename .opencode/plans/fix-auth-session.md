# Fix: Auth Session Not Persisting After Login

## Root Cause

**Double-navigation race condition** in the login page:

1. `signIn.email({ callbackURL: "/dashboard" })` triggers Better Auth's built-in `redirectPlugin` which fires `window.location.href = "/dashboard"` (hard reload)
2. Immediately after, the login page code also runs `router.push(callbackUrl)` + `router.refresh()` (client-side nav)

These two navigations race. The client-side `router.push` can win, mounting the dashboard via soft navigation before the hard reload commits the session cookie. The `useSession()` fetch runs against a blank state and returns null — showing "Welcome to OneCurrency, Sign in to Continue".

## Changes Required

### 1. `frontend/app/(auth)/login/page.tsx`

- Remove `callbackURL` from `signIn.email()` — disables the redirectPlugin so only we control navigation
- Remove `router.push` and `router.refresh` after sign-in
- Use `window.location.href = callbackUrl` explicitly for a clean full-reload
- Add `useEffect` to redirect already-authenticated users away from login page (redundant with proxy but prevents flash)
- Remove unused `useRouter` import

### 2. `frontend/app/(main)/layout.tsx`

- Add unauthenticated redirect: when `!sessionLoading && !session`, redirect to `/login?callbackUrl=<pathname>`
- Currently the layout only redirects admin users to `/admin/kyc` — regular unauthenticated users see the "sign in to continue" state from the dashboard component instead of being sent to login

## Files to Edit

1. `frontend/app/(auth)/login/page.tsx` — fix onSubmit + add auth check
2. `frontend/app/(main)/layout.tsx` — add unauthenticated redirect

## No backend changes needed

Both env vars are correctly set:
- `NEXT_PUBLIC_API_URL = https://api.onecurrency.tech` ✓  
- `BETTER_AUTH_URL = https://api.onecurrency.tech` ✓
