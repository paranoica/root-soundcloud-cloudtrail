import { MESSAGES } from "../../shared/constants.js";
import { formatDuration, getFunEquivalent } from "../../shared/utils/time.js";
import { formatNumber } from "../../shared/i18n/index.js";
import { generateWrappedShareText, copyToClipboard, getShareUrls } from "../../shared/utils/share.js";
import { showToast } from "../utils/toast.js";

export class WrappedPage {
	constructor(options = {}) {
		this.container = options.container;

		this._wrappedData = null;
		this._currentSlide = 0;
		this._slides = [];
		this._isAnimating = false;
		this._year = new Date().getFullYear();
	}

	async render() {
		this.container.innerHTML = this._getTemplate();
		this._bindEvents(); await this._loadWrapped();
	}

	async _loadWrapped() {
		try {
			const response = await chrome.runtime.sendMessage({
				type: MESSAGES.GENERATE_WRAPPED,
				data: { year: this._year }
			});

			if (response?.error) {
				throw new Error(response.error);
			}

			this._wrappedData = response;
			if (!this._wrappedData || this._wrappedData.summary.totalSeconds < 3600) {
				this._showNotEnoughData();
				return;
			}

			this._buildSlides();
			this._renderSlides();
		} catch (error) {
			console.error("[Wrapped] Load failed:", error);
			this._showError();
		}
	}

	_bindEvents() {
		const yearBtns = this.container.querySelectorAll(".year-btn"); yearBtns.forEach(btn => {
			btn.addEventListener("click", () => {
				const year = parseInt(btn.dataset.year);
				this._selectYear(year);
			});
		});

		this.container.addEventListener("click", (e) => {
			if (e.target.closest("#prev-slide")) {
				this._prevSlide();
			} else if (e.target.closest("#next-slide")) {
				this._nextSlide();
			}
		});

		document.addEventListener("keydown", this._handleKeydown.bind(this)); this.container.addEventListener("click", (e) => {
			const shareBtn = e.target.closest("[data-share]");
			if (shareBtn) {
				this._handleShare(shareBtn.dataset.share);
			}
		});
	}

	_handleKeydown(e) {
		if (e.key === "ArrowLeft") {
			this._prevSlide();
		} else if (e.key === "ArrowRight" || e.key === " ") {
			this._nextSlide();
		}
	}

	_selectYear(year) {
		this._year = year;
		this.container.querySelectorAll(".year-btn").forEach(btn => {
			btn.classList.toggle("active", parseInt(btn.dataset.year) === year);
		});

		this._currentSlide = 0;
		this._loadWrapped();
	}

	_buildSlides() {
		const data = this._wrappedData;

		const equivalent = getFunEquivalent(data.summary.totalSeconds);
		const bestEquivalent = equivalent.getBest();

		this._slides = [
			{
				type: "intro",
				title: `Your ${this._year}`,
				subtitle: "on SoundCloud",
				content: `<p>Let"s see what you"ve been listening to...</p>`,
				background: "gradient-1",
			},
			{
				type: "stat",
				title: "You listened for",
				value: formatDuration(data.summary.totalSeconds, { style: "long", showSeconds: false }),
				subtitle: this._getEquivalentText(bestEquivalent),
				background: "gradient-2",
			},
			{
				type: "stat",
				title: "You discovered",
				value: formatNumber(data.summary.totalTracks),
				valueLabel: "tracks",
				subtitle: `From ${formatNumber(data.summary.totalArtists)} different artists`,
				background: "gradient-3",
			},
			{
				type: "top-track",
				title: "Your #1 Track",
				track: data.topTracks[0],
				background: "gradient-4",
			},
			{
				type: "top-list",
				title: "Your Top 5",
				items: data.topTracks.slice(0, 5),
				itemType: "track",
				background: "gradient-5",
			},
			{
				type: "top-artist",
				title: "Your #1 Artist",
				artist: data.topArtists[0],
				background: "gradient-1",
			},
			{
				type: "patterns",
				title: "Your Listening Style",
				patterns: data.patterns,
				summary: data.summary,
				background: "gradient-2",
			},
			{
				type: "summary",
				title: `That"s a wrap!`,
				subtitle: `Your ${this._year} on SoundCloud`,
				data: data,
				background: "gradient-6",
			},
		];
	}

