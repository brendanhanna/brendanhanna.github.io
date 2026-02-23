(function () {
  var KEY = "studioLifeThemeV1";
  var root = document.documentElement;

  applyTheme(getPreferredTheme());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToggle);
  } else {
    initToggle();
  }

  function getPreferredTheme() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (error) {
      // Ignore storage access errors and fall back to system preference.
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }

  function initToggle() {
    if (!document.body || document.getElementById("themeToggleButton")) return;

    var needsRoleMenuTarget = document.body.dataset.requiresAuth === "true" && document.body.dataset.auth !== "login";
    if (needsRoleMenuTarget) {
      waitForRoleMenu(10, function (roleMenu) {
        mountThemeControl(roleMenu || null);
      });
      return;
    }

    mountThemeControl(null);
  }

  function waitForRoleMenu(remaining, done) {
    var menu = document.getElementById("roleDockMenu");
    if (menu || remaining <= 0) {
      done(menu || null);
      return;
    }

    setTimeout(function () {
      waitForRoleMenu(remaining - 1, done);
    }, 40);
  }

  function mountThemeControl(roleMenu) {
    var button = document.createElement("button");
    button.type = "button";
    button.id = "themeToggleButton";

    if (roleMenu) {
      button.className = "role-theme-button";
      roleMenu.appendChild(button);
    } else {
      var mount = document.createElement("div");
      mount.className = "theme-toggle";
      mount.id = "themeToggle";
      button.className = "theme-fab-button";
      mount.appendChild(button);
      document.body.appendChild(mount);
    }

    syncLabel(button, Boolean(roleMenu));

    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(KEY, next);
      } catch (error) {
        // Ignore storage errors for prototype use.
      }
      syncLabel(button, Boolean(roleMenu));
    });
  }

  function syncLabel(button, inMenu) {
    var current = root.getAttribute("data-theme") || "light";
    var next = current === "dark" ? "light" : "dark";

    if (inMenu) {
      button.textContent = "Theme: " + (current === "dark" ? "Dark" : "Light");
    } else {
      button.textContent = "TH";
    }

    button.setAttribute("title", "Switch to " + next + " mode");
    button.setAttribute("aria-label", "Switch to " + next + " mode");
  }
})();
