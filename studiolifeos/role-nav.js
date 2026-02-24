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
      { href: "owner.html?view=snapshot", label: "Dashboard", icon: "&#128200;" },
      { href: "owner.html?view=schedule", label: "Schedule", icon: "&#128197;" },
      { href: "owner-admin.html?tab=students", label: "Students", icon: "&#128101;" },
      { href: "owner-admin.html?tab=payments", label: "Payments", icon: "&#128179;" },
      { href: "owner-admin.html?tab=events", label: "Recitals / Events", icon: "&#127917;" },
      { href: "owner-admin.html", label: "Admin Center", icon: "&#9881;" }
    ],
    teacher: [
      { href: "teacher.html", label: "Teacher Home", icon: "&#127979;" },
      { href: "teacher.html?view=metrics", label: "Dashboard", icon: "&#128200;" },
      { href: "teacher.html?view=classes", label: "Schedule", icon: "&#128197;" },
      { href: "teacher.html?view=roster", label: "Roster", icon: "&#128101;" },
      { href: "teacher.html?view=attendance", label: "Attendance", icon: "&#9989;" },
      { href: "teacher.html?view=events", label: "Recitals / Events", icon: "&#127917;" }
    ],
    parent: [
      { href: "parent.html", label: "Parent Home", icon: "&#127968;" },
      { href: "parent.html?view=schedule", label: "Schedule", icon: "&#128197;" },
      { href: "parent.html?view=payments", label: "Payments", icon: "&#128179;" },
      { href: "parent.html?view=enrollment", label: "Enrollment", icon: "&#128221;" },
      { href: "parent.html?view=billing", label: "Billing Settings", icon: "&#128179;" },
      { href: "parent.html?view=waivers", label: "Waivers", icon: "&#9997;" },
      { href: "parent.html?view=documents", label: "Documents", icon: "&#128196;" },
      { href: "parent.html?view=events", label: "Events", icon: "&#127917;" },
      { href: "parent.html?view=bulletin", label: "Bulletin", icon: "&#128227;" }
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
    "<button class='role-sidebar-foot-link' type='button' id='openTourButton' data-open-tour='1'>Help / Tour</button>" +
    "<a class='role-sidebar-foot-link' href='login.html'>Switch Account</a>" +
    "<button class='role-sidebar-foot-link role-sidebar-logout' type='button' id='roleSidebarLogout'>Log Out</button>" +
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
  initializeLogout();
  window.addEventListener("popstate", renderNav);
  window.addEventListener("hashchange", renderNav);
  window.addEventListener("studio:nav-refresh", renderNav);

  function renderNav() {
    var nav = document.getElementById("roleSidebarNav");
    if (!nav) return;

    var currentFile = (window.location.pathname.split("/").pop() || "").toLowerCase();
    var currentQuery = (window.location.search || "").replace(/^\?/, "").toLowerCase();
    nav.innerHTML = navItems
      .map(function (item) {
        var itemHref = String(item.href || "").toLowerCase();
        var hrefParts = itemHref.split("?");
        var hrefFile = hrefParts[0] || "";
        var hrefQuery = hrefParts[1] || "";
        var active = "";

        if (hrefFile === currentFile) {
          if (!hrefQuery && (!currentQuery || currentQuery === "view=overview")) active = " active";
          if (hrefQuery && hrefQuery === currentQuery) active = " active";
        }

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

  function initializeLogout() {
    var logoutButton = document.getElementById("roleSidebarLogout");
    if (!logoutButton) return;

    logoutButton.addEventListener("click", function () {
      if (window.Auth && typeof window.Auth.clearSession === "function") {
        window.Auth.clearSession();
      }
      window.location.href = "login.html";
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
