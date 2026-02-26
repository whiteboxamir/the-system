/**
 * The Fourth Way Engine
 * A deterministic processor that evaluates a student's self-observation
 * and returns feedback based on Fourth Way principles.
 */

function evaluateObservation(observationData) {
    const text = (observationData.observation_text || "").toLowerCase();
    const identified = observationData.identified || false;
    const center = observationData.center_observed || "unknown";
    
    let evaluation = "";
    let reference = "";
    let nextAim = "";

    // Rule 1: Detecting negative emotions and judgment which destroy neutral observation
    if (text.includes("angry") || text.includes("bad") || text.includes("stupid") || text.includes("frustrated") || text.includes("judge") || text.includes("negative")) {
        evaluation = "Student has lost neutral self-observation to negative emotions and judgment. You have left the observational state and entered a sleep state.";
        reference = 'P.D. Ouspensky: "Observation must be like a photograph. It must register everything without judging. As soon as you judge, you are identified."';
        nextAim = "For your next exercise, observe your negative imagination and mechanical judgment. Do not try to stop it or change it, only photograph its occurrence.";
    } 
    // Rule 2: Detecting identification with a specific center
    else if (identified) {
        evaluation = `Student identified with the ${center} center. The attention was completely absorbed by the object rather than being divided between the observer and the observed.`;
        reference = 'G.I. Gurdjieff: "Man cannot observe himself because he is identified with his observation. His attention is directed solely outward."';
        nextAim = "Practice divided attention: Attempt to consciously sense your physical body (e.g., your right arm) while observing your environment. Begin with 2 minutes.";
    } 
    // Rule 3: Neutral observation achieved
    else {
        evaluation = `Neutral observation of the ${center} center was partially achieved. However, the machine will soon attempt to imitate observation.`;
        reference = 'Maurice Nicoll: "True self-observation creates a new memory, distinct from the memory of the moving/instinctive center. This new memory is the beginning of escaping mechanicalness."';
        nextAim = "Continue neutral observation. Your task now is to notice the transitions and contradictions between centers—when one center desires something the other hates.";
    }

    return {
        evaluation: evaluation,
        teaching_reference: reference,
        next_aim: nextAim
    };
}

// ---------------------------------------------------------
// PROOF OF CONCEPT: Running without UI
// ---------------------------------------------------------

const sampleInput = {
    duration_minutes: 15,
    center_observed: "moving",
    observation_text: "I noticed my leg shaking rapidly. I felt frustrated at myself for being so mechanical.",
    identified: true
};

console.log("=== INPUT (Student Data) ===");
console.log(JSON.stringify(sampleInput, null, 2));

console.log("\n=== PROCESSING (Fourth Way Deterministic Engine) ===");
const output = evaluateObservation(sampleInput);

console.log("\n=== OUTPUT (Teacher Assessment) ===");
console.log(JSON.stringify(output, null, 2));

// Export for use in our UI later
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { evaluateObservation };
}
