"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface WeakArea {
    id: string;
    concept_tag: string;
    error_count: number;
    last_tested_at: string;
}

interface Props {
    user: { id: string; email: string };
    subscription: { status: string; current_period_end: string } | null;
    progress: any[];
    weakAreas: WeakArea[];
    totalLessons: number;
    completedLessons: number;
    progressPercentage: number;
    currentProgress: any;
    currentYear?: { title: string } | null;
    currentTerm?: { title: string } | null;
    gpa?: number | null;
    termModulesTotal?: number;
    termModulesCompleted?: number;
    upcomingAssessment?: { title: string; type: string } | null;
}

export default function DashboardView({
    user,
    subscription,
    progress,
    weakAreas,
    totalLessons,
    completedLessons,
    progressPercentage,
    currentProgress,
    currentYear,
    currentTerm,
    gpa,
    termModulesTotal,
    termModulesCompleted,
    upcomingAssessment,
}: Props) {
    const router = useRouter();
    const supabase = createClient();

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/");
    }

    async function handleSubscribe() {
        const response = await fetch("/api/stripe/checkout", {
            method: "POST",
        });
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        }
    }

    const requiredReviews = weakAreas.filter((w) => w.error_count >= 3);

    return (
        <main className="max-w-3xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-10 pb-5 border-b border-neutral-200">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 m-0">
                    Student Dashboard
                </h1>
                <div className="flex items-center gap-3 text-sm text-neutral-400">
                    <span>{user.email}</span>
                    <button
                        onClick={handleLogout}
                        className="px-3 py-1 text-xs text-neutral-400 bg-transparent border border-neutral-300 rounded cursor-pointer hover:text-neutral-700 hover:border-neutral-400 transition-colors duration-150"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Enrollment Status */}
            {!subscription && (
                <div className="bg-neutral-100 px-5 py-4 rounded mb-8 max-w-xl">
                    <p className="text-sm text-neutral-600 mb-3">
                        You currently have access to Level 0 (Orientation) only.
                        Enrollment is required to access additional levels.
                    </p>
                    <button onClick={handleSubscribe} className="btn">
                        Enroll
                    </button>
                </div>
            )}

            {subscription && (
                <Section title="Enrollment">
                    <p className="text-base text-neutral-800">
                        {subscription.status} · Renews{" "}
                        {new Date(
                            subscription.current_period_end
                        ).toLocaleDateString()}
                    </p>
                </Section>
            )}

            {/* Current Position */}
            <Section title="Current Position">
                {currentYear || currentTerm ? (
                    <p className="text-base text-neutral-800">
                        {currentYear?.title ?? "—"} ·{" "}
                        {currentTerm?.title ?? "—"}
                    </p>
                ) : null}
                {currentProgress ? (
                    <div>
                        <p className="text-base text-neutral-800">
                            Module:{" "}
                            {(currentProgress.lessons as any)?.modules
                                ?.title ?? "—"}
                        </p>
                        <p className="text-base text-neutral-800">
                            Lesson:{" "}
                            {(currentProgress.lessons as any)?.title ?? "—"}
                        </p>
                    </div>
                ) : (
                    <p className="text-base text-neutral-600">
                        No lessons started.{" "}
                        <Link
                            href="/program"
                            className="text-neutral-500 hover:text-neutral-900"
                        >
                            Begin studying
                        </Link>
                        .
                    </p>
                )}
            </Section>

            {/* Term Progress */}
            {termModulesTotal !== undefined && (
                <Section title="Term Progress">
                    <p className="text-base text-neutral-800">
                        Module {termModulesCompleted ?? 0} of{" "}
                        {termModulesTotal}
                    </p>
                </Section>
            )}

            {/* Program Progress */}
            <Section title="Program Completion">
                <p className="text-base text-neutral-800">
                    {completedLessons} of {totalLessons} lessons completed
                    ({progressPercentage}%)
                </p>
            </Section>

            {/* GPA */}
            {gpa !== undefined && gpa !== null && (
                <Section title="Program GPA">
                    <p className="text-base text-neutral-800">
                        {gpa.toFixed(1)}
                    </p>
                </Section>
            )}

            {/* Upcoming Assessment */}
            {upcomingAssessment && (
                <Section title="Upcoming Assessment">
                    <p className="text-base text-neutral-800">
                        {upcomingAssessment.title} (
                        {upcomingAssessment.type.replace("_", " ")})
                    </p>
                </Section>
            )}

            {/* Weak Concepts */}
            {weakAreas.length > 0 && (
                <Section title="Weak Concepts">
                    <ul className="space-y-1 text-sm">
                        {weakAreas.map((area) => (
                            <li
                                key={area.id}
                                className="py-1 border-b border-neutral-100 text-neutral-700"
                            >
                                <strong>{area.concept_tag}</strong> —{" "}
                                {area.error_count} error
                                {area.error_count !== 1 ? "s" : ""}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Required Reviews */}
            {requiredReviews.length > 0 && (
                <Section title="Required Reviews">
                    <p className="text-sm text-neutral-600 mb-2">
                        The following concepts require targeted review
                        before progression:
                    </p>
                    <ul className="space-y-1 text-sm">
                        {requiredReviews.map((area) => (
                            <li
                                key={area.id}
                                className="py-1 border-b border-neutral-100 text-neutral-700"
                            >
                                {area.concept_tag}
                                {area.error_count >= 5 && (
                                    <span className="text-red-700 ml-2">
                                        — blocks progression
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Last Studied */}
            {progress.length > 0 && (
                <Section title="Last Activity">
                    <p className="text-base text-neutral-800">
                        {(progress[0].lessons as any)?.title ?? "Unknown"}{" "}
                        —{" "}
                        {new Date(
                            progress[0].updated_at
                        ).toLocaleDateString()}
                    </p>
                </Section>
            )}

            {/* Navigation */}
            <nav className="mt-10">
                <Link href="/program" className="btn">
                    View Program
                </Link>
            </nav>

            {/* Disclaimer */}
            <p className="mt-12 text-xs text-neutral-400">
                This platform supports intellectual study only. It does not provide the conditions for practical development.
            </p>
        </main>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">
                {title}
            </h2>
            {children}
        </div>
    );
}
