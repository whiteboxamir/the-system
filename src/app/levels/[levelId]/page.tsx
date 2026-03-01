import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function LevelPage({
    params,
}: {
    params: Promise<{ levelId: string }>;
}) {
    const { levelId } = await params;
    const supabase = await createClient();

    const { data: level } = await supabase
        .from("levels")
        .select('id, title, "order"')
        .eq("id", levelId)
        .single();

    if (!level) {
        notFound();
    }

    const { data: modules } = await supabase
        .from("modules")
        .select('id, title, "order"')
        .eq("level_id", levelId)
        .order("order", { ascending: true });

    return (
        <main className="max-w-3xl mx-auto px-6 py-12">
            <Link
                href="/levels"
                className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 no-underline mb-8"
            >
                ← Back to Curriculum
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-6">
                Level {level.order} — {level.title}
            </h1>
            <ul className="max-w-xl">
                {modules?.map((mod) => (
                    <li
                        key={mod.id}
                        className="border-b border-neutral-100 first:border-t first:border-neutral-100"
                    >
                        <Link
                            href={`/levels/${levelId}/${mod.id}`}
                            className="flex items-center justify-between py-3 px-4 text-base text-neutral-800 no-underline hover:bg-neutral-50 transition-colors duration-150"
                        >
                            <span>
                                Module {level.order}.{mod.order} —{" "}
                                {mod.title}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
