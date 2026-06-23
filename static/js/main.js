const appState = {
  cases: [],
  activeCaseId: null,
  activeCase: null,
  metrics: null,
  chart: null,
  causeDistribution: [],
  learningEntries: [],
  recommendations: [],
  activeStep: 1,
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
  dom.kpiKnowledge = document.getElementById("kpiKnowledge");
  dom.kpiActions = document.getElementById("kpiActions");
  dom.kpiImplemented = document.getElementById("kpiImplemented");
  dom.kpiPrevented = document.getElementById("kpiPrevented");
  dom.refreshBtn = document.getElementById("refreshBtn");
  dom.chartInsight = document.getElementById("chartInsight");
  dom.actionImpactPreview = document.getElementById("actionImpactPreview");
  dom.actionStatusLabel = document.getElementById("actionStatusLabel");
  dom.actionLeaderPreview = document.getElementById("actionLeaderPreview");
  dom.actionDueDatePreview = document.getElementById("actionDueDatePreview");
  dom.stepButtons = [...document.querySelectorAll("[data-step-target]")];
  dom.stepPanes = [...document.querySelectorAll("[data-step-pane]")];
  dom.stepWorkspace = document.querySelector(".step-workspace");
  dom.toast = document.getElementById("toast");

  bindEvents();
  bindStepNavigation();
  setActiveStep(getInitialStep(), { updateHash: false });
  refreshDashboard();
});

function bindEvents() {
  dom.caseSelector.addEventListener("change", () => {
    appState.activeCaseId = Number(dom.caseSelector.value);
    appState.activeCase = appState.cases.find((item) => item.id === appState.activeCaseId) || appState.cases[0] || null;
    renderActiveCase();
    renderWorkflow();
    renderMetrics();
  });

  dom.refreshBtn.addEventListener("click", () => refreshDashboard(true));

  dom.caseCreateForm.addEventListener("submit", handleCaseCreate);
  dom.analysisForm.addEventListener("submit", handleAnalysisSave);
  dom.actionForm.addEventListener("submit", handleActionSave);
  dom.actionForm.addEventListener("input", () => renderActionPreview(appState.activeCase));
}

function bindStepNavigation() {
  dom.stepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetStep = Number(button.dataset.stepTarget || 1);
      setActiveStep(targetStep, { updateHash: true, scrollToWorkspace: true });
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveStep(getInitialStep(), { updateHash: false });
  });
}

function getInitialStep() {
  const match = window.location.hash.match(/step-(\d+)/i);
  const step = Number(match?.[1] || 1);
  return Number.isFinite(step) && step >= 1 && step <= 7 ? step : 1;
}

