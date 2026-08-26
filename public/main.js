/* ============================================================
   ALEJANDRO DORADO — main.js
   IIFE pattern, vanilla JS, no module imports.

   CONTRACT: this file is DECORATION ONLY.
   Every element on the page is visible with no JS at all. The
   entrance animations are gated behind the `js-reveal` class that
   the inline <head> script sets before first paint — and it only
   sets it when JS runs AND the visitor has not requested reduced
   motion. Nothing here may ever be the reason content is invisible.
   ============================================================ */
(function () {
  "use strict";

  const data = window.__BRAND__ || {};
  const $  = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const reduced    = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fineHover  = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp      = (v, min, max) => Math.max(min, Math.min(max, v));

  /* Single source of truth for "may we animate?".
     Mirrors the inline <head> gate: no reduced-motion request, and the
     CSS starting states are actually in effect. */
  const animate = !reduced &&
    document.documentElement.classList.contains("js-reveal");

  /* An element is worth revealing eagerly if it is already on screen. */
  const inViewport = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  };

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "] failed:", e); }
  }

  /* --------------------------------------------------------
     Reading progress bar
     -------------------------------------------------------- */
  function initProgressBar() {
    const fill = $("[data-progress]");
    if (!fill) return;
    let ticking = false;
    const update = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docH > 0 ? clamp(window.scrollY / docH, 0, 1) : 0;
      fill.style.width = (ratio * 100).toFixed(2) + "%";
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
  }

  /* --------------------------------------------------------
     Nav background on scroll + current section indicator
     -------------------------------------------------------- */
  function initNav() {
    const nav = $("[data-nav]");
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 40) nav.classList.add("is-scrolled");
      else nav.classList.remove("is-scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const current = $("[data-nav-current]");
    const links = $$(".nav-links a");
    const sections = $$("section[id]");
    if (!current || !sections.length) return;

    /* Prefer the manifest, but fall back to the data-attributes that live
       on each <section> so the label never goes stale if one drifts. */
    const sectionMeta = (data.sections || []).reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {});
    sections.forEach((s) => {
      if (sectionMeta[s.id]) return;
      const num = s.dataset.sectionNum;
      const label = s.dataset.sectionLabel;
      if (num && label) sectionMeta[s.id] = { id: s.id, num: num, label: label };
    });

    // Persistent across batches: IntersectionObserver only reports entries
    // whose status *changed*, not the full current state of every target.
    const intersecting = new Set();

    const applyCurrent = (section) => {
      const id = section.id;
      const meta = sectionMeta[id];
      if (meta) current.textContent = `${meta.num} · ${meta.label}`;
      links.forEach(a => {
        const href = a.getAttribute("href");
        if (href === "#" + id) a.classList.add("is-active");
        else a.classList.remove("is-active");
      });
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) intersecting.add(entry.target);
        else intersecting.delete(entry.target);
      });
      if (!intersecting.size) return;

      // One winner per batch, chosen deterministically — not per-entry.
      // intersectionRatio isn't a fair comparison here: it's normalized
      // against each section's own height, so a short section barely in
      // the band can outrank a tall one whose top just crossed in. Instead,
      // walk sections in document order and keep the last (i.e. lowest)
      // one currently intersecting — the section the reader has scrolled to.
      let winner = null;
      for (const s of sections) {
        if (intersecting.has(s)) winner = s;
      }
      if (winner) applyCurrent(winner);
    }, { threshold: 0, rootMargin: "-40% 0px -55% 0px" });

    sections.forEach(s => io.observe(s));
  }

  /* --------------------------------------------------------
     Reveal-on-scroll.
     Only runs when `animate` is true — otherwise the CSS default
     (fully visible) already stands and there is nothing to do.
     -------------------------------------------------------- */
  function initReveals() {
    if (!animate) return;
    /* Only these two carry an animated starting state in the CSS:
       `.reveal` (fade-up copy) and `.section` (the hairline rule draw). */
    const SEL = ".reveal, .section";
    const targets = $$(SEL);
    if (!targets.length) return;

    const show = (el) => el.classList.add("is-visible");

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          show(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.04, rootMargin: "0px 0px -4% 0px" });

    targets.forEach((el) => {
      /* Anything already on screen at boot reveals immediately —
         above-the-fold content must never wait on an observer tick. */
      if (inViewport(el)) show(el);
      else io.observe(el);
    });

    // safety net: force-reveal anything still hidden inside the viewport
    setTimeout(() => {
      $$(".reveal:not(.is-visible), .section:not(.is-visible)")
        .forEach((el) => { if (inViewport(el)) show(el); });
    }, 1500);
  }

  /* --------------------------------------------------------
     Word reveal — short staggered entrance on display headings.
     Splits target element text into word-spans.
     Skipped entirely when animation is off, so the original
     markup (and therefore the text) is left untouched.
     -------------------------------------------------------- */
  function initWordReveal() {
    if (!animate) return;
    const targets = $$("[data-blur-reveal]");
    if (!targets.length) return;

    // Split each target into word spans, preserving inline <em>
    targets.forEach((el) => {
      if (el.dataset.blurSplit === "1") return; // split at most once
      el.dataset.blurSplit = "1";

      /* Punctuation that opens a text node belongs to whatever came
         before it (typically the comma right after an <em>). Wrapping it
         as its own inline-block word would create a line-break
         opportunity and orphan it onto the next line. */
      const LEADING_PUNCT = /^[.,;:!?)\]}'"’”…]+$/;

      const wrapText = (text, indexStart) => {
        const words = text.split(/(\s+)/);
        let html = "";
        let i = indexStart;
        for (let k = 0; k < words.length; k++) {
          const w = words[k];
          if (/^\s+$/.test(w)) {
            html += w;
          } else if (w.length > 0) {
            if (k === 0 && LEADING_PUNCT.test(w)) {
              html += `<span class="blur-word blur-punct" style="--word-i:${Math.max(i - 1, 0)}">${w}</span>`;
              continue;
            }
            html += `<span class="blur-word" style="--word-i:${i}">${w}</span>`;
            i++;
          }
        }
        return { html, next: i };
      };

      let counter = 0;
      const out = [];
      const walk = (node) => {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const r = wrapText(child.textContent, counter);
            counter = r.next;
            out.push(r.html);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toLowerCase();
            // Re-emit inline element (em, strong, br, etc.) wrapping its text too
            if (tag === "br") {
              out.push("<br>");
            } else {
              const inner = [];
              child.childNodes.forEach((sub) => {
                if (sub.nodeType === Node.TEXT_NODE) {
                  const r = wrapText(sub.textContent, counter);
                  counter = r.next;
                  inner.push(r.html);
                }
              });
              out.push(`<${tag}>${inner.join("")}</${tag}>`);
            }
          }
        });
      };
      walk(el);
      el.innerHTML = out.join("");
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

    targets.forEach((el) => {
      /* The hero headline is above the fold: reveal it in the same frame
         it was split, so there is never a blank first paint. */
      if (inViewport(el)) el.classList.add("is-revealed");
      else io.observe(el);
    });

    // safety: force-reveal any target still hidden inside the viewport
    setTimeout(() => {
      $$("[data-blur-reveal]:not(.is-revealed)").forEach((el) => {
        if (inViewport(el)) el.classList.add("is-revealed");
      });
    }, 1200);
  }

  /* --------------------------------------------------------
     Section watermark (A4) — one-time fade + settle-in for the
     giant ghost section name behind each section's content.
     -------------------------------------------------------- */
  function initSectionWatermark() {
    if (!animate) return;
    const targets = $$(".section[data-section-label]");
    if (!targets.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -20% 0px" });

    targets.forEach((el) => {
      if (inViewport(el)) el.classList.add("is-revealed");
      else io.observe(el);
    });

    setTimeout(() => {
      targets.forEach((el) => {
        if (!el.classList.contains("is-revealed") && inViewport(el)) el.classList.add("is-revealed");
      });
    }, 1500);
  }

  /* --------------------------------------------------------
     Photo reveal (A2) — clip-path uncover on scroll-into-view.
     Contact photo only: the hero avatar reveals on load via the
     html.is-ready CSS hook instead (see styles.css), since it's
     always in the initial viewport and never scrolled to.
     -------------------------------------------------------- */
  function initPhotoReveal() {
    if (!animate) return;
    const targets = $$("[data-photo-reveal]");
    if (!targets.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" });

    targets.forEach((el) => {
      if (inViewport(el)) el.classList.add("is-revealed");
      else io.observe(el);
    });

    setTimeout(() => {
      $$("[data-photo-reveal]:not(.is-revealed)").forEach((el) => {
        if (inViewport(el)) el.classList.add("is-revealed");
      });
    }, 2000);
  }

  /* --------------------------------------------------------
     Photo parallax (A3) — very subtle scroll-linked zoom on the
     hero avatar and contact portrait. Scale only (1.0 to 1.03),
     never translate — these are small masked/circular photo boxes,
     not full-bleed backgrounds. Off under reduced-motion and below
     the desktop breakpoint: no listeners attached, zero cost.
     -------------------------------------------------------- */
  function initPhotoParallax() {
    if (reduced) return;
    if (!matchMedia("(min-width: 720px)").matches) return;

    const items = [];
    const avatarBox = $(".avatar");
    const avatarImg = $(".avatar-face img");
    if (avatarBox && avatarImg) {
      items.push({
        box: avatarBox,
        img: avatarImg,
        isReady: () => document.documentElement.classList.contains("is-ready"),
      });
    }
    const contactBox = $(".contact-photo-wrap");
    const contactZoom = $(".contact-photo-zoom");
    const contactPhoto = $(".contact-photo");
    if (contactBox && contactZoom && contactPhoto) {
      items.push({
        box: contactBox,
        img: contactZoom,
        isReady: () => contactPhoto.isConnected && contactPhoto.classList.contains("is-revealed"),
      });
    }
    if (!items.length) return;

    const MAX_SCALE = 1.03;
    let raf = 0;

    function update() {
      raf = 0;
      const vh = window.innerHeight;
      items.forEach(({ box, img, isReady }) => {
        if (!isReady()) return;
        const rect = box.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - vh / 2);
        const span = vh / 2 + rect.height / 2;
        const proximity = clamp(1 - dist / span, 0, 1); // 1 = centered, 0 = at the edge
        img.style.transform = `scale(${1 + (MAX_SCALE - 1) * proximity})`;
      });
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* --------------------------------------------------------
     Mask reveal — line-by-line editorial entrance for two
     high-weight headlines (about-lede, contact-title). Each
     detected visual line is wrapped in an overflow-hidden mask
     and rises into place, instead of the word-cascade used
     elsewhere. Lines are detected by measuring rendered offsets,
     so it stays correct across reflow/resize.
     -------------------------------------------------------- */
  function initMaskReveal() {
    if (!animate) return;
    const targets = $$("[data-mask-reveal]");
    if (!targets.length) return;

    function splitIntoLines(el) {
      if (!el.dataset.maskOriginal) el.dataset.maskOriginal = el.innerHTML;
      el.innerHTML = el.dataset.maskOriginal;

      // Wrap every word (preserving inline <em>) in a measuring span.
      const wrapWords = (node) => {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment();
            const parts = child.textContent.split(/(\s+)/);
            parts.forEach((part) => {
              if (/^\s+$/.test(part)) {
                if (part.length) frag.appendChild(document.createTextNode(part));
              } else if (part.length) {
                const span = document.createElement("span");
                span.className = "mask-word";
                span.textContent = part;
                frag.appendChild(span);
              }
            });
            child.replaceWith(frag);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            wrapWords(child);
          }
        });
      };
      wrapWords(el);

      // Group el's direct children into lines by rendered vertical offset.
      const tokens = Array.from(el.childNodes);
      if (!tokens.length) return;

      const wordSpanOf = (n) => {
        if (n.nodeType !== Node.ELEMENT_NODE) return null;
        return n.classList.contains("mask-word") ? n : n.querySelector(".mask-word");
      };

      const lines = [];
      let currentTop = null;
      tokens.forEach((token) => {
        const wordSpan = wordSpanOf(token);
        if (!wordSpan) {
          if (!lines.length) lines.push([]);
          lines[lines.length - 1].push(token);
          return;
        }
        const top = wordSpan.getBoundingClientRect().top;
        if (currentTop === null || Math.abs(top - currentTop) > 10) {
          lines.push([]);
          currentTop = top;
        }
        lines[lines.length - 1].push(token);
      });

      el.innerHTML = "";
      lines.forEach((lineTokens, i) => {
        const line = document.createElement("span");
        line.className = "mask-line";
        const inner = document.createElement("span");
        inner.className = "mask-line-inner";
        inner.style.setProperty("--line-i", i);
        lineTokens.forEach((t) => inner.appendChild(t));
        line.appendChild(inner);
        el.appendChild(line);
      });
    }

    targets.forEach((el) => splitIntoLines(el));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

    targets.forEach((el) => {
      if (inViewport(el)) el.classList.add("is-revealed");
      else io.observe(el);
    });

    setTimeout(() => {
      targets.forEach((el) => {
        if (!el.classList.contains("is-revealed") && inViewport(el)) el.classList.add("is-revealed");
      });
    }, 1500);

    // Re-measure line breaks on resize (viewport rotation, font load, etc.)
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => targets.forEach((el) => splitIntoLines(el)), 200);
    });
  }

  /* --------------------------------------------------------
     3D tilt (subtle perspective on data-tilt)
     -------------------------------------------------------- */
  function initTilt() {
    if (!animate || !fineHover) return;
    const items = $$("[data-tilt]");
    if (!items.length) return;

    items.forEach((el) => {
      let raf = 0;
      let tx = 0, ty = 0;

      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const px = clamp(((e.clientX - r.left) / r.width), 0, 1);
        const py = clamp(((e.clientY - r.top)  / r.height), 0, 1);
        tx = (py - 0.5) * -6;
        ty = (px - 0.5) *  6;
        if (!raf) raf = requestAnimationFrame(update);
      };
      const update = () => {
        el.style.transform = `perspective(900px) rotateX(${tx}deg) rotateY(${ty}deg)`;
        raf = 0;
      };
      const reset = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseover", (e) => {
        if (!el.contains(e.relatedTarget)) onMove(e);
      });
      el.addEventListener("mouseout", (e) => {
        if (!el.contains(e.relatedTarget)) reset();
      });
    });
  }

  /* --------------------------------------------------------
     Magnetic — small attraction on hoverable CTAs
     -------------------------------------------------------- */
  function initMagnetic() {
    if (!animate || !fineHover) return;
    const items = $$("[data-magnetic]");
    if (!items.length) return;

    items.forEach((el) => {
      let raf = 0;
      const STRENGTH = 0.28;
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) * STRENGTH;
        const dy = (e.clientY - cy) * STRENGTH;
        if (!raf) {
          raf = requestAnimationFrame(() => {
            el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
            raf = 0;
          });
        }
      };
      const reset = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        el.style.transform = "translate3d(0, 0, 0)";
      };
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseover", (e) => {
        if (!el.contains(e.relatedTarget)) onMove(e);
      });
      el.addEventListener("mouseout", (e) => {
        if (!el.contains(e.relatedTarget)) reset();
      });
    });
  }

  /* --------------------------------------------------------
     Hero title — scroll-driven scale + fade. Decoration only:
     the CSS defaults are scale 1 / opacity 1.
     -------------------------------------------------------- */
  function initHeroScroll() {
    if (!animate) return;
    const root = document.documentElement;
    const hero = $(".hero");
    if (!hero) return;
    let ticking = false;
    const update = () => {
      const sy = window.scrollY;
      const vh = window.innerHeight;
      // 0 at top, 1 once you've scrolled 70% of viewport height
      const ratio = clamp(sy / (vh * 0.7), 0, 1);
      const scale   = 1 - ratio * 0.18;
      const opacity = 1 - ratio * 0.85;
      root.style.setProperty("--hero-scale",   scale.toFixed(3));
      root.style.setProperty("--hero-opacity", opacity.toFixed(2));
      ticking = false;
    };
    update();
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
  }

  /* --------------------------------------------------------
     Mobile nav — hamburger toggles the drawer overlay
     -------------------------------------------------------- */
  function initMobileNav() {
    const burger = $("[data-burger]");
    const drawer = $("[data-mobile-nav]");
    if (!burger || !drawer) return;

    const open = () => {
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Close menu");
      document.body.classList.add("has-mobile-nav-open");
    };
    const close = () => {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open menu");
      document.body.classList.remove("has-mobile-nav-open");
    };
    const toggle = () => {
      if (drawer.classList.contains("is-open")) close();
      else open();
    };

    burger.addEventListener("click", toggle);
    // close on any link click inside drawer
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a")) close();
    });
    // close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) close();
    });
    // close when resizing up to desktop
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 960 && drawer.classList.contains("is-open")) close();
    });
  }

  /* --------------------------------------------------------
     Smooth anchor scroll
     -------------------------------------------------------- */
  function initSmoothScroll() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 72;
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - navH + 1,
        behavior: reduced ? "auto" : "smooth"
      });
    });
  }

  /* --------------------------------------------------------
     Boot
     -------------------------------------------------------- */
  function boot() {
    safe(initProgressBar,  "initProgressBar");
    safe(initNav,          "initNav");
    safe(initWordReveal,   "initWordReveal");
    safe(initMaskReveal,   "initMaskReveal");
    safe(initReveals,      "initReveals");
    safe(initSectionWatermark, "initSectionWatermark");
    safe(initPhotoReveal,  "initPhotoReveal");
    safe(initMagnetic,     "initMagnetic");
    safe(initTilt,         "initTilt");
    safe(initHeroScroll,   "initHeroScroll");
    safe(initMobileNav,    "initMobileNav");
    safe(initSmoothScroll, "initSmoothScroll");

    document.documentElement.classList.add("is-ready");

    // Parallax reads is-ready/is-revealed state per frame, so wire it
    // up last — after the class that gates the hero avatar's own reveal.
    safe(initPhotoParallax, "initPhotoParallax");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
