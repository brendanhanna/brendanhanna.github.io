(function () {
  var PAGE = document.body.dataset.page || "";
  if (!["parent", "teacher", "owner", "owner-admin"].includes(PAGE)) return;

  var data = loadAppData();

  if (PAGE === "parent") initParentView();
  if (PAGE === "teacher") initTeacherView();
  if (PAGE === "owner") initOwnerView();
  if (PAGE === "owner-admin") initOwnerAdminView();

  function initParentView() {
    var session = window.Auth && window.Auth.getSession ? window.Auth.getSession() : null;
    var sessionEmail = (session && session.email) || "nora.hart@email.com";
    var studentId = (session && session.primaryStudentId) || "s1";
    var student = getStudentById(studentId) || data.students[0];
    if (!student) return;

    var portalState = loadParentPortalState();
    var profile = ensureParentProfile(portalState, sessionEmail, student.id);
    var classes = student.classIds.map(getClassById).filter(Boolean);
    var attendance = buildAttendance(student).slice(0, 18);
    var presentCount = attendance.filter(function (row) {
      return row.status === "present";
    }).length;
    var attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;

    setText("parentStudentName", student.name);
    setText("parentStudentMeta", "Age " + student.age + " | Guardian: " + student.guardianName);
    setText("parentUpcomingCount", String(classes.length));
    setText("parentAttendanceRate", attendanceRate + "%");
    setText("parentBalance", formatCurrency(student.balance));
    setText("parentNextClass", nextClassLabel(classes));

    var scheduleRows = classes
      .slice()
      .sort(function (a, b) {
        return weekdaySort(a.days[0]) - weekdaySort(b.days[0]);
      })
      .map(function (danceClass) {
        return (
          "<tr><td>" +
          escapeHtml(danceClass.name) +
          "</td><td><span class='status-pill neutral'>" +
          escapeHtml(danceClass.style) +
          "</span></td><td>" +
          escapeHtml(danceClass.days.join(", ")) +
          "</td><td>" +
          escapeHtml(to12Hour(danceClass.start) + " - " + to12Hour(danceClass.end)) +
          "</td><td>" +
          escapeHtml(danceClass.instructor) +
          "</td></tr>"
        );
      })
      .join("");
    setHtml("parentScheduleList", scheduleRows || "<tr><td colspan='5'>No enrolled classes.</td></tr>");

    var payments = data.transactions
      .filter(function (tx) {
        return tx.studentId === student.id;
      })
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      })
      .slice(0, 8)
      .map(function (tx) {
        return (
          "<tr><td>" +
          escapeHtml(formatDate(tx.date)) +
          "</td><td>" +
          escapeHtml(titleCase(tx.type)) +
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
    setHtml("parentPaymentList", payments || "<tr><td colspan='4'>No payment activity.</td></tr>");

    var announcements = portalState.bulletinPosts
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      })
      .slice(0, 3)
      .map(function (item) {
        return "<li>" + escapeHtml(item.title + " (" + formatDate(item.date) + ")") + "</li>";
      })
      .join("");
    setHtml("parentAnnouncements", announcements);

    renderEnrollmentCenter();
    renderBillingSettings();
    renderParentEventCenter();
    renderWaiverCenter();
    renderFileCenter();
    renderBulletinBoard();
    applyParentSectionView();

    function renderEnrollmentCenter() {
      var enrolledContainer = document.getElementById("parentEnrolledManageList");
      var availableContainer = document.getElementById("parentAvailableClassList");
      var requestRows = document.getElementById("parentRequestRows");
      if (!enrolledContainer || !availableContainer || !requestRows) return;

      var enrolledHtml = classes
        .slice()
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        })
        .map(function (danceClass) {
          var hasPendingDrop = profile.enrollmentRequests.some(function (request) {
            return request.classId === danceClass.id && request.type === "drop" && request.status === "submitted";
          });
          return (
            "<div class='stack-item'><div class='stack-item-top'><strong>" +
            escapeHtml(danceClass.name) +
            "</strong><button type='button' class='button' data-request-drop='" +
            danceClass.id +
            "'" +
            (hasPendingDrop ? " disabled" : "") +
            ">" +
            (hasPendingDrop ? "Drop Requested" : "Request Drop") +
            "</button></div><div class='stack-item-meta'>" +
            escapeHtml(danceClass.style + " | " + danceClass.days.join(", ") + " | " + to12Hour(danceClass.start)) +
            "</div></div>"
          );
        })
        .join("");
      enrolledContainer.innerHTML = enrolledHtml || "<div class='empty-state'>No enrolled classes found.</div>";

      var availableClasses = data.classes
        .filter(function (danceClass) {
          return student.classIds.indexOf(danceClass.id) === -1 && ageEligibleForClass(student.age, danceClass.ageRange);
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });

      var availableHtml = availableClasses
        .map(function (danceClass) {
          var hasPendingEnroll = profile.enrollmentRequests.some(function (request) {
            return request.classId === danceClass.id && request.type === "enroll" && request.status === "submitted";
          });
          return (
            "<div class='stack-item'><div class='stack-item-top'><strong>" +
            escapeHtml(danceClass.name) +
            "</strong><button type='button' class='button button-primary' data-request-enroll='" +
            danceClass.id +
            "'" +
            (hasPendingEnroll ? " disabled" : "") +
            ">" +
            (hasPendingEnroll ? "Enrollment Requested" : "Request Enrollment") +
            "</button></div><div class='stack-item-meta'>" +
            escapeHtml(
              danceClass.style +
                " | " +
                danceClass.ageRange +
                " | " +
                danceClass.days.join(", ") +
                " | " +
                to12Hour(danceClass.start) +
                "-" +
                to12Hour(danceClass.end)
            ) +
            "</div></div>"
          );
        })
        .join("");
      availableContainer.innerHTML = availableHtml || "<div class='empty-state'>No additional classes match this age group.</div>";

      var requestHtml = profile.enrollmentRequests
        .slice()
        .sort(function (a, b) {
          return b.submittedAt.localeCompare(a.submittedAt);
        })
        .map(function (request) {
          var danceClass = getClassById(request.classId);
          return (
            "<tr><td>" +
            escapeHtml(formatDate(request.submittedAt)) +
            "</td><td>" +
            escapeHtml(danceClass ? danceClass.name : request.classId) +
            "</td><td>" +
            escapeHtml(titleCase(request.type)) +
            "</td><td><span class='status-pill " +
            request.status +
            "'>" +
            escapeHtml(request.status) +
            "</span></td><td>" +
            (request.status === "submitted"
              ? "<button type='button' class='button' data-cancel-request='" + request.id + "'>Cancel</button>"
              : "<span class='muted'>-</span>") +
            "</td></tr>"
          );
        })
        .join("");
      requestRows.innerHTML = requestHtml || "<tr><td colspan='5'>No enrollment requests yet.</td></tr>";
    }

    var enrolledManageList = document.getElementById("parentEnrolledManageList");
    if (enrolledManageList) {
      enrolledManageList.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.getAttribute("data-request-drop")) return;
        createEnrollmentRequest("drop", target.getAttribute("data-request-drop"));
      });
    }

    var availableClassList = document.getElementById("parentAvailableClassList");
    if (availableClassList) {
      availableClassList.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.getAttribute("data-request-enroll")) return;
        createEnrollmentRequest("enroll", target.getAttribute("data-request-enroll"));
      });
    }

    var requestTable = document.getElementById("parentRequestRows");
    if (requestTable) {
      requestTable.addEventListener("click", function (event) {
        var target = event.target;
        var requestId = target && target.getAttribute("data-cancel-request");
        if (!requestId) return;
        profile.enrollmentRequests = profile.enrollmentRequests.filter(function (request) {
          return request.id !== requestId;
        });
        saveParentPortalState(portalState);
        renderEnrollmentCenter();
      });
    }

    function createEnrollmentRequest(type, classId) {
      var exists = profile.enrollmentRequests.some(function (request) {
        return request.classId === classId && request.type === type && request.status === "submitted";
      });
      if (exists) return;

      profile.enrollmentRequests.unshift({
        id: "er" + Date.now() + Math.floor(Math.random() * 1000),
        classId: classId,
        type: type,
        status: "submitted",
        submittedAt: new Date().toISOString().slice(0, 10)
      });

      saveParentPortalState(portalState);
      setText("parentEnrollmentMessage", "Request submitted. Front desk will review and confirm.");
      renderEnrollmentCenter();
    }

    function renderBillingSettings() {
      var brandInput = document.getElementById("parentCardBrand");
      var last4Input = document.getElementById("parentCardLast4");
      var expInput = document.getElementById("parentCardExp");
      var zipInput = document.getElementById("parentCardZip");
      var autopayToggle = document.getElementById("parentAutopayToggle");
      var saveButton = document.getElementById("parentSaveBillingButton");
      var receiptRows = document.getElementById("parentReceiptRows");
      if (!brandInput || !last4Input || !expInput || !zipInput || !autopayToggle || !saveButton || !receiptRows) return;

      brandInput.value = profile.paymentMethod.brand || "";
      last4Input.value = profile.paymentMethod.last4 || "";
      expInput.value = profile.paymentMethod.exp || "";
      zipInput.value = profile.paymentMethod.zip || "";
      autopayToggle.checked = Boolean(profile.autopay);

      saveButton.onclick = function () {
        profile.paymentMethod.brand = brandInput.value.trim() || "Card";
        profile.paymentMethod.last4 = (last4Input.value || "").replace(/\D/g, "").slice(-4);
        profile.paymentMethod.exp = expInput.value.trim() || "01/30";
        profile.paymentMethod.zip = zipInput.value.trim() || "00000";
        profile.autopay = Boolean(autopayToggle.checked);
        saveParentPortalState(portalState);
        setText("parentBillingMessage", "Billing settings saved.");
      };

      var paidTransactions = data.transactions
        .filter(function (tx) {
          return tx.studentId === student.id && tx.status === "paid";
        })
        .sort(function (a, b) {
          return b.date.localeCompare(a.date);
        })
        .slice(0, 8);

      receiptRows.innerHTML = paidTransactions
        .map(function (tx) {
          return (
            "<tr><td>" +
            escapeHtml(formatDate(tx.date)) +
            "</td><td>" +
            escapeHtml(titleCase(tx.type)) +
            "</td><td>" +
            formatCurrency(tx.amount) +
            "</td><td><button type='button' class='button' data-receipt-id='" +
            tx.id +
            "'>Download</button></td></tr>"
          );
        })
        .join("");

      if (!paidTransactions.length) {
        receiptRows.innerHTML = "<tr><td colspan='4'>No paid receipts available yet.</td></tr>";
      }

      receiptRows.onclick = function (event) {
        var target = event.target;
        var receiptId = target && target.getAttribute("data-receipt-id");
        if (!receiptId) return;
        var tx = paidTransactions.find(function (item) {
          return item.id === receiptId;
        });
        if (!tx) return;
        downloadReceipt(student, tx);
      };
    }

    function renderParentEventCenter() {
      var eventList = document.getElementById("parentEventList");
      if (!eventList) return;

      var classIdSet = new Set(student.classIds || []);
      var scopedEvents = (data.events || [])
        .map(function (eventItem) {
          var routines = (eventItem.routines || []).filter(function (routine) {
            return classIdSet.has(routine.classId);
          });
          return {
            event: eventItem,
            routines: routines
          };
        })
        .filter(function (entry) {
          return entry.routines.length > 0;
        })
        .sort(function (a, b) {
          return String(a.event.date || "").localeCompare(String(b.event.date || ""));
        });

      if (!scopedEvents.length) {
        eventList.innerHTML = "<div class='empty-state'>No upcoming events are assigned to your enrolled classes.</div>";
        return;
      }

      eventList.innerHTML = scopedEvents
        .map(function (entry) {
          var routineNames = entry.routines
            .slice(0, 4)
            .map(function (routine) {
              var danceClass = getClassById(routine.classId);
              return danceClass ? danceClass.name : routine.routine;
            })
            .join(", ");

          return (
            "<div class='stack-item'><div class='stack-item-top'><strong>" +
            escapeHtml(entry.event.name) +
            "</strong><span class='status-pill neutral'>" +
            escapeHtml(entry.event.status) +
            "</span></div><div class='stack-item-meta'>" +
            escapeHtml(formatDate(entry.event.date) + " | " + entry.event.venue) +
            "</div><div class='stack-item-meta'>" +
            escapeHtml("Classes performing: " + routineNames) +
            "</div></div>"
          );
        })
        .join("");
    }

    function renderWaiverCenter() {
      var waiverList = document.getElementById("parentWaiverList");
      if (!waiverList) return;

      waiverList.innerHTML = portalState.waiverTemplates
        .map(function (template) {
          var record = profile.waivers.find(function (waiver) {
            return waiver.waiverId === template.id;
          });
          var signed = record && record.status === "signed";
          return (
            "<div class='stack-item'><div class='stack-item-top'><strong>" +
            escapeHtml(template.title) +
            "</strong><span class='status-pill " +
            (signed ? "paid" : "pending") +
            "'>" +
            (signed ? "Signed" : "Pending") +
            "</span></div><div class='stack-item-meta'>" +
            escapeHtml(template.description + " | Version " + template.version) +
            "</div><div class='actions' style='justify-content:flex-start;margin-top:8px'><button type='button' class='button button-primary' data-sign-waiver='" +
            template.id +
            "'" +
            (signed ? " disabled" : "") +
            ">" +
            (signed ? "Signed " + formatDate(record.signedAt) : "Sign Waiver") +
            "</button></div></div>"
          );
        })
        .join("");

      waiverList.onclick = function (event) {
        var target = event.target;
        var waiverId = target && target.getAttribute("data-sign-waiver");
        if (!waiverId) return;
        var existing = profile.waivers.find(function (waiver) {
          return waiver.waiverId === waiverId;
        });
        if (existing) {
          existing.status = "signed";
          existing.signedAt = new Date().toISOString().slice(0, 10);
        } else {
          profile.waivers.push({
            waiverId: waiverId,
            status: "signed",
            signedAt: new Date().toISOString().slice(0, 10)
          });
        }
        saveParentPortalState(portalState);
        renderWaiverCenter();
      };
    }

    function renderFileCenter() {
      var fileList = document.getElementById("parentFileList");
      if (!fileList) return;

      if (!Array.isArray(portalState.files) || !portalState.files.length) {
        fileList.innerHTML = "<div class='empty-state'>No studio documents are published yet.</div>";
        return;
      }

      fileList.innerHTML = portalState.files
        .slice()
        .sort(function (a, b) {
          return b.updated.localeCompare(a.updated);
        })
        .map(function (file) {
          return (
            "<div class='stack-item'><div class='stack-item-top'><strong>" +
            escapeHtml(file.name) +
            "</strong><div class='actions'><a class='button' href='" +
            escapeHtml(file.url) +
            "' target='_blank' rel='noopener noreferrer'>Open</a><a class='button' href='" +
            escapeHtml(file.url) +
            "' download>Download</a></div></div><div class='stack-item-meta'>" +
            escapeHtml(file.category + " | Updated " + formatDate(file.updated) + " | " + file.size) +
            "</div></div>"
          );
        })
        .join("");
    }

    function renderBulletinBoard() {
      var bulletin = document.getElementById("parentBulletinList");
      if (!bulletin) return;

      bulletin.innerHTML = portalState.bulletinPosts
        .slice()
        .sort(function (a, b) {
          return b.date.localeCompare(a.date);
        })
        .map(function (post) {
          return (
            "<article class='bulletin-item'><div class='stack-item-top'><h4>" +
            escapeHtml(post.title) +
            "</h4><span class='muted'>" +
            escapeHtml(formatDate(post.date)) +
            "</span></div><p>" +
            escapeHtml(post.body) +
            "</p></article>"
          );
        })
        .join("");
    }

    function applyParentSectionView() {
      var activeView = getParentView();
      var sections = Array.prototype.slice.call(document.querySelectorAll("[data-parent-view]"));
      sections.forEach(function (section) {
        var views = String(section.getAttribute("data-parent-view") || "")
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        var shouldShow = activeView === "overview" ? views.indexOf("overview") !== -1 : views.indexOf(activeView) !== -1;
        section.style.display = shouldShow ? "" : "none";
      });
    }

    function getParentView() {
      var allowed = [
        "overview",
        "schedule",
        "announcements",
        "payments",
        "enrollment",
        "billing",
        "waivers",
        "documents",
        "events",
        "bulletin"
      ];
      try {
        var params = new URLSearchParams(window.location.search || "");
        var requested = String(params.get("view") || "").toLowerCase();
        return allowed.indexOf(requested) !== -1 ? requested : "overview";
      } catch (error) {
        return "overview";
      }
    }
  }

  function loadAppData() {
    var seed = window.DanceData || { classes: [], students: [], transactions: [], events: [], parentPortal: {} };
    try {
      var raw = localStorage.getItem("danceStudioPrototypeStateV1");
      if (!raw) return seed;
      var saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.classes) || !Array.isArray(saved.students)) return seed;
      return {
        styles: seed.styles || {},
        classes: saved.classes,
        students: saved.students,
        transactions: Array.isArray(saved.transactions) ? saved.transactions : seed.transactions || [],
        events: Array.isArray(saved.events) ? saved.events : seed.events || [],
        parentPortal: seed.parentPortal || {}
      };
    } catch (error) {
      return seed;
    }
  }

  function initTeacherView() {
    var session = window.Auth && window.Auth.getSession ? window.Auth.getSession() : null;
    var instructorName = (session && session.instructorName) || "Marcus Reed";

    setText("teacherName", instructorName);

    var myClasses = data.classes.filter(function (danceClass) {
      return danceClass.instructor === instructorName;
    });

    var todayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
    var today = myClasses
      .filter(function (danceClass) {
        return danceClass.days.includes(todayName);
      })
      .sort(function (a, b) {
        return timeToMinutes(a.start) - timeToMinutes(b.start);
      });

    var todayCards = today
      .map(function (danceClass) {
        return (
          "<div class='today-class-card'><div class='today-class-top'><strong>" +
          escapeHtml(danceClass.name) +
          "</strong><span>" +
          escapeHtml(to12Hour(danceClass.start) + " - " + to12Hour(danceClass.end)) +
          "</span></div><div class='today-class-meta'><span>" +
          escapeHtml(danceClass.style) +
          "</span><span>" +
          danceClass.studentIds.length +
          "/" +
          danceClass.capacity +
          " enrolled</span><span>" +
          escapeHtml(danceClass.room) +
          "</span></div></div>"
        );
      })
      .join("");
    setHtml("teacherTodayClasses", todayCards || "<div class='empty-state'>No classes on today's schedule.</div>");

    setText("teacherTotalClasses", String(myClasses.length));
    setText(
      "teacherTotalStudents",
      String(
        unique(
          myClasses.reduce(function (all, danceClass) {
            return all.concat(danceClass.studentIds);
          }, [])
        ).length
      )
    );

    setText(
      "teacherHoursWeek",
      String(
        myClasses.reduce(function (sum, danceClass) {
          var duration = (timeToMinutes(danceClass.end) - timeToMinutes(danceClass.start)) / 60;
          return sum + duration * danceClass.days.length;
        }, 0)
      )
    );

    var picker = document.getElementById("teacherClassPicker");
    if (picker) {
      picker.innerHTML = myClasses
        .map(function (danceClass) {
          return "<option value='" + danceClass.id + "'>" + escapeHtml(danceClass.name + " (" + danceClass.days.join(",") + ")") + "</option>";
        })
        .join("");
      picker.addEventListener("change", renderTeacherRoster);
    }

    renderTeacherRosterDirectory();
    renderTeacherRoster();
    renderTeacherEventCenter();
    applyTeacherSectionView();

    function renderTeacherRosterDirectory() {
      var rosterBody = document.getElementById("teacherRosterDirectoryRows");
      if (!rosterBody) return;

      var studentMap = {};
      myClasses.forEach(function (danceClass) {
        danceClass.studentIds.forEach(function (studentId) {
          if (!studentMap[studentId]) studentMap[studentId] = [];
          studentMap[studentId].push(danceClass.name);
        });
      });

      var rows = Object.keys(studentMap)
        .map(function (studentId) {
          var student = getStudentById(studentId);
          if (!student) return null;
          return {
            name: student.name,
            html:
              "<tr><td>" +
              escapeHtml(student.name) +
              "</td><td>Age " +
              student.age +
              "</td><td>" +
              escapeHtml(student.guardianName) +
              "</td><td>" +
              escapeHtml(studentMap[studentId].sort().join(", ")) +
              "</td></tr>"
          };
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        })
        .map(function (row) {
          return row.html;
        })
        .join("");

      rosterBody.innerHTML = rows || "<tr><td colspan='4'>No assigned students yet.</td></tr>";
    }

    function renderTeacherRoster() {
      var classId = picker && picker.value;
      var danceClass = getClassById(classId || (myClasses[0] && myClasses[0].id));
      var tableBody = document.getElementById("teacherRosterBody");
      if (!tableBody || !danceClass) {
        if (tableBody) tableBody.innerHTML = "<tr><td colspan='4'>No assigned classes.</td></tr>";
        return;
      }

      tableBody.innerHTML = danceClass.studentIds
        .map(function (studentId) {
          var student = getStudentById(studentId);
          if (!student) return "";
          return (
            "<tr><td>" +
            escapeHtml(student.name) +
            "</td><td>Age " +
            student.age +
            "</td><td>" +
            escapeHtml(student.guardianName) +
            "</td><td><div class='attendance-toggle'><button type='button' class='mini-btn active'>Present</button><button type='button' class='mini-btn'>Absent</button></div></td></tr>"
          );
        })
        .join("");

      Array.prototype.slice.call(tableBody.querySelectorAll(".attendance-toggle")).forEach(function (toggle) {
        var buttons = toggle.querySelectorAll("button");
        buttons[0].addEventListener("click", function () {
          buttons[0].classList.add("active");
          buttons[1].classList.remove("active");
        });
        buttons[1].addEventListener("click", function () {
          buttons[1].classList.add("active");
          buttons[0].classList.remove("active");
        });
      });

      setText("teacherRosterClass", danceClass.name);
    }

    function renderTeacherEventCenter() {
      var eventList = document.getElementById("teacherEventList");
      if (!eventList) return;

      var classIdSet = new Set(
        myClasses.map(function (danceClass) {
          return danceClass.id;
        })
      );

      var scopedEvents = (data.events || [])
        .map(function (eventItem) {
          var routines = (eventItem.routines || []).filter(function (routine) {
            return classIdSet.has(routine.classId);
          });
          return {
            event: eventItem,
            routines: routines
          };
        })
        .filter(function (entry) {
          return entry.routines.length > 0;
        })
        .sort(function (a, b) {
          return String(a.event.date || "").localeCompare(String(b.event.date || ""));
        });

      if (!scopedEvents.length) {
        eventList.innerHTML = "<div class='empty-state'>No upcoming rehearsals linked to your classes.</div>";
        return;
      }

      eventList.innerHTML = scopedEvents
        .map(function (entry) {
          var routineNames = entry.routines
            .slice(0, 4)
            .map(function (routine) {
              return routine.routine;
            })
            .join(", ");

          return (
            "<div class='stack-item'><div class='stack-item-top'><strong>" +
            escapeHtml(entry.event.name) +
            "</strong><span class='status-pill neutral'>" +
            escapeHtml(entry.event.status) +
            "</span></div><div class='stack-item-meta'>" +
            escapeHtml(formatDate(entry.event.date) + " | " + entry.event.venue) +
            "</div><div class='stack-item-meta'>" +
            escapeHtml("Assigned routines: " + routineNames) +
            "</div></div>"
          );
        })
        .join("");
    }

    function applyTeacherSectionView() {
      var activeView = getTeacherView();
      var sections = Array.prototype.slice.call(document.querySelectorAll("[data-teacher-view]"));
      sections.forEach(function (section) {
        var views = String(section.getAttribute("data-teacher-view") || "")
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        var shouldShow = activeView === "overview" ? views.indexOf("overview") !== -1 : views.indexOf(activeView) !== -1;
        section.style.display = shouldShow ? "" : "none";
      });
    }

    function getTeacherView() {
      var allowed = ["overview", "metrics", "classes", "roster", "attendance", "events"];
      try {
        var params = new URLSearchParams(window.location.search || "");
        var requested = String(params.get("view") || "").toLowerCase();
        return allowed.indexOf(requested) !== -1 ? requested : "overview";
      } catch (error) {
        return "overview";
      }
    }
  }

  function initOwnerView() {
    var portalState = loadParentPortalState();
    var initialTeacherCount = Array.isArray(portalState.teachers) ? portalState.teachers.length : 0;
    var ownerScheduleMode = loadOwnerScheduleMode();
    ensureTeacherRecords(portalState);
    if ((portalState.teachers || []).length !== initialTeacherCount) {
      saveParentPortalState(portalState);
    }
    renderOwnerSnapshot();
    initOwnerAdmin(portalState, renderOwnerSnapshot);
    applyOwnerSectionView();

    function renderOwnerSnapshot() {
      var now = new Date();
      var activeStudents = data.students.filter(function (student) {
        return student.classIds.length > 0;
      }).length;

      var monthlyRevenue = data.transactions
        .filter(function (tx) {
          var date = new Date(tx.date + "T12:00:00");
          return tx.status === "paid" && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        })
        .reduce(function (sum, tx) {
          return sum + Number(tx.amount || 0);
        }, 0);

      var outstanding = data.students.reduce(function (sum, student) {
        return sum + Number(student.balance || 0);
      }, 0);

      var weeklySessions = data.classes.reduce(function (sum, danceClass) {
        return sum + danceClass.days.length;
      }, 0);

      setText("ownerRevenue", formatCurrency(monthlyRevenue));
      setText("ownerOutstanding", formatCurrency(outstanding));
      setText("ownerStudents", String(activeStudents));
      setText("ownerClassSessions", String(weeklySessions));

      var overdueRows = data.students
        .filter(function (student) {
          return student.paymentStatus === "overdue" || Number(student.balance || 0) >= 90;
        })
        .sort(function (a, b) {
          return Number(b.balance || 0) - Number(a.balance || 0);
        })
        .slice(0, 8)
        .map(function (student) {
          return (
            "<tr><td>" +
            escapeHtml(student.name) +
            "</td><td>" +
            escapeHtml(student.guardianName) +
            "</td><td>" +
            formatCurrency(student.balance) +
            "</td><td><span class='status-pill " +
            student.paymentStatus +
            "'>" +
            escapeHtml(student.paymentStatus) +
            "</span></td></tr>"
          );
        })
        .join("");
      setHtml("ownerOverdueRows", overdueRows || "<tr><td colspan='4'>No overdue balances.</td></tr>");

      var capacity = data.classes
        .map(function (danceClass) {
          return {
            name: danceClass.name,
            fill: danceClass.capacity ? Math.round((danceClass.studentIds.length / danceClass.capacity) * 100) : 0
          };
        })
        .sort(function (a, b) {
          return b.fill - a.fill;
        })
        .slice(0, 6)
        .map(function (item) {
          return "<div class='util-row'><span>" + escapeHtml(item.name) + "</span><span>" + item.fill + "%</span></div>";
        })
        .join("");
      setHtml("ownerCapacityList", capacity || "<div class='empty-state'>No classes configured.</div>");

      var upcomingEvents = data.events
        .slice()
        .sort(function (a, b) {
          return a.date.localeCompare(b.date);
        })
        .map(function (event) {
          return "<div class='util-row'><span>" + escapeHtml(event.name) + "</span><span>" + escapeHtml(formatDate(event.date)) + "</span></div>";
        })
        .join("");
      setHtml("ownerEventsList", upcomingEvents || "<div class='empty-state'>No upcoming events scheduled.</div>");

      renderOwnerScheduleExplorer();
    }

    function renderOwnerScheduleExplorer() {
      var filter = document.getElementById("ownerTeacherScheduleFilter");
      var filterLabel = document.getElementById("ownerTeacherScheduleFilterLabel");
      var list = document.getElementById("ownerTeacherScheduleList");
      var grid = document.getElementById("ownerRoomScheduleGrid");
      var modeSwitch = document.getElementById("ownerScheduleModeSwitch");
      if (!filter || !filterLabel || !list || !grid || !modeSwitch) return;

      var modeButtons = Array.prototype.slice.call(modeSwitch.querySelectorAll("[data-owner-schedule-mode]"));
      if (!modeSwitch.dataset.bound) {
        modeButtons.forEach(function (button) {
          button.addEventListener("click", function () {
            var nextMode = button.getAttribute("data-owner-schedule-mode");
            if (nextMode !== "teacher" && nextMode !== "room" && nextMode !== "room-teacher") return;
            ownerScheduleMode = nextMode;
            saveOwnerScheduleMode(ownerScheduleMode);
            renderOwnerScheduleExplorer();
          });
        });
        modeSwitch.dataset.bound = "1";
      }

      modeButtons.forEach(function (button) {
        var isActive = button.getAttribute("data-owner-schedule-mode") === ownerScheduleMode;
        button.classList.toggle("active", isActive);
      });

      var isTeacherMode = ownerScheduleMode === "teacher";
      var isRoomTeacherMode = ownerScheduleMode === "room-teacher";
      filter.style.display = isTeacherMode || isRoomTeacherMode ? "" : "none";
      filterLabel.style.display = isTeacherMode || isRoomTeacherMode ? "" : "none";
      list.style.display = isTeacherMode ? "grid" : "none";
      grid.style.display = isTeacherMode ? "none" : "block";
      filterLabel.textContent = isRoomTeacherMode ? "Teacher Filter" : "Teacher";

      var teacherNames = unique(
        data.classes.map(function (danceClass) {
          return String(danceClass.instructor || "").trim() || "Unassigned";
        })
      )
        .slice()
        .sort(function (a, b) {
          return a.localeCompare(b);
        });

      var previousValue = filter.value || "all";
      filter.innerHTML =
        "<option value='all'>All Teachers</option>" +
        teacherNames
          .map(function (name) {
            return "<option value='" + escapeHtml(name) + "'>" + escapeHtml(name) + "</option>";
          })
          .join("");
      if (previousValue === "all" || teacherNames.indexOf(previousValue) !== -1) {
        filter.value = previousValue;
      } else {
        filter.value = "all";
      }

      if (!filter.dataset.bound) {
        filter.addEventListener("change", renderOwnerScheduleExplorer);
        filter.dataset.bound = "1";
      }

      var dayOrder = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
      var dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      if (!isTeacherMode) {
        var roomTeacherFilter = filter.value || "all";
        var roomNames = unique(
          data.classes.map(function (danceClass) {
            return String(danceClass.room || "").trim() || "TBD";
          })
        )
          .slice()
          .sort(function (a, b) {
            return a.localeCompare(b);
          });
        var activeDays = dayLabels.filter(function (day) {
          return data.classes.some(function (danceClass) {
            return (danceClass.days || []).indexOf(day) !== -1;
          });
        });

        if (!roomNames.length || !activeDays.length) {
          grid.innerHTML = "<div class='empty-state'>No classes available to build the room schedule.</div>";
          return;
        }

        var roomHeaders = roomNames
          .map(function (room) {
            return "<th>" + escapeHtml(room) + "</th>";
          })
          .join("");

        var totalVisibleSlots = 0;
        var rows = activeDays
          .map(function (day) {
            var roomCells = roomNames
              .map(function (room) {
                var slots = data.classes
                  .filter(function (danceClass) {
                    var teacher = String(danceClass.instructor || "").trim() || "Unassigned";
                    if (isRoomTeacherMode && roomTeacherFilter !== "all" && teacher !== roomTeacherFilter) return false;
                    return (danceClass.days || []).indexOf(day) !== -1 && (String(danceClass.room || "").trim() || "TBD") === room;
                  })
                  .sort(function (a, b) {
                    return timeToMinutes(a.start) - timeToMinutes(b.start);
                  });
                totalVisibleSlots += slots.length;

                if (!slots.length) {
                  return "<td class='owner-room-cell'><span class='muted'>-</span></td>";
                }

                var slotHtml = slots
                  .map(function (slot) {
                    return (
                      "<div class='owner-room-item'><strong>" +
                      escapeHtml(to12Hour(slot.start) + " - " + to12Hour(slot.end)) +
                      "</strong><span class='owner-room-item-title'>" +
                      escapeHtml(slot.name + " (" + slot.style + ")") +
                      "</span><span>" +
                      escapeHtml(slot.instructor + " | " + slot.studentIds.length + "/" + slot.capacity + " enrolled") +
                      "</span></div>"
                    );
                  })
                  .join("");

                return "<td class='owner-room-cell'>" + slotHtml + "</td>";
              })
              .join("");

            return "<tr><td><strong>" + escapeHtml(day) + "</strong></td>" + roomCells + "</tr>";
          })
          .join("");

        if (totalVisibleSlots === 0) {
          grid.innerHTML = "<div class='empty-state'>No classes match the current room/day teacher filter.</div>";
          return;
        }

        grid.innerHTML =
          "<div class='table-wrap'><table class='owner-room-schedule-table'><thead><tr><th>Day</th>" +
          roomHeaders +
          "</tr></thead><tbody>" +
          rows +
          "</tbody></table></div>";
        return;
      }

      var selectedTeacher = filter.value || "all";
      var teacherGroups = {};

      data.classes.forEach(function (danceClass) {
        var teacher = String(danceClass.instructor || "").trim() || "Unassigned";
        if (selectedTeacher !== "all" && teacher !== selectedTeacher) return;
        if (!teacherGroups[teacher]) teacherGroups[teacher] = [];
        teacherGroups[teacher].push(danceClass);
      });

      var groupNames = Object.keys(teacherGroups).sort(function (a, b) {
        return a.localeCompare(b);
      });

      if (!groupNames.length) {
        list.innerHTML = "<div class='empty-state'>No schedule rows available for that teacher.</div>";
        return;
      }

      list.innerHTML = groupNames
        .map(function (teacher) {
          var classes = teacherGroups[teacher];
          var weeklyHours = classes.reduce(function (sum, danceClass) {
            var sessionHours = (timeToMinutes(danceClass.end) - timeToMinutes(danceClass.start)) / 60;
            return sum + sessionHours * (danceClass.days || []).length;
          }, 0);

          var slots = [];
          classes.forEach(function (danceClass) {
            (danceClass.days || []).forEach(function (day) {
              slots.push({
                day: day,
                start: danceClass.start,
                end: danceClass.end,
                name: danceClass.name,
                room: danceClass.room,
                style: danceClass.style,
                enrolled: (danceClass.studentIds || []).length,
                capacity: danceClass.capacity
              });
            });
          });

          slots.sort(function (a, b) {
            var dayDiff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
            if (dayDiff !== 0) return dayDiff;
            return timeToMinutes(a.start) - timeToMinutes(b.start);
          });

          var slotHtml = slots
            .map(function (slot) {
              return (
                "<div class='util-row'><span>" +
                escapeHtml(slot.day + " " + to12Hour(slot.start) + "-" + to12Hour(slot.end) + " | " + slot.name + " (" + slot.style + ")") +
                "</span><span>" +
                escapeHtml(slot.room + " | " + slot.enrolled + "/" + slot.capacity) +
                "</span></div>"
              );
            })
            .join("");

          return (
            "<div class='stack-item'><div class='stack-item-top'><strong>" +
            escapeHtml(teacher) +
            "</strong><span class='muted'>" +
            escapeHtml(classes.length + " classes | " + weeklyHours.toFixed(1) + " hrs/week") +
            "</span></div><div class='util-list'>" +
            slotHtml +
            "</div></div>"
          );
        })
        .join("");
    }

    function loadOwnerScheduleMode() {
      try {
        var saved = localStorage.getItem("studioLifeOwnerScheduleModeV1");
        if (saved === "room" || saved === "room-teacher") return saved;
        return "teacher";
      } catch (error) {
        return "teacher";
      }
    }

    function saveOwnerScheduleMode(mode) {
      try {
        var normalized = mode === "room" || mode === "room-teacher" ? mode : "teacher";
        localStorage.setItem("studioLifeOwnerScheduleModeV1", normalized);
      } catch (error) {
        // Ignore storage access errors in prototype mode.
      }
    }

    function applyOwnerSectionView() {
      var activeView = getOwnerView();
      var sections = Array.prototype.slice.call(document.querySelectorAll("[data-owner-view]"));
      sections.forEach(function (section) {
        var views = String(section.getAttribute("data-owner-view") || "")
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        var shouldShow = activeView === "overview" ? views.indexOf("overview") !== -1 : views.indexOf(activeView) !== -1;
        section.style.display = shouldShow ? "" : "none";
      });
    }

    function getOwnerView() {
      var allowed = ["overview", "navigation", "snapshot", "schedule", "finance", "operations", "shortcuts", "admin"];
      try {
        var params = new URLSearchParams(window.location.search || "");
        var requested = String(params.get("view") || "").toLowerCase();
        return allowed.indexOf(requested) !== -1 ? requested : "overview";
      } catch (error) {
        return "overview";
      }
    }
  }

  function initOwnerAdminView() {
    var portalState = loadParentPortalState();
    var initialTeacherCount = Array.isArray(portalState.teachers) ? portalState.teachers.length : 0;
    ensureTeacherRecords(portalState);
    if ((portalState.teachers || []).length !== initialTeacherCount) {
      saveParentPortalState(portalState);
    }
    initOwnerAdmin(portalState);
  }

  function initOwnerAdmin(portalState, refreshSnapshot) {
    var tabs = document.getElementById("ownerAdminTabs");
    if (!tabs) return;

    var panels = Array.prototype.slice.call(document.querySelectorAll("[data-admin-panel]"));
    var validTabs = ["teachers", "students", "classes", "events", "payments", "docs"];
    var editState = {
      teacherId: "",
      studentId: "",
      classId: "",
      eventId: "",
      paymentId: "",
      docId: ""
    };

    tabs.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.getAttribute("data-admin-tab")) return;
      activateTab(target.getAttribute("data-admin-tab"));
      setActiveTabRoute(target.getAttribute("data-admin-tab"));
    });

    window.addEventListener("hashchange", function () {
      activateTab(getInitialAdminTab());
    });

    activateTab(getInitialAdminTab());

    var teacherNameInput = document.getElementById("ownerTeacherNameInput");
    var teacherEmailInput = document.getElementById("ownerTeacherEmailInput");
    var teacherPhoneInput = document.getElementById("ownerTeacherPhoneInput");
    var teacherSpecialtiesInput = document.getElementById("ownerTeacherSpecialtiesInput");
    var saveTeacherButton = document.getElementById("ownerSaveTeacherButton");
    var resetTeacherButton = document.getElementById("ownerResetTeacherButton");
    var teacherRows = document.getElementById("ownerTeacherRows");

    var studentNameInput = document.getElementById("ownerStudentNameInput");
    var studentAgeInput = document.getElementById("ownerStudentAgeInput");
    var studentGuardianInput = document.getElementById("ownerStudentGuardianInput");
    var studentPhoneInput = document.getElementById("ownerStudentPhoneInput");
    var studentMembershipInput = document.getElementById("ownerStudentMembershipInput");
    var studentBalanceInput = document.getElementById("ownerStudentBalanceInput");
    var studentPaymentStatusInput = document.getElementById("ownerStudentPaymentStatusInput");
    var studentPackageExpiryInput = document.getElementById("ownerStudentPackageExpiryInput");
    var saveStudentButton = document.getElementById("ownerSaveStudentButton");
    var resetStudentButton = document.getElementById("ownerResetStudentButton");
    var studentRows = document.getElementById("ownerStudentRows");

    var classNameInput = document.getElementById("ownerClassNameInput");
    var classStyleInput = document.getElementById("ownerClassStyleInput");
    var classInstructorInput = document.getElementById("ownerClassInstructorInput");
    var classRoomInput = document.getElementById("ownerClassRoomInput");
    var classDaysInput = document.getElementById("ownerClassDaysInput");
    var classStartInput = document.getElementById("ownerClassStartInput");
    var classEndInput = document.getElementById("ownerClassEndInput");
    var classCapacityInput = document.getElementById("ownerClassCapacityInput");
    var classAgeRangeInput = document.getElementById("ownerClassAgeRangeInput");
    var saveClassButton = document.getElementById("ownerSaveClassButton");
    var resetClassButton = document.getElementById("ownerResetClassButton");
    var classRows = document.getElementById("ownerClassRows");

    var eventNameInput = document.getElementById("ownerEventNameInput");
    var eventDateInput = document.getElementById("ownerEventDateInput");
    var eventVenueInput = document.getElementById("ownerEventVenueInput");
    var eventStatusInput = document.getElementById("ownerEventStatusInput");
    var saveEventButton = document.getElementById("ownerSaveEventButton");
    var resetEventButton = document.getElementById("ownerResetEventButton");
    var eventRows = document.getElementById("ownerEventRows");

    var paymentDateInput = document.getElementById("ownerPaymentDateInput");
    var paymentStudentInput = document.getElementById("ownerPaymentStudentInput");
    var paymentAmountInput = document.getElementById("ownerPaymentAmountInput");
    var paymentTypeInput = document.getElementById("ownerPaymentTypeInput");
    var paymentMethodInput = document.getElementById("ownerPaymentMethodInput");
    var paymentStatusInput = document.getElementById("ownerPaymentStatusInput");
    var savePaymentButton = document.getElementById("ownerSavePaymentButton");
    var resetPaymentButton = document.getElementById("ownerResetPaymentButton");
    var paymentRows = document.getElementById("ownerPaymentRows");

    var docNameInput = document.getElementById("ownerDocNameInput");
    var docCategoryInput = document.getElementById("ownerDocCategoryInput");
    var docSizeInput = document.getElementById("ownerDocSizeInput");
    var docUpdatedInput = document.getElementById("ownerDocUpdatedInput");
    var docUrlInput = document.getElementById("ownerDocUrlInput");
    var saveDocButton = document.getElementById("ownerSaveDocButton");
    var resetDocButton = document.getElementById("ownerResetDocButton");
    var docRows = document.getElementById("ownerDocRows");

    if (saveTeacherButton) saveTeacherButton.onclick = onSaveTeacher;
    if (resetTeacherButton) resetTeacherButton.onclick = resetTeacherForm;
    if (teacherRows) teacherRows.onclick = onTeacherTableClick;

    if (saveStudentButton) saveStudentButton.onclick = onSaveStudent;
    if (resetStudentButton) resetStudentButton.onclick = resetStudentForm;
    if (studentRows) studentRows.onclick = onStudentTableClick;

    if (saveClassButton) saveClassButton.onclick = onSaveClass;
    if (resetClassButton) resetClassButton.onclick = resetClassForm;
    if (classRows) classRows.onclick = onClassTableClick;

    if (saveEventButton) saveEventButton.onclick = onSaveEvent;
    if (resetEventButton) resetEventButton.onclick = resetEventForm;
    if (eventRows) eventRows.onclick = onEventTableClick;

    if (savePaymentButton) savePaymentButton.onclick = onSavePayment;
    if (resetPaymentButton) resetPaymentButton.onclick = resetPaymentForm;
    if (paymentRows) paymentRows.onclick = onPaymentTableClick;

    if (saveDocButton) saveDocButton.onclick = onSaveDocument;
    if (resetDocButton) resetDocButton.onclick = resetDocumentForm;
    if (docRows) docRows.onclick = onDocumentTableClick;

    renderAll();

    function activateTab(tabId) {
      if (validTabs.indexOf(tabId) === -1) tabId = "teachers";
      Array.prototype.slice.call(tabs.querySelectorAll("[data-admin-tab]")).forEach(function (button) {
        button.classList.toggle("active", button.getAttribute("data-admin-tab") === tabId);
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("active", panel.getAttribute("data-admin-panel") === tabId);
      });
    }

    function getInitialAdminTab() {
      try {
        var hashTab = String(window.location.hash || "")
          .replace(/^#/, "")
          .toLowerCase();
        if (validTabs.indexOf(hashTab) !== -1) return hashTab;

        var params = new URLSearchParams(window.location.search || "");
        var queryTab = String(params.get("tab") || "").toLowerCase();
        if (validTabs.indexOf(queryTab) !== -1) return queryTab;
      } catch (error) {
        // Ignore URL parsing errors in prototype mode.
      }
      return "teachers";
    }

    function setActiveTabRoute(tabId) {
      if (validTabs.indexOf(tabId) === -1) return;
      try {
        var url = new URL(window.location.href);
        url.searchParams.set("tab", tabId);
        url.hash = tabId;
        window.history.replaceState(null, "", url.toString());
        window.dispatchEvent(new Event("studio:nav-refresh"));
      } catch (error) {
        // Ignore route updates in prototype mode.
      }
    }

    function renderAll() {
      ensureTeacherRecords(portalState);
      renderTeacherRows();
      renderStudentRows();
      renderClassRows();
      renderEventRows();
      renderPaymentRows();
      renderDocumentRows();
    }

    function renderTeacherRows() {
      if (!teacherRows) return;
      var teachers = (portalState.teachers || []).slice().sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      teacherRows.innerHTML = teachers
        .map(function (teacher) {
          var classesCount = data.classes.filter(function (danceClass) {
            return danceClass.instructor === teacher.name;
          }).length;
          return (
            "<tr><td>" +
            escapeHtml(teacher.name) +
            "</td><td>" +
            escapeHtml(teacher.email || "-") +
            "</td><td>" +
            escapeHtml(teacher.phone || "-") +
            "</td><td>" +
            classesCount +
            "</td><td><button type='button' class='button' data-teacher-edit='" +
            teacher.id +
            "'>Edit</button> <button type='button' class='button' data-teacher-delete='" +
            teacher.id +
            "'>Remove</button></td></tr>"
          );
        })
        .join("");
      if (!teachers.length) teacherRows.innerHTML = "<tr><td colspan='5'>No teachers configured yet.</td></tr>";
    }

    function onSaveTeacher() {
      var name = String(teacherNameInput && teacherNameInput.value || "").trim();
      if (!name) {
        setText("ownerTeacherMessage", "Teacher name is required.");
        return;
      }

      ensureTeacherRecords(portalState);
      if (editState.teacherId) {
        var existing = portalState.teachers.find(function (teacher) {
          return teacher.id === editState.teacherId;
        });
        if (!existing) return;
        var previousName = existing.name;
        existing.name = name;
        existing.email = String(teacherEmailInput && teacherEmailInput.value || "").trim();
        existing.phone = String(teacherPhoneInput && teacherPhoneInput.value || "").trim();
        existing.specialties = String(teacherSpecialtiesInput && teacherSpecialtiesInput.value || "").trim();
        if (previousName !== name) {
          data.classes.forEach(function (danceClass) {
            if (danceClass.instructor === previousName) danceClass.instructor = name;
          });
        }
        setText("ownerTeacherMessage", "Teacher updated.");
      } else {
        portalState.teachers.push({
          id: "tch" + Date.now(),
          name: name,
          email: String(teacherEmailInput && teacherEmailInput.value || "").trim(),
          phone: String(teacherPhoneInput && teacherPhoneInput.value || "").trim(),
          specialties: String(teacherSpecialtiesInput && teacherSpecialtiesInput.value || "").trim()
        });
        setText("ownerTeacherMessage", "Teacher added.");
      }

      saveParentPortalState(portalState);
      saveAppData();
      resetTeacherForm();
      renderTeacherRows();
      renderClassRows();
      if (refreshSnapshot) refreshSnapshot();
    }

    function onTeacherTableClick(event) {
      var target = event.target;
      if (!target) return;
      var editId = target.getAttribute("data-teacher-edit");
      var deleteId = target.getAttribute("data-teacher-delete");

      if (editId) {
        var teacher = (portalState.teachers || []).find(function (item) {
          return item.id === editId;
        });
        if (!teacher) return;
        editState.teacherId = teacher.id;
        if (teacherNameInput) teacherNameInput.value = teacher.name || "";
        if (teacherEmailInput) teacherEmailInput.value = teacher.email || "";
        if (teacherPhoneInput) teacherPhoneInput.value = teacher.phone || "";
        if (teacherSpecialtiesInput) teacherSpecialtiesInput.value = teacher.specialties || "";
        setText("ownerTeacherMessage", "Editing " + teacher.name + ".");
        return;
      }

      if (deleteId) {
        var selected = (portalState.teachers || []).find(function (item) {
          return item.id === deleteId;
        });
        if (!selected) return;
        portalState.teachers = portalState.teachers.filter(function (item) {
          return item.id !== deleteId;
        });
        data.classes.forEach(function (danceClass) {
          if (danceClass.instructor === selected.name) danceClass.instructor = "Unassigned Instructor";
        });
        saveParentPortalState(portalState);
        saveAppData();
        resetTeacherForm();
        renderTeacherRows();
        renderClassRows();
        if (refreshSnapshot) refreshSnapshot();
        setText("ownerTeacherMessage", "Teacher removed and affected classes were set to Unassigned Instructor.");
      }
    }

    function resetTeacherForm() {
      editState.teacherId = "";
      if (teacherNameInput) teacherNameInput.value = "";
      if (teacherEmailInput) teacherEmailInput.value = "";
      if (teacherPhoneInput) teacherPhoneInput.value = "";
      if (teacherSpecialtiesInput) teacherSpecialtiesInput.value = "";
    }

    function renderStudentRows() {
      if (!studentRows) return;
      studentRows.innerHTML = data.students
        .slice()
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        })
        .map(function (student) {
          return (
            "<tr><td>" +
            escapeHtml(student.name) +
            "</td><td>" +
            student.age +
            "</td><td>" +
            escapeHtml(student.guardianName) +
            "</td><td>" +
            escapeHtml(student.phone) +
            "</td><td>" +
            formatCurrency(student.balance) +
            "</td><td><span class='status-pill " +
            student.paymentStatus +
            "'>" +
            escapeHtml(student.paymentStatus) +
            "</span></td><td><button type='button' class='button' data-student-edit='" +
            student.id +
            "'>Edit</button> <button type='button' class='button' data-student-delete='" +
            student.id +
            "'>Remove</button></td></tr>"
          );
        })
        .join("");

      renderPaymentStudentOptions();
      if (!data.students.length) studentRows.innerHTML = "<tr><td colspan='7'>No students configured yet.</td></tr>";
    }

    function onSaveStudent() {
      var name = String(studentNameInput && studentNameInput.value || "").trim();
      var age = Number(studentAgeInput && studentAgeInput.value || 0);
      var guardian = String(studentGuardianInput && studentGuardianInput.value || "").trim();
      var phone = String(studentPhoneInput && studentPhoneInput.value || "").trim();
      var membership = String(studentMembershipInput && studentMembershipInput.value || "").trim() || "Monthly";
      var balance = Number(studentBalanceInput && studentBalanceInput.value || 0);
      var status = String(studentPaymentStatusInput && studentPaymentStatusInput.value || "paid");
      var packageExpires = String(studentPackageExpiryInput && studentPackageExpiryInput.value || "").trim() || addDays(new Date(), 45).toISOString().slice(0, 10);

      if (!name || !age || !guardian || !phone) {
        setText("ownerStudentMessage", "Name, age, guardian, and phone are required.");
        return;
      }

      if (editState.studentId) {
        var existing = getStudentById(editState.studentId);
        if (!existing) return;
        existing.name = name;
        existing.age = age;
        existing.guardianName = guardian;
        existing.phone = phone;
        existing.membershipType = membership;
        existing.balance = Math.max(0, Math.round(balance));
        existing.paymentStatus = status;
        existing.packageExpires = packageExpires;
        existing.emergencyContact = existing.emergencyContact || { name: guardian, relation: "Guardian", phone: phone };
        setText("ownerStudentMessage", "Student updated.");
      } else {
        data.students.push({
          id: "s" + Date.now(),
          name: name,
          age: age,
          guardianName: guardian,
          phone: phone,
          emergencyContact: { name: guardian, relation: "Guardian", phone: phone },
          classIds: [],
          membershipType: membership,
          balance: Math.max(0, Math.round(balance)),
          paymentStatus: status,
          packageExpires: packageExpires,
          notes: ""
        });
        setText("ownerStudentMessage", "Student added.");
      }

      saveAppData();
      resetStudentForm();
      renderStudentRows();
      renderPaymentRows();
      renderClassRows();
      if (refreshSnapshot) refreshSnapshot();
    }

    function onStudentTableClick(event) {
      var target = event.target;
      if (!target) return;
      var editId = target.getAttribute("data-student-edit");
      var deleteId = target.getAttribute("data-student-delete");

      if (editId) {
        var student = getStudentById(editId);
        if (!student) return;
        editState.studentId = student.id;
        if (studentNameInput) studentNameInput.value = student.name || "";
        if (studentAgeInput) studentAgeInput.value = String(student.age || "");
        if (studentGuardianInput) studentGuardianInput.value = student.guardianName || "";
        if (studentPhoneInput) studentPhoneInput.value = student.phone || "";
        if (studentMembershipInput) studentMembershipInput.value = student.membershipType || "";
        if (studentBalanceInput) studentBalanceInput.value = String(student.balance || 0);
        if (studentPaymentStatusInput) studentPaymentStatusInput.value = student.paymentStatus || "paid";
        if (studentPackageExpiryInput) studentPackageExpiryInput.value = student.packageExpires || "";
        setText("ownerStudentMessage", "Editing " + student.name + ".");
        return;
      }

      if (deleteId) {
        data.students = data.students.filter(function (student) {
          return student.id !== deleteId;
        });
        data.classes.forEach(function (danceClass) {
          danceClass.studentIds = (danceClass.studentIds || []).filter(function (studentId) {
            return studentId !== deleteId;
          });
        });
        data.transactions = data.transactions.filter(function (tx) {
          return tx.studentId !== deleteId;
        });
        portalState.parentProfiles.forEach(function (profile) {
          profile.studentIds = (profile.studentIds || []).filter(function (studentId) {
            return studentId !== deleteId;
          });
        });
        saveParentPortalState(portalState);
        saveAppData();
        resetStudentForm();
        renderStudentRows();
        renderPaymentRows();
        renderClassRows();
        if (refreshSnapshot) refreshSnapshot();
        setText("ownerStudentMessage", "Student and related records removed.");
      }
    }

    function resetStudentForm() {
      editState.studentId = "";
      if (studentNameInput) studentNameInput.value = "";
      if (studentAgeInput) studentAgeInput.value = "";
      if (studentGuardianInput) studentGuardianInput.value = "";
      if (studentPhoneInput) studentPhoneInput.value = "";
      if (studentMembershipInput) studentMembershipInput.value = "";
      if (studentBalanceInput) studentBalanceInput.value = "0";
      if (studentPaymentStatusInput) studentPaymentStatusInput.value = "paid";
      if (studentPackageExpiryInput) studentPackageExpiryInput.value = addDays(new Date(), 45).toISOString().slice(0, 10);
    }

    function renderClassRows() {
      if (classStyleInput && classStyleInput.options.length < 2) {
        Object.keys(data.styles || {})
          .sort()
          .forEach(function (style) {
            var option = document.createElement("option");
            option.value = style;
            option.textContent = style;
            classStyleInput.appendChild(option);
          });
      }

      if (!classRows) return;
      classRows.innerHTML = data.classes
        .slice()
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        })
        .map(function (danceClass) {
          return (
            "<tr><td>" +
            escapeHtml(danceClass.name) +
            "</td><td>" +
            escapeHtml(danceClass.style) +
            "</td><td>" +
            escapeHtml(danceClass.instructor) +
            "</td><td>" +
            escapeHtml((danceClass.days || []).join(", ")) +
            "</td><td>" +
            escapeHtml(to12Hour(danceClass.start) + " - " + to12Hour(danceClass.end)) +
            "</td><td>" +
            escapeHtml(danceClass.room) +
            "</td><td>" +
            (danceClass.studentIds || []).length +
            "/" +
            danceClass.capacity +
            "</td><td><button type='button' class='button' data-class-edit='" +
            danceClass.id +
            "'>Edit</button> <button type='button' class='button' data-class-delete='" +
            danceClass.id +
            "'>Remove</button></td></tr>"
          );
        })
        .join("");

      if (!data.classes.length) classRows.innerHTML = "<tr><td colspan='8'>No classes configured yet.</td></tr>";
    }

    function onSaveClass() {
      var name = String(classNameInput && classNameInput.value || "").trim();
      var style = String(classStyleInput && classStyleInput.value || "").trim();
      var instructor = String(classInstructorInput && classInstructorInput.value || "").trim();
      var room = String(classRoomInput && classRoomInput.value || "").trim();
      var days = normalizeClassDays(String(classDaysInput && classDaysInput.value || ""));
      var start = String(classStartInput && classStartInput.value || "").trim();
      var end = String(classEndInput && classEndInput.value || "").trim();
      var capacity = Number(classCapacityInput && classCapacityInput.value || 0);
      var ageRange = String(classAgeRangeInput && classAgeRangeInput.value || "").trim() || "All Ages";

      if (!name || !style || !instructor || !room || !days.length || !start || !end || !capacity) {
        setText("ownerClassMessage", "All class fields are required, including valid day abbreviations.");
        return;
      }
      if (timeToMinutes(start) >= timeToMinutes(end)) {
        setText("ownerClassMessage", "End time must be after start time.");
        return;
      }

      if (editState.classId) {
        var existing = getClassById(editState.classId);
        if (!existing) return;
        existing.name = name;
        existing.style = style;
        existing.instructor = instructor;
        existing.room = room;
        existing.days = days;
        existing.start = start;
        existing.end = end;
        existing.capacity = capacity;
        existing.ageRange = ageRange;
        setText("ownerClassMessage", "Class updated.");
      } else {
        data.classes.push({
          id: "c" + Date.now(),
          name: name,
          style: style,
          instructor: instructor,
          room: room,
          days: days,
          start: start,
          end: end,
          capacity: capacity,
          ageRange: ageRange,
          studentIds: []
        });
        setText("ownerClassMessage", "Class added.");
      }

      ensureTeacherRecords(portalState);
      saveParentPortalState(portalState);
      saveAppData();
      resetClassForm();
      renderTeacherRows();
      renderClassRows();
      if (refreshSnapshot) refreshSnapshot();
    }

    function onClassTableClick(event) {
      var target = event.target;
      if (!target) return;
      var editId = target.getAttribute("data-class-edit");
      var deleteId = target.getAttribute("data-class-delete");

      if (editId) {
        var danceClass = getClassById(editId);
        if (!danceClass) return;
        editState.classId = danceClass.id;
        if (classNameInput) classNameInput.value = danceClass.name || "";
        if (classStyleInput) classStyleInput.value = danceClass.style || "";
        if (classInstructorInput) classInstructorInput.value = danceClass.instructor || "";
        if (classRoomInput) classRoomInput.value = danceClass.room || "";
        if (classDaysInput) classDaysInput.value = (danceClass.days || []).join(",");
        if (classStartInput) classStartInput.value = danceClass.start || "";
        if (classEndInput) classEndInput.value = danceClass.end || "";
        if (classCapacityInput) classCapacityInput.value = String(danceClass.capacity || "");
        if (classAgeRangeInput) classAgeRangeInput.value = danceClass.ageRange || "";
        setText("ownerClassMessage", "Editing " + danceClass.name + ".");
        return;
      }

      if (deleteId) {
        data.classes = data.classes.filter(function (danceClass) {
          return danceClass.id !== deleteId;
        });
        data.students.forEach(function (student) {
          student.classIds = (student.classIds || []).filter(function (classId) {
            return classId !== deleteId;
          });
        });
        portalState.parentProfiles.forEach(function (profile) {
          profile.enrollmentRequests = (profile.enrollmentRequests || []).filter(function (request) {
            return request.classId !== deleteId;
          });
        });
        saveParentPortalState(portalState);
        saveAppData();
        resetClassForm();
        renderClassRows();
        renderStudentRows();
        if (refreshSnapshot) refreshSnapshot();
        setText("ownerClassMessage", "Class removed.");
      }
    }

    function resetClassForm() {
      editState.classId = "";
      if (classNameInput) classNameInput.value = "";
      if (classStyleInput) classStyleInput.value = "";
      if (classInstructorInput) classInstructorInput.value = "";
      if (classRoomInput) classRoomInput.value = "";
      if (classDaysInput) classDaysInput.value = "";
      if (classStartInput) classStartInput.value = "";
      if (classEndInput) classEndInput.value = "";
      if (classCapacityInput) classCapacityInput.value = "12";
      if (classAgeRangeInput) classAgeRangeInput.value = "";
    }

    function renderEventRows() {
      if (!eventRows) return;
      eventRows.innerHTML = data.events
        .slice()
        .sort(function (a, b) {
          return a.date.localeCompare(b.date);
        })
        .map(function (eventItem) {
          return (
            "<tr><td>" +
            escapeHtml(eventItem.name) +
            "</td><td>" +
            escapeHtml(formatDate(eventItem.date)) +
            "</td><td>" +
            escapeHtml(eventItem.venue) +
            "</td><td>" +
            escapeHtml(eventItem.status) +
            "</td><td>" +
            (eventItem.routines || []).length +
            "</td><td><button type='button' class='button' data-event-edit='" +
            eventItem.id +
            "'>Edit</button> <button type='button' class='button' data-event-delete='" +
            eventItem.id +
            "'>Remove</button></td></tr>"
          );
        })
        .join("");
      if (!data.events.length) eventRows.innerHTML = "<tr><td colspan='6'>No events configured yet.</td></tr>";
    }

    function onSaveEvent() {
      var name = String(eventNameInput && eventNameInput.value || "").trim();
      var date = String(eventDateInput && eventDateInput.value || "").trim();
      var venue = String(eventVenueInput && eventVenueInput.value || "").trim();
      var status = String(eventStatusInput && eventStatusInput.value || "").trim() || "Planning";
      if (!name || !date || !venue) {
        setText("ownerEventMessage", "Event name, date, and venue are required.");
        return;
      }

      if (editState.eventId) {
        var existing = data.events.find(function (eventItem) {
          return eventItem.id === editState.eventId;
        });
        if (!existing) return;
        existing.name = name;
        existing.date = date;
        existing.venue = venue;
        existing.status = status;
        setText("ownerEventMessage", "Event updated.");
      } else {
        data.events.push({
          id: "e" + Date.now(),
          name: name,
          date: date,
          venue: venue,
          status: status,
          routines: [],
          rehearsals: [],
          ticketing: { sold: 0, goal: 0, price: 0 },
          fees: { expected: 0, collected: 0 }
        });
        setText("ownerEventMessage", "Event added.");
      }

      saveAppData();
      resetEventForm();
      renderEventRows();
      if (refreshSnapshot) refreshSnapshot();
    }

    function onEventTableClick(event) {
      var target = event.target;
      if (!target) return;
      var editId = target.getAttribute("data-event-edit");
      var deleteId = target.getAttribute("data-event-delete");

      if (editId) {
        var eventItem = data.events.find(function (item) {
          return item.id === editId;
        });
        if (!eventItem) return;
        editState.eventId = eventItem.id;
        if (eventNameInput) eventNameInput.value = eventItem.name || "";
        if (eventDateInput) eventDateInput.value = eventItem.date || "";
        if (eventVenueInput) eventVenueInput.value = eventItem.venue || "";
        if (eventStatusInput) eventStatusInput.value = eventItem.status || "";
        setText("ownerEventMessage", "Editing " + eventItem.name + ".");
        return;
      }

      if (deleteId) {
        data.events = data.events.filter(function (item) {
          return item.id !== deleteId;
        });
        saveAppData();
        resetEventForm();
        renderEventRows();
        if (refreshSnapshot) refreshSnapshot();
        setText("ownerEventMessage", "Event removed.");
      }
    }

    function resetEventForm() {
      editState.eventId = "";
      if (eventNameInput) eventNameInput.value = "";
      if (eventDateInput) eventDateInput.value = "";
      if (eventVenueInput) eventVenueInput.value = "";
      if (eventStatusInput) eventStatusInput.value = "";
    }

    function renderPaymentStudentOptions() {
      if (!paymentStudentInput) return;
      var selected = paymentStudentInput.value;
      paymentStudentInput.innerHTML = "<option value=''>Student</option>" +
        data.students
          .slice()
          .sort(function (a, b) {
            return a.name.localeCompare(b.name);
          })
          .map(function (student) {
            return "<option value='" + student.id + "'>" + escapeHtml(student.name) + "</option>";
          })
          .join("");
      if (selected) paymentStudentInput.value = selected;
    }

    function renderPaymentRows() {
      if (!paymentRows) return;
      paymentRows.innerHTML = data.transactions
        .slice()
        .sort(function (a, b) {
          return b.date.localeCompare(a.date);
        })
        .slice(0, 40)
        .map(function (tx) {
          var student = getStudentById(tx.studentId);
          return (
            "<tr><td>" +
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
            "</span></td><td><button type='button' class='button' data-payment-edit='" +
            tx.id +
            "'>Edit</button> <button type='button' class='button' data-payment-delete='" +
            tx.id +
            "'>Remove</button></td></tr>"
          );
        })
        .join("");
      if (!data.transactions.length) paymentRows.innerHTML = "<tr><td colspan='7'>No transactions recorded yet.</td></tr>";
    }

    function onSavePayment() {
      var date = String(paymentDateInput && paymentDateInput.value || "").trim();
      var studentId = String(paymentStudentInput && paymentStudentInput.value || "").trim();
      var amount = Number(paymentAmountInput && paymentAmountInput.value || 0);
      var type = String(paymentTypeInput && paymentTypeInput.value || "").trim().toLowerCase();
      var method = String(paymentMethodInput && paymentMethodInput.value || "").trim().toLowerCase();
      var status = String(paymentStatusInput && paymentStatusInput.value || "paid");

      if (!date || !studentId || !amount || !type || !method) {
        setText("ownerPaymentMessage", "Date, student, amount, type, and method are required.");
        return;
      }

      if (editState.paymentId) {
        var existing = data.transactions.find(function (tx) {
          return tx.id === editState.paymentId;
        });
        if (!existing) return;
        existing.date = date;
        existing.studentId = studentId;
        existing.amount = Math.max(0, Math.round(amount));
        existing.type = type;
        existing.method = method;
        existing.status = status;
        setText("ownerPaymentMessage", "Transaction updated.");
      } else {
        data.transactions.push({
          id: "t" + Date.now(),
          date: date,
          studentId: studentId,
          amount: Math.max(0, Math.round(amount)),
          type: type,
          status: status,
          method: method
        });
        setText("ownerPaymentMessage", "Transaction added.");
      }

      refreshStudentFinancialSnapshots();
      saveAppData();
      resetPaymentForm();
      renderPaymentRows();
      renderStudentRows();
      if (refreshSnapshot) refreshSnapshot();
    }

    function onPaymentTableClick(event) {
      var target = event.target;
      if (!target) return;
      var editId = target.getAttribute("data-payment-edit");
      var deleteId = target.getAttribute("data-payment-delete");

      if (editId) {
        var tx = data.transactions.find(function (item) {
          return item.id === editId;
        });
        if (!tx) return;
        editState.paymentId = tx.id;
        if (paymentDateInput) paymentDateInput.value = tx.date || "";
        if (paymentStudentInput) paymentStudentInput.value = tx.studentId || "";
        if (paymentAmountInput) paymentAmountInput.value = String(tx.amount || 0);
        if (paymentTypeInput) paymentTypeInput.value = tx.type || "";
        if (paymentMethodInput) paymentMethodInput.value = tx.method || "";
        if (paymentStatusInput) paymentStatusInput.value = tx.status || "paid";
        setText("ownerPaymentMessage", "Editing transaction " + tx.id + ".");
        return;
      }

      if (deleteId) {
        data.transactions = data.transactions.filter(function (tx) {
          return tx.id !== deleteId;
        });
        refreshStudentFinancialSnapshots();
        saveAppData();
        resetPaymentForm();
        renderPaymentRows();
        renderStudentRows();
        if (refreshSnapshot) refreshSnapshot();
        setText("ownerPaymentMessage", "Transaction removed.");
      }
    }

    function resetPaymentForm() {
      editState.paymentId = "";
      if (paymentDateInput) paymentDateInput.value = new Date().toISOString().slice(0, 10);
      if (paymentStudentInput) paymentStudentInput.value = "";
      if (paymentAmountInput) paymentAmountInput.value = "";
      if (paymentTypeInput) paymentTypeInput.value = "";
      if (paymentMethodInput) paymentMethodInput.value = "";
      if (paymentStatusInput) paymentStatusInput.value = "paid";
    }

    function renderDocumentRows() {
      if (!docRows) return;
      docRows.innerHTML = (portalState.files || [])
        .slice()
        .sort(function (a, b) {
          return String(b.updated || "").localeCompare(String(a.updated || ""));
        })
        .map(function (file) {
          return (
            "<tr><td>" +
            escapeHtml(file.name) +
            "</td><td>" +
            escapeHtml(file.category || "-") +
            "</td><td>" +
            escapeHtml(file.updated ? formatDate(file.updated) : "-") +
            "</td><td>" +
            escapeHtml(file.size || "-") +
            "</td><td><a class='button' href='" +
            escapeHtml(file.url || "#") +
            "' target='_blank' rel='noopener noreferrer'>Open</a> <button type='button' class='button' data-doc-edit='" +
            file.id +
            "'>Edit</button> <button type='button' class='button' data-doc-delete='" +
            file.id +
            "'>Remove</button></td></tr>"
          );
        })
        .join("");

      if (!(portalState.files || []).length) {
        docRows.innerHTML = "<tr><td colspan='5'>No parent-facing documents published yet.</td></tr>";
      }
    }

    function onSaveDocument() {
      var name = String(docNameInput && docNameInput.value || "").trim();
      var category = String(docCategoryInput && docCategoryInput.value || "").trim() || "General";
      var size = String(docSizeInput && docSizeInput.value || "").trim() || "-";
      var updated = String(docUpdatedInput && docUpdatedInput.value || "").trim() || new Date().toISOString().slice(0, 10);
      var url = String(docUrlInput && docUrlInput.value || "").trim();

      if (!name || !url) {
        setText("ownerDocMessage", "Document name and URL are required.");
        return;
      }

      portalState.files = Array.isArray(portalState.files) ? portalState.files : [];
      if (editState.docId) {
        var existing = portalState.files.find(function (file) {
          return file.id === editState.docId;
        });
        if (!existing) return;
        existing.name = name;
        existing.category = category;
        existing.size = size;
        existing.updated = updated;
        existing.url = url;
        setText("ownerDocMessage", "Document updated.");
      } else {
        portalState.files.push({
          id: "f" + Date.now(),
          name: name,
          category: category,
          size: size,
          updated: updated,
          url: url
        });
        setText("ownerDocMessage", "Document added.");
      }

      saveParentPortalState(portalState);
      resetDocumentForm();
      renderDocumentRows();
    }

    function onDocumentTableClick(event) {
      var target = event.target;
      if (!target) return;
      var editId = target.getAttribute("data-doc-edit");
      var deleteId = target.getAttribute("data-doc-delete");

      if (editId) {
        var file = (portalState.files || []).find(function (item) {
          return item.id === editId;
        });
        if (!file) return;
        editState.docId = file.id;
        if (docNameInput) docNameInput.value = file.name || "";
        if (docCategoryInput) docCategoryInput.value = file.category || "";
        if (docSizeInput) docSizeInput.value = file.size || "";
        if (docUpdatedInput) docUpdatedInput.value = file.updated || "";
        if (docUrlInput) docUrlInput.value = file.url || "";
        setText("ownerDocMessage", "Editing " + file.name + ".");
        return;
      }

      if (deleteId) {
        portalState.files = (portalState.files || []).filter(function (item) {
          return item.id !== deleteId;
        });
        saveParentPortalState(portalState);
        resetDocumentForm();
        renderDocumentRows();
        setText("ownerDocMessage", "Document removed.");
      }
    }

    function resetDocumentForm() {
      editState.docId = "";
      if (docNameInput) docNameInput.value = "";
      if (docCategoryInput) docCategoryInput.value = "";
      if (docSizeInput) docSizeInput.value = "";
      if (docUpdatedInput) docUpdatedInput.value = new Date().toISOString().slice(0, 10);
      if (docUrlInput) docUrlInput.value = "";
    }

    function normalizeClassDays(value) {
      var map = {
        mon: "Mon",
        monday: "Mon",
        tue: "Tue",
        tues: "Tue",
        tuesday: "Tue",
        wed: "Wed",
        wednesday: "Wed",
        thu: "Thu",
        thur: "Thu",
        thurs: "Thu",
        thursday: "Thu",
        fri: "Fri",
        friday: "Fri",
        sat: "Sat",
        saturday: "Sat",
        sun: "Sun",
        sunday: "Sun"
      };
      return unique(
        String(value || "")
          .split(/[,\s/]+/)
          .map(function (token) {
            return map[String(token || "").toLowerCase().trim()] || "";
          })
          .filter(Boolean)
      );
    }
  }

  function loadParentPortalState() {
    var key = "studioLifeParentPortalStateV1";
    var seed = clone(data.parentPortal || { bulletinPosts: [], files: [], waiverTemplates: [], parentProfiles: [], teachers: [] });
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return seed;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return seed;
      return {
        bulletinPosts: Array.isArray(saved.bulletinPosts) ? saved.bulletinPosts : seed.bulletinPosts,
        files: Array.isArray(saved.files) ? saved.files : seed.files,
        waiverTemplates: Array.isArray(saved.waiverTemplates) ? saved.waiverTemplates : seed.waiverTemplates,
        parentProfiles: Array.isArray(saved.parentProfiles) ? saved.parentProfiles : seed.parentProfiles,
        teachers: Array.isArray(saved.teachers) ? saved.teachers : seed.teachers || []
      };
    } catch (error) {
      return seed;
    }
  }

  function saveParentPortalState(state) {
    try {
      localStorage.setItem("studioLifeParentPortalStateV1", JSON.stringify(state));
    } catch (error) {
      // Ignore storage issues in prototype mode.
    }
  }

  function saveAppData() {
    try {
      localStorage.setItem(
        "danceStudioPrototypeStateV1",
        JSON.stringify({
          classes: data.classes,
          students: data.students,
          transactions: data.transactions,
          events: data.events
        })
      );
    } catch (error) {
      // Ignore storage issues in prototype mode.
    }
  }

  function ensureTeacherRecords(state) {
    state.teachers = Array.isArray(state.teachers) ? state.teachers : [];
    var existingNames = {};
    state.teachers.forEach(function (teacher) {
      existingNames[String(teacher.name || "").toLowerCase()] = true;
    });

    data.classes.forEach(function (danceClass) {
      var name = String(danceClass.instructor || "").trim();
      if (!name) return;
      var key = name.toLowerCase();
      if (existingNames[key]) return;
      state.teachers.push({
        id: "tch-seed-" + key.replace(/[^a-z0-9]/g, "-"),
        name: name,
        email: "",
        phone: "",
        specialties: ""
      });
      existingNames[key] = true;
    });
  }

  function refreshStudentFinancialSnapshots() {
    data.students.forEach(function (student) {
      var related = data.transactions.filter(function (tx) {
        return tx.studentId === student.id;
      });
      var overdue = related.some(function (tx) {
        return tx.status === "overdue";
      });
      var pending = related.some(function (tx) {
        return tx.status === "pending";
      });
      var balance = related
        .filter(function (tx) {
          return tx.status !== "paid";
        })
        .reduce(function (sum, tx) {
          return sum + Number(tx.amount || 0);
        }, 0);

      student.balance = Math.max(0, Math.round(balance));
      student.paymentStatus = overdue ? "overdue" : pending ? "pending" : "paid";
    });
  }

  function ensureParentProfile(state, email, studentId) {
    var profile = state.parentProfiles.find(function (item) {
      return String(item.email || "").toLowerCase() === String(email || "").toLowerCase();
    });
    if (!profile) {
      profile = {
        email: email,
        studentIds: [studentId],
        autopay: false,
        paymentMethod: { brand: "Visa", last4: "4242", exp: "09/28", zip: "78701" },
        enrollmentRequests: [],
        waivers: []
      };
      state.parentProfiles.push(profile);
      saveParentPortalState(state);
    }

    profile.studentIds = Array.isArray(profile.studentIds) ? profile.studentIds : [];
    profile.enrollmentRequests = Array.isArray(profile.enrollmentRequests) ? profile.enrollmentRequests : [];
    profile.waivers = Array.isArray(profile.waivers) ? profile.waivers : [];
    profile.paymentMethod = profile.paymentMethod || { brand: "Visa", last4: "4242", exp: "09/28", zip: "78701" };
    if (profile.studentIds.indexOf(studentId) === -1) profile.studentIds.push(studentId);

    return profile;
  }

  function ageEligibleForClass(age, ageRange) {
    var text = String(ageRange || "").toLowerCase();
    if (!text) return true;

    var between = text.match(/(\d+)\s*-\s*(\d+)/);
    if (between) {
      return age >= Number(between[1]) && age <= Number(between[2]);
    }

    var plus = text.match(/(\d+)\s*\+/);
    if (plus) {
      return age >= Number(plus[1]);
    }

    return true;
  }

  function downloadReceipt(student, tx) {
    var content = [
      "Studio Life OS Receipt",
      "Receipt ID: " + tx.id,
      "Date: " + formatDate(tx.date),
      "Student: " + student.name,
      "Type: " + titleCase(tx.type),
      "Amount: " + formatCurrency(tx.amount),
      "Status: " + titleCase(tx.status),
      "Method: " + titleCase(normalizePaymentMethod(tx.method))
    ].join("\n");

    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "receipt-" + tx.id + ".txt";
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 0);
  }

  function getClassById(id) {
    return data.classes.find(function (danceClass) {
      return danceClass.id === id;
    });
  }

  function getStudentById(id) {
    return data.students.find(function (student) {
      return student.id === id;
    });
  }

  function buildAttendance(student) {
    var rows = [];
    var now = new Date();

    student.classIds.forEach(function (classId) {
      var danceClass = getClassById(classId);
      if (!danceClass) return;

      for (var offset = 1; offset <= 35; offset += 1) {
        var date = addDays(now, -offset);
        var day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
        if (!danceClass.days.includes(day)) continue;

        rows.push({
          date: date.toISOString().slice(0, 10),
          status: seeded(student.id + classId + date.toISOString()) > 0.2 ? "present" : "absent"
        });

        if (rows.length > 22) break;
      }
    });

    return rows.sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
  }

  function nextClassLabel(classes) {
    var now = new Date();
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    var options = [];
    classes.forEach(function (danceClass) {
      danceClass.days.forEach(function (day) {
        var delta = (weekdaySort(day) - now.getDay() + 7) % 7;
        options.push({
          label: danceClass.name + " - " + day + " " + to12Hour(danceClass.start),
          delta: delta,
          start: danceClass.start
        });
      });
    });

    options.sort(function (a, b) {
      if (a.delta !== b.delta) return a.delta - b.delta;
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });

    return options[0] ? options[0].label : "No upcoming classes";
  }

  function weekdaySort(day) {
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[day] || 0;
  }

  function unique(items) {
    return Array.from(new Set(items));
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setHtml(id, value) {
    var node = document.getElementById(id);
    if (node) node.innerHTML = value;
  }

  function formatDate(dateString) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(dateString + "T12:00:00"));
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
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
    var method = String(value || "").trim().toLowerCase();
    if (!method) return "credit card";

    var aliases = {
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

  function timeToMinutes(value) {
    var parts = String(value || "00:00").split(":");
    return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
  }

  function to12Hour(value) {
    var minutes = timeToMinutes(value);
    var hour24 = Math.floor(minutes / 60);
    var mins = minutes % 60;
    var hour = ((hour24 + 11) % 12) + 1;
    var suffix = hour24 >= 12 ? "PM" : "AM";
    return hour + ":" + String(mins).padStart(2, "0") + " " + suffix;
  }

  function addDays(date, days) {
    var copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function seeded(text) {
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
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
