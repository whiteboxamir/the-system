// The Teacher Agent Logic

const introSequence = [
    '"It is necessary to observe oneself."',
    '"You do not know yourself. You do not realize you are a machine."',
    '"Everything happens. You do not do anything. It happens."',
    '"But there is a system. A way out of sleep."',
    '"We call it The Work."'
];

let introIndex = 0;

// Intro Screen Logic
const voiceText = document.getElementById('voice-text');
const btnNextVoice = document.getElementById('next-voice');

btnNextVoice.addEventListener('click', () => {
    introIndex++;
    if (introIndex < introSequence.length) {
        voiceText.style.opacity = 0;
        setTimeout(() => {
            voiceText.innerText = introSequence[introIndex];
            voiceText.style.opacity = 1;
            if (introIndex === introSequence.length - 1) {
                btnNextVoice.innerText = "Enter The System";
            }
        }, 500);
    } else {
        // Transition to Dashboard
        document.getElementById('intro-sequence').classList.remove('active');
        setTimeout(() => {
            document.getElementById('dashboard').classList.add('active');
            document.getElementById('dashboard').classList.remove('hidden');
        }, 800);
    }
});


// Dashboard Logic
const btnBegin = document.getElementById('btn-begin');
const btnObserve = document.getElementById('btn-observe');
const formContainer = document.getElementById('observation-form-container');
const btnCancel = document.getElementById('cancel-obs');
const chatHistory = document.getElementById('chat-history');

function appendToChat(text, type) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = `<p>${text}</p>`;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

btnBegin.addEventListener('click', () => {
    btnBegin.style.display = 'none';

    appendToChat("I wish to begin.", "user-msg");

    setTimeout(() => {
        appendToChat("Good. To begin, you must prove you can observe without judgment. Submit your first observation of the machine.", "agent-msg");
        btnObserve.style.display = 'block';
    }, 1000);
});

btnObserve.addEventListener('click', () => {
    document.getElementById('action-buttons').classList.add('hidden');
    formContainer.classList.remove('hidden');
});

btnCancel.addEventListener('click', () => {
    formContainer.classList.add('hidden');
    document.getElementById('action-buttons').classList.remove('hidden');
});

// Engine Integration
document.getElementById('obs-form').addEventListener('submit', function (e) {
    e.preventDefault();

    // Hide form immediately
    formContainer.classList.add('hidden');

    // Get Data
    const data = {
        duration_minutes: document.getElementById('durationInput').value,
        center_observed: document.getElementById('centerSelect').value,
        observation_text: document.getElementById('textInput').value,
        identified: document.getElementById('identifiedInput').checked
    };

    // Show user message
    appendToChat(`Observation Submitted: [${data.duration_minutes}m, ${data.center_observed.toUpperCase()}] "${data.observation_text}"`, "user-msg");

    // "Typing" delay from the Teacher
    setTimeout(() => {
        // Run Engine
        // Note: engine.js must be loaded before this!
        let result;
        try {
            result = evaluateObservation(data);
        } catch (err) {
            console.error(err);
            result = {
                evaluation: "System error identifying your state.",
                teaching_reference: "Please try again later.",
                next_aim: "Wait."
            };
        }

        // Output Agent Results
        appendToChat(`<strong>EVALUATION:</strong> ${result.evaluation}`, "agent-msg");

        setTimeout(() => {
            appendToChat(`<strong>THEORY:</strong> <em>${result.teaching_reference}</em>`, "agent-msg");

            setTimeout(() => {
                appendToChat(`<strong>YOUR AIM:</strong> ${result.next_aim}`, "agent-msg");

                // Update Sidebar Work Panel
                document.getElementById('current-aim').innerText = result.next_aim;

                // Show action buttons again so they can submit more
                setTimeout(() => {
                    document.getElementById('action-buttons').classList.remove('hidden');
                    // Reset form
                    document.getElementById('obs-form').reset();
                }, 1000);

            }, 2000);
        }, 1500);

    }, 1500);
});
