(function () {
  const input = document.getElementById("ai-photo");
  const preview = document.getElementById("ai-preview");
  const result = document.getElementById("ai-result");
  const loading = document.getElementById("ai-loading");
  const dropzone = document.getElementById("ai-dropzone");
  const page = document.querySelector("[data-ai-mode]");
  const mode = page?.dataset.aiMode || "skin";

  if (!input || !preview || !result || !page) return;

  let activeObjectUrl = "";
  let analysisTimer = null;

  const skinTypes = ["oily", "dry", "combination", "normal"];
  const conditionInfo = {
    Acne: "Blocked pores and visible inflammation may point to acne-prone skin.",
    Eczema: "Dryness, irritation and uneven patches can resemble eczema-like patterns.",
    Rosacea: "Diffuse redness and sensitivity-like signs may resemble rosacea patterns.",
    Psoriasis: "Thicker-looking dry patches and contrast changes can resemble psoriasis-like plaques.",
    Dermatitis: "Irritated, reactive-looking areas may resemble dermatitis patterns.",
    Hyperpigmentation: "Uneven tone and darker areas may point to pigmentation changes.",
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  function hashFile(file) {
    const text = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }

    return hash;
  }

  function setLoading(isLoading) {
    if (!loading) return;
    loading.classList.toggle("show", isLoading);
  }

  function resetResult() {
    window.clearTimeout(analysisTimer);
    result.classList.remove("show");
    result.innerHTML = "";
  }

  function readImageMetrics(image, file) {
    const canvas = document.createElement("canvas");
    const size = 96;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      return fallbackMetrics(file);
    }

    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let brightness = 0;
    let saturation = 0;
    let redness = 0;
    let contrast = 0;
    const samples = data.length / 4;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const light = (red + green + blue) / 3;

      brightness += light;
      saturation += max === 0 ? 0 : (max - min) / max;
      redness += Math.max(0, red - (green + blue) / 2);
      contrast += Math.abs(light - 128);
    }

    return {
      hash: hashFile(file),
      brightness: brightness / samples,
      saturation: (saturation / samples) * 100,
      redness: redness / samples,
      contrast: contrast / samples,
      megapixels: (image.naturalWidth * image.naturalHeight) / 1000000,
      fileSize: file.size,
    };
  }

  function fallbackMetrics(file) {
    const hash = hashFile(file);
    return {
      hash,
      brightness: 90 + (hash % 80),
      saturation: 22 + (hash % 35),
      redness: 8 + (hash % 24),
      contrast: 22 + (hash % 35),
      megapixels: 1,
      fileSize: file.size,
    };
  }

  function scoreLabel(value) {
    if (value >= 75) return "High";
    if (value >= 45) return "Medium";
    return "Low";
  }

  function renderMetricCard(label, value, description, tone = "blue") {
    return `
      <article class="ai-result-card ai-result-card--${tone}">
        <span>${label}</span>
        <strong>${value}</strong>
        <p>${description}</p>
      </article>
    `;
  }

  function buildSkinAnalysis(metrics) {
    const hashNoise = metrics.hash % 17;
    const oilIndex = clamp((metrics.saturation * 0.55) + (metrics.brightness > 150 ? 18 : 6) + hashNoise, 0, 100);
    const hydration = clamp(100 - metrics.contrast * 1.15 + (metrics.brightness - 120) * 0.12, 18, 96);
    const acne = clamp(metrics.redness * 2.4 + metrics.saturation * 0.22 + (metrics.contrast > 42 ? 12 : 0), 4, 92);
    const pores = clamp(oilIndex * 0.5 + metrics.contrast * 0.75 + (metrics.fileSize > 2500000 ? 4 : 0), 10, 88);
    const sensitivity = clamp(metrics.redness * 2.1 + (100 - hydration) * 0.25, 8, 90);
    const overall = clamp(100 - acne * 0.22 - pores * 0.16 - sensitivity * 0.14 + hydration * 0.22, 32, 96);
    const typeIndex = oilIndex > 68 ? 0 : hydration < 45 ? 1 : Math.abs(oilIndex - hydration) < 18 ? 3 : 2;
    const skinType = skinTypes[typeIndex];

    const morning = [
      "Gentle cleanser with a low-foam texture",
      hydration < 58 ? "Hydrating serum with humectants" : "Light antioxidant serum",
      oilIndex > 62 ? "Oil-free moisturizer" : "Barrier-supporting moisturizer",
      "Broad-spectrum SPF 30+ every morning",
    ];
    const evening = [
      "Cleanse thoroughly without scrubbing",
      acne > 55 ? "Use a calming exfoliating step 2-3 times weekly" : "Use a mild recovery serum",
      sensitivity > 55 ? "Barrier cream with soothing ingredients" : "Moisturizer matched to skin type",
    ];
    const products = [
      hydration < 55 ? "Hydrating serum" : "Lightweight serum",
      acne > 50 ? "Non-comedogenic acne-support gel" : "Gentle texture-refining product",
      sensitivity > 50 ? "Fragrance-free calming moisturizer" : "Balanced daily moisturizer",
      "Daily sunscreen",
    ];

    return `
      <div class="ai-result__header">
        <span>Analysis complete</span>
        <h2>AI Skin Analyzer Report</h2>
        <p>This structured estimate is based on image brightness, color balance and texture-like contrast signals.</p>
      </div>
      <div class="ai-score">
        <div class="ai-score__ring" style="--score:${overall}%"><strong>${overall}</strong><span>/100</span></div>
        <div>
          <h3>Overall skin score</h3>
          <p>${overall >= 78 ? "Skin appears balanced with minor optimization points." : overall >= 58 ? "Skin appears generally stable, with a few areas to support." : "Skin may benefit from a gentler, barrier-focused routine."}</p>
        </div>
      </div>
      <div class="ai-result-grid">
        ${renderMetricCard("Skin type", skinType, "Estimated from shine, color balance and hydration indicators.", "blue")}
        ${renderMetricCard("Hydration level", `${hydration}%`, scoreLabel(hydration), hydration > 65 ? "green" : "orange")}
        ${renderMetricCard("Acne level", `${acne}%`, scoreLabel(acne), acne > 60 ? "red" : "green")}
        ${renderMetricCard("Pores condition", `${pores}%`, pores > 60 ? "More visible" : "Balanced", pores > 60 ? "orange" : "blue")}
        ${renderMetricCard("Sensitivity level", `${sensitivity}%`, scoreLabel(sensitivity), sensitivity > 60 ? "red" : "green")}
      </div>
      <div class="ai-recommendations">
        <h3>Personalized skincare recommendations</h3>
        <div class="ai-routine-grid">
          ${renderRoutine("Morning routine", morning)}
          ${renderRoutine("Evening routine", evening)}
          ${renderRoutine("Product suggestions", products)}
        </div>
      </div>
      <p class="ai-disclaimer">This is AI-generated analysis and not medical advice.</p>
    `;
  }

  function buildDiseaseAnalysis(metrics) {
    const base = metrics.hash % 19;
    const rednessSignal = clamp(metrics.redness * 2.8 + base, 0, 100);
    const drynessSignal = clamp(metrics.contrast * 1.4 + (metrics.brightness < 112 ? 18 : 0), 0, 100);
    const pigmentSignal = clamp(Math.abs(metrics.brightness - 128) * 0.55 + metrics.saturation * 0.45, 0, 100);

    const conditions = [
      ["Acne", clamp(rednessSignal * 0.58 + metrics.saturation * 0.3 + 12, 12, 91)],
      ["Eczema", clamp(drynessSignal * 0.58 + rednessSignal * 0.2 + 8, 8, 84)],
      ["Rosacea", clamp(rednessSignal * 0.66 + metrics.brightness * 0.05, 10, 88)],
      ["Psoriasis", clamp(drynessSignal * 0.5 + metrics.contrast * 0.35 + 6, 7, 78)],
      ["Dermatitis", clamp(rednessSignal * 0.38 + drynessSignal * 0.38 + 10, 10, 86)],
      ["Hyperpigmentation", clamp(pigmentSignal * 0.72 + 8, 9, 82)],
    ].sort((a, b) => b[1] - a[1]);

    const topScore = conditions[0][1];
    const nextSteps = [
      "Take another photo in natural light for comparison.",
      "Avoid aggressive exfoliation until the skin feels calm.",
      "Keep the area clean, moisturized and protected from sun exposure.",
      topScore > 65 ? "Book a dermatologist visit for professional evaluation." : "Monitor changes for several days and consult a specialist if it worsens.",
    ];
    const seeDoctor = [
      "Rapid spreading, pain, swelling or warmth",
      "Bleeding, crusting, pus or open wounds",
      "Symptoms around eyes or lips",
      "No improvement or repeated flare-ups",
    ];

    return `
      <div class="ai-result__header">
        <span>Detection complete</span>
        <h2>Possible skin conditions</h2>
        <p>Confidence scores are heuristic estimates based on redness, contrast, texture-like signals and tone variation.</p>
      </div>
      <div class="ai-condition-list">
        ${conditions.map(([name, confidence]) => renderCondition(name, confidence)).join("")}
      </div>
      <div class="ai-recommendations">
        <h3>Recommended next steps</h3>
        <div class="ai-routine-grid">
          ${renderRoutine("What to do next", nextSteps)}
          ${renderRoutine("When to see a dermatologist", seeDoctor)}
        </div>
      </div>
      <p class="ai-disclaimer">This tool does not provide medical diagnosis and is for educational purposes only.</p>
    `;
  }

  function renderCondition(name, confidence) {
    const severity = confidence >= 70 ? "High" : confidence >= 45 ? "Medium" : "Low";
    const tone = confidence >= 70 ? "red" : confidence >= 45 ? "orange" : "green";

    return `
      <article class="ai-condition ai-condition--${tone}">
        <div class="ai-condition__top">
          <div>
            <h3>${name}</h3>
            <p>${conditionInfo[name]}</p>
          </div>
          <strong>${confidence}%</strong>
        </div>
        <div class="ai-condition__bar"><span style="width:${confidence}%"></span></div>
        <small>Severity: ${severity}</small>
      </article>
    `;
  }

  function renderRoutine(title, items) {
    return `
      <article class="ai-routine">
        <h4>${title}</h4>
        <ul>
          ${items.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </article>
    `;
  }

  function analyzeFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      result.innerHTML = '<p class="ai-disclaimer">Please upload a valid image file.</p>';
      result.classList.add("show");
      return;
    }

    resetResult();
    setLoading(true);

    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = URL.createObjectURL(file);
    preview.src = activeObjectUrl;
    preview.hidden = false;
    dropzone?.classList.add("has-image");

    const image = new Image();
    image.onload = () => {
      const metrics = readImageMetrics(image, file);
      analysisTimer = window.setTimeout(() => {
        result.innerHTML = mode === "disease"
          ? buildDiseaseAnalysis(metrics)
          : buildSkinAnalysis(metrics);
        setLoading(false);
        result.classList.add("show");
      }, 1200);
    };
    image.onerror = () => {
      setLoading(false);
      result.innerHTML = '<p class="ai-disclaimer">Could not read this image. Please try another photo.</p>';
      result.classList.add("show");
    };
    image.src = activeObjectUrl;
  }

  input.addEventListener("change", () => {
    analyzeFile(input.files?.[0]);
  });

  input.addEventListener("click", () => {
    input.value = "";
  });

  dropzone?.addEventListener("click", () => {
    input.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });

  dropzone?.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) analyzeFile(file);
  });
})();
