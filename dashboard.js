// ========= HARD CHECK: mapData =========
if (typeof window.mapData === "undefined" || !mapData.countries) {
  alert(
    "mapData not found. In map_data.js, remove 'export default mapData;' and use 'window.mapData = mapData;'."
  );
}

// ========= GLOBAL CHART.JS DEFAULTS =========
if (window.Chart) {
  Chart.defaults.font.family =
    "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  Chart.defaults.color = "#e5e7eb";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(15,23,42,0.98)";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(30,64,175,0.9)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

// ========= MAP SETUP =========
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 2,
  maxBounds: [
    [-90, -180],
    [90, 180],
  ],
}).setView([20, 0], 2.5);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    subdomains: "abcd",
    maxZoom: 19,
  }
).addTo(map);

L.control.zoom({ position: "bottomleft" }).addTo(map);

let geojsonLayer = null;
let selectedCountries = []; // names
let isCompareMode = false;

let scatterChart = null;
let radarChartA = null;
let radarChartB = null;
let scatterPoints = [];
let scatterActiveRow = null;

const compareColors = ["#0ea5e9", "#34d399"];

// ========= METADATA =========
const METRIC_LABELS = {
  Youth_Unemployment_Rate_percent: "Youth unemployment (%)",
  Agricultural_Land: "Agricultural land (% of area)",
  "Arable_Land (%% of Total Agricultural Land)":
    "Arable land (% of agricultural land)",
  Real_GDP_per_Capita_USD: "Real GDP per capita (USD)",
  Real_GDP_Growth_Rate_percent: "Real GDP growth (%)",
  Unemployment_Rate_percent: "Unemployment rate (%)",
  refined_petroleum_imports_bbl_per_day: "Refined petroleum imports (bbl/day)",
  Exports_billion_USD: "Exports (billion USD)",
  Imports_billion_USD: "Imports (billion USD)",
  Coastline: "Coastline length (km)",
};

const SCATTER_METRICS = [
  "Youth_Unemployment_Rate_percent",
  "Agricultural_Land",
  "Arable_Land (%% of Total Agricultural Land)",
  "Real_GDP_per_Capita_USD",
  "Real_GDP_Growth_Rate_percent",
  "Unemployment_Rate_percent",
  "refined_petroleum_imports_bbl_per_day",
  "Exports_billion_USD",
  "Imports_billion_USD",
  "Coastline",
];

const RADAR_A = [
  { key: "Coastline", label: "Coastline length (km)" },
  { key: "Agricultural_Land", label: "Agricultural land (% of area)" },
  { key: "Lowest_Elevation", label: "Lowest elevation (m)" },
  { key: "Water_Area", label: "Water area (km²)" },
  {
    key: "Permanent_Pasture (%% of Total Agricultural Land)",
    label: "Permanent pasture (% of agri land)",
  },
  {
    key: "Arable_Land (%% of Total Agricultural Land)",
    label: "Arable land (% of agri land)",
  },
  {
    key: "Permanent_Crops (%% of Total Agricultural Land)",
    label: "Permanent crops (% of agri land)",
  },
];

const RADAR_B = [
  {
    key: "Real_GDP_per_Capita_USD",
    label: "Real GDP per capita (USD)",
  },
  {
    key: "Real_GDP_Growth_Rate_percent",
    label: "Real GDP growth (%)",
  },
  {
    key: "Unemployment_Rate_percent",
    label: "Unemployment rate (%)",
  },
  {
    key: "refined_petroleum_imports_bbl_per_day",
    label: "Refined petroleum imports (bbl/day)",
  },
  { key: "Exports_billion_USD", label: "Exports (billion USD)" },
  { key: "Imports_billion_USD", label: "Imports (billion USD)" },
];

