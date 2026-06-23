const appState = {
  cases: [],
  activeCaseId: null,
  activeCase: null,
  metrics: null,
  chart: null,
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  dom.caseSelector = document.getElementById("caseSelector");
  dom.caseStatusPill = document.getElementById("caseStatusPill");
  dom.caseSummary = document.getElementById("caseSummary");
  dom.caseCreateForm = document.getElementById("caseCreateForm");
  dom.analysisForm = document.getElementById("analysisForm");
  dom.actionForm = document.getElementById("actionForm");
  dom.whyStack = document.getElementById("whyStack");
  dom.learningLibraryBody = document.getElementById("learningLibraryBody");
  dom.recommendationsList = document.getElementById("recommendationsList");
  dom.workflowStepper = document.getElementById("workflowStepper");
  dom.similarCasesChart = document.getElementById("similarCasesChart");
  dom.iaoGaugeFill = document.getElementById("iaoGaugeFill");
  dom.iaoGaugeNeedle = document.getElementById("iaoGaugeNeedle");
  dom.iaoValue = document.getElementById("iaoValue");
  dom.iaoNarrative = document.getElementById("iaoNarrative");
  dom.iaoLabel = document.getElementById("iaoLabel");
  dom.kpiReceived = document.getElementById("kpiReceived");
  dom.kpiRootCauses = document.getElementById("kpiRootCauses");
  dom.kpiActions = document.getElementById("kpiActions");
  dom.kpiImplemented = document.getElementById("kpiImplemented");
  dom.kpiPrevented = document.getElementById("kpiPrevented");
  dom.refreshBtn = document.getElementById("refreshBtn");
  dom.toast = document.getElementById("toast");

  bindEvents();
  refreshDashboard();
});

function bindEvents() {
  dom.caseSelector.addEventListener("change", () => {
    appState.activeCaseId = Number(dom.caseSelector.value);
    appState.activeCase = appState.cases.find((item) => item.id === appState.activeCaseId) || appState.cases[0] || null;
    renderActiveCase();
    renderWorkflow();
    renderGauge();
  });

  dom.refreshBtn.addEventListener("click", () => refreshDashboard(true));

  dom.caseCreateForm.addEventListener("submit", handleCaseCreate);
  dom.analysisForm.addEventListener("submit", handleAnalysisSave);
  dom.actionForm.addEventListener("submit", handleActionSave);
}

async function refreshDashboard(showToast = false) {
  try {
    const [casesPayload, metricsPayload] = await Promise.all([fetchJson("/api/cases"), fetchJson("/api/metrics")]);
    appState.cases = casesPayload.cases || [];
    appState.activeCaseId = casesPayload.active_case_id;
    appState.activeCase = casesPayload.active_case || appState.cases[0] || null;
    appState.workflow = casesPayload.workflow || [];
    appState.metrics = metricsPayload.metrics || null;

    renderCaseSelector();
    renderActiveCase();
    renderWorkflow();
    renderMetrics();
    renderChart(metricsPayload.cause_distribution || []);
    renderLearningLibrary(metricsPayload.learning_library || []);
    renderRecommendations(metricsPayload.recommendations || []);
    if (showToast) {
      showToastMessage("Tablero actualizado con la informacion mas reciente.");
    }
  } catch (error) {
    showToastMessage(error.message || "No se pudo refrescar el tablero.");
  }
}

async function handleCaseCreate(event) {
  event.preventDefault();
  const formData = new FormData(dom.caseCreateForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await fetchJson("/api/cases", { method: "POST", body: JSON.stringify(payload) });
    dom.caseCreateForm.reset();
    dom.caseCreateForm.querySelector('[name="priority"]').value = "Media";
    dom.caseCreateForm.querySelector('[name="channel"]').value = "Portal";
    showToastMessage("Paso 1 completado: el caso quedo registrado y paso al flujo de analisis.");
    await refreshDashboard();
  } catch (error) {
    showToastMessage(error.message || "No se pudo registrar el caso.");
  }
}

