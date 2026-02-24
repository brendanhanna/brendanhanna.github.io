(function () {
  const STORAGE_KEY = "danceStudioPrototypeStateV1";
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const PAGE = document.body.dataset.page || "dashboard";

  const seedData = window.DanceData || {};
  const state = loadState(seedData);

  initializeShell();
  if (PAGE === "dashboard") initDashboard();
  if (PAGE === "schedule") initSchedule();
  if (PAGE === "students") initStudents();
  if (PAGE === "payments") initPayments();
  if (PAGE === "events") initEvents();

  function loadState(base) {
    const fallback = clone(base);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.students) || !Array.isArray(saved.classes)) {
        return fallback;
      }
      return {
        styles: clone(base.styles),
        classes: saved.classes,
        students: saved.students,
        transactions: saved.transactions || [],
        events: saved.events || []
      };
    } catch (error) {
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        classes: state.classes,
        students: state.students,
        transactions: state.transactions,
        events: state.events
      })
    );
  }

  function initializeShell() {
    const pageToFile = {
      dashboard: "dashboard.html",
      schedule: "schedule.html",
      students: "students.html",
      payments: "payments.html",
      events: "events.html"
    };

    const fileName = pageToFile[PAGE] || "dashboard.html";

    qsa("[data-nav]").forEach(function (node) {
      const href = node.getAttribute("href");
      if (href === fileName) node.classList.add("active");
    });

    qsa("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", function () {
        const modal = button.closest(".modal");
        if (modal) modal.classList.remove("open");
      });
    });

    qsa(".modal").forEach(function (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) modal.classList.remove("open");
      });
    });

    initMainSidebarCollapse();
  }

  function initMainSidebarCollapse() {
    var sidebar = document.querySelector(".app-shell .sidebar");
    if (!sidebar) return;

    var body = document.body;
    var storageKey = "studioLifeSidebarCollapsedV1";
    var legacyKey = "studioLifeMainSidebarCollapsedV1";

    if (!sidebar.querySelector(".sidebar-head")) {
      var brand = sidebar.querySelector(".brand");
      if (brand) {
        var brandText = brand.querySelector("div");
        if (brandText) brandText.classList.add("brand-text");

        var head = document.createElement("div");
        head.className = "sidebar-head";
        sidebar.insertBefore(head, sidebar.firstChild);
        head.appendChild(brand);

        var toggle = document.createElement("button");
        toggle.className = "sidebar-toggle";
        toggle.type = "button";
        toggle.id = "mainSidebarToggle";
        toggle.setAttribute("aria-label", "Collapse navigation");
        toggle.setAttribute("title", "Collapse navigation");
        toggle.innerHTML = "&#9776;";
        head.appendChild(toggle);
      }
    }

    qsa(".nav-link", sidebar).forEach(function (link) {
      if (link.querySelector(".nav-label")) return;

      var icon = link.querySelector(".nav-ico");
      var labelText = "";
      Array.prototype.slice.call(link.childNodes).forEach(function (node) {
        if (node === icon) return;
        if (node.nodeType === Node.TEXT_NODE) labelText += node.textContent;
      });
      labelText = labelText.trim();
      if (!labelText) return;

      Array.prototype.slice.call(link.childNodes).forEach(function (node) {
        if (node !== icon && node.nodeType === Node.TEXT_NODE) {
          link.removeChild(node);
        }
      });

      var label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = labelText;
      link.appendChild(label);
    });

    try {
      var saved = localStorage.getItem(storageKey);
      if (saved !== "1" && saved !== "0") {
        var legacy = localStorage.getItem(legacyKey);
        if (legacy === "1" || legacy === "0") {
          saved = legacy;
          localStorage.setItem(storageKey, legacy);
        }
      }
      if (saved === "1") {
        body.classList.add("app-sidebar-collapsed");
      }
    } catch (error) {
      // Ignore storage access errors in prototype mode.
    }

    var toggleButton = document.getElementById("mainSidebarToggle");
    if (!toggleButton) return;

    toggleButton.addEventListener("click", function () {
      body.classList.toggle("app-sidebar-collapsed");
      try {
        localStorage.setItem(storageKey, body.classList.contains("app-sidebar-collapsed") ? "1" : "0");
      } catch (error) {
        // Ignore storage access errors in prototype mode.
      }
    });
  }

  function initDashboard() {
    const roleContext = getRoleContext();
    const now = new Date();
    const todayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    const todayClasses = getClassInstances(roleContext.classes).filter(function (instance) {
      return instance.day === todayName;
    });
    const subtitle = document.querySelector(".topbar .subtitle");
    if (subtitle && roleContext.dashboardSubtitle) subtitle.textContent = roleContext.dashboardSubtitle;

    if (roleContext.role === "teacher") {
      byId("kpiStudentsLabel").textContent = "My Students";
      byId("kpiClassesLabel").textContent = "My Classes This Week";
      byId("kpiRevenueLabel").textContent = "Roster Paid This Month";
      byId("kpiOutstandingLabel").textContent = "Roster Outstanding";
    }
    if (roleContext.role === "parent") {
      byId("kpiStudentsLabel").textContent = "Students in Household";
      byId("kpiClassesLabel").textContent = "Household Classes This Week";
      byId("kpiRevenueLabel").textContent = "Paid This Month";
      byId("kpiOutstandingLabel").textContent = "Household Balance";
    }

    byId("todayLabel").textContent = formatDate(now.toISOString().slice(0, 10), {
      weekday: "long",
      month: "short",
      day: "numeric"
    });

    const todayList = byId("todayClasses");
    todayList.innerHTML = "";

    if (!todayClasses.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No classes scheduled today.";
      todayList.appendChild(empty);
    }

    todayClasses
      .sort(function (a, b) {
        return timeToMinutes(a.start) - timeToMinutes(b.start);
      })
      .forEach(function (item) {
        const classDrillTarget = roleContext.role === "parent" ? "parent.html" : "schedule.html";
        const styleMeta = state.styles[item.style] || {};
        const classCard = document.createElement("button");
        classCard.className = "today-class-card";
        classCard.style.borderLeftColor = styleMeta.color || "#d1d5db";
        classCard.innerHTML =
          "<div class='today-class-top'>" +
          "<strong>" +
          escapeHtml(item.name) +
          "</strong><span>" +
          escapeHtml(item.start + "-" + item.end) +
          "</span></div>" +
          "<div class='today-class-meta'>" +
          "<span>" +
          escapeHtml(item.instructor) +
          "</span><span>" +
          escapeHtml(item.room) +
          "</span><span>" +
          item.studentIds.length +
          "/" +
          item.capacity +
          " enrolled</span></div>";
        classCard.addEventListener("click", function () {
          window.location.href = classDrillTarget;
        });
        todayList.appendChild(classCard);
      });

    const monthRevenue = roleContext.transactions
      .filter(function (tx) {
        const txDate = new Date(tx.date + "T12:00:00");
        return tx.status === "paid" && txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      })
      .reduce(function (sum, tx) {
        return sum + Number(tx.amount || 0);
      }, 0);

    const outstanding = roleContext.students.reduce(function (sum, student) {
      return sum + Math.max(0, Number(student.balance || 0));
    }, 0);

    const activeStudents = roleContext.students.filter(function (student) {
      return student.classIds && student.classIds.length > 0;
    }).length;

    const classSessionsThisWeek = roleContext.classes.reduce(function (sum, danceClass) {
      return sum + (danceClass.days ? danceClass.days.length : 0);
    }, 0);

    byId("kpiStudents").textContent = activeStudents;
    byId("kpiClasses").textContent = classSessionsThisWeek;
    byId("kpiRevenue").textContent = formatCurrency(monthRevenue);
    byId("kpiOutstanding").textContent = formatCurrency(outstanding);

    const alertList = byId("alertList");
    alertList.innerHTML = "";

    const soon = addDays(now, 14);
    const soonEvents = roleContext.events.filter(function (evt) {
      const date = new Date(evt.date + "T12:00:00");
      return date >= now && date <= addDays(now, 60);
    });

    const expiringStudents = roleContext.students.filter(function (student) {
      const expiry = new Date(student.packageExpires + "T12:00:00");
      return expiry >= now && expiry <= soon;
    });

    const overdueStudents = roleContext.students.filter(function (student) {
      return student.paymentStatus === "overdue" || Number(student.balance || 0) >= 90;
    });

    soonEvents.slice(0, 2).forEach(function (evt) {
      addAlertRow(alertList, "Upcoming Event", evt.name + " on " + formatDate(evt.date));
    });

    expiringStudents.slice(0, 4).forEach(function (student) {
      addAlertRow(alertList, "Package Expiring", student.name + " - " + formatDate(student.packageExpires));
    });

    overdueStudents.slice(0, 4).forEach(function (student) {
      addAlertRow(alertList, "Payment Overdue", student.name + " - " + formatCurrency(student.balance));
    });

    if (!alertList.children.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No alerts today.";
      alertList.appendChild(empty);
    }
  }

  function addAlertRow(parent, label, text) {
    const row = document.createElement("div");
    row.className = "alert-row";
    row.innerHTML = "<span class='alert-tag'>" + escapeHtml(label) + "</span><span>" + escapeHtml(text) + "</span>";
    parent.appendChild(row);
  }

  function initSchedule() {
    const roleContext = getRoleContext();
    const timeRail = byId("timeRail");
    const dayColumns = byId("dayColumns");
    const legend = byId("scheduleLegend");
    const panel = byId("classPanel");
    const panelBody = byId("classPanelBody");
    const panelTitle = byId("classPanelTitle");
    const addButton = byId("addClassButton");
    const modal = byId("classModal");
    const form = byId("classForm");
    const modalTitle = byId("classModalTitle");
    const subtitle = document.querySelector(".topbar .subtitle");
    if (subtitle && roleContext.scheduleSubtitle) subtitle.textContent = roleContext.scheduleSubtitle;

    const startHour = 8;
    const endHour = 21;
    const pixelsPerHour = 64;
    const headerOffset = 40;
    let editingClassId = null;

    legend.innerHTML = "";
    Object.keys(state.styles).forEach(function (style) {
      const chip = document.createElement("span");
      chip.className = "legend-chip";
      chip.style.background = state.styles[style].color;
      chip.textContent = style;
      legend.appendChild(chip);
    });

    timeRail.style.height = headerOffset + (endHour - startHour) * pixelsPerHour + "px";

    for (var hour = startHour; hour <= endHour; hour += 1) {
      const label = document.createElement("div");
      label.className = "time-label";
      label.textContent = to12Hour(hour + ":00");
      label.style.top = headerOffset + (hour - startHour) * pixelsPerHour + "px";
      timeRail.appendChild(label);
    }

    DAY_NAMES.forEach(function (day) {
      const column = document.createElement("div");
      column.className = "day-column";
      column.dataset.day = day;
      column.innerHTML = "<div class='day-column-header'>" + day + "</div><div class='day-column-grid'></div>";
      dayColumns.appendChild(column);
    });

    function renderScheduleBlocks() {
      qsa(".day-column-grid", dayColumns).forEach(function (grid) {
        grid.innerHTML = "";
        grid.style.height = (endHour - startHour) * pixelsPerHour + "px";
      });

      getClassInstances(roleContext.classes).forEach(function (instance) {
        const dayColumn = dayColumns.querySelector(".day-column[data-day='" + instance.day + "'] .day-column-grid");
        if (!dayColumn) return;

        const block = document.createElement("button");
        const styleMeta = state.styles[instance.style] || {};
        const startMinutes = timeToMinutes(instance.start);
        const endMinutes = timeToMinutes(instance.end);
        const top = ((startMinutes - startHour * 60) / 60) * pixelsPerHour;
        const height = Math.max(((endMinutes - startMinutes) / 60) * pixelsPerHour - 4, 36);

        block.className = "class-block";
        block.style.top = top + "px";
        block.style.height = height + "px";
        block.style.background = styleMeta.color || "#dbeafe";
        block.style.color = styleMeta.accent || "#1f2937";
        block.innerHTML =
          "<strong>" +
          escapeHtml(instance.name) +
          "</strong>" +
          "<span>" +
          escapeHtml(to12Hour(instance.start) + " - " + to12Hour(instance.end)) +
          "</span>" +
          "<span>" +
          escapeHtml(instance.instructor) +
          "</span>" +
          "<span>" +
          escapeHtml(instance.room) +
          "</span>" +
          "<span>" +
          instance.studentIds.length +
          "/" +
          instance.capacity +
          "</span>";
        block.addEventListener("click", function () {
          openClassPanel(instance.id);
        });

        dayColumn.appendChild(block);
      });
    }

    function openClassPanel(classId) {
      const danceClass = roleContext.classes.find(function (item) {
        return item.id === classId;
      });
      if (!danceClass) return;

      panelTitle.textContent = danceClass.name;
      panelBody.innerHTML = "";
      const styleMeta = state.styles[danceClass.style] || {};
      const rosterNames = danceClass.studentIds
        .map(function (studentId) {
          return getStudentById(studentId);
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });

      const wrapper = document.createElement("div");
      wrapper.className = "panel-stack";
      wrapper.innerHTML =
        "<div class='panel-topline'>" +
        "<span class='style-pill' style='background:" +
        escapeHtml(styleMeta.color || "#e5e7eb") +
        ";color:" +
        escapeHtml(styleMeta.accent || "#1f2937") +
        "'>" +
        escapeHtml(danceClass.style) +
        "</span>" +
        "<span>" +
        escapeHtml(danceClass.ageRange) +
        "</span></div>" +
        "<p><strong>Instructor:</strong> " +
        escapeHtml(danceClass.instructor) +
        "</p>" +
        "<p><strong>Room:</strong> " +
        escapeHtml(danceClass.room) +
        "</p>" +
        "<p><strong>Days:</strong> " +
        escapeHtml(danceClass.days.join(", ")) +
        "</p>" +
        "<p><strong>Time:</strong> " +
        escapeHtml(to12Hour(danceClass.start) + " - " + to12Hour(danceClass.end)) +
        "</p>" +
        "<p><strong>Enrollment:</strong> " +
        danceClass.studentIds.length +
        "/" +
        danceClass.capacity +
        "</p>";

      const roster = document.createElement("div");
      roster.className = "roster-list";
      roster.innerHTML = "<h4>Roster</h4>";
      if (!rosterNames.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No enrolled students.";
        roster.appendChild(empty);
      } else {
        rosterNames.forEach(function (student) {
          const row = document.createElement("div");
          row.className = "roster-row";
          row.innerHTML = "<span>" + escapeHtml(student.name) + "</span><span>Age " + student.age + "</span>";
          roster.appendChild(row);
        });
      }

      wrapper.appendChild(roster);
      panelBody.appendChild(wrapper);
      panel.classList.add("open");

      editingClassId = classId;
      const editButton = byId("editClassButton");
      if (editButton) {
        if (roleContext.canManageClasses) {
          editButton.style.display = "";
          editButton.onclick = function () {
            openClassModal(classId);
          };
        } else {
          editButton.style.display = "none";
          editButton.onclick = null;
        }
      }
    }

    byId("closeClassPanel").addEventListener("click", function () {
      panel.classList.remove("open");
    });

    if (addButton) {
      if (roleContext.canManageClasses) {
        addButton.style.display = "";
        addButton.addEventListener("click", function () {
          openClassModal();
        });
      } else {
        addButton.style.display = "none";
      }
    }

    function openClassModal(classId) {
      if (!roleContext.canManageClasses) return;
      editingClassId = classId || null;
      const classNameInput = byId("classNameInput");
      const classStyleInput = byId("classStyleInput");
      const classInstructorInput = byId("classInstructorInput");
      const classRoomInput = byId("classRoomInput");
      const classStartInput = byId("classStartInput");
      const classEndInput = byId("classEndInput");
      const classCapacityInput = byId("classCapacityInput");
      const classAgeRangeInput = byId("classAgeRangeInput");

      if (classStyleInput.options.length < 2) {
        Object.keys(state.styles).forEach(function (style) {
          const option = document.createElement("option");
          option.value = style;
          option.textContent = style;
          classStyleInput.appendChild(option);
        });
      }

      qsa("input[name='classDays']").forEach(function (box) {
        box.checked = false;
      });

      if (editingClassId) {
        const danceClass = getClassById(editingClassId);
        if (!danceClass) return;
        modalTitle.textContent = "Edit Class";
        classNameInput.value = danceClass.name;
        classStyleInput.value = danceClass.style;
        classInstructorInput.value = danceClass.instructor;
        classRoomInput.value = danceClass.room;
        classStartInput.value = danceClass.start;
        classEndInput.value = danceClass.end;
        classCapacityInput.value = danceClass.capacity;
        classAgeRangeInput.value = danceClass.ageRange;
        qsa("input[name='classDays']").forEach(function (box) {
          box.checked = danceClass.days.includes(box.value);
        });
      } else {
        modalTitle.textContent = "Add Class";
        form.reset();
        classCapacityInput.value = 12;
      }

      modal.classList.add("open");
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!roleContext.canManageClasses) return;

      const name = byId("classNameInput").value.trim();
      const style = byId("classStyleInput").value;
      const instructor = byId("classInstructorInput").value.trim();
      const room = byId("classRoomInput").value.trim();
      const start = byId("classStartInput").value;
      const end = byId("classEndInput").value;
      const capacity = Number(byId("classCapacityInput").value);
      const ageRange = byId("classAgeRangeInput").value.trim() || "All Ages";
      const days = qsa("input[name='classDays']:checked").map(function (box) {
        return box.value;
      });

      if (!name || !style || !instructor || !room || !start || !end || !days.length || !capacity) return;
      if (timeToMinutes(start) >= timeToMinutes(end)) return;

      if (editingClassId) {
        const existing = getClassById(editingClassId);
        if (!existing) return;
        existing.name = name;
        existing.style = style;
        existing.instructor = instructor;
        existing.room = room;
        existing.start = start;
        existing.end = end;
        existing.capacity = capacity;
        existing.ageRange = ageRange;
        existing.days = days;
      } else {
        state.classes.push({
          id: "c" + Date.now(),
          name: name,
          style: style,
          instructor: instructor,
          room: room,
          start: start,
          end: end,
          capacity: capacity,
          ageRange: ageRange,
          days: days,
          studentIds: []
        });
      }

      saveState();
      modal.classList.remove("open");
      renderScheduleBlocks();
      if (editingClassId) openClassPanel(editingClassId);
    });

    renderScheduleBlocks();
  }

  function initStudents() {
    const roleContext = getRoleContext();
    const searchInput = byId("studentSearchInput");
    const styleFilter = byId("studentStyleFilter");
    const ageFilter = byId("studentAgeFilter");
    const paymentFilter = byId("studentPaymentFilter");
    const tableBody = byId("studentTableBody");
    const panel = byId("studentPanel");
    const panelBody = byId("studentPanelBody");
    const panelTitle = byId("studentPanelTitle");
    const subtitle = document.querySelector(".topbar .subtitle");
    if (subtitle && roleContext.studentsSubtitle) subtitle.textContent = roleContext.studentsSubtitle;

    const scopedStudents = roleContext.students;
    const scopedStudentMap = scopedStudents.reduce(function (map, student) {
      map[student.id] = student;
      return map;
    }, {});
    const roleClassIdSet = new Set(
      roleContext.classes.map(function (danceClass) {
        return danceClass.id;
      })
    );
    const scopedStyleSet = new Set();
    roleContext.classes.forEach(function (danceClass) {
      scopedStyleSet.add(danceClass.style);
    });

    const sortState = { key: "name", direction: "asc" };

    if (styleFilter.options.length < 2) {
      Array.from(scopedStyleSet)
        .sort(function (a, b) {
          return String(a || "").localeCompare(String(b || ""));
        })
        .forEach(function (style) {
        const option = document.createElement("option");
        option.value = style;
        option.textContent = style;
        styleFilter.appendChild(option);
      });
    }

    function filteredStudents() {
      const term = searchInput.value.trim().toLowerCase();
      const style = styleFilter.value;
      const ageGroup = ageFilter.value;
      const payStatus = paymentFilter.value;

      return scopedStudents.filter(function (student) {
        const classRecords = student.classIds
          .filter(function (classId) {
            return roleClassIdSet.has(classId);
          })
          .map(getClassById)
          .filter(Boolean);
        const styles = classRecords.map(function (record) {
          return record.style;
        });

        const searchHit =
          !term ||
          [student.name, student.guardianName, student.phone]
            .join(" ")
            .toLowerCase()
            .includes(term);

        const styleHit = !style || styles.includes(style);
        const paymentHit = !payStatus || student.paymentStatus === payStatus;

        let ageHit = true;
        if (ageGroup === "3-5") ageHit = student.age >= 3 && student.age <= 5;
        if (ageGroup === "6-8") ageHit = student.age >= 6 && student.age <= 8;
        if (ageGroup === "9-12") ageHit = student.age >= 9 && student.age <= 12;
        if (ageGroup === "13+") ageHit = student.age >= 13;

        return searchHit && styleHit && ageHit && paymentHit;
      });
    }

    function renderTable() {
      const rows = filteredStudents().sort(function (a, b) {
        return compareValues(a, b, sortState.key, sortState.direction, function (student) {
          if (sortState.key === "activeClasses")
            return student.classIds.filter(function (classId) {
              return roleClassIdSet.has(classId);
            }).length;
          if (sortState.key === "balance") return Number(student.balance || 0);
          return student[sortState.key];
        });
      });

      tableBody.innerHTML = "";
      rows.forEach(function (student) {
        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.innerHTML =
          "<td>" +
          escapeHtml(student.name) +
          "</td><td>" +
          student.age +
          "</td><td>" +
          escapeHtml(student.guardianName) +
          "</td><td>" +
          escapeHtml(student.phone) +
          "</td><td>" +
          student.classIds.filter(function (classId) {
            return roleClassIdSet.has(classId);
          }).length +
          "</td><td>" +
          escapeHtml(student.membershipType) +
          "</td><td>" +
          formatCurrency(student.balance) +
          "</td>";
        row.addEventListener("click", function () {
          openStudentPanel(student.id);
        });
        tableBody.appendChild(row);
      });
    }

    function openStudentPanel(studentId) {
      const student = scopedStudentMap[studentId] || getStudentById(studentId);
      if (!student) return;

      panelTitle.textContent = student.name;
      panelBody.innerHTML = "";

      const enrolled = student.classIds
        .filter(function (classId) {
          return roleClassIdSet.has(classId);
        })
        .map(getClassById)
        .filter(Boolean);
      const attendance = buildAttendanceHistory(student, roleClassIdSet).slice(0, 12);
      const paymentHistory = roleContext.transactions
        .filter(function (tx) {
          return tx.studentId === student.id;
        })
        .sort(function (a, b) {
          return b.date.localeCompare(a.date);
        })
        .slice(0, 10);

      const section = document.createElement("div");
      section.className = "panel-stack";

      const classItems = enrolled
        .map(function (danceClass) {
          return "<li>" + escapeHtml(danceClass.name + " (" + danceClass.style + ")") + "</li>";
        })
        .join("");

      const attendanceRows = attendance
        .map(function (entry) {
          return (
            "<tr><td>" +
            escapeHtml(formatDate(entry.date)) +
            "</td><td>" +
            escapeHtml(entry.className) +
            "</td><td><span class='status-pill " +
            entry.status +
            "'>" +
            escapeHtml(entry.status) +
            "</span></td></tr>"
          );
        })
        .join("");

      const paymentRows = paymentHistory
        .map(function (tx) {
          return (
            "<tr><td>" +
            escapeHtml(formatDate(tx.date)) +
            "</td><td>" +
            escapeHtml(tx.type) +
            "</td><td>" +
            formatCurrency(tx.amount) +
            "</td><td><span class='status-pill " +
            tx.status +
            "'>" +
            escapeHtml(tx.status) +
            "</span></td></tr>"
          );
        })
        .join("");

      section.innerHTML =
        "<div class='detail-card'><h4>Contact</h4><p><strong>Guardian:</strong> " +
        escapeHtml(student.guardianName) +
        "</p><p><strong>Phone:</strong> " +
        escapeHtml(student.phone) +
        "</p><p><strong>Emergency:</strong> " +
        escapeHtml(student.emergencyContact.name + " (" + student.emergencyContact.relation + ")") +
        " - " +
        escapeHtml(student.emergencyContact.phone) +
        "</p></div>" +
        "<div class='detail-card'><h4>Enrolled Classes</h4><ul class='simple-list'>" +
        classItems +
        "</ul></div>" +
        "<div class='detail-card'><h4>Attendance</h4><div class='table-wrap'><table><thead><tr><th>Date</th><th>Class</th><th>Status</th></tr></thead><tbody>" +
        attendanceRows +
        "</tbody></table></div></div>" +
        "<div class='detail-card'><h4>Payment History</h4><div class='table-wrap'><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>" +
        paymentRows +
        "</tbody></table></div><p class='balance-line'><strong>Current Balance:</strong> " +
        formatCurrency(student.balance) +
        "</p></div>" +
        "<div class='detail-card'><h4>Notes</h4><textarea id='studentNotesInput' rows='4'>" +
        escapeHtml(student.notes || "") +
        "</textarea><button id='saveNotesButton' class='button button-primary'>Save Notes</button></div>";

      panelBody.appendChild(section);
      panel.classList.add("open");

      byId("saveNotesButton").addEventListener("click", function () {
        const notesValue = byId("studentNotesInput").value.trim();
        student.notes = notesValue;
        saveState();
      });
    }

    byId("closeStudentPanel").addEventListener("click", function () {
      panel.classList.remove("open");
    });

    [searchInput, styleFilter, ageFilter, paymentFilter].forEach(function (control) {
      control.addEventListener("input", renderTable);
      control.addEventListener("change", renderTable);
    });

    qsa("th[data-sort]").forEach(function (head) {
      head.addEventListener("click", function () {
        const key = head.dataset.sort;
        if (sortState.key === key) {
          sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
        } else {
          sortState.key = key;
          sortState.direction = "asc";
        }
        renderTable();
      });
    });

    renderTable();
  }

  function initPayments() {
    const tableBody = byId("paymentTableBody");
    const searchInput = byId("paymentSearchInput");
    const statusFilter = byId("paymentStatusFilter");
    const typeFilter = byId("paymentTypeFilter");
    const methodFilter = byId("paymentMethodFilter");
    const startInput = byId("paymentStartDate");
    const endInput = byId("paymentEndDate");
    const lookupInput = byId("balanceLookupInput");
    const lookupResult = byId("balanceLookupResult");
    const scopeNote = byId("paymentScopeNote");
    const subtitle = document.querySelector(".topbar .subtitle");
    const session = window.Auth && window.Auth.getSession ? window.Auth.getSession() : null;
    const paymentScope = getPaymentScope(session);
    const scopedStudents = paymentScope.students;
    const scopedTransactions = paymentScope.transactions;
    const scopedStudentMap = scopedStudents.reduce(function (map, student) {
      map[student.id] = student;
      return map;
    }, {});

    const sortState = { key: "date", direction: "desc" };

    if (scopeNote) scopeNote.textContent = paymentScope.note;
    if (subtitle && paymentScope.subtitle) subtitle.textContent = paymentScope.subtitle;
    if (paymentScope.role === "parent") {
      const revenueLabel = byId("paymentLabelRevenue");
      const outstandingLabel = byId("paymentLabelOutstanding");
      const recentLabel = byId("paymentLabelRecent");
      if (revenueLabel) revenueLabel.textContent = "Paid This Month";
      if (outstandingLabel) outstandingLabel.textContent = "Household Balance";
      if (recentLabel) recentLabel.textContent = "Recent Family Transactions (14d)";
    }

    const uniqueTypes = Array.from(
      new Set(
        scopedTransactions.map(function (tx) {
          return tx.type;
        })
      )
    ).sort(function (a, b) {
      return String(a || "").localeCompare(String(b || ""));
    });

    uniqueTypes.forEach(function (type) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = titleCase(type);
      typeFilter.appendChild(option);
    });

    const methodCatalog = [
      "credit card",
      "cash",
      "check",
      "scholarship",
      "gift certificate",
      "fundraising funds",
      "bank transfer (ach)"
    ];

    const uniqueMethods = Array.from(
      new Set(
        methodCatalog.concat(
          scopedTransactions.map(function (tx) {
            return normalizePaymentMethod(tx.method);
          })
        )
      )
    ).sort(function (a, b) {
      return String(a || "").localeCompare(String(b || ""));
    });

    uniqueMethods.forEach(function (method) {
      if (!methodFilter) return;
      const option = document.createElement("option");
      option.value = method;
      option.textContent = titleCase(method);
      methodFilter.appendChild(option);
    });

    const datalist = byId("studentLookupList");
    scopedStudents
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      })
      .forEach(function (student) {
        const option = document.createElement("option");
        option.value = student.name;
        datalist.appendChild(option);
      });

    if (lookupInput && scopedStudents.length === 1) {
      lookupInput.value = scopedStudents[0].name;
    }

    function getScopedStudentById(studentId) {
      return scopedStudentMap[studentId] || getStudentById(studentId);
    }

    function renderSummary() {
      const now = new Date();
      const monthRevenue = scopedTransactions
        .filter(function (tx) {
          const date = new Date(tx.date + "T12:00:00");
          return tx.status === "paid" && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        })
        .reduce(function (sum, tx) {
          return sum + Number(tx.amount || 0);
        }, 0);

      const outstanding = scopedStudents.reduce(function (sum, student) {
        return sum + Number(student.balance || 0);
      }, 0);

      const recentCount = scopedTransactions.filter(function (tx) {
        return new Date(tx.date + "T12:00:00") >= addDays(now, -14);
      }).length;

      byId("paymentRevenueMonth").textContent = formatCurrency(monthRevenue);
      byId("paymentOutstanding").textContent = formatCurrency(outstanding);
      byId("paymentRecentCount").textContent = recentCount;
    }

    function filteredTransactions() {
      const term = searchInput.value.trim().toLowerCase();
      const status = statusFilter.value;
      const type = typeFilter.value;
      const method = methodFilter ? methodFilter.value : "";
      const startDate = startInput.value;
      const endDate = endInput.value;

      return scopedTransactions.filter(function (tx) {
        const student = getScopedStudentById(tx.studentId);
        const normalizedMethod = normalizePaymentMethod(tx.method);
        const hitSearch =
          !term ||
          [student ? student.name : "", tx.type, normalizedMethod, tx.status, tx.date].join(" ").toLowerCase().includes(term);

        const hitStatus = !status || tx.status === status;
        const hitType = !type || tx.type === type;
        const hitMethod = !method || normalizedMethod === method;
        const hitStart = !startDate || tx.date >= startDate;
        const hitEnd = !endDate || tx.date <= endDate;

        return hitSearch && hitStatus && hitType && hitMethod && hitStart && hitEnd;
      });
    }

    function renderTable() {
      const rows = filteredTransactions().sort(function (a, b) {
        return compareValues(a, b, sortState.key, sortState.direction, function (tx) {
          if (sortState.key === "student") {
            const student = getScopedStudentById(tx.studentId);
            return student ? student.name : "";
          }
          if (sortState.key === "amount") return Number(tx.amount || 0);
          if (sortState.key === "method") return normalizePaymentMethod(tx.method);
          return tx[sortState.key];
        });
      });

      tableBody.innerHTML = "";
      rows.forEach(function (tx) {
        const student = getScopedStudentById(tx.studentId);
        const row = document.createElement("tr");
        row.innerHTML =
          "<td>" +
          escapeHtml(formatDate(tx.date)) +
          "</td><td>" +
          escapeHtml(student ? student.name : "Unknown") +
          "</td><td>" +
          formatCurrency(tx.amount) +
          "</td><td>" +
          escapeHtml(titleCase(tx.type)) +
          "</td><td>" +
          escapeHtml(titleCase(normalizePaymentMethod(tx.method))) +
          "</td><td><span class='status-pill " +
          tx.status +
          "'>" +
          escapeHtml(tx.status) +
          "</span></td>";
        tableBody.appendChild(row);
      });
    }

    function renderLookup() {
      const value = lookupInput.value.trim().toLowerCase();
      if (!value) {
        lookupResult.innerHTML = "<p class='muted'>Select a student to view their current balance.</p>";
        return;
      }

      const student = scopedStudents.find(function (candidate) {
        return candidate.name.toLowerCase() === value;
      });

      if (!student) {
        lookupResult.innerHTML = "<p class='muted'>No matching student found.</p>";
        return;
      }

      const lastPayment = scopedTransactions
        .filter(function (tx) {
          return tx.studentId === student.id;
        })
        .sort(function (a, b) {
          return b.date.localeCompare(a.date);
        })[0];

      lookupResult.innerHTML =
        "<h4>" +
        escapeHtml(student.name) +
        "</h4><p><strong>Balance:</strong> " +
        formatCurrency(student.balance) +
        "</p><p><strong>Status:</strong> <span class='status-pill " +
        student.paymentStatus +
        "'>" +
        escapeHtml(student.paymentStatus) +
        "</span></p><p><strong>Last Transaction:</strong> " +
        (lastPayment
          ? escapeHtml(
              formatDate(lastPayment.date) +
                " - " +
                titleCase(lastPayment.type) +
                " via " +
                titleCase(normalizePaymentMethod(lastPayment.method))
            )
          : "No payments yet") +
        "</p>";
    }

    [searchInput, statusFilter, typeFilter, methodFilter, startInput, endInput]
      .filter(Boolean)
      .forEach(function (control) {
        control.addEventListener("input", renderTable);
        control.addEventListener("change", renderTable);
      });

    lookupInput.addEventListener("input", renderLookup);

    qsa("th[data-sort]").forEach(function (head) {
      head.addEventListener("click", function () {
        const key = head.dataset.sort;
        if (sortState.key === key) {
          sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
        } else {
          sortState.key = key;
          sortState.direction = key === "date" ? "desc" : "asc";
        }
        renderTable();
      });
    });

    renderSummary();
    renderLookup();
    renderTable();
  }

  function initEvents() {
    const roleContext = getRoleContext();
    const list = byId("eventList");
    const detail = byId("eventDetail");
    const statusFilter = byId("eventStatusFilter");
    const subtitle = document.querySelector(".topbar .subtitle");
    const scopeNote = byId("eventScopeNote");
    const scopedEvents = roleContext.events;
    const editableClassIdSet = roleContext.classIdSet || new Set();

    if (!list || !detail) return;
    if (subtitle && roleContext.eventsSubtitle) subtitle.textContent = roleContext.eventsSubtitle;
    if (scopeNote && roleContext.eventsScopeNote) scopeNote.textContent = roleContext.eventsScopeNote;

    const statuses = Array.from(
      new Set(
        scopedEvents.map(function (event) {
          return event.status;
        })
      )
    );

    statuses.forEach(function (status) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      statusFilter.appendChild(option);
    });

    let selectedId = scopedEvents[0] ? scopedEvents[0].id : null;

    function visibleEvents() {
      const status = statusFilter.value;
      return scopedEvents
        .filter(function (event) {
          return !status || event.status === status;
        })
        .sort(function (a, b) {
          return a.date.localeCompare(b.date);
        });
    }

    function renderList() {
      const events = visibleEvents();
      list.innerHTML = "";

      events.forEach(function (event) {
        const item = document.createElement("button");
        item.className = "event-item" + (event.id === selectedId ? " active" : "");
        item.innerHTML =
          "<strong>" +
          escapeHtml(event.name) +
          "</strong><span>" +
          escapeHtml(formatDate(event.date)) +
          "</span><span>" +
          escapeHtml(event.venue) +
          "</span><span class='status-pill neutral'>" +
          escapeHtml(event.status) +
          "</span>";
        item.addEventListener("click", function () {
          selectedId = event.id;
          renderList();
          renderDetail();
        });
        list.appendChild(item);
      });

      if (!events.length) {
        list.innerHTML = "<div class='empty-state'>No events match this filter.</div>";
      } else if (!events.find(function (event) { return event.id === selectedId; })) {
        selectedId = events[0].id;
      }
    }

    function renderDetail() {
      const event = scopedEvents.find(function (item) {
        return item.id === selectedId;
      });

      if (!event) {
        detail.innerHTML = "<div class='empty-state'>Select an event to view details.</div>";
        return;
      }

      const routineRows = event.routines
        .map(function (routine, index) {
          const danceClass = getClassById(routine.classId);
          const sourceIndex = routine._sourceIndex != null ? routine._sourceIndex : index;
          const canEditCostume =
            roleContext.role === "owner" || (roleContext.role === "teacher" && editableClassIdSet.has(routine.classId));
          const costumeCell = canEditCostume
            ? "<select class='costume-select' data-event='" +
              escapeHtml(event.id) +
              "' data-index='" +
              sourceIndex +
              "'>" +
              ["Ordered", "Arrived", "Distributed", "N/A"]
                .map(function (status) {
                  return "<option value='" + status + "'" + (status === routine.costumeStatus ? " selected" : "") + ">" + status + "</option>";
                })
                .join("") +
              "</select>"
            : "<span class='status-pill neutral'>" + escapeHtml(routine.costumeStatus) + "</span>";
          return (
            "<tr><td>" +
            escapeHtml(routine.routine) +
            "</td><td>" +
            escapeHtml(danceClass ? danceClass.name : "Unknown") +
            "</td><td>" +
            costumeCell +
            "</td></tr>"
          );
        })
        .join("");

      const rehearsalRows = event.rehearsals
        .map(function (rehearsal) {
          return (
            "<tr><td>" +
            escapeHtml(formatDate(rehearsal.date)) +
            "</td><td>" +
            escapeHtml(rehearsal.time) +
            "</td><td>" +
            escapeHtml(rehearsal.focus) +
            "</td><td>" +
            escapeHtml(rehearsal.room) +
            "</td></tr>"
          );
        })
        .join("");

      const tickets = event.ticketing || { sold: 0, goal: 0, price: 0 };
      const fees = event.fees || { expected: 0, collected: 0 };
      const soldPercent = tickets.goal ? Math.min(100, Math.round((tickets.sold / tickets.goal) * 100)) : 0;
      const feePercent = fees.expected ? Math.min(100, Math.round((fees.collected / fees.expected) * 100)) : 0;
      const showFinance = roleContext.role === "owner";
      const familyOutstanding = roleContext.transactions
        .filter(function (tx) {
          return tx.status !== "paid" && (tx.type.indexOf("fee") !== -1 || tx.type.indexOf("tuition") !== -1 || tx.type === "drop-in");
        })
        .reduce(function (sum, tx) {
          return sum + Number(tx.amount || 0);
        }, 0);

      const statsHtml = showFinance
        ? "<div class='event-stats-grid'>" +
          "<div class='detail-card'><h4>Ticket Tracking</h4><p><strong>Sold:</strong> " +
          tickets.sold +
          (tickets.goal ? " / " + tickets.goal : "") +
          "</p><p><strong>Price:</strong> " +
          formatCurrency(tickets.price) +
          "</p><div class='progress'><span style='width:" +
          soldPercent +
          "%'></span></div></div>" +
          "<div class='detail-card'><h4>Fee Tracking</h4><p><strong>Collected:</strong> " +
          formatCurrency(fees.collected) +
          "</p><p><strong>Outstanding:</strong> " +
          formatCurrency(Math.max(0, fees.expected - fees.collected)) +
          "</p><div class='progress'><span style='width:" +
          feePercent +
          "%'></span></div></div>" +
          "</div>"
        : "<div class='event-stats-grid'>" +
          "<div class='detail-card'><h4>Ticket Tracking</h4><p><strong>Sold:</strong> " +
          tickets.sold +
          (tickets.goal ? " / " + tickets.goal : "") +
          "</p><p><strong>Price:</strong> " +
          formatCurrency(tickets.price) +
          "</p><div class='progress'><span style='width:" +
          soldPercent +
          "%'></span></div></div>" +
          "<div class='detail-card'><h4>" +
          (roleContext.role === "parent" ? "Family Fee Snapshot" : "Finance Access") +
          "</h4><p>" +
          (roleContext.role === "parent"
            ? "Outstanding family fees: " + formatCurrency(familyOutstanding)
            : "Financial fee tracking is limited to studio owner access.") +
          "</p></div></div>";

      detail.innerHTML =
        "<div class='event-detail-top'><h3>" +
        escapeHtml(event.name) +
        "</h3><p>" +
        escapeHtml(formatDate(event.date)) +
        " - " +
        escapeHtml(event.venue) +
        "</p><span class='status-pill neutral'>" +
        escapeHtml(event.status) +
        "</span></div>" +
        "<div class='detail-card'><h4>Assigned Routines</h4><div class='table-wrap'><table><thead><tr><th>Routine</th><th>Class</th><th>Costume Status</th></tr></thead><tbody>" +
        routineRows +
        "</tbody></table></div></div>" +
        "<div class='detail-card'><h4>Rehearsal Schedule</h4><div class='table-wrap'><table><thead><tr><th>Date</th><th>Time</th><th>Focus</th><th>Room</th></tr></thead><tbody>" +
        rehearsalRows +
        "</tbody></table></div></div>" +
        statsHtml;

      qsa(".costume-select", detail).forEach(function (select) {
        select.addEventListener("change", function () {
          const eventId = select.dataset.event;
          const index = Number(select.dataset.index);
          const activeEvent = state.events.find(function (item) {
            return item.id === eventId;
          });
          if (!activeEvent || !activeEvent.routines[index]) return;
          const routineClassId = activeEvent.routines[index].classId;
          const canEdit =
            roleContext.role === "owner" || (roleContext.role === "teacher" && editableClassIdSet.has(routineClassId));
          if (!canEdit) return;
          activeEvent.routines[index].costumeStatus = select.value;
          const activeScopedEvent = scopedEvents.find(function (item) {
            return item.id === eventId;
          });
          if (activeScopedEvent) {
            const scopedRoutine = (activeScopedEvent.routines || []).find(function (routine) {
              const sourceIndex = routine._sourceIndex != null ? routine._sourceIndex : -1;
              return sourceIndex === index;
            });
            if (scopedRoutine) scopedRoutine.costumeStatus = select.value;
          }
          saveState();
        });
      });
    }

    statusFilter.addEventListener("change", function () {
      renderList();
      renderDetail();
    });

    renderList();
    renderDetail();
  }

  function getClassInstances(classList) {
    const source = Array.isArray(classList) ? classList : state.classes;
    const instances = [];
    source.forEach(function (danceClass) {
      (danceClass.days || []).forEach(function (day) {
        instances.push(
          Object.assign(
            {
              day: day
            },
            danceClass
          )
        );
      });
    });
    return instances;
  }

  function buildAttendanceHistory(student, allowedClassIds) {
    const history = [];
    const now = new Date();
    const classIdSet = allowedClassIds instanceof Set ? allowedClassIds : null;

    student.classIds.forEach(function (classId) {
      if (classIdSet && !classIdSet.has(classId)) return;
      const danceClass = getClassById(classId);
      if (!danceClass) return;

      for (var offset = 1; offset <= 45; offset += 1) {
        const candidate = addDays(now, -offset);
        const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][candidate.getDay()];
        if (!danceClass.days.includes(dayName)) continue;

        if (seedRandom(student.id + classId + candidate.toISOString().slice(0, 10)) > 0.78) continue;

        const status = seedRandom("status" + student.id + classId + candidate.toISOString()) > 0.16 ? "present" : "absent";
        history.push({
          date: candidate.toISOString().slice(0, 10),
          className: danceClass.name,
          status: status
        });

        if (history.length >= 20) break;
      }
    });

    return history.sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
  }

  function getClassById(id) {
    return state.classes.find(function (danceClass) {
      return danceClass.id === id;
    });
  }

  function getStudentById(id) {
    return state.students.find(function (student) {
      return student.id === id;
    });
  }

  function compareValues(a, b, key, direction, selector) {
    const aValue = selector ? selector(a) : a[key];
    const bValue = selector ? selector(b) : b[key];

    let result = 0;
    if (typeof aValue === "number" || typeof bValue === "number") {
      result = Number(aValue || 0) - Number(bValue || 0);
    } else {
      result = String(aValue || "").localeCompare(String(bValue || ""));
    }

    return direction === "asc" ? result : -result;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatDate(dateString, options) {
    if (!dateString) return "";
    return new Intl.DateTimeFormat(
      "en-US",
      options || {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    ).format(new Date(dateString + "T12:00:00"));
  }

  function addDays(date, days) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function timeToMinutes(value) {
    const parts = String(value || "00:00").split(":");
    return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
  }

  function to12Hour(value) {
    const minutes = timeToMinutes(value);
    const hour24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const hour = ((hour24 + 11) % 12) + 1;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    return hour + ":" + String(mins).padStart(2, "0") + " " + suffix;
  }

  function titleCase(value) {
    return String(value || "")
      .split(" ")
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function normalizePaymentMethod(value) {
    const method = String(value || "").trim().toLowerCase();
    if (!method) return "credit card";

    const aliases = {
      card: "credit card",
      cc: "credit card",
      credit: "credit card",
      "credit card": "credit card",
      cash: "cash",
      check: "check",
      cheque: "check",
      ach: "bank transfer (ach)",
      "bank transfer": "bank transfer (ach)",
      "bank transfer (ach)": "bank transfer (ach)",
      scholarship: "scholarship",
      "gift card": "gift certificate",
      gift: "gift certificate",
      "gift certificate": "gift certificate",
      fundraising: "fundraising funds",
      "fundraising fund": "fundraising funds",
      "fundraising funds": "fundraising funds"
    };

    return aliases[method] || method;
  }

  function getRoleContext() {
    const session = window.Auth && window.Auth.getSession ? window.Auth.getSession() : null;
    const role = (session && session.role) || "owner";
    const allClasses = state.classes;
    const allStudents = state.students;
    const allTransactions = state.transactions;
    const allEvents = state.events;

    if (role === "teacher") {
      const instructorName = String((session && session.instructorName) || "").trim().toLowerCase();
      const classes = allClasses.filter(function (danceClass) {
        return String(danceClass.instructor || "").trim().toLowerCase() === instructorName;
      });
      const classIdSet = new Set(
        classes.map(function (danceClass) {
          return danceClass.id;
        })
      );
      const students = allStudents.filter(function (student) {
        return student.classIds.some(function (classId) {
          return classIdSet.has(classId);
        });
      });
      const studentIdSet = new Set(
        students.map(function (student) {
          return student.id;
        })
      );
      const transactions = allTransactions.filter(function (tx) {
        return studentIdSet.has(tx.studentId);
      });
      const events = scopeEventsByClassIds(allEvents, classIdSet);
      const instructorLabel = (session && session.instructorName) || "your classes";

      return {
        role: role,
        session: session,
        classes: classes,
        students: students,
        transactions: transactions,
        events: events,
        classIdSet: classIdSet,
        studentIdSet: studentIdSet,
        canManageClasses: false,
        dashboardSubtitle: "At-a-glance teaching operations for your roster",
        scheduleSubtitle: "Weekly view for classes taught by " + instructorLabel,
        studentsSubtitle: "Student roster scoped to your classes",
        eventsSubtitle: "Events involving your classes",
        eventsScopeNote: "Showing event details for routines assigned to " + instructorLabel + "."
      };
    }

    if (role === "parent") {
      const parentStudentIds = getParentStudentIds(session);
      const studentIdSet = new Set(parentStudentIds);
      const students = allStudents.filter(function (student) {
        return studentIdSet.has(student.id);
      });
      const classIdSet = new Set();
      students.forEach(function (student) {
        (student.classIds || []).forEach(function (classId) {
          classIdSet.add(classId);
        });
      });
      const classes = allClasses.filter(function (danceClass) {
        return classIdSet.has(danceClass.id);
      });
      const transactions = allTransactions.filter(function (tx) {
        return studentIdSet.has(tx.studentId);
      });
      const events = scopeEventsByClassIds(allEvents, classIdSet);
      const studentNames = students.map(function (student) {
        return student.name;
      });

      return {
        role: role,
        session: session,
        classes: classes,
        students: students,
        transactions: transactions,
        events: events,
        classIdSet: classIdSet,
        studentIdSet: studentIdSet,
        canManageClasses: false,
        dashboardSubtitle: "At-a-glance family studio activity",
        scheduleSubtitle: "Family schedule",
        studentsSubtitle: "Family student records",
        eventsSubtitle: "Recitals and events for your household",
        eventsScopeNote: studentNames.length
          ? "Showing events linked to: " + studentNames.join(", ") + "."
          : "Showing household event details."
      };
    }

    const classIdSet = new Set(
      allClasses.map(function (danceClass) {
        return danceClass.id;
      })
    );
    const studentIdSet = new Set(
      allStudents.map(function (student) {
        return student.id;
      })
    );

    return {
      role: "owner",
      session: session,
      classes: allClasses,
      students: allStudents,
      transactions: allTransactions,
      events: allEvents,
      classIdSet: classIdSet,
      studentIdSet: studentIdSet,
      canManageClasses: true,
      dashboardSubtitle: "At-a-glance studio operations for today",
      scheduleSubtitle: "Weekly view (Monday to Saturday)",
      studentsSubtitle: "Search, filter, and manage student records",
      eventsSubtitle: "Track routines, rehearsals, and ticket/fee progress",
      eventsScopeNote: "Showing studio-wide events and production tracking."
    };
  }

  function scopeEventsByClassIds(events, classIdSet) {
    if (!classIdSet || !classIdSet.size) return [];

    return events
      .map(function (event) {
        const routines = (event.routines || [])
          .map(function (routine, index) {
            return Object.assign({ _sourceIndex: index }, routine);
          })
          .filter(function (routine) {
            return classIdSet.has(routine.classId);
          });

        if (!routines.length) return null;
        return Object.assign({}, event, { routines: routines });
      })
      .filter(Boolean);
  }

  function getPaymentScope(session) {
    const role = (session && session.role) || "owner";
    const allStudents = state.students.slice();
    const allTransactions = state.transactions.slice();

    if (role !== "parent") {
      return {
        role: role,
        students: allStudents,
        transactions: allTransactions,
        subtitle: "Revenue and transaction tracking",
        note: "Showing studio-wide payment activity."
      };
    }

    const parentStudentIds = getParentStudentIds(session);
    const idSet = new Set(parentStudentIds);

    const students = allStudents.filter(function (student) {
      return idSet.has(student.id);
    });
    const transactions = allTransactions.filter(function (tx) {
      return idSet.has(tx.studentId);
    });
    const studentNames = students.map(function (student) {
      return student.name;
    });

    return {
      role: role,
      students: students,
      transactions: transactions,
      subtitle: "Family billing and payment history",
      note: studentNames.length
        ? "Showing payment activity for: " + studentNames.join(", ") + "."
        : "Showing payment activity for your household."
    };
  }

  function getParentStudentIds(session) {
    const ids = [];
    const email = (session && session.email ? session.email : "").toLowerCase();

    function addIds(list) {
      (list || []).forEach(function (id) {
        if (id && ids.indexOf(id) === -1) ids.push(id);
      });
    }

    if (session && session.primaryStudentId) addIds([session.primaryStudentId]);

    try {
      const raw = localStorage.getItem("studioLifeParentPortalStateV1");
      if (raw) {
        const saved = JSON.parse(raw);
        const profiles = Array.isArray(saved.parentProfiles) ? saved.parentProfiles : [];
        const profile = profiles.find(function (item) {
          return String(item.email || "").toLowerCase() === email;
        });
        if (profile && Array.isArray(profile.studentIds)) addIds(profile.studentIds);
      }
    } catch (error) {
      // Ignore prototype storage parsing issues.
    }

    const seedPortal = window.DanceData && window.DanceData.parentPortal;
    const seedProfiles = seedPortal && Array.isArray(seedPortal.parentProfiles) ? seedPortal.parentProfiles : [];
    const seedProfile = seedProfiles.find(function (item) {
      return String(item.email || "").toLowerCase() === email;
    });
    if (seedProfile && Array.isArray(seedProfile.studentIds)) addIds(seedProfile.studentIds);

    return ids;
  }

  function seedRandom(seedText) {
    var hash = 0;
    for (var i = 0; i < seedText.length; i += 1) {
      hash = (hash << 5) - hash + seedText.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(Math.sin(hash) * 10000) % 1;
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
