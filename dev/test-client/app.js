const API_BASE = 'http://127.0.0.1:8000/api';

const healthBtn = document.getElementById('health-btn');
const healthStatus = document.getElementById('health-status');
const chatInput = document.getElementById('chat-input');
const chatBtn = document.getElementById('chat-btn');
const chatReply = document.getElementById('chat-reply');
const chatEmotion = document.getElementById('chat-emotion');
const errorBox = document.getElementById('error-box');

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
}

healthBtn.addEventListener('click', async () => {
    hideError();
    healthBtn.disabled = true;
    healthStatus.textContent = 'Checking...';

    try {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        healthStatus.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        showError(`Health check failed: ${e.message}. Is the backend running?`);
        healthStatus.textContent = 'Failed';
    } finally {
        healthBtn.disabled = false;
    }
});

chatBtn.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    hideError();
    chatBtn.disabled = true;
    chatReply.textContent = '...';
    chatEmotion.textContent = '...';

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        chatReply.textContent = data.reply || '-';
        chatEmotion.textContent = data.emotion || '-';
    } catch (e) {
        showError(`Chat request failed: ${e.message}`);
        chatReply.textContent = 'Error';
        chatEmotion.textContent = 'Error';
    } finally {
        chatBtn.disabled = false;
    }
});
