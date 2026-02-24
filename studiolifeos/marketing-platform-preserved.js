(function () {
  initRoleTabs();
  initRevealAnimations();
  initSmoothAnchors();

  function initRoleTabs() {
    var tabsRoot = document.getElementById("marketingRoleTabs");
    var panelsRoot = document.getElementById("marketingRolePanels");
    if (!tabsRoot || !panelsRoot) return;

    var buttons = Array.prototype.slice.call(tabsRoot.querySelectorAll("[data-role-tab]"));
    var panels = Array.prototype.slice.call(panelsRoot.querySelectorAll("[data-role-panel]"));
    if (!buttons.length || !panels.length) return;

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var selected = button.getAttribute("data-role-tab");
        buttons.forEach(function (btn) {
          var active = btn === button;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        panels.forEach(function (panel) {
          panel.classList.toggle("active", panel.getAttribute("data-role-panel") === selected);
        });
      });
    });
  }

  function initRevealAnimations() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(".marketing-reveal"));
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  function initSmoothAnchors() {
    Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]')).forEach(function (anchor) {
      anchor.addEventListener("click", function (event) {
        var href = anchor.getAttribute("href");
        if (!href || href === "#") return;
        var target = document.querySelector(href);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
})();
