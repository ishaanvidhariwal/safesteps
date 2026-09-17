// SafeSteps — shared site behavior (nav, quick exit, accordions, tabs)

document.addEventListener("DOMContentLoaded", () => {
  /* Full-screen overlay nav toggle */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  const setNavOpen = (open) => {
    if (!toggle || !links) return;
    links.classList.toggle("open", open);
    toggle.classList.toggle("active", open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  if (toggle && links) {
    toggle.addEventListener("click", () => setNavOpen(!links.classList.contains("open")));
  }

  /* Dropdown expand (tap to open submenu) inside the overlay */
  document.querySelectorAll(".has-dropdown > a.nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      link.parentElement.classList.toggle("open");
    });
  });

  /* Plain nav links close the overlay after navigating */
  document.querySelectorAll(".nav-links a.nav-link:not(.has-dropdown > a)").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });
  document.querySelectorAll(".dropdown a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });

  /* Escape closes the overlay first, if open */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && links && links.classList.contains("open")) {
      setNavOpen(false);
    }
  });

  /* Highlight current page in nav */
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.split("/").pop() === path) link.classList.add("active");
  });

  /* Quick Exit — instantly leaves the site with no back-button trace */
  document.querySelectorAll(".js-quick-exit").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.replace("https://www.google.com");
    });
  });
  // Keyboard shortcut: press Escape three times quickly to quick-exit
  let escCount = 0;
  let escTimer = null;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      escCount += 1;
      clearTimeout(escTimer);
      escTimer = setTimeout(() => (escCount = 0), 800);
      if (escCount >= 3) window.location.replace("https://www.google.com");
    }
  });

  /* Story cards (stories / blog) — click anywhere on the card to expand */
  document.querySelectorAll(".story-card").forEach((card) => {
    card.addEventListener("click", () => card.classList.toggle("open"));
  });

  /* Tabs (safety.html) */
  document.querySelectorAll("[data-tabs]").forEach((group) => {
    const buttons = group.querySelectorAll(".tab-btn");
    const panels = group.querySelectorAll(".tab-panel");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const target = group.querySelector(`#${btn.dataset.tab}`);
        if (target) target.classList.add("active");
      });
    });
  });

  /* Simple contact/request forms with no backend: show a friendly confirmation */
  document.querySelectorAll("form[data-static-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = form.querySelector(".form-success");
      form.querySelectorAll("input, textarea, select").forEach((el) => (el.value = ""));
      if (note) note.style.display = "block";
    });
  });

  /* Year in footer */
  document.querySelectorAll(".js-year").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* Scroll-reveal: fade + rise into view, staggered within their own row */
  const revealTargets = document.querySelectorAll(
    ".card, .story-card, .section-head, .hero-collage .cell, .stats-row > div, .scenario-card"
  );
  if ("IntersectionObserver" in window && revealTargets.length) {
    revealTargets.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 4) * 70 + "ms";
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealTargets.forEach((el) => io.observe(el));
  }
});
