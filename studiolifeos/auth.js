(function () {
  var AUTH_KEY = "danceStudioAuthSessionV1";
  var ROLE_HOME = {
    owner: "owner.html",
    teacher: "teacher.html",
    parent: "parent.html"
  };
  var ROLE_LINKS = {
    owner: ["owner.html", "owner-admin.html", "dashboard.html", "schedule.html", "students.html", "payments.html", "events.html", "feedback.html"],
    teacher: ["teacher.html", "dashboard.html", "schedule.html", "students.html", "events.html", "feedback.html"],
    parent: ["parent.html", "dashboard.html", "payments.html", "events.html", "feedback.html"]
  };

  var DEMO_USERS = [
    {
      role: "owner",
      email: "owner@studiolife.com",
      password: "dance123",
      name: "Sabrina Wells"
    },
    {
      role: "teacher",
      email: "marcus.reed@studiolife.com",
      password: "dance123",
      name: "Marcus Reed",
      instructorName: "Marcus Reed"
    },
    {
      role: "parent",
      email: "nora.hart@email.com",
      password: "dance123",
      name: "Nora Hart",
      primaryStudentId: "s1"
    }
  ];

  window.Auth = {
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    switchRole: switchRole,
    roleHome: function (role) {
      return ROLE_HOME[role] || "login.html";
    }
  };

  var body = document.body;
  if (!body) return;

  if (body.dataset.auth === "login") {
    initLogin();
    return;
  }

  if (body.dataset.requiresAuth === "true") {
    var currentSession = getSession();
    if (!currentSession) {
      var redirect = encodeURIComponent(currentFile());
      window.location.href = "login.html?redirect=" + redirect;
      return;
    }
    if (!isAllowedForRole(currentSession, currentFile())) {
      window.location.href = ROLE_HOME[currentSession.role] || "login.html";
      return;
    }
  }

  applyRoleNavVisibility();
  initRoleDock();

  function initLogin() {
    var form = document.getElementById("loginForm");
    var emailInput = document.getElementById("loginEmail");
    var passwordInput = document.getElementById("loginPassword");
    var message = document.getElementById("loginMessage");
    var demoList = document.getElementById("demoAccounts");
    var continueButton = document.getElementById("continueSessionButton");
    var session = getSession();

    if (demoList) {
      demoList.innerHTML = DEMO_USERS.map(function (user) {
        return (
          "<button class='demo-chip' type='button' data-role='" +
          user.role +
          "'><strong>" +
          titleCase(user.role) +
          "</strong><span>" +
          user.email +
          "</span></button>"
        );
      }).join("");

      Array.prototype.slice.call(demoList.querySelectorAll("button[data-role]")).forEach(function (button) {
        button.addEventListener("click", function () {
          var role = button.getAttribute("data-role");
          switchRole(role);
        });
      });
    }

    if (continueButton) {
      if (session) {
        continueButton.style.display = "inline-flex";
        continueButton.textContent = "Continue as " + session.name + " (" + titleCase(session.role) + ")";
        continueButton.addEventListener("click", function () {
          var redirectTarget = getRedirectTarget();
          window.location.href = redirectTarget || ROLE_HOME[session.role] || "owner.html";
        });
      } else {
        continueButton.style.display = "none";
      }
    }

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var email = (emailInput.value || "").trim().toLowerCase();
        var password = (passwordInput.value || "").trim();
        var user = DEMO_USERS.find(function (candidate) {
          return candidate.email.toLowerCase() === email && candidate.password === password;
        });

        if (!user) {
          if (message) {
            message.textContent = "Invalid credentials. Use a demo account card or password: dance123.";
            message.className = "login-message error";
          }
          return;
        }

        setSession(user);
        var redirectTarget = getRedirectTarget();
        window.location.href = redirectTarget || ROLE_HOME[user.role] || "owner.html";
      });
    }
  }

  function initRoleDock() {
    if (document.getElementById("roleDock")) return;

    var session = getSession();
    if (!session) return;

    var dock = document.createElement("div");
    dock.id = "roleDock";
    dock.className = "role-dock";

    dock.innerHTML =
      "<button class='role-dock-toggle' id='roleDockToggle' type='button' title='Switch role'>" +
      "<span class='role-short'>" +
      roleBadge(session.role) +
      "</span></button>" +
      "<div class='role-dock-menu' id='roleDockMenu'>" +
      "<p class='role-dock-user'>Signed in: " +
      escapeHtml(session.name) +
      "</p>" +
      "<button type='button' data-switch-role='owner'>Studio Owner</button>" +
      "<button type='button' data-switch-role='teacher'>Teacher</button>" +
      "<button type='button' data-switch-role='parent'>Parent</button>" +
      "<a class='role-dock-link' href='feedback.html'>Send Feedback</a>" +
      "<button type='button' data-action='logout'>Log Out</button>" +
      "</div>";

    document.body.appendChild(dock);

    var toggle = document.getElementById("roleDockToggle");
    var menu = document.getElementById("roleDockMenu");

    toggle.addEventListener("click", function () {
      menu.classList.toggle("open");
    });

    document.addEventListener("click", function (event) {
      if (!dock.contains(event.target)) {
        menu.classList.remove("open");
      }
    });

    Array.prototype.slice.call(menu.querySelectorAll("button[data-switch-role]")).forEach(function (button) {
      button.addEventListener("click", function () {
        switchRole(button.getAttribute("data-switch-role"));
      });
    });

    var logout = menu.querySelector("button[data-action='logout']");
    if (logout) {
      logout.addEventListener("click", function () {
        clearSession();
        window.location.href = "login.html";
      });
    }
  }

  function applyRoleNavVisibility() {
    var session = getSession();
    if (!session || !session.role) return;

    var allowed = ROLE_LINKS[session.role];
    if (!allowed) return;

    Array.prototype.slice.call(document.querySelectorAll("[data-nav]")).forEach(function (node) {
      var href = String(node.getAttribute("href") || "").toLowerCase();
      if (!href) return;
      if (allowed.indexOf(href) === -1) {
        node.style.display = "none";
      }
    });
  }

  function isAllowedForRole(session, file) {
    if (!session || !session.role) return false;
    var allowed = ROLE_LINKS[session.role];
    if (!allowed || !allowed.length) return false;
    var page = String(file || "").toLowerCase();
    return allowed.indexOf(page) !== -1;
  }

  function switchRole(role) {
    var existing = getSession();
    var fallback = DEMO_USERS.find(function (user) {
      return user.role === role;
    });

    if (!fallback) return;

    var nextSession = {
      role: role,
      name: fallback.name,
      email: fallback.email,
      instructorName: fallback.instructorName || "",
      primaryStudentId: fallback.primaryStudentId || "",
      switchedAt: new Date().toISOString()
    };

    if (existing && existing.role !== role) {
      if (role === "parent") nextSession.primaryStudentId = existing.primaryStudentId || fallback.primaryStudentId || "s1";
      if (role === "teacher") nextSession.instructorName = existing.instructorName || fallback.instructorName || "Marcus Reed";
    }

    setSession(nextSession);
    window.location.href = ROLE_HOME[role] || "owner.html";
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setSession(user) {
    var payload = {
      role: user.role,
      name: user.name,
      email: user.email,
      instructorName: user.instructorName || "",
      primaryStudentId: user.primaryStudentId || "",
      signedInAt: user.signedInAt || new Date().toISOString()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
  }

  function clearSession() {
    localStorage.removeItem(AUTH_KEY);
  }

  function getRedirectTarget() {
    try {
      var params = new URLSearchParams(window.location.search);
      var redirect = params.get("redirect");
      if (!redirect) return "";
      if (redirect.indexOf(".html") === -1) return "";
      return redirect;
    } catch (error) {
      return "";
    }
  }

  function titleCase(value) {
    return String(value || "")
      .split(" ")
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function roleBadge(role) {
    if (role === "owner") return "OW";
    if (role === "teacher") return "TE";
    if (role === "parent") return "PA";
    return "RO";
  }

  function currentFile() {
    var parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "dashboard.html";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
