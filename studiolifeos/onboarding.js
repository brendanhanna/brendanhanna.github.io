(function () {
  if (!document.body || document.body.dataset.auth !== "login") return;

  var STORAGE_KEY = "studioLifeFlyoverSeenV2";
  var params = new URLSearchParams(window.location.search || "");
  var forceTour = params.get("tour") === "1";
  var steps = [
    {
      title: "Welcome to Studio Life OS",
      body: "This prototype combines scheduling, student tracking, payments, and event planning for dance studios.",
      tip: "You are currently on the login screen."
    },
    {
      title: "Login and Demo Access",
      body: "Use the demo credentials or the Quick Role Switch cards to jump in as Owner, Teacher, or Parent.",
      tip: "Demo password for all accounts is dance123."
    },
    {
      title: "Theme and Display",
      body: "Use the small TH button in the corner to switch light and dark mode on login.",
      tip: "After login, theme switching moves into the round role menu."
    },
    {
      title: "Role Selector and Navigation",
      body: "After login, use the round role button at bottom-right to switch roles. On Owner view, use Full Studio Console Navigation at the top to jump into the full app pages.",
      tip: "You can always return to feedback and role tools from the same floating menu."
    }
  ];

  var state = {
    index: 0,
    mounted: false
  };

  mountFlyover();

  var openButton = document.getElementById("openTourButton");
  if (openButton) {
    openButton.addEventListener("click", function () {
      openFlyover();
    });
  }

  if (forceTour || !hasSeenFlyover()) {
    openFlyover();
  }

  function mountFlyover() {
    if (state.mounted) return;

    var container = document.createElement("div");
    container.id = "onboardingFlyover";
    container.className = "flyover";

    container.innerHTML =
      "<div class='flyover-backdrop' data-close='1'></div>" +
      "<div class='flyover-card' role='dialog' aria-modal='true' aria-labelledby='flyoverTitle'>" +
      "<button class='flyover-close' type='button' id='flyoverCloseButton' aria-label='Close tour'>&times;</button>" +
      "<p class='eyebrow'>Quick Tour</p>" +
      "<h2 id='flyoverTitle'></h2>" +
      "<p id='flyoverBody'></p>" +
      "<p class='flyover-tip' id='flyoverTip'></p>" +
      "<div class='flyover-dots' id='flyoverDots'></div>" +
      "<div class='flyover-actions'>" +
      "<button class='button' type='button' id='flyoverBack'>Back</button>" +
      "<button class='button button-primary' type='button' id='flyoverNext'>Next</button>" +
      "</div>" +
      "</div>";

    document.body.appendChild(container);
    state.mounted = true;

    container.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.getAttribute("data-close") === "1") {
        closeFlyover();
      }
    });

    var closeButton = document.getElementById("flyoverCloseButton");
    var backButton = document.getElementById("flyoverBack");
    var nextButton = document.getElementById("flyoverNext");

    closeButton.addEventListener("click", closeFlyover);
    backButton.addEventListener("click", function () {
      if (state.index > 0) {
        state.index -= 1;
        renderStep();
      }
    });

    nextButton.addEventListener("click", function () {
      if (state.index < steps.length - 1) {
        state.index += 1;
        renderStep();
      } else {
        closeFlyover();
      }
    });

    document.addEventListener("keydown", function (event) {
      var flyover = document.getElementById("onboardingFlyover");
      if (!flyover || !flyover.classList.contains("open")) return;
      if (event.key === "Escape") closeFlyover();
    });
  }

  function renderStep() {
    var step = steps[state.index];
    var title = document.getElementById("flyoverTitle");
    var body = document.getElementById("flyoverBody");
    var tip = document.getElementById("flyoverTip");
    var dots = document.getElementById("flyoverDots");
    var backButton = document.getElementById("flyoverBack");
    var nextButton = document.getElementById("flyoverNext");

    title.textContent = step.title;
    body.textContent = step.body;
    tip.textContent = step.tip;

    dots.innerHTML = steps
      .map(function (_, index) {
        return "<span class='" + (index === state.index ? "active" : "") + "'></span>";
      })
      .join("");

    backButton.disabled = state.index === 0;
    nextButton.textContent = state.index === steps.length - 1 ? "Got It" : "Next";
  }

  function openFlyover() {
    state.index = 0;
    renderStep();

    var flyover = document.getElementById("onboardingFlyover");
    if (!flyover) return;

    flyover.classList.add("open");
    document.body.classList.add("flyover-open");
  }

  function closeFlyover() {
    var flyover = document.getElementById("onboardingFlyover");
    if (!flyover) return;

    flyover.classList.remove("open");
    document.body.classList.remove("flyover-open");
    rememberFlyoverSeen();
  }

  function hasSeenFlyover() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function rememberFlyoverSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (error) {
      // Ignore storage errors in prototype mode.
    }
  }
})();
