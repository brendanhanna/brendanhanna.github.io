(function () {
  var TESTIMONIALS = [
    {
      quote:
        "Our daughter has grown so much technically and emotionally this year. We love how clear and encouraging the teachers are.",
      meta: "The Nguyen Family • Ages 7 + 11"
    },
    {
      quote:
        "Communication is excellent. We always know schedule updates, recital details, and payment info before we have to ask.",
      meta: "Jordan M. • Parent"
    },
    {
      quote:
        "Studio Life has the right balance of high standards and warmth. Our kids feel challenged and supported every week.",
      meta: "Alicia R. • Parent"
    },
    {
      quote:
        "The trial process was simple, and we were matched into the right class right away. It felt welcoming from day one.",
      meta: "Patel Family • New Enrollment"
    }
  ];

  markActiveNav();
  initRevealAnimations();
  initSmoothAnchors();
  initTestimonialRotators();
  initProgramFilters();

  function markActiveNav() {
    var current = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    Array.prototype.slice.call(document.querySelectorAll("[data-nav]"))
      .forEach(function (link) {
        var target = String(link.getAttribute("data-nav") || "").toLowerCase();
        link.classList.toggle("active", target === current);
      });
  }

  function initRevealAnimations() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(".showcase-reveal"));
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
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
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
        var stickyHeader = document.querySelector(".showcase-header");
        var offset = stickyHeader ? stickyHeader.offsetHeight + 10 : 0;
        var y = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      });
    });
  }

  function initTestimonialRotators() {
    Array.prototype.slice.call(document.querySelectorAll("[data-testimonial-rotator]"))
      .forEach(function (root) {
        setupRotator(root);
      });
  }

  function setupRotator(root) {
    var textNode = root.querySelector("[data-quote-text]");
    var metaNode = root.querySelector("[data-quote-meta]");
    var prev = root.querySelector("[data-quote-prev]");
    var next = root.querySelector("[data-quote-next]");
    if (!textNode || !metaNode || !TESTIMONIALS.length) return;

    var index = 0;
    var timer = null;

    function render() {
      var item = TESTIMONIALS[index % TESTIMONIALS.length];
      textNode.textContent = '"' + item.quote + '"';
      metaNode.textContent = item.meta;
    }

    function advance(step) {
      index = (index + step + TESTIMONIALS.length) % TESTIMONIALS.length;
      render();
      restart();
    }

    function restart() {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(function () {
        advance(1);
      }, 6500);
    }

    if (prev) {
      prev.addEventListener("click", function () {
        advance(-1);
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        advance(1);
      });
    }

    render();
    restart();
  }

  function initProgramFilters() {
    var filterRoot = document.querySelector("[data-program-filter]");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".program-grid [data-age]"));
    if (!filterRoot || !cards.length) return;

    Array.prototype.slice.call(filterRoot.querySelectorAll("[data-filter]"))
      .forEach(function (button) {
        button.addEventListener("click", function () {
          var selected = String(button.getAttribute("data-filter") || "all");

          Array.prototype.slice.call(filterRoot.querySelectorAll("[data-filter]"))
            .forEach(function (node) {
              var active = node === button;
              node.classList.toggle("button-primary", active);
            });

          cards.forEach(function (card) {
            var age = String(card.getAttribute("data-age") || "");
            var show = selected === "all" || selected === age;
            card.classList.toggle("hidden", !show);
          });
        });
      });
  }
})();