	_getEquivalentText(equivalent) {
		const texts = {
			movies: `That"s like watching ${equivalent.count} movies! 🎬`,
			audiobooks: `That"s ${equivalent.count} audiobooks worth! 📚`,
			flights: `That"s ${equivalent.count} flights to Tokyo! ✈️`,
		};

		return texts[equivalent.type] || "";
	}

	_renderSlides() {
		const content = this.container.querySelector("#wrapped-content"); content.innerHTML = `
			<div class="wrapped-slider">
				${this._slides.map((slide, index) => `
					<div class="wrapped-slide ${slide.background} ${index === 0 ? "active" : ""}" data-index="${index}">
						${this._renderSlideContent(slide)}
					</div>
				`).join("")}
			</div>
			
			<div class="wrapped-nav">
				<button class="wrapped-nav__btn" id="prev-slide" ${this._currentSlide === 0 ? "disabled" : ""}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15 18 9 12 15 6"/>
					</svg>
				</button>
				<div class="wrapped-nav__dots">
					${
						this._slides.map((_, i) => `
							<div class="wrapped-nav__dot ${i === 0 ? "active" : ""}" data-index="${i}"></div>
						`).join("")
					}
				</div>
				<button class="wrapped-nav__btn" id="next-slide">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9 18 15 12 9 6"/>
					</svg>
				</button>
			</div>
		`;

		content.querySelectorAll(".wrapped-nav__dot").forEach(dot => {
			dot.addEventListener("click", () => {
				this._goToSlide(parseInt(dot.dataset.index));
			});
		});
	}

