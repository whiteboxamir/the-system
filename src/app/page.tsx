import Link from "next/link";

export default function LandingPage() {
    return (
        <main className="max-w-3xl mx-auto px-6 py-16">
            {/* Section 1 — Title & Description */}
            <section className="mb-20 pb-12 border-b border-neutral-200">
                <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 mb-4">
                    The System
                </h1>
                <p className="text-lg text-neutral-600 leading-relaxed max-w-xl mb-6">
                    A structured study program covering Fourth Way ideas,
                    based on the works of Ouspensky, Nicoll, Collin,
                    and related authors.
                </p>
                <p className="text-xs text-neutral-400">
                    This platform supports intellectual study only. It does not provide the conditions for practical development.
                </p>
            </section>

            {/* Section 2 — Level 0 Orientation */}
            <section className="mb-16">
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">
                    Level 0 — Orientation
                </h2>
                <ul className="space-y-0">
                    <li className="py-3 border-b border-neutral-100">
                        <Link
                            href="/levels"
                            className="text-base text-neutral-800 hover:text-neutral-600 no-underline"
                        >
                            What is the Fourth Way?
                        </Link>
                    </li>
                    <li className="py-3 border-b border-neutral-100">
                        <Link
                            href="/levels"
                            className="text-base text-neutral-800 hover:text-neutral-600 no-underline"
                        >
                            The structure of this program
                        </Link>
                    </li>
                    <li className="py-3 border-b border-neutral-100">
                        <Link
                            href="/levels"
                            className="text-base text-neutral-800 hover:text-neutral-600 no-underline"
                        >
                            Sources and lineage
                        </Link>
                    </li>
                    <li className="py-3 border-b border-neutral-100">
                        <Link
                            href="/levels"
                            className="text-base text-neutral-800 hover:text-neutral-600 no-underline"
                        >
                            What this system does not claim
                        </Link>
                    </li>
                </ul>
                <div className="mt-8">
                    <Link href="/levels" className="btn">
                        Begin Studying
                    </Link>
                </div>
            </section>
        </main >
    );
}
