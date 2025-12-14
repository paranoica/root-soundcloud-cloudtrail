export class Navigation {
    constructor(options = {}) {
        this.onNavigate = options.onNavigate || (() => { });
        this._currentPage = "overview";

        this._init();
    }

    _init() {
        window.addEventListener("hashchange", () => this._handleHashChange());
        document.querySelectorAll(".nav-item").forEach(item => {
            item.addEventListener("click", (e) => {
                e.preventDefault(); const page = item.dataset.page; if (page) {
                    this.navigate(page);
                }
            });
        });

        this._handleHashChange();
    }

    _handleHashChange() {
        const hash = window.location.hash.slice(2) || "overview";
        const page = hash.split("/")[0] || "overview";

        if (page !== this._currentPage) {
            this._currentPage = page;
            this.onNavigate(page);
        }
    }

    navigate(page) {
        window.location.hash = `/${page}`;
    }

    getCurrentPage() {
        return this._currentPage;
    }
}