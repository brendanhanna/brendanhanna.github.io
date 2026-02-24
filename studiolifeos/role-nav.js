(function () {
  var body = document.body;
  if (!body) return;

  var page = body.dataset.page || "";
  if (!["owner", "owner-admin", "teacher", "parent"].includes(page)) return;

  var session = window.Auth && window.Auth.getSession ? window.Auth.getSession() : null;
  var role = (session && session.role) || (page.indexOf("owner") === 0 ? "owner" : page);

  var navItemsByRole = {
    owner: [
      { href: "owner.html", label: "Owner Home", icon: "&#127970;" },
      { href: "owner-admin.html", label: "Admin Center", icon: "&#9881;" },
      { href: "dashboard.html", label: "Dashboard", icon: "&#128200;" },
      { href: "schedule.html", label: "Schedule", icon: "&#128197;" },
      { href: "students.html", label: "Students", icon: "&#128101;" },
      { href: "payments.html", label: "Payments", icon: "&#128179;" },
      { href: "events.html", label: "Recitals / Events", icon: "&#127917;" }
    ],
    teacher: [
      { href: "teacher.html", label: "Teacher Home", icon: "&#127979;" },
      { href: "schedule.html", label: "My Schedule", icon: "&#128197;" },
      { href: "students.html", label: "Students", icon: "&#128101;" },
      { href: "events.html", label: "Events", icon: "&#127917;" }
    ],
    parent: [
      { href: "parent.html", label: "Parent Home", icon: "&#127968;" },
      { href: "payments.html", label: "Payments", icon: "&#128179;" },
      { href: "events.html", label: "Events", icon: "&#127917;" }
    ]
  };

  var navItems = navItemsByRole[role] || navItemsByRole.owner;
  var main = document.querySelector("main.role-shell");
  if (!main || document.querySelector(".role-sidebar")) return;
  var insertionPoint = main.nextSibling;

  var shell = document.createElement("div");
  shell.className = "role-app-shell";

  var sidebar = document.createElement("aside");
  sidebar.className = "role-sidebar";

  sidebar.innerHTML =
    "<div class='role-sidebar-head'>" +
    "<div class='role-sidebar-brand'>" +
    "<div class='brand-mark'>SL</div>" +
    "<div class='role-sidebar-brand-text'><h2>Studio Life OS</h2><p>" +
    escapeHtml(titleCase(role)) +
    " View</p></div>" +
    "</div>" +
    "<button class='role-sidebar-toggle' type='button' id='roleSidebarToggle' aria-label='Collapse navigation' title='Collapse navigation'>&#9776;</button>" +
    "</div>" +
    "<nav class='role-sidebar-nav' id='roleSidebarNav'></nav>" +
    "<div class='role-sidebar-foot'>" +
    "<a class='role-sidebar-foot-link' href='login.html'>Switch Account</a>" +
    "</div>";

  shell.appendChild(sidebar);
  shell.appendChild(main);
  if (insertionPoint) {
    body.insertBefore(shell, insertionPoint);
  } else {
    body.appendChild(shell);
  }

  renderNav();
  initializeCollapse();

  function renderNav() {
    var nav = document.getElementById("roleSidebarNav");
    if (!nav) return;

    var currentFile = (window.location.pathname.split("/").pop() || "").toLowerCase();
    nav.innerHTML = navItems
      .map(function (item) {
        var active = currentFile === item.href.toLowerCase() ? " active" : "";
        return (
          "<a class='role-nav-link" +
          active +
          "' href='" +
          item.href +
          "'><span class='nav-ico' aria-hidden='true'>" +
          item.icon +
          "</span><span class='role-nav-label'>" +
          escapeHtml(item.label) +
          "</span></a>"
        );
      })
      .join("");
  }

  function initializeCollapse() {
    var key = "studioLifeSidebarCollapsedV1";
    var legacyKey = "studioLifeRoleSidebarCollapsedV1";
    var toggle = document.getElementById("roleSidebarToggle");
    if (!toggle) return;

    try {
      var saved = localStorage.getItem(key);
      if (saved !== "1" && saved !== "0") {
        var legacy = localStorage.getItem(legacyKey);
        if (legacy === "1" || legacy === "0") {
          saved = legacy;
          localStorage.setItem(key, legacy);
        }
      }
      if (saved === "1") {
        body.classList.add("role-sidebar-collapsed");
      }
    } catch (error) {
      // Ignore storage access errors in prototype mode.
    }

    toggle.addEventListener("click", function () {
      body.classList.toggle("role-sidebar-collapsed");
      try {
        localStorage.setItem(key, body.classList.contains("role-sidebar-collapsed") ? "1" : "0");
      } catch (error) {
        // Ignore storage access errors in prototype mode.
      }
    });
  }

  function titleCase(value) {
    return String(value || "")
      .split(" ")
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
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