	_renderSlideContent(slide) {
		switch (slide.type) {
			case "intro":
				return `
					<div class="slide-content slide-content--intro">
						<div class="slide-logo">
							<svg viewBox="0 0 48 48" fill="none">
								<circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2"/>
								<path d="M18 18c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-8c-1.1 0-2-.9-2-2V18z" fill="currentColor" opacity="0.8"/>
								<path d="M14 20h3v10h-3zM31 20h3v10h-3z" fill="currentColor" opacity="0.6"/>
							</svg>
						</div>
						<h1 class="slide-title slide-title--large">${slide.title}</h1>
						<h2 class="slide-subtitle">${slide.subtitle}</h2>
						<div class="slide-cta">
							<span>Tap to continue</span>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="9 18 15 12 9 6"/>
							</svg>
						</div>
					</div>
				`;
			case "stat":
				return `
					<div class="slide-content slide-content--stat">
						<p class="slide-label">${slide.title}</p>
						<h1 class="slide-value">${slide.value}</h1>
						${slide.valueLabel ? `<p class="slide-value-label">${slide.valueLabel}</p>` : ""}
						<p class="slide-subtitle">${slide.subtitle}</p>
					</div>
				`;
			case "top-track":
				return `
					<div class="slide-content slide-content--top-track">
						<p class="slide-label">${slide.title}</p>
						<div class="featured-track">
							<div class="featured-track__artwork">
								${
									slide.track?.artworkUrl
										? `<img src="${slide.track.artworkUrl}" alt="">`
										: `<div class="featured-track__placeholder">🎵</div>`
								}
							</div>
							<h2 class="featured-track__title">${this._escapeHtml(slide.track?.title || "Unknown")}</h2>
							<p class="featured-track__artist">${this._escapeHtml(slide.track?.artist || "Unknown")}</p>
							<div class="featured-track__stats">
								<span>${formatNumber(slide.track?.playCount || 0)} plays</span>
								<span>•</span>
								<span>${formatDuration(slide.track?.totalSeconds || 0, { showSeconds: false })}</span>
							</div>
						</div>
					</div>
				`;
			case "top-list":
				return `
					<div class="slide-content slide-content--list">
						<p class="slide-label">${slide.title}</p>
						<div class="top-list">
							${
								slide.items.map((item, i) => `
									<div class="top-list__item">
										<span class="top-list__rank">${i + 1}</span>
									<div class="top-list__artwork">
										${item.artworkUrl
											? `<img src="${item.artworkUrl.replace("-t500x500", "-t200x200")}" alt="">`
											: ""
										}
									</div>
									<div class="top-list__info">
										<div class="top-list__title">${this._escapeHtml(item.title || "Unknown")}</div>
										<div class="top-list__subtitle">${this._escapeHtml(item.artist || "Unknown")}</div>
									</div>
									<div class="top-list__plays">${formatNumber(item.playCount || 0)}</div>
									</div>
								`).join("")
							}
						</div>
					</div>
				`;
			case "top-artist":
				return `
					<div class="slide-content slide-content--top-artist">
						<p class="slide-label">${slide.title}</p>
						<div class="featured-artist">
							<div class="featured-artist__avatar">
								${
									slide.artist?.avatarUrl
										? `<img src="${slide.artist.avatarUrl}" alt="">`
										: `<div class="featured-artist__initial">${(slide.artist?.name || "?")[0].toUpperCase()}</div>`
								}
							</div>
							<h2 class="featured-artist__name">${this._escapeHtml(slide.artist?.name || "Unknown")}</h2>
							<div class="featured-artist__stats">
								<div class="featured-artist__stat">
									<span class="featured-artist__stat-value">${formatDuration(slide.artist?.totalSeconds || 0, { showSeconds: false })}</span>
									<span class="featured-artist__stat-label">listened</span>
								</div>
								<div class="featured-artist__stat">
									<span class="featured-artist__stat-value">${slide.artist?.trackCount || 0}</span>
									<span class="featured-artist__stat-label">tracks</span>
								</div>
							</div>
						</div>
					</div>
				`;
			case "patterns":
				return `
					<div class="slide-content slide-content--patterns">
						<p class="slide-label">${slide.title}</p>
						<div class="patterns-grid">
							<div class="pattern-card">
								<div class="pattern-card__icon">🌙</div>
								<div class="pattern-card__value">${this._formatHour(slide.summary.mostActiveHour)}</div>
								<div class="pattern-card__label">Peak hour</div>
							</div>
							<div class="pattern-card">
								<div class="pattern-card__icon">📅</div>
								<div class="pattern-card__value">${this._formatDay(slide.summary.mostActiveDay)}</div>
								<div class="pattern-card__label">Top day</div>
							</div>
							<div class="pattern-card">
								<div class="pattern-card__icon">📊</div>
								<div class="pattern-card__value">${this._formatMonth(slide.summary.mostActiveMonth)}</div>
								<div class="pattern-card__label">Best month</div>
							</div>
						</div>
					</div>
				`;
			case "summary":
				return `
					<div class="slide-content slide-content--summary">
						<div class="summary-header">
							<h1 class="slide-title">${slide.title}</h1>
							<p class="slide-subtitle">${slide.subtitle}</p>
						</div>
						
						<div class="summary-stats">
							<div class="summary-stat">
								<span class="summary-stat__value">${formatDuration(slide.data.summary.totalSeconds, { showSeconds: false })}</span>
								<span class="summary-stat__label">listened</span>
							</div>
							<div class="summary-stat">
								<span class="summary-stat__value">${formatNumber(slide.data.summary.totalTracks)}</span>
								<span class="summary-stat__label">tracks</span>
							</div>
							<div class="summary-stat">
								<span class="summary-stat__value">${formatNumber(slide.data.summary.totalArtists)}</span>
								<span class="summary-stat__label">artists</span>
							</div>
						</div>

						<div class="share-section">
							<p class="share-section__title">Share your Wrapped</p>
							<div class="share-buttons">
								<button class="share-btn" data-share="twitter">
									<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
								</button>
								<button class="share-btn" data-share="copy">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
								</button>
								<button class="share-btn" data-share="download">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
								</button>
							</div>
						</div>
					</div>
				`;
			default:
				return "";
		}
	}

	_nextSlide() {
		if (this._isAnimating) return;
		if (this._currentSlide >= this._slides.length - 1) return;

		this._goToSlide(this._currentSlide + 1);
	}