async function handleAnalysisSave(event) {
  event.preventDefault();
  if (!appState.activeCaseId) {
    showToastMessage("Selecciona un caso activo antes de guardar el analisis.");
    return;
  }

  const whyInputs = [...dom.whyStack.querySelectorAll("input")].map((input) => input.value.trim());
  const payload = {
    step: "analysis",
    whys: whyInputs,
    root_cause: document.getElementById("rootCauseInput").value.trim(),
    learning: document.getElementById("learningInput").value.trim(),
    cause_bucket: appState.activeCase?.cause_bucket || "Proceso Interno",
  };

  try {
    await fetchJson(`/api/cases/${appState.activeCaseId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    showToastMessage("Paso 3 y 4 actualizados: la causa raiz y el aprendizaje quedaron indexados.");
    await refreshDashboard();
  } catch (error) {
    showToastMessage(error.message || "No se pudo guardar el analisis.");
  }
}

async function handleActionSave(event) {
  event.preventDefault();
  if (!appState.activeCaseId) {
    showToastMessage("Selecciona un caso activo antes de crear una accion.");
    return;
  }

  const milestones = document.getElementById("actionMilestones").value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  const payload = {
    case_id: appState.activeCaseId,
    title: document.getElementById("actionTitle").value.trim(),
    leader: document.getElementById("actionLeader").value.trim(),
    due_date: document.getElementById("actionDueDate").value,
    expected_impact: document.getElementById("actionImpact").value,
    milestones,
    implemented: document.getElementById("actionImplemented").checked,
    prevented: document.getElementById("actionPrevented").checked,
    prevention: document.getElementById("actionPrevention").value.trim(),
  };

  try {
    await fetchJson("/api/actions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToastMessage("Paso 5 y 6 completados: la accion y la prevencion ya impactan el IAO.");
    await refreshDashboard();
  } catch (error) {
    showToastMessage(error.message || "No se pudo guardar la accion.");
  }
}

function renderCaseSelector() {
  if (!dom.caseSelector) {
    return;
  }

  dom.caseSelector.innerHTML = appState.cases
    .map((caseItem) => {
      const selected = caseItem.id === appState.activeCaseId ? "selected" : "";
      return `<option value="${caseItem.id}" ${selected}>#${caseItem.id} · ${escapeHtml(caseItem.status || "En Analisis")}</option>`;
    })
    .join("");
}

function renderActiveCase() {
  const caseData = appState.activeCase;
  if (!caseData) {
    dom.caseSummary.innerHTML = `<div class="summary-card"><strong>No hay casos cargados.</strong></div>`;
    return;
  }

  dom.caseStatusPill.textContent = caseData.status || "En Analisis";
  dom.caseSummary.innerHTML = `
    <div class="summary-card">
      <span>Caso activo</span>
      <strong>#${caseData.id}</strong>
    </div>
    <div class="summary-card">
      <span>Descripcion</span>
      <strong>${escapeHtml(caseData.description)}</strong>
    </div>
    <div class="summary-card">
      <span>Usuario / Canal</span>
      <strong>${escapeHtml(caseData.user)} · ${escapeHtml(caseData.channel)}</strong>
    </div>
    <div class="summary-card">
      <span>Tipificacion</span>
      <strong>${escapeHtml(caseData.category)} / ${escapeHtml(caseData.subcategory)}</strong>
    </div>
  `;

  const whyValues = Array.from({ length: 5 }, (_, index) => caseData.why_tree?.[index]?.answer || "");
  dom.whyStack.innerHTML = whyValues
    .map((value, index) => `
      <label class="why-item">
        <strong>Por que ${index + 1}</strong>
        <input type="text" value="${escapeAttribute(value)}" placeholder="Hipotesis ${index + 1}">
      </label>
    `)
    .join("");

  document.getElementById("rootCauseInput").value = caseData.root_cause || "";
  document.getElementById("learningInput").value = caseData.learning || "";
  document.getElementById("actionTitle").value = caseData.action_title || "";
  document.getElementById("actionLeader").value = caseData.action_leader || "";
  document.getElementById("actionDueDate").value = caseData.action_due_date || "";
  document.getElementById("actionImpact").value = caseData.expected_impact ?? "";
  document.getElementById("actionMilestones").value = (caseData.milestones || []).join("; ");
  document.getElementById("actionPrevention").value = caseData.prevention || "";
  document.getElementById("actionImplemented").checked = Boolean(caseData.implemented);
  document.getElementById("actionPrevented").checked = Boolean(caseData.prevented);
}

