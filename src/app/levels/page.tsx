import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function LevelsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: levels } = await supabase
        .from("levels")
        .select('id, title, "order"')
        .order("order", { ascending: true });

    let hasSubscription = false;
    if (user) {
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("status")
            .eq("user_id", user.id)
            .eq("status", "active")
            .single();
        hasSubscription = !!subscription;
    }

    return (
        <main className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-3">
                Curriculum
            </h1>
            <p className="text-base text-neutral-600 mb-8 max-w-xl">
                The curriculum is structured across five levels, each
                building on the precision of the previous.
            </p>

            <ul className="max-w-xl">
                {levels?.map((level) => {
                    const accessible =
                        level.order === 0 || hasSubscription;
                    return (
                        <li
                            key={level.id}
                            className="border-b border-neutral-100 first:border-t first:border-neutral-100"
                        >
                            {accessible ? (
                                <Link
                                    href={`/levels/${level.id}`}
                                    className="flex items-center justify-between py-3 px-4 text-base text-neutral-800 no-underline hover:bg-neutral-50 transition-colors duration-150"
                                >
                                    <span>
                                        Level {level.order} — {level.title}
                                    </span>
                                </Link>
                            ) : (
                                <span className="flex items-center justify-between py-3 px-4 text-base text-neutral-400">
                                    <span>
                                        Level {level.order} — {level.title}
                                    </span>
                                    <span className="text-xs text-neutral-400">
                                        Subscription required
                                    </span>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>

            {!hasSubscription && user && (
                <div className="bg-neutral-100 px-5 py-4 rounded mt-8 max-w-xl">
                    <p className="text-sm text-neutral-600 mb-3">
                        Subscribe to access Levels 1–4.
                    </p>
                    <Link href="/dashboard" className="btn">
                        View Subscription Options
                    </Link>
                </div>
            )}
        </main>
    );
}
