import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
    title: "The System — Structured Study Program",
    description:
        "A structured study program covering Fourth Way ideas. Based on the works of Ouspensky, Nicoll, and related authors.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="min-h-screen">
                <header className="max-w-3xl mx-auto flex items-center justify-between px-6 py-5 border-b border-neutral-200">
                    <Link
                        href="/"
                        className="text-sm font-semibold tracking-wide uppercase text-neutral-900 no-underline"
                    >
                        The System
                    </Link>
                    <nav>
                        <Link
                            href="/login"
                            className="text-sm font-medium text-neutral-500 hover:text-neutral-900 no-underline"
                        >
                            Login
                        </Link>
                    </nav>
                </header>
                {children}
            </body>
        </html>
    );
}
