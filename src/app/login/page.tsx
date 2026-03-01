"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        router.push("/dashboard");
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-[80vh] px-6">
            <div className="w-full max-w-sm">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
                    Login
                </h1>
                <p className="text-sm text-neutral-500 mb-8">
                    Sign in to continue.
                </p>
                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-neutral-500 mb-1"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="form-input"
                        />
                    </div>
                    <div className="mb-4">
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-neutral-500 mb-1"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="form-input"
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-700 mb-3">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn w-full mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </form>
                <p className="mt-6 text-sm text-neutral-400 text-center">
                    No account?{" "}
                    <a href="/signup" className="text-neutral-600 hover:text-neutral-900">
                        Sign up
                    </a>
                </p>
            </div>
        </main>
    );
}
