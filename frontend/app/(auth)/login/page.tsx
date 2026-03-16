import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="font-bold text-2xl text-neutral-900 tracking-tight">
            OneCurrency
          </h1>
          <p className="mt-1.5 text-neutral-500 text-sm">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <form action="#" className="flex flex-col gap-4" method="post">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                className="font-medium text-neutral-900 text-sm"
                htmlFor="email"
              >
                Email
              </label>
              <input
                autoComplete="email"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-transparent focus:ring-2 focus:ring-neutral-900"
                id="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="font-medium text-neutral-900 text-sm"
                  htmlFor="password"
                >
                  Password
                </label>
                <a
                  className="text-neutral-500 text-xs transition hover:text-neutral-900"
                  href="/forgot-password"
                >
                  Forgot password?
                </a>
              </div>
              <input
                autoComplete="current-password"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-transparent focus:ring-2 focus:ring-neutral-900"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type="password"
              />
            </div>

            {/* Submit */}
            <button
              className="mt-1 rounded-lg bg-neutral-900 py-2 font-medium text-sm text-white transition hover:bg-neutral-700 active:bg-neutral-800"
              type="submit"
            >
              Sign in
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-neutral-500 text-sm">
          Don&apos;t have an account?{" "}
          <Link
            className="font-medium text-neutral-900 hover:underline"
            href="/sign-up"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
