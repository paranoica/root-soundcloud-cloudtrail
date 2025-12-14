export class TimeFilter {
    constructor(container, onChange) {
        this.container = container;
        this.onChange = onChange;
        this.currentPeriod = "today";
        this.buttons = [];

        this._init();
    }

    _init() {
        this.buttons = this.container.querySelectorAll(".time-filter__btn");
        this.buttons.forEach(btn => {
            btn.addEventListener("click", () => {
                const period = btn.dataset.period;
                if (period !== this.currentPeriod) {
                    this.select(period);
                }
            });
        });
    }

    select(period) {
        this.currentPeriod = period;

        this.buttons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.period === period);
        });

        if (this.onChange) {
            this.onChange(period);
        }
    }

    getPeriod() {
        return this.currentPeriod;
    }

    disable() {
        this.buttons.forEach(btn => {
            btn.disabled = true;
        });
    }

    enable() {
        this.buttons.forEach(btn => {
            btn.disabled = false;
        });
    }
}

export function createTimeFilter(container, onChange) {
    return new TimeFilter(container, onChange);
}

export function mapPeriod(uiPeriod) {
    const mapping = {
        "today": "today",
        "week": "week",
        "month": "month",
        "all": "all",
    };
    return mapping[uiPeriod] || "all";
}