import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            OneCurrency
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <form className="flex flex-col gap-4" action="#" method="post">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-neutral-900"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-neutral-900 placeholder:text-neutral-400"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-neutral-900"
                >
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs text-neutral-500 transition hover:text-neutral-900"
                >
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-neutral-900 placeholder:text-neutral-400"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="mt-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 active:bg-neutral-800"
            >
              Sign in
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-neutral-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-neutral-900 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
