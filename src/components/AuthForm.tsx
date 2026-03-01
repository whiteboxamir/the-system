"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
    mode: "login" | "signup";
}

export default function AuthForm({ mode }: Props) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (mode === "login") {
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
        } else {
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
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
                <div className="w-full max-w-sm">
                    <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
                        Check Your Email
                    </h2>
                    <p className="text-base text-neutral-600">
                        A confirmation link has been sent to{" "}
                        <strong>{email}</strong>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <div className="mb-4">
                <label
                    htmlFor="auth-email"
                    className="block text-sm font-medium text-neutral-500 mb-1"
                >
                    Email
                </label>
                <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="form-input"
                />
            </div>
            <div className="mb-4">
                <label
                    htmlFor="auth-password"
                    className="block text-sm font-medium text-neutral-500 mb-1"
                >
                    Password
                </label>
                <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
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
                {loading
                    ? mode === "login"
                        ? "Signing in…"
                        : "Creating account…"
                    : mode === "login"
                        ? "Sign In"
                        : "Create Account"}
            </button>
        </form>
    );
}
