const TOAST_DURATION = 4000;

export function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container)
        return;

    const toast = document.createElement("div"); toast.className = `toast toast--${type}`;
    const iconSvg = getToastIcon(type);

    toast.innerHTML = `
        <div class="toast__icon">${iconSvg}</div>
        <span class="toast__message">${escapeHtml(message)}</span>
        <button class="toast__close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;

    toast.querySelector(".toast__close").addEventListener("click", () => {
        removeToast(toast);
    });

    container.appendChild(toast); setTimeout(() => {
        removeToast(toast);
    }, TOAST_DURATION);
}

function removeToast(toast) {
    toast.style.animation = "fadeOut 0.3s ease forwards"; setTimeout(() => {
        toast.remove();
    }, 300);
}

function getToastIcon(type) {
    switch (type) {
        case "success":
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            `;
        case "error":
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            `;
        default:
            return `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
            `;
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text; return div.innerHTML;
}