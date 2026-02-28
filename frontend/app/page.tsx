"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "@/lib/auth-client";

export default function Home() {
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");

  const handleLogin = async () => {
    await signIn.email({
      email,
      password,
    });
  };

  if (isPending) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-10">
      <h1 className="mb-4 font-bold text-2xl">OneCurrency</h1>

      {session ? (
        <div className="rounded border bg-green-50 p-4">
          <p>Welcome back, {session.user.name}</p>
          <p>Email: {session.user.email}</p>
          <p>Email Verified: {session.user.emailVerified ? "Yes" : "No"}</p>
          <button
            className="mt-4 rounded bg-red-500 px-4 py-2 text-white"
            onClick={() => signOut()}
            type="button"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="flex max-w-xs flex-col gap-2">
          <label className="font-medium text-sm" htmlFor="email">
            Email
          </label>
          <input
            className="border p-2"
            id="email"
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
          <label className="font-medium text-sm" htmlFor="password">
            Password
          </label>
          <input
            className="border p-2"
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
          <button
            className="rounded bg-blue-500 px-4 py-2 text-white"
            onClick={handleLogin}
            type="button"
          >
            Sign In
          </button>
        </div>
      )}
    </div>
  );
}