function setActiveStep(step, options = {}) {
  appState.activeStep = Number(step) || 1;
  renderActiveStep();

  if (options.updateHash) {
    window.history.replaceState(null, "", `#step-${appState.activeStep}`);
  }

  if (options.scrollToWorkspace) {
    const targetPane = dom.stepPanes.find((pane) => Number(pane.dataset.stepPane) === appState.activeStep);
    if (targetPane) {
      targetPane.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function renderActiveStep() {
  dom.stepButtons.forEach((button) => {
    const isActive = Number(button.dataset.stepTarget) === appState.activeStep;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.setAttribute("aria-current", isActive ? "true" : "false");
  });

  dom.stepPanes.forEach((pane) => {
    const isActive = Number(pane.dataset.stepPane) === appState.activeStep;
    pane.classList.toggle("is-focused", isActive);
  });
}

async function refreshDashboard(showToast = false) {
  try {
    const [casesPayload, metricsPayload] = await Promise.all([fetchJson("/api/cases"), fetchJson("/api/metrics")]);
    appState.cases = casesPayload.cases || [];
    appState.activeCaseId = casesPayload.active_case_id;
    appState.activeCase = casesPayload.active_case || appState.cases[0] || null;
    appState.workflow = casesPayload.workflow || [];
    appState.metrics = metricsPayload.metrics || null;
    appState.causeDistribution = metricsPayload.cause_distribution || [];
    appState.learningEntries = metricsPayload.learning_library || [];
    appState.recommendations = metricsPayload.recommendations || [];

    renderCaseSelector();
    renderActiveCase();
    renderWorkflow();
    renderMetrics();
    renderChart(appState.causeDistribution);
    renderLearningLibrary(appState.learningEntries);
    renderRecommendations(appState.recommendations);
    renderActiveStep();
    renderActionPreview(appState.activeCase);
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
    <div class="case-summary__main">
      <div class="case-summary__title-row">
        <div>
          <span>Caso activo</span>
          <strong>#${caseData.id}</strong>
        </div>
        <div class="case-summary__badge">${escapeHtml(caseData.status || "En Analisis")}</div>
      </div>
      <ul class="case-summary__meta">
        <li><span>Fecha de registro</span><strong>${formatDateLabel(caseData.created_at)}</strong></li>
        <li><span>Usuario</span><strong>${escapeHtml(caseData.user)}</strong></li>
        <li><span>Categoria</span><strong>${escapeHtml(caseData.category)}</strong></li>
        <li><span>Subcategoria</span><strong>${escapeHtml(caseData.subcategory)}</strong></li>
        <li><span>Canal</span><strong>${escapeHtml(caseData.channel)}</strong></li>
        <li><span>Descripcion</span><strong>${escapeHtml(caseData.description)}</strong></li>
      </ul>
    </div>
    <div class="case-summary__aside">
      <div class="case-summary__status">
        <span>Estado del caso</span>
        <strong>${escapeHtml(caseData.status || "En Analisis")}</strong>
      </div>
      <div class="case-summary__info"><span>Responsable</span><strong>${escapeHtml(caseData.action_leader || "Maria Gomez")}</strong></div>
      <div class="case-summary__info"><span>Prioridad</span><strong>${escapeHtml(caseData.priority)}</strong></div>
      <div class="case-summary__info"><span>Origen</span><strong>${escapeHtml(caseData.channel)}</strong></div>
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

  renderActionPreview(caseData);
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
  dom.kpiKnowledge.textContent = metrics.knowledge_identified ?? appState.learningEntries.length ?? 0;
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

  appState.causeDistribution = causeDistribution;
  const labels = causeDistribution.map((item) => item.label);
  const values = causeDistribution.map((item) => item.value);
  const colors = ["#4caf50", "#0b2f6f", "#a855f7"];
  const total = values.reduce((sum, value) => sum + value, 0);
  const topBucket = causeDistribution.reduce((top, item) => (item.value > (top?.value || 0) ? item : top), null);

  if (dom.chartInsight) {
    dom.chartInsight.textContent = topBucket ? `La causa mas recurrente es ${topBucket.label} con ${topBucket.value} casos sobre ${total || 0}.` : "Aun no hay suficientes datos para calcular la recurrencia.";
  }

  const chartCenterValue = document.getElementById("chartCenterValue");
  if (chartCenterValue) {
    chartCenterValue.textContent = String(total || 0);
  }

  if (appState.chart) {
    appState.chart.destroy();
  }

  appState.chart = new Chart(dom.similarCasesChart, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          label: "Casos similares",
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label(context) { return ` ${context.label}: ${context.raw} casos`; } } },
      },
    },
  });
}

function renderLearningLibrary(entries) {
  appState.learningEntries = entries;
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
  appState.recommendations = recommendations;
  dom.recommendationsList.innerHTML = recommendations
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function renderActionPreview(caseData) {
  const activeCase = caseData || appState.activeCase || {};
  const impactValue = Number(document.getElementById("actionImpact")?.value || activeCase.expected_impact || 0);
  const leaderValue = document.getElementById("actionLeader")?.value?.trim() || activeCase.action_leader || "Sin asignar";
  const dueDateValue = document.getElementById("actionDueDate")?.value || activeCase.action_due_date || "";

  if (dom.actionImpactPreview) {
    dom.actionImpactPreview.textContent = `${impactValue.toFixed(0)}%`;
  }
  if (dom.actionStatusLabel) {
    dom.actionStatusLabel.textContent = activeCase.prevented ? "Prevencion activa" : activeCase.implemented ? "Accion implementada" : activeCase.status || "En Analisis";
  }
  if (dom.actionLeaderPreview) {
    dom.actionLeaderPreview.textContent = leaderValue;
  }
  if (dom.actionDueDatePreview) {
    dom.actionDueDatePreview.textContent = formatDateLabel(dueDateValue || activeCase.action_due_date);
  }
}

function mapValueToAngle(value) {
  return -90 + (Math.max(0, Math.min(100, value)) / 100) * 180;
}

function formatDateLabel(value) {
  if (!value) {
    return "--/--/----";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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