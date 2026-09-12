document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('backend-status');
    const checkBtn = document.getElementById('check-btn');

    const indicatorEl = document.querySelector('.status-indicator');

    async function checkBackendHealth() {
        if (statusEl) {
            statusEl.textContent = 'Checking backend (127.0.0.1:8000)...';
            statusEl.style.color = '#94a3b8';
        }
        if (indicatorEl) {
            indicatorEl.className = 'status-indicator';
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch('http://127.0.0.1:8000/api/health', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                    if (statusEl) {
                        statusEl.textContent = 'Backend Online (127.0.0.1:8000)';
                        statusEl.style.color = '#4ade80';
                    }
                    if (indicatorEl) {
                        indicatorEl.className = 'status-indicator online';
                    }
                    return true;
                }
            }
            if (statusEl) {
                statusEl.textContent = 'Backend Error HTTP ' + res.status;
                statusEl.style.color = '#f87171';
            }
            if (indicatorEl) {
                indicatorEl.className = 'status-indicator offline';
            }
            return false;
        } catch (e) {
            if (statusEl) {
                statusEl.textContent = 'Backend Offline';
                statusEl.style.color = '#f87171';
            }
            if (indicatorEl) {
                indicatorEl.className = 'status-indicator offline';
            }
            return false;
        }
    }

    await checkBackendHealth();

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