	_prevSlide() {
		if (this._isAnimating) return;
		if (this._currentSlide <= 0) return;

		this._goToSlide(this._currentSlide - 1);
	}

	_goToSlide(index) {
		if (this._isAnimating || index === this._currentSlide) return;
		if (index < 0 || index >= this._slides.length) return;

		this._isAnimating = true;

		const slides = this.container.querySelectorAll(".wrapped-slide");
		const dots = this.container.querySelectorAll(".wrapped-nav__dot");
		const prevBtn = this.container.querySelector("#prev-slide");
		const nextBtn = this.container.querySelector("#next-slide");

		slides.forEach((slide, i) => {
			slide.classList.remove("active", "prev", "next");
			if (i === index) {
				slide.classList.add("active");
			} else if (i < index) {
				slide.classList.add("prev");
			} else {
				slide.classList.add("next");
			}
		});

		dots.forEach((dot, i) => {
			dot.classList.toggle("active", i === index);
		});

		prevBtn.disabled = index === 0;
		nextBtn.disabled = index === this._slides.length - 1;

		this._currentSlide = index;

		setTimeout(() => {
			this._isAnimating = false;
		}, 500);
	}

	async _handleShare(type) {
		const shareText = generateWrappedShareText(this._wrappedData);

		switch (type) {
			case "twitter":
				const urls = getShareUrls(shareText);
				window.open(urls.twitter, "_blank");

				break;
			case "copy":
				const success = await copyToClipboard(shareText);
				showToast(success ? "Copied to clipboard!" : "Failed to copy", success ? "success" : "error");

				break;
			case "download":
				this._downloadImage();
				break;
		}
	}

	async _downloadImage() {
		showToast("Generating image...", "info"); try {
			const currentSlide = this.container.querySelector(".wrapped-slide.active");
			if (!currentSlide)
				return;

			const shareText = generateWrappedShareText(this._wrappedData);

			await copyToClipboard(shareText);
			showToast("Stats copied! Screenshot the slide to share.", "success");
		} catch (error) {
			showToast("Failed to generate image", "error");
		}
	}

	_formatHour(hour) {
		if (hour === null || hour === undefined)
			return "--";

		const h = parseInt(hour);

		if (h === 0) return "12 AM";
		if (h < 12) return `${h} AM`;
		if (h === 12) return "12 PM";

		return `${h - 12} PM`;
	}

	_formatDay(day) {
		const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		return days[day] || "--";
	}

	_formatMonth(month) {
		const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		return months[month] || "--";
	}

	_showNotEnoughData() {
		const content = this.container.querySelector("#wrapped-content"); content.innerHTML = `
			<div class="wrapped-empty">
				<div class="wrapped-empty__icon">📊</div>
				<h2>Not Enough Data Yet</h2>
				<p>Keep listening on SoundCloud to unlock your ${this._year} Wrapped!</p>
				<p class="wrapped-empty__hint">You need at least 1 hour of listening time.</p>
			</div>
		`;
	}

	_showError() {
		const content = this.container.querySelector("#wrapped-content"); content.innerHTML = `
			<div class="wrapped-empty">
				<div class="wrapped-empty__icon">😕</div>
				<h2>Something went wrong</h2>
				<p>We couldn"t load your Wrapped. Please try again.</p>
			</div>
		`;
	}

	_getTemplate() {
		const currentYear = new Date().getFullYear();
		const years = [currentYear, currentYear - 1];

		return `
			<div class="wrapped-page">
				<div class="wrapped-header">
					<div class="year-selector">
						${years.map(year => `
								<button class="year-btn ${year === this._year ? "active" : ""}" data-year="${year}">
									${year}
								</button>
							`
						).join("")}
					</div>
				</div>
				
				<div class="wrapped-container" id="wrapped-content">
					<div class="wrapped-loading">
						<div class="loading-spinner loading-spinner--lg"></div>
						<p>Generating your Wrapped...</p>
					</div>
				</div>
			</div>
		`;
	}

	_escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text; return div.innerHTML;
	}

	async updatePeriod() { }

	destroy() {
		document.removeEventListener("keydown", this._handleKeydown);
	}
}