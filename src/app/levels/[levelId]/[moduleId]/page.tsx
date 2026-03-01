import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ModulePage({
    params,
}: {
    params: Promise<{ levelId: string; moduleId: string }>;
}) {
    const { levelId, moduleId } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: module } = await supabase
        .from("modules")
        .select('id, title, "order", level_id')
        .eq("id", moduleId)
        .single();

    if (!module) {
        notFound();
    }

    const { data: level } = await supabase
        .from("levels")
        .select('id, title, "order"')
        .eq("id", levelId)
        .single();

    const { data: lessons } = await supabase
        .from("lessons")
        .select('id, title, "order"')
        .eq("module_id", moduleId)
        .order("order", { ascending: true });

    let progressMap = new Map<string, boolean>();
    if (user && lessons) {
        const { data: progressData } = await supabase
            .from("progress")
            .select("lesson_id, completed")
            .eq("user_id", user.id)
            .in(
                "lesson_id",
                lessons.map((l) => l.id)
            );

        progressData?.forEach((p) => {
            progressMap.set(p.lesson_id, p.completed);
        });
    }

    return (
        <main className="max-w-3xl mx-auto px-6 py-12">
            <Link
                href={`/levels/${levelId}`}
                className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 no-underline mb-8"
            >
                ← Back to Level {level?.order}
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-6">
                Module {level?.order}.{module.order} — {module.title}
            </h1>
            <ul className="max-w-xl">
                {lessons?.map((lesson, index) => {
                    const completed =
                        progressMap.get(lesson.id) ?? false;
                    const locked =
                        index > 0 &&
                        !progressMap.get(lessons[index - 1].id);
                    return (
                        <li
                            key={lesson.id}
                            className="border-b border-neutral-100 first:border-t first:border-neutral-100"
                        >
                            {locked ? (
                                <span className="flex items-center justify-between py-3 px-4 text-base text-neutral-400">
                                    <span>{lesson.title}</span>
                                    <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-400 rounded">
                                        Locked
                                    </span>
                                </span>
                            ) : (
                                <Link
                                    href={`/levels/${levelId}/${moduleId}/${lesson.id}`}
                                    className="flex items-center justify-between py-3 px-4 text-base text-neutral-800 no-underline hover:bg-neutral-50 transition-colors duration-150"
                                >
                                    <span>{lesson.title}</span>
                                    {completed && (
                                        <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                                            Complete
                                        </span>
                                    )}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ul>
        </main>
    );
}
