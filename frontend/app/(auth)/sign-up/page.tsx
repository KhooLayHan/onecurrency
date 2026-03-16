import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            OneCurrency
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Create your account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <form className="flex flex-col gap-4" action="#" method="post">
            {/* Full name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="name"
                className="text-sm font-medium text-neutral-900"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                required
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-neutral-900 placeholder:text-neutral-400"
              />
            </div>

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
              <label
                htmlFor="password"
                className="text-sm font-medium text-neutral-900"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                required
                minLength={8}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-neutral-900 placeholder:text-neutral-400"
              />
              <p className="text-xs text-neutral-400">Minimum 8 characters</p>
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="confirm-password"
                className="text-sm font-medium text-neutral-900"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                required
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-neutral-900 placeholder:text-neutral-400"
              />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 text-sm text-neutral-500">
              <input
                type="checkbox"
                name="terms"
                required
                className="mt-0.5 rounded border-neutral-300 accent-neutral-900"
              />
              <span>
                I agree to the{" "}
                <a
                  href="#"
                  className="font-medium text-neutral-900 hover:underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="font-medium text-neutral-900 hover:underline"
                >
                  Privacy Policy
                </a>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              className="mt-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 active:bg-neutral-800"
            >
              Create account
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-neutral-900 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
