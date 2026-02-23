(function () {
  var form = document.getElementById("feedbackForm");
  var copyBtn = document.getElementById("copyFeedbackBtn");
  var payloadArea = document.getElementById("feedbackPayload");
  var status = document.getElementById("feedbackStatus");

  if (!form || !copyBtn || !payloadArea || !status) return;

  var pageParams = new URLSearchParams(window.location.search);
  var suggestedPage = pageParams.get("page");
  if (suggestedPage && document.getElementById("fbPage")) {
    document.getElementById("fbPage").value = suggestedPage;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var message = buildPayload();
    payloadArea.value = message;

    var subject = encodeURIComponent("Studio Life OS Feedback");
    var body = encodeURIComponent(message);
    window.location.href = "mailto:feedback@studiolifeos.com?subject=" + subject + "&body=" + body;

    status.textContent = "Opened your email app. If nothing opened, click Copy Text and paste feedback into your channel.";
  });

  copyBtn.addEventListener("click", async function () {
    var text = buildPayload();
    payloadArea.value = text;

    try {
      await navigator.clipboard.writeText(text);
      status.textContent = "Feedback text copied.";
    } catch (error) {
      status.textContent = "Could not access clipboard. Copy the text manually from the box below.";
      payloadArea.focus();
      payloadArea.select();
    }
  });

  function buildPayload() {
    var role = document.getElementById("fbRole").value;
    var rating = document.getElementById("fbRating").value;
    var page = document.getElementById("fbPage").value.trim() || "Not specified";
    var notes = document.getElementById("fbNotes").value.trim();
    var date = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    return [
      "Studio Life OS Feedback",
      "Submitted: " + date,
      "Role: " + role,
      "Rating: " + rating,
      "Page/Feature: " + page,
      "",
      "Feedback:",
      notes
    ].join("\n");
  }
})();
