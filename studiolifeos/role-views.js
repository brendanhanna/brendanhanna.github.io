(function () {
  var PAGE = document.body.dataset.page || "";
  if (!["parent", "teacher", "owner"].includes(PAGE)) return;

  var data = window.DanceData || { classes: [], students: [], transactions: [], events: [] };

  if (PAGE === "parent") initParentView();
  if (PAGE === "teacher") initTeacherView();
  if (PAGE === "owner") initOwnerView();

  function initParentView() {
    var session = window.Auth && window.Auth.getSession ? window.Auth.getSession() : null;
    var studentId = (session && session.primaryStudentId) || "s1";
    var student = getStudentById(studentId) || data.students[0];
    if (!student) return;

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

    var announcements = [
      "Recital costume fittings begin March 10.",
      "Studio closed Monday, May 26 for Memorial Day.",
      "Ticket pre-sale opens April 1 for enrolled families."
    ]
      .map(function (item) {
        return "<li>" + escapeHtml(item) + "</li>";
      })
      .join("");
    setHtml("parentAnnouncements", announcements);
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

    renderTeacherRoster();

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
  }

  function initOwnerView() {
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
    setHtml("ownerCapacityList", capacity);

    var upcomingEvents = data.events
      .slice()
      .sort(function (a, b) {
        return a.date.localeCompare(b.date);
      })
      .map(function (event) {
        return "<div class='util-row'><span>" + escapeHtml(event.name) + "</span><span>" + escapeHtml(formatDate(event.date)) + "</span></div>";
      })
      .join("");
    setHtml("ownerEventsList", upcomingEvents);
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
