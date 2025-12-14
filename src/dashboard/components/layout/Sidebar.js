export class Sidebar {
    constructor() {
        this.element = document.getElementById("sidebar");

        this.overlay = null;
        this._isOpen = false;

        this._init();
    }

    _init() {
        this.overlay = document.createElement("div");
        this.overlay.className = "sidebar-overlay";

        document.body.appendChild(this.overlay);
        this.overlay.addEventListener("click", () => this.close());

        const menuToggle = document.getElementById("menu-toggle");
        if (menuToggle) {
            menuToggle.addEventListener("click", () => this.toggle());
        }
    }

    open() {
        this._isOpen = true;

        this.element.classList.add("open");
        this.overlay.classList.add("visible");

        document.body.style.overflow = "hidden";
    }

    close() {
        this._isOpen = false;

        this.element.classList.remove("open");
        this.overlay.classList.remove("visible");

        document.body.style.overflow = "";
    }

    toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    setActive(page) {
        const items = this.element.querySelectorAll(".nav-item"); items.forEach(item => {
            item.classList.toggle("active", item.dataset.page === page);
        });
    }

    updateStatus(isActive, text = null) {
        const statusEl = document.getElementById("sidebar-status");
        if (!statusEl)
            return;

        const indicator = statusEl.querySelector(".status-indicator");
        const textEl = statusEl.querySelector("span");

        if (indicator) {
            indicator.classList.toggle("status-indicator--active", isActive);
            indicator.classList.toggle("status-indicator--inactive", !isActive);
        }

        if (textEl && text) {
            textEl.textContent = text;
        }
    }
}