// ========= HELPERS =========
function getCountryRecord(name) {
  if (!mapData || !mapData.countries) return null;
  return (
    mapData.countries[name] || mapData.countries[name.toUpperCase()] || null
  );
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function formatMaybe(v) {
  if (!isFiniteNumber(v)) return "—";
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return v.toLocaleString();
  return (Math.round(v * 100) / 100).toString();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ========= MAP STYLES =========
function styleBase() {
  return {
    fillColor: "transparent",
    weight: 1,
    color: "rgba(148,163,184,0.35)",
    fillOpacity: 0,
  };
}

function styleNoData() {
  return {
    className: "striped-country",
    weight: 0.5,
    color: "#475569",
  };
}

function applyStyle(layer, styleObj) {
  if (styleObj.className) {
    layer.setStyle({
      fillColor: null,
      fillOpacity: 0,
      weight: 0.5,
      color: "#475569",
    });
    if (layer._path) L.DomUtil.addClass(layer._path, "striped-country");
  } else {
    if (layer._path) L.DomUtil.removeClass(layer._path, "striped-country");
    layer.setStyle(styleObj);
  }
}

function styleHeatYouth(feature) {
  const d = getCountryRecord(feature.properties.name);
  if (!d) return styleNoData();
  const v = d["Youth_Unemployment_Rate_percent"];
  if (!isFiniteNumber(v)) return styleNoData();

  const color =
    v > 40
      ? "#f97316"
      : v > 30
      ? "#fb923c"
      : v > 20
      ? "#facc15"
      : v > 10
      ? "#4ade80"
      : "#22c55e";

  return {
    fillColor: color,
    weight: 0.5,
    color: "rgba(15,23,42,0.9)",
    fillOpacity: 0.7,
  };
}

function styleHeatAgri(feature) {
  const d = getCountryRecord(feature.properties.name);
  if (!d) return styleNoData();
  const v = d["Agricultural_Land"];
  if (!isFiniteNumber(v)) return styleNoData();

  const color =
    v > 70
      ? "#0ea5e9"
      : v > 50
      ? "#38bdf8"
      : v > 35
      ? "#60a5fa"
      : v > 20
      ? "#818cf8"
      : "#64748b";

  return {
    fillColor: color,
    weight: 0.5,
    color: "rgba(15,23,42,0.9)",
    fillOpacity: 0.7,
  };
}

function styleHeatArable(feature) {
  const d = getCountryRecord(feature.properties.name);
  if (!d) return styleNoData();
  const v = d["Arable_Land (%% of Total Agricultural Land)"];
  if (!isFiniteNumber(v)) return styleNoData();

  const color =
    v > 60
      ? "#22c55e"
      : v > 40
      ? "#4ade80"
      : v > 25
      ? "#a3e635"
      : v > 10
      ? "#bef264"
      : "#64748b";

  return {
    fillColor: color,
    weight: 0.5,
    color: "rgba(15,23,42,0.9)",
    fillOpacity: 0.7,
  };
}

// ========= MAP INTERACTION =========
function highlightFeature(e) {
  const layer = e.target;
  const name = layer.feature.properties.name;
  if (selectedCountries.includes(name)) return;
  layer.setStyle({
    weight: 2,
    color: "#e5f3ff",
    fillOpacity: 0.9,
  });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
}

function resetHighlight(e) {
  const layer = e.target;
  const name = layer.feature.properties.name;
  if (selectedCountries.includes(name)) return;

  const mode = document.getElementById("viewMode").value;
  if (mode === "heat_youth") applyStyle(layer, styleHeatYouth(layer.feature));
  else if (mode === "heat_agri")
    applyStyle(layer, styleHeatAgri(layer.feature));
  else if (mode === "heat_arable")
    applyStyle(layer, styleHeatArable(layer.feature));
  else applyStyle(layer, styleBase(layer.feature));
}

function onCountryClick(feature, layer) {
  const name = feature.properties.name;
  if (!getCountryRecord(name)) {
    alert("No data for: " + name);
    return;
  }

  if (isCompareMode) {
    if (selectedCountries.includes(name)) {
      selectedCountries = selectedCountries.filter((c) => c !== name);
      resetHighlight({ target: layer });
    } else {
      if (selectedCountries.length >= 2) {
        alert("Comparison mode supports at most 2 countries.");
        return;
      }
      selectedCountries.push(name);
      layer.setStyle({
        weight: 3,
        color: compareColors[selectedCountries.length - 1],
        fillOpacity: 0.9,
      });
    }
  } else {
    // single mode: clear others
    geojsonLayer.eachLayer((l) => {
      const nm = l.feature.properties.name;
      if (nm !== name) resetHighlight({ target: l });
    });
    selectedCountries = [name];
    layer.setStyle({
      weight: 3,
      color: "#38bdf8",
      fillOpacity: 0.9,
    });
    map.flyTo(layer.getBounds().getCenter(), 4, { duration: 0.6 });
  }

  updateInspector();
  updateRadars();
}

// ========= INSPECTOR (RIGHT SIDEBAR) =========
function updateInspector() {
  const box = document.getElementById("selectionBox");
  const metricsBox = document.getElementById("metricsBox");
  box.innerHTML = "";
  metricsBox.innerHTML = "";

  if (!selectedCountries.length) {
    box.innerHTML =
      '<span style="font-size:11px;color:var(--text-sub);">No country selected. Click on the map to inspect.</span>';
    metricsBox.innerHTML =
      '<div class="metric-card"><div class="metric-label">Info</div><div class="metric-value" style="font-size:12px;">Pick a country on the map to see its profile.</div></div>';
    return;
  }

  selectedCountries.forEach((c, i) => {
    const color = isCompareMode ? compareColors[i] : "#38bdf8";
    box.innerHTML += `
      <div class="country-tag">
        <span class="country-dot" style="background:${color}"></span>
        ${escapeHtml(c)}
        <span class="country-remove" onclick="removeCountry('${c.replace(
          /'/g,
          "\\'"
        )}')">×</span>
      </div>
    `;
  });

  const primary = getCountryRecord(selectedCountries[0]);
  if (!primary) return;

  const cards = [
    {
      label: "Youth unemployment (%)",
      val: primary["Youth_Unemployment_Rate_percent"],
    },
    {
      label: "Agricultural land (% of area)",
      val: primary["Agricultural_Land"],
    },
    {
      label: "Arable land (% of agri land)",
      val: primary["Arable_Land (%% of Total Agricultural Land)"],
    },
    {
      label: "Real GDP per capita (USD)",
      val: primary["Real_GDP_per_Capita_USD"],
    },
    {
      label: "Unemployment rate (%)",
      val: primary["Unemployment_Rate_percent"],
    },
  ];

  metricsBox.innerHTML = cards
    .map(
      (c) => `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(c.label)}</div>
      <div class="metric-value">${formatMaybe(c.val)}</div>
    </div>
  `
    )
    .join("");
}

function removeCountry(name) {
  selectedCountries = selectedCountries.filter((c) => c !== name);
  geojsonLayer.eachLayer((l) => {
    if (l.feature.properties.name === name) {
      resetHighlight({ target: l });
    }
  });
  updateInspector();
  updateRadars();
}
window.removeCountry = removeCountry; // for inline onclick

// ========= LEGEND =========
function updateLegend() {
  const mode = document.getElementById("viewMode").value;
  const leg = document.getElementById("legend");

  if (mode === "heat_youth") {
    leg.innerHTML = `
      <div style="margin-bottom:4px;font-size:11px;">Youth unemployment rate (%)</div>
      <div class="legend-row"><div class="color-box" style="background:#22c55e"></div><span>0 – 10 (very low)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#4ade80"></div><span>10 – 20 (low)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#facc15"></div><span>20 – 30 (medium)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#fb923c"></div><span>30 – 40 (high)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#f97316"></div><span>&gt; 40 (very high)</span></div>
      <div class="legend-row" style="margin-top:6px;"><div class="stripe-box"></div><span>No data</span></div>
    `;
  } else if (mode === "heat_agri") {
    leg.innerHTML = `
      <div style="margin-bottom:4px;font-size:11px;">Agricultural land (% of total area)</div>
      <div class="legend-row"><div class="color-box" style="background:#64748b"></div><span>0 – 20 (very low)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#818cf8"></div><span>20 – 35 (low)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#60a5fa"></div><span>35 – 50 (medium)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#38bdf8"></div><span>50 – 70 (high)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#0ea5e9"></div><span>&gt; 70 (very high)</span></div>
      <div class="legend-row" style="margin-top:6px;"><div class="stripe-box"></div><span>No data</span></div>
    `;
  } else if (mode === "heat_arable") {
    leg.innerHTML = `
      <div style="margin-bottom:4px;font-size:11px;">Arable land (% of agricultural land)</div>
      <div class="legend-row"><div class="color-box" style="background:#64748b"></div><span>0 – 10 (very low)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#bef264"></div><span>10 – 25 (low)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#a3e635"></div><span>25 – 40 (medium)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#4ade80"></div><span>40 – 60 (high)</span></div>
      <div class="legend-row"><div class="color-box" style="background:#22c55e"></div><span>&gt; 60 (very high)</span></div>
      <div class="legend-row" style="margin-top:6px;"><div class="stripe-box"></div><span>No data</span></div>
    `;
  } else {
    leg.innerHTML =
      '<div style="font-size:11px;color:var(--text-sub);">Map shows country outlines only. Use heatmap layers above to encode a specific attribute by color.</div>';
  }
}

function updateMapMode() {
  const mode = document.getElementById("viewMode").value;
  updateLegend();

  if (!geojsonLayer) return;

  geojsonLayer.eachLayer((l) => {
    if (l._path) L.DomUtil.removeClass(l._path, "striped-country");
  });

  if (mode === "heat_youth") {
    geojsonLayer.eachLayer((l) =>
      applyStyle(l, styleHeatYouth(l.feature))
    );
  } else if (mode === "heat_agri") {
    geojsonLayer.eachLayer((l) =>
      applyStyle(l, styleHeatAgri(l.feature))
    );
  } else if (mode === "heat_arable") {
    geojsonLayer.eachLayer((l) =>
      applyStyle(l, styleHeatArable(l.feature))
    );
  } else {
    geojsonLayer.eachLayer((l) => applyStyle(l, styleBase(l.feature)));
  }

  // re-apply selection styling
  geojsonLayer.eachLayer((l) => {
    const nm = l.feature.properties.name;
    if (selectedCountries.includes(nm)) {
      const idx = selectedCountries.indexOf(nm);
      l.setStyle({
        weight: 3,
        color: isCompareMode ? compareColors[idx] || "#38bdf8" : "#38bdf8",
        fillOpacity: 0.9,
      });
    }
  });
}

// ========= COMPARE TOGGLE =========
function toggleCompare() {
  isCompareMode = !isCompareMode;
  const btn = document.getElementById("compareBtn");
  if (isCompareMode) {
    btn.classList.add("active");
    btn.textContent = "ON";
  } else {
    btn.classList.remove("active");
    btn.textContent = "OFF";
  }
  selectedCountries = [];
  if (geojsonLayer) geojsonLayer.resetStyle();
  updateMapMode();
  updateInspector();
  updateRadars();
}

document.getElementById("compareBtn").addEventListener("click", toggleCompare);

// ========= GEOJSON LOAD =========
fetch(
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
)
  .then((res) => res.json())
  .then((data) => {
    geojsonLayer = L.geoJSON(data, {
      style: styleBase,
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: highlightFeature,
          mouseout: resetHighlight,
          click: () => onCountryClick(feature, layer),
        });
      },
    }).addTo(map);

    updateLegend();
  })
  .catch((err) => {
    console.error(err);
    alert("Failed to load world geojson.");
  });