function renderWorkflow() {
  if (!dom.workflowStepper) {
    return;
  }

  dom.workflowStepper.innerHTML = appState.workflow
    .map((step) => {
      const stateClass = [step.done ? "is-done" : "", step.current ? "is-current" : ""].filter(Boolean).join(" ");
      return `
        <article class="stepper__item ${stateClass}">
          <div class="stepper__index">${step.index}</div>
          <strong>${escapeHtml(step.label)}</strong>
          <p>${escapeHtml(step.detail)}</p>
        </article>
      `;
    })
    .join("");
}

function renderMetrics() {
  if (!appState.metrics) {
    return;
  }

  const metrics = appState.metrics;
  dom.kpiReceived.textContent = metrics.cases_received ?? 0;
  dom.kpiRootCauses.textContent = metrics.root_causes_identified ?? 0;
  dom.kpiActions.textContent = metrics.actions_generated ?? 0;
  dom.kpiImplemented.textContent = metrics.implemented_improvements ?? 0;
  dom.kpiPrevented.textContent = metrics.problems_prevented ?? 0;

  const label = metrics.interpretation || "Estado intermedio";
  dom.iaoLabel.textContent = label;
  dom.iaoNarrative.textContent = metrics.narrative || "";

  const iaoValue = Number(metrics.iao || 0);
  dom.iaoValue.textContent = `${iaoValue.toFixed(1)}%`;

  const gaugeColor = iaoValue <= 30 ? "var(--red)" : iaoValue <= 70 ? "var(--amber)" : "var(--emerald)";
  document.documentElement.style.setProperty("--gauge-color", gaugeColor);
  dom.iaoGaugeFill.style.strokeDashoffset = String(100 - iaoValue);
  dom.iaoGaugeNeedle.style.transform = `rotate(${mapValueToAngle(iaoValue)}deg)`;
}

function renderChart(causeDistribution) {
  if (!dom.similarCasesChart || typeof Chart === "undefined") {
    return;
  }

  const labels = causeDistribution.map((item) => item.label);
  const values = causeDistribution.map((item) => item.value);
  const colors = ["#16a36d", "#0b2f6f", "#f0b429"];

  if (appState.chart) {
    appState.chart.destroy();
  }

  appState.chart = new Chart(dom.similarCasesChart, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Recurrencia",
          data: values,
          borderWidth: 0,
          borderRadius: 12,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${context.raw} casos`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#5c6c82", font: { weight: "700" } },
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: "#5c6c82" },
          grid: { color: "rgba(15, 37, 68, 0.08)" },
        },
      },
    },
  });
}

function renderLearningLibrary(entries) {
  dom.learningLibraryBody.innerHTML = entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.problem)}</td>
          <td>${escapeHtml(entry.root_cause)}</td>
          <td>${escapeHtml(entry.action)}</td>
          <td><strong>${Number(entry.impact || 0).toFixed(0)}%</strong></td>
        </tr>
      `,
    )
    .join("");
}

function renderRecommendations(recommendations) {
  dom.recommendationsList.innerHTML = recommendations
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function mapValueToAngle(value) {
  return -90 + (Math.max(0, Math.min(100, value)) / 100) * 180;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Error ${response.status}`);
  }
  return payload;
}

function showToastMessage(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  clearTimeout(showToastMessage.timer);
  showToastMessage.timer = window.setTimeout(() => {
    dom.toast.classList.remove("is-visible");
  }, 3000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}