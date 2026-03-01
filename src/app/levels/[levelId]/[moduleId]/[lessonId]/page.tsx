import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LessonContent } from "@/lib/types";

export default async function LessonPage({
    params,
}: {
    params: Promise<{ levelId: string; moduleId: string; lessonId: string }>;
}) {
    const { levelId, moduleId, lessonId } = await params;
    const supabase = await createClient();

    const { data: lesson } = await supabase
        .from("lessons")
        .select('id, title, content, "order", module_id')
        .eq("id", lessonId)
        .single();

    if (!lesson) {
        notFound();
    }

    const content = lesson.content as LessonContent;

    const { data: quiz } = await supabase
        .from("quizzes")
        .select("id")
        .eq("lesson_id", lessonId)
        .single();

    return (
        <main className="max-w-3xl mx-auto px-6 py-12">
            <Link
                href={`/levels/${levelId}/${moduleId}`}
                className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 no-underline mb-8"
            >
                ← Back to Module
            </Link>

            {/* Title */}
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-8">
                {lesson.title}
            </h1>

            {/* Core Idea — visually emphasized */}
            <section className="mb-10">
                <div className="bg-neutral-100 border-l-3 border-neutral-400 px-6 py-5">
                    <p className="text-lg leading-relaxed text-neutral-800 m-0">
                        {content.core_idea}
                    </p>
                </div>
            </section>

            {/* Explanation — clean readable text */}
            <section className="mb-10">
                <h2 className="text-lg font-semibold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
                    Explanation
                </h2>
                <p className="text-base text-neutral-700 leading-relaxed max-w-xl">
                    {content.explanation}
                </p>
            </section>

            {/* Definitions — separated section */}
            {content.key_definitions && content.key_definitions.length > 0 && (
                <section className="mb-10">
                    <h2 className="text-lg font-semibold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
                        Key Definitions
                    </h2>
                    <dl className="space-y-4 max-w-xl">
                        {content.key_definitions.map((def, i) => (
                            <div key={i}>
                                <dt className="font-semibold text-neutral-900 mb-1">
                                    {def.term}
                                </dt>
                                <dd className="text-neutral-600 pl-4 border-l-2 border-neutral-100">
                                    {def.definition}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {/* Misunderstandings — clearly labeled */}
            {content.common_misunderstandings &&
                content.common_misunderstandings.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
                            Common Misunderstandings
                        </h2>
                        <div className="space-y-4">
                            {content.common_misunderstandings.map((mis, i) => (
                                <div
                                    key={i}
                                    className="bg-neutral-50 px-5 py-4 rounded max-w-xl"
                                >
                                    <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1">
                                        Misunderstanding
                                    </p>
                                    <p className="text-neutral-700 mb-3">
                                        {mis.misunderstanding}
                                    </p>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1">
                                        Correction
                                    </p>
                                    <p className="text-neutral-700 m-0">
                                        {mis.correction}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

            {/* Conceptual Contrast */}
            {content.conceptual_contrast &&
                content.conceptual_contrast.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
                            Conceptual Contrast
                        </h2>
                        <table className="w-full max-w-xl text-sm border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left px-3 py-2 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                        Correct
                                    </th>
                                    <th className="text-left px-3 py-2 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                        Incorrect
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {content.conceptual_contrast.map(
                                    (contrast, i) => (
                                        <tr key={i}>
                                            <td className="px-3 py-2 border-b border-neutral-100 text-emerald-700">
                                                {contrast.correct}
                                            </td>
                                            <td className="px-3 py-2 border-b border-neutral-100 text-red-700">
                                                {contrast.incorrect}
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </section>
                )}

            {/* Preparation for Testing */}
            {content.preparation_for_testing &&
                content.preparation_for_testing.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
                            Preparation for Testing
                        </h2>
                        <p className="text-neutral-600 mb-3 text-sm">
                            To pass this lesson, you must be able to:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-neutral-700 max-w-xl">
                            {content.preparation_for_testing.map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    </section>
                )}

            {/* Quiz Link */}
            {quiz && (
                <section className="mt-12 pt-8 border-t border-neutral-200">
                    <Link
                        href={`/levels/${levelId}/${moduleId}/${lessonId}/quiz`}
                        className="btn"
                    >
                        Begin Quiz
                    </Link>
                </section>
            )}
        </main>
    );
}