// ========= SCATTER SETUP =========
function initScatterControls() {
  const xSel = document.getElementById("scatterX");
  const ySel = document.getElementById("scatterY");

  xSel.innerHTML = SCATTER_METRICS.map(
    (m) =>
      `<option value="${escapeHtml(m)}">${escapeHtml(
        METRIC_LABELS[m] || m
      )}</option>`
  ).join("");
  ySel.innerHTML = xSel.innerHTML;

  xSel.value = "Agricultural_Land";
  ySel.value = "Youth_Unemployment_Rate_percent";

  xSel.addEventListener("change", renderScatter);
  ySel.addEventListener("change", renderScatter);

  const slider = document.getElementById("scatterSizeSlider");
  slider.addEventListener("input", onScatterSizeChange);

  renderScatter();
}

function renderScatter() {
  const X = document.getElementById("scatterX").value;
  const Y = document.getElementById("scatterY").value;

  const points = [];
  for (const cName in mapData.countries) {
    const d = mapData.countries[cName];
    const vx = d[X];
    const vy = d[Y];
    if (!isFiniteNumber(vx) || !isFiniteNumber(vy)) continue;
    points.push({ x: vx, y: vy, label: cName });
  }

  scatterPoints = points;
  const totalCount = points.length;

  const canvas = document.getElementById("scatterCanvas");
  if (!canvas) return;

  // sync js canvas size with css
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  if (scatterChart) {
    try {
      scatterChart.destroy();
    } catch (e) {}
  }

  const xLabel = METRIC_LABELS[X] || X;
  const yLabel = METRIC_LABELS[Y] || Y;

  const xTh = document.getElementById("scatterXLabelTh");
  const yTh = document.getElementById("scatterYLabelTh");
  if (xTh) xTh.textContent = xLabel;
  if (yTh) yTh.textContent = yLabel;

  scatterChart = new Chart(canvas.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${xLabel} vs ${yLabel}`,
          data: points,
          parsing: false,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHitRadius: 10,
          pointBackgroundColor: "rgba(56,189,248,0.9)",
          pointBorderColor: "rgba(15,23,42,0.96)",
          pointBorderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: {
        duration: totalCount > 300 ? 0 : 450,
        easing: "easeOutCubic",
      },
      interaction: {
        mode: "nearest",
        axis: "xy",
        intersect: false,
      },
      plugins: {
        legend: { labels: { color: "#e5e7eb" } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              return `${p.label}: (${formatMaybe(p.x)}, ${formatMaybe(
                p.y
              )})`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: xLabel, color: "#d1d5db" },
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(31,41,55,0.7)" },
        },
        y: {
          title: { display: true, text: yLabel, color: "#d1d5db" },
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(31,41,55,0.7)" },
        },
      },
    },
  });

  // Apply current slider size
  onScatterSizeChange();

  const infoEl = document.getElementById("scatterInfo");
  if (infoEl) {
    infoEl.textContent = `Plotted ${totalCount} countries with valid data.`;
  }

  const tbody = document.getElementById("scatterTableBody");
  if (tbody) {
    tbody.innerHTML = points
      .map(
        (p, i) => `
      <tr onclick="focusScatterPoint(${i})" data-row-idx="${i}">
        <td>${escapeHtml(p.label)}</td>
        <td>${formatMaybe(p.x)}</td>
        <td>${formatMaybe(p.y)}</td>
      </tr>
    `
      )
      .join("");
    scatterActiveRow = null;
  }
}

function onScatterSizeChange() {
  if (!scatterChart) return;
  const slider = document.getElementById("scatterSizeSlider");
  const size = parseInt(slider.value, 10) || 4;

  const ds = scatterChart.data.datasets[0];
  ds.pointRadius = size;
  ds.pointHoverRadius = size + 3;
  ds.pointHitRadius = size + 5;

  scatterChart.update("none");
}

function focusScatterPoint(idx) {
  if (!scatterChart || !scatterPoints || !scatterPoints[idx]) return;
  const meta = scatterChart.getDatasetMeta(0);
  if (!meta || !meta.data || !meta.data[idx]) return;

  const el = meta.data[idx];
  if (scatterChart.setActiveElements) {
    scatterChart.setActiveElements([{ datasetIndex: 0, index: idx }]);
    if (scatterChart.tooltip && scatterChart.tooltip.setActiveElements) {
      scatterChart.tooltip.setActiveElements(
        [{ datasetIndex: 0, index: idx }],
        { x: el.x, y: el.y }
      );
    }
  }
  scatterChart.update();

  const tbody = document.getElementById("scatterTableBody");
  if (tbody) {
    if (scatterActiveRow !== null) {
      const prev = tbody.querySelector(
        `tr[data-row-idx="${scatterActiveRow}"]`
      );
      if (prev) prev.classList.remove("scatter-row-active");
    }
    const now = tbody.querySelector(`tr[data-row-idx="${idx}"]`);
    if (now) {
      now.classList.add("scatter-row-active");
      scatterActiveRow = idx;
    }
  }
}
window.focusScatterPoint = focusScatterPoint;

// ========= RADAR SETUP =========
function initRadars() {
  const canvasA = document.getElementById("radarA");
  const canvasB = document.getElementById("radarB");

  canvasA.width = canvasA.clientWidth;
  canvasA.height = canvasA.clientHeight;
  canvasB.width = canvasB.clientWidth;
  canvasB.height = canvasB.clientHeight;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");

  radarChartA = new Chart(ctxA, {
    type: "radar",
    data: {
      labels: RADAR_A.map((dim) => dim.label),
      datasets: [],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      layout: { padding: 20 },
      animation: { duration: 400, easing: "easeOutCubic" },
      scales: {
        r: {
          grid: { color: "rgba(55,65,81,0.7)" },
          angleLines: { color: "rgba(55,65,81,0.7)" },
          ticks: { display: false },
          pointLabels: { color: "#e5e7eb", font: { size: 9 } },
        },
      },
      elements: { line: { tension: 0.25 } },
      plugins: {
        legend: { labels: { color: "#e5e7eb", font: { size: 10 } } },
      },
    },
  });

  radarChartB = new Chart(ctxB, {
    type: "radar",
    data: {
      labels: RADAR_B.map((dim) => dim.label),
      datasets: [],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      layout: { padding: 20 },
      animation: { duration: 400, easing: "easeOutCubic" },
      scales: {
        r: {
          grid: { color: "rgba(55,65,81,0.7)" },
          angleLines: { color: "rgba(55,65,81,0.7)" },
          ticks: { display: false },
          pointLabels: { color: "#e5e7eb", font: { size: 9 } },
        },
      },
      elements: { line: { tension: 0.25 } },
      plugins: {
        legend: { labels: { color: "#e5e7eb", font: { size: 10 } } },
      },
    },
  });
}

function updateRadars() {
  if (!radarChartA || !radarChartB) return;

  if (!selectedCountries.length) {
    radarChartA.data.datasets = [];
    radarChartB.data.datasets = [];
    radarChartA.update();
    radarChartB.update();
    return;
  }

  const colors = selectedCountries.length === 2 ? compareColors : ["#3b82f6"];

  const datasetsA = selectedCountries.map((c, i) => {
    const d = getCountryRecord(c) || {};
    return {
      label: c,
      data: RADAR_A.map((dim) =>
        isFiniteNumber(d[dim.key]) ? d[dim.key] : 0
      ),
      borderColor: colors[i],
      backgroundColor: colors[i] + "33",
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 4,
    };
  });

  const datasetsB = selectedCountries.map((c, i) => {
    const d = getCountryRecord(c) || {};
    return {
      label: c,
      data: RADAR_B.map((dim) =>
        isFiniteNumber(d[dim.key]) ? d[dim.key] : 0
      ),
      borderColor: colors[i],
      backgroundColor: colors[i] + "33",
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 4,
    };
  });

  radarChartA.data.datasets = datasetsA;
  radarChartB.data.datasets = datasetsB;
  radarChartA.update();
  radarChartB.update();
}

// ========= INITIALIZATION =========
document.getElementById("viewMode").addEventListener("change", updateMapMode);

window.addEventListener("load", () => {
  updateInspector(); // empty state
  initScatterControls();
  initRadars();
});
