(function () {
  var body = document.body;
  if (!body) return;

  var page = String(body.dataset.page || "");
  var isLogin = body.dataset.auth === "login";
  if (!isLogin && ["owner", "owner-admin", "teacher", "parent"].indexOf(page) === -1) return;

  var context = isLogin ? "login" : page;
  var params = new URLSearchParams(window.location.search || "");
  var forceTour = params.get("tour") === "1";
  var storageKey = "studioLifeFlyoverSeenV3:" + context;
  var steps = getSteps(context);
  if (!steps.length) return;

  var state = {
    index: 0,
    mounted: false,
    hotspotNode: null,
    activeTarget: null
  };

  mountFlyover();
  bindTourTriggers();

  if (forceTour || !hasSeenFlyover()) {
    openFlyover();
  }

  function bindTourTriggers() {
    Array.prototype.slice.call(document.querySelectorAll("#openTourButton,[data-open-tour='1']")).forEach(function (button) {
      if (!button || button.dataset.tourBound === "1") return;
      button.addEventListener("click", openFlyover);
      button.dataset.tourBound = "1";
    });

    window.addEventListener("studio:open-tour", openFlyover);
  }

  function getSteps(key) {
    var byContext = {
      login: [
        {
          title: "Welcome to Studio Life OS",
          body: "This prototype combines scheduling, student tracking, payments, and event planning for dance studios.",
          tip: "You are currently on the login screen.",
          targets: [".login-hero"]
        },
        {
          title: "Login and Demo Access",
          body: "Use one of the listed demo account emails or the Quick Role Switch cards to jump in as Owner, Teacher, or Parent. Do not use your personal email on this prototype login.",
          tip: "All demo accounts use password: dance123.",
          targets: ["#loginForm", "#demoAccounts"]
        },
        {
          title: "Theme and Display",
          body: "Use the small TH button in the corner to switch light and dark mode on login.",
          tip: "After login, theme switching moves into the round role menu.",
          targets: ["#themeToggleButton", "#themeToggle"]
        },
        {
          title: "Role Selector and Navigation",
          body: "After login, use the round role button at bottom-right to switch roles. Each role has a tailored sidebar for only the pages relevant to that person.",
          tip: "Use Help / Tour anytime to replay walkthroughs.",
          targets: ["#openTourButton"]
        }
      ],
      owner: [
        {
          title: "Owner Home",
          body: "This page gives you executive KPIs, collections risk, class utilization, and event readiness in one place.",
          tip: "Use the left sidebar for Dashboard, Schedule, Students, Payments, Events, and Admin Center.",
          targets: ["#roleSidebarNav"]
        },
        {
          title: "Schedule Explorer Modes",
          body: "Use the mode toggle to switch between By Teacher, By Room / Day, and By Room + Teacher views.",
          tip: "By Room + Teacher helps spot room conflicts and coverage for one instructor.",
          targets: ["#ownerScheduleModeSwitch"]
        },
        {
          title: "Admin Center and Data Control",
          body: "Admin Center includes Teachers, Students, Classes, Events, Payments, and Documents management tabs.",
          tip: "Changes are prototype-local and can be revisited across sessions.",
          targets: ["a[href='owner-admin.html']", "#roleSidebarNav"]
        },
        {
          title: "Replay and Role Switching",
          body: "Use Help / Tour in the sidebar or role menu whenever you need a refresher.",
          tip: "Use the role menu to switch to Teacher or Parent views without signing out.",
          targets: ["#openTourButton", "#roleDockToggle"]
        }
      ],
      "owner-admin": [
        {
          title: "Owner Admin Center",
          body: "This area is for editing operational data: teachers, students, class times, events, payments, and documents.",
          tip: "Use the top tab row to move between data domains.",
          targets: ["#ownerAdminTabs"]
        },
        {
          title: "Edit Workflow",
          body: "Each panel supports add, edit, and remove. Saved changes update role dashboards and related views.",
          tip: "Payments include both type and method/source to reflect studio reality.",
          targets: ["[data-admin-tab='payments']", "[data-admin-tab='teachers']"]
        },
        {
          title: "Parent-Facing Documents",
          body: "The Documents tab publishes files visible in the Parent portal.",
          tip: "Keep policies and rehearsal materials updated here.",
          targets: ["[data-admin-tab='docs']"]
        }
      ],
      teacher: [
        {
          title: "Teacher Workflow",
          body: "Your menu is split by daily flow: Dashboard, Schedule, Roster, Attendance, and Recitals / Events.",
          tip: "This keeps planning and execution views separate.",
          targets: ["#roleSidebarNav"]
        },
        {
          title: "Roster vs Attendance",
          body: "Roster shows all students across your classes. Attendance is class-specific check-in with present/absent toggles.",
          tip: "Use the class picker in Attendance to change sections quickly.",
          targets: ["[data-teacher-view~='roster']", "[data-teacher-view~='attendance']"]
        },
        {
          title: "Event Rehearsals",
          body: "Events are automatically scoped to routines connected to your assigned classes.",
          tip: "Only relevant rehearsals appear in your view.",
          targets: ["#teacherEventList"]
        }
      ],
      parent: [
        {
          title: "Parent Portal Overview",
          body: "Parents can see schedule, attendance trends, payment history, events, waivers, and documents.",
          tip: "Views are scoped to the logged-in family account.",
          targets: ["#roleSidebarNav", "#parentScheduleList"]
        },
        {
          title: "Enrollment and Billing",
          body: "Enrollment supports add/drop requests, while Billing handles payment methods and receipts.",
          tip: "Use nav items to jump directly to those centers.",
          targets: ["a[href='parent.html?view=enrollment']", "a[href='parent.html?view=billing']"]
        },
        {
          title: "Reopen This Tour",
          body: "Help / Tour is always available from the role menu for quick onboarding refresh.",
          tip: "Great for user testing sessions.",
          targets: ["#openTourButton", "#roleDockToggle"]
        }
      ]
    };

    return byContext[key] || [];
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

    var hotspot = document.createElement("div");
    hotspot.id = "tourHotspot";
    hotspot.className = "tour-hotspot";
    container.appendChild(hotspot);
    state.hotspotNode = hotspot;

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

    window.addEventListener("resize", function () {
      if (!isFlyoverOpen()) return;
      positionHotspot(state.activeTarget);
    });

    window.addEventListener(
      "scroll",
      function () {
        if (!isFlyoverOpen()) return;
        positionHotspot(state.activeTarget);
      },
      true
    );
  }

  function renderStep() {
    var step = steps[state.index];
    var title = document.getElementById("flyoverTitle");
    var bodyText = document.getElementById("flyoverBody");
    var tip = document.getElementById("flyoverTip");
    var dots = document.getElementById("flyoverDots");
    var backButton = document.getElementById("flyoverBack");
    var nextButton = document.getElementById("flyoverNext");

    title.textContent = step.title;
    bodyText.textContent = step.body;
    tip.textContent = step.tip;

    dots.innerHTML = steps
      .map(function (_, index) {
        return "<span class='" + (index === state.index ? "active" : "") + "'></span>";
      })
      .join("");

    backButton.disabled = state.index === 0;
    nextButton.textContent = state.index === steps.length - 1 ? "Got It" : "Next";
    updateHotspot(step);
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
    clearHotspot();
    rememberFlyoverSeen();
  }

  function updateHotspot(step) {
    if (!state.hotspotNode) return;
    var target = resolveStepTarget(step);
    if (!target) {
      clearHotspot();
      return;
    }

    state.activeTarget = target;
    ensureTargetVisible(target);
    positionHotspot(target);
  }

  function resolveStepTarget(step) {
    if (!step) return null;
    var selectors = [];
    if (step.target) selectors.push(step.target);
    if (Array.isArray(step.targets)) selectors = selectors.concat(step.targets);

    for (var i = 0; i < selectors.length; i += 1) {
      var selector = selectors[i];
      if (!selector) continue;
      var candidate = document.querySelector(selector);
      if (candidate && isElementVisible(candidate)) return candidate;
    }
    return null;
  }

  function ensureTargetVisible(target) {
    if (!target || typeof target.scrollIntoView !== "function") return;
    var rect = target.getBoundingClientRect();
    var viewportPadding = 72;
    if (rect.top < viewportPadding || rect.bottom > window.innerHeight - viewportPadding) {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      setTimeout(function () {
        if (!isFlyoverOpen()) return;
        positionHotspot(target);
      }, 220);
    }
  }

  function positionHotspot(target) {
    if (!state.hotspotNode) return;
    if (!target || !isElementVisible(target)) {
      clearHotspot();
      return;
    }

    var rect = target.getBoundingClientRect();
    var pad = 8;
    state.hotspotNode.style.left = Math.max(6, rect.left - pad) + "px";
    state.hotspotNode.style.top = Math.max(6, rect.top - pad) + "px";
    state.hotspotNode.style.width = Math.max(28, rect.width + pad * 2) + "px";
    state.hotspotNode.style.height = Math.max(28, rect.height + pad * 2) + "px";
    state.hotspotNode.classList.add("visible");
  }

  function clearHotspot() {
    state.activeTarget = null;
    if (!state.hotspotNode) return;
    state.hotspotNode.classList.remove("visible");
    state.hotspotNode.style.width = "0";
    state.hotspotNode.style.height = "0";
  }

  function isElementVisible(node) {
    if (!node) return false;
    var style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    var rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isFlyoverOpen() {
    var flyover = document.getElementById("onboardingFlyover");
    return Boolean(flyover && flyover.classList.contains("open"));
  }

  function hasSeenFlyover() {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch (error) {
      return false;
    }
  }

  function rememberFlyoverSeen() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch (error) {
      // Ignore storage errors in prototype mode.
    }
  }
})();
