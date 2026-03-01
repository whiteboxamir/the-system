"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        setSuccess(true);
        setLoading(false);
    }

    if (success) {
        return (
            <main className="flex flex-col items-center justify-center min-h-[80vh] px-6">
                <div className="w-full max-w-sm">
                    <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
                        Check Your Email
                    </h1>
                    <p className="text-base text-neutral-600">
                        A confirmation link has been sent to{" "}
                        <strong>{email}</strong>. Click the link to verify
                        your account.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-[80vh] px-6">
            <div className="w-full max-w-sm">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
                    Create Account
                </h1>
                <p className="text-sm text-neutral-500 mb-8">
                    Create an account to save your progress.
                    Level 0 does not require an account.
                </p>
                <form onSubmit={handleSignup}>
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
                            minLength={8}
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
                        {loading ? "Creating account…" : "Create Account"}
                    </button>
                </form>
                <p className="mt-6 text-sm text-neutral-400 text-center">
                    Already have an account?{" "}
                    <a href="/login" className="text-neutral-600 hover:text-neutral-900">
                        Login
                    </a>
                </p>
            </div>
        </main>
    );
}
