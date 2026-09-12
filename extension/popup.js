document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('backend-status');
    const checkBtn = document.getElementById('check-btn');

    try {
        const res = await fetch('http://127.0.0.1:8000/api/health');
        if (res.ok) {
            statusEl.textContent = 'Backend Online (127.0.0.1:8000)';
            statusEl.style.color = '#4ade80';
        } else {
            statusEl.textContent = 'Backend Error HTTP ' + res.status;
            statusEl.style.color = '#f87171';
        }
    } catch (e) {
        statusEl.textContent = 'Backend Offline';
        statusEl.style.color = '#f87171';
    }

    checkBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    if (window.KukkoCompanion && typeof window.KukkoCompanion.trigger === 'function') {
                        window.KukkoCompanion.trigger(true);
                    } else {
                        location.reload();
                    }
                }
            }).catch(err => {
                console.warn('Script execution error:', err);
            });
        }
    });
});
