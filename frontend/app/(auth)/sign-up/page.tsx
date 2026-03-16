import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="font-bold text-2xl text-neutral-900 tracking-tight">
            OneCurrency
          </h1>
          <p className="mt-1.5 text-neutral-500 text-sm">Create your account</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <form action="#" className="flex flex-col gap-4" method="post">
            {/* Full name */}
            <div className="flex flex-col gap-1.5">
              <label
                className="font-medium text-neutral-900 text-sm"
                htmlFor="name"
              >
                Full name
              </label>
              <input
                autoComplete="name"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-transparent focus:ring-2 focus:ring-neutral-900"
                id="name"
                name="name"
                placeholder="Jane Doe"
                required
                type="text"
              />
            </div>

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
              <label
                className="font-medium text-neutral-900 text-sm"
                htmlFor="password"
              >
                Password
              </label>
              <input
                autoComplete="new-password"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-transparent focus:ring-2 focus:ring-neutral-900"
                id="password"
                minLength={8}
                name="password"
                placeholder="••••••••"
                required
                type="password"
              />
              <p className="text-neutral-400 text-xs">Minimum 8 characters</p>
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="font-medium text-neutral-900 text-sm"
                htmlFor="confirm-password"
              >
                Confirm password
              </label>
              <input
                autoComplete="new-password"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-transparent focus:ring-2 focus:ring-neutral-900"
                id="confirm-password"
                name="confirmPassword"
                placeholder="••••••••"
                required
                type="password"
              />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 text-neutral-500 text-sm">
              <input
                className="mt-0.5 rounded border-neutral-300 accent-neutral-900"
                name="terms"
                required
                type="checkbox"
              />
              <span>
                I agree to the{" "}
                <a
                  className="font-medium text-neutral-900 hover:underline"
                  href="/terms"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  className="font-medium text-neutral-900 hover:underline"
                  href="/privacy"
                >
                  Privacy Policy
                </a>
              </span>
            </label>

            {/* Submit */}
            <button
              className="mt-1 rounded-lg bg-neutral-900 py-2 font-medium text-sm text-white transition hover:bg-neutral-700 active:bg-neutral-800"
              type="submit"
            >
              Create account
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-neutral-500 text-sm">
          Already have an account?{" "}
          <Link
            className="font-medium text-neutral-900 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
