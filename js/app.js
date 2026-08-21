/**
 * ClaimPilot AI - Application Core Logic
 * Modern light glassmorphism interactive controller
 */

// Application State
const AppState = {
  currentScreen: 'submission', // 'submission' | 'processing' | 'dashboard'
  currentStep: 1, // 1: Documents, 2: Photos, 3: Review
  currentScenarioId: 'clean_approval',
  
  // Uploaded assets state
  uploads: {
    docs: {
      rc: null,
      dl: null,
      claimForm: null
    },
    photos: {
      front: null,
      rear: null,
      leftSide: null,
      rightSide: null
    }
  },
  
  // Processing animation state
  processingStep: 0,
  processingProgress: 0,
  
  // Active modal
  activeModal: null, // { type: 'doc'|'photo'|'export'|'reasoning', data: any }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initScenarioSelector();
  initEventListeners();
  renderScreen();
  lucide.createIcons();
});

// Initialize the scenario switcher dropdown
function initScenarioSelector() {
  const select = document.getElementById('scenario-select');
  if (!select) return;

  select.innerHTML = Object.keys(SCENARIOS).map(key => {
    const s = SCENARIOS[key];
    return `<option value="${key}" ${key === AppState.currentScenarioId ? 'selected' : ''}>
      ${s.title}
    </option>`;
  }).join('');

  select.addEventListener('change', (e) => {
    switchScenario(e.target.value);
  });
}

function switchScenario(scenarioId) {
  if (!SCENARIOS[scenarioId]) return;
  AppState.currentScenarioId = scenarioId;
  
  // Update dropdown if not changed via select
  const select = document.getElementById('scenario-select');
  if (select && select.value !== scenarioId) {
    select.value = scenarioId;
  }

  // Pre-load uploads if in submission or re-render dashboard
  if (AppState.currentScreen === 'dashboard') {
    renderDashboard();
  } else if (AppState.currentScreen === 'submission') {
    renderSubmissionScreen();
  }
  
  showToast(`Switched to ${SCENARIOS[scenarioId].badgeLabel} scenario`);
}

// Main screen router
function setScreen(screenName) {
  AppState.currentScreen = screenName;
  renderScreen();
}

function renderScreen() {
  const container = document.getElementById('app-content');
  if (!container) return;

  // Update top nav active indicator
  const navSubmission = document.getElementById('nav-btn-submission');
  const navDashboard = document.getElementById('nav-btn-dashboard');

  if (AppState.currentScreen === 'submission') {
    if (navSubmission) navSubmission.classList.add('bg-indigo-900', 'text-white', 'shadow-sm');
    if (navSubmission) navSubmission.classList.remove('text-slate-600', 'hover:bg-slate-100/60');
    if (navDashboard) navDashboard.classList.remove('bg-indigo-900', 'text-white', 'shadow-sm');
    if (navDashboard) navDashboard.classList.add('text-slate-600', 'hover:bg-slate-100/60');
    renderSubmissionScreen();
  } else if (AppState.currentScreen === 'processing') {
    renderProcessingScreen();
  } else if (AppState.currentScreen === 'dashboard') {
    if (navDashboard) navDashboard.classList.add('bg-indigo-900', 'text-white', 'shadow-sm');
    if (navDashboard) navDashboard.classList.remove('text-slate-600', 'hover:bg-slate-100/60');
    if (navSubmission) navSubmission.classList.remove('bg-indigo-900', 'text-white', 'shadow-sm');
    if (navSubmission) navSubmission.classList.add('text-slate-600', 'hover:bg-slate-100/60');
    renderDashboard();
  }

  // Reinitialize icons
  setTimeout(() => lucide.createIcons(), 50);
}

// -------------------------------------------------------------
// SCREEN 1: CLAIM SUBMISSION SCREEN
// -------------------------------------------------------------
function renderSubmissionScreen() {
  const container = document.getElementById('app-content');
  const scenario = SCENARIOS[AppState.currentScenarioId];

  // Check upload counts
  const docsCount = Object.values(AppState.uploads.docs).filter(Boolean).length;
  const photosCount = Object.values(AppState.uploads.photos).filter(Boolean).length;

  container.innerHTML = `
    <div class="max-w-4xl mx-auto animate-fade-in-up">
      <!-- Title & Demo Assistant Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200/60">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
              Claim Intake Gateway
            </span>
            <span class="text-xs text-slate-500">Autonomous Instant Adjudication</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 tracking-tight">
            Motor OD Claim Intake &amp; Live Assessment
          </h1>
          <p class="text-sm text-slate-500 mt-1">
            Upload vehicle registration credentials and live damage imagery for multi-model AI reconciliation.
          </p>
        </div>

        <!-- Quick Pitch Demo Auto-Fill button -->
        <div class="flex items-center gap-2">
          <button onclick="autoFillDemoData()" class="px-3.5 py-2 text-xs font-semibold text-indigo-950 bg-white/80 hover:bg-white border border-indigo-200/80 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 group">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-600 group-hover:rotate-12 transition-transform"></i>
            <span>Demo Auto-Fill All</span>
          </button>
        </div>
      </div>

      <!-- Step Stepper Indicator -->
      <div class="glass-card rounded-2xl p-4 sm:p-5 mb-8">
        <div class="flex items-center justify-between relative">
          <!-- Connector line -->
          <div class="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-0"></div>
          <div class="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-900 -z-0 transition-all duration-500"
               style="width: ${AppState.currentStep === 1 ? '0%' : AppState.currentStep === 2 ? '50%' : '100%'}"></div>

          <!-- Step 1 Dot -->
          <div class="step-item relative z-10 flex flex-col items-center cursor-pointer" onclick="goToStep(1)">
            <div class="step-dot w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${AppState.currentStep === 1 ? 'bg-indigo-900 text-white shadow-md' : (docsCount === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600')}">
              ${docsCount === 3 && AppState.currentStep > 1 ? '<i data-lucide="check" class="w-4 h-4"></i>' : '1'}
            </div>
            <span class="text-xs font-semibold mt-2 ${AppState.currentStep === 1 ? 'text-indigo-950 font-bold' : 'text-slate-500'}">
              1. Document Upload
            </span>
            <span class="text-[10px] text-slate-400 font-medium">RC, DL &amp; Intimation</span>
          </div>

          <!-- Step 2 Dot -->
          <div class="step-item relative z-10 flex flex-col items-center cursor-pointer" onclick="goToStep(2)">
            <div class="step-dot w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${AppState.currentStep === 2 ? 'bg-indigo-900 text-white shadow-md' : (photosCount === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600')}">
              ${photosCount === 4 && AppState.currentStep > 2 ? '<i data-lucide="check" class="w-4 h-4"></i>' : '2'}
            </div>
            <span class="text-xs font-semibold mt-2 ${AppState.currentStep === 2 ? 'text-indigo-950 font-bold' : 'text-slate-500'}">
              2. Live Damage Photos
            </span>
            <span class="text-[10px] text-slate-400 font-medium">4-Angle Inspection</span>
          </div>

          <!-- Step 3 Dot -->
          <div class="step-item relative z-10 flex flex-col items-center cursor-pointer" onclick="goToStep(3)">
            <div class="step-dot w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${AppState.currentStep === 3 ? 'bg-indigo-900 text-white shadow-md' : 'bg-slate-200 text-slate-600'}">
              3
            </div>
            <span class="text-xs font-semibold mt-2 ${AppState.currentStep === 3 ? 'text-indigo-950 font-bold' : 'text-slate-500'}">
              3. Review &amp; Submit
            </span>
            <span class="text-[10px] text-slate-400 font-medium">AI Pipeline Trigger</span>
          </div>
        </div>
      </div>

      <!-- STEP CONTENT CONTAINER -->
      <div id="step-content-area">
        ${renderCurrentStepContent()}
      </div>
    </div>
  `;
}

function renderCurrentStepContent() {
  if (AppState.currentStep === 1) {
    return renderStep1Documents();
  } else if (AppState.currentStep === 2) {
    return renderStep2Photos();
  } else {
    return renderStep3Review();
  }
}

// Step 1: Documents Upload
function renderStep1Documents() {
  const rcUploaded = AppState.uploads.docs.rc;
  const dlUploaded = AppState.uploads.docs.dl;
  const formUploaded = AppState.uploads.docs.claimForm;

  return `
    <div class="space-y-6">
      <div class="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
        <div class="p-2 bg-indigo-600 text-white rounded-xl">
          <i data-lucide="file-check-2" class="w-5 h-5"></i>
        </div>
        <div>
          <h4 class="text-sm font-bold text-indigo-950">Intelligent Document Extraction (OCR + VAHAN)</h4>
          <p class="text-xs text-indigo-900/80 mt-0.5 leading-relaxed">
            Drop your vehicle RC Smart Card, Driving Licence, and Signed Claim Intimation. The system extracts 18 key data fields in sub-seconds and matches with Government databases.
          </p>
        </div>
      </div>

      <!-- 3 Glassmorphic Upload Slots -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <!-- Slot 1: RC Book -->
        ${renderDocUploadSlot('rc', 'Registration Certificate (RC)', 'Vahan smartcard or digital DigiLocker PDF', rcUploaded, 'file-badge')}
        
        <!-- Slot 2: Driving License -->
        ${renderDocUploadSlot('dl', 'Driving Licence (DL)', 'Valid LMV private / commercial licence', dlUploaded, 'id-card')}

        <!-- Slot 3: Claim Form -->
        ${renderDocUploadSlot('claimForm', 'Claim Intimation Form', 'Signed statement with incident details', formUploaded, 'file-text')}
      </div>

      <!-- Step Navigation Footer -->
      <div class="flex items-center justify-between pt-4">
        <span class="text-xs text-slate-500 font-medium">
          ${[rcUploaded, dlUploaded, formUploaded].filter(Boolean).length} of 3 documents ready
        </span>
        <button onclick="handleStep1Next()" class="btn-indigo text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2">
          <span>Proceed to Damage Photos</span>
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

function renderDocUploadSlot(docKey, title, subtitle, isUploaded, iconName) {
  return `
    <div class="glass-card rounded-2xl p-5 border ${isUploaded ? 'border-emerald-300/80 bg-emerald-50/20' : 'border-white/80'} flex flex-col justify-between h-full group hover:shadow-lg transition-all">
      <div>
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-xl ${isUploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'} flex items-center justify-center">
            <i data-lucide="${iconName}" class="w-4 h-4"></i>
          </div>
          ${isUploaded ? `
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              <i data-lucide="check-circle-2" class="w-3 h-3"></i> Verified
            </span>
          ` : `
            <span class="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Required</span>
          `}
        </div>
        <h3 class="text-sm font-bold text-slate-900">${title}</h3>
        <p class="text-xs text-slate-500 mt-1 mb-4 leading-normal">${subtitle}</p>

        <!-- Dropzone / Preview Area -->
        ${isUploaded ? `
          <div class="relative rounded-xl overflow-hidden border border-emerald-200 bg-white shadow-sm group/prev cursor-pointer" onclick="openDocPreviewModal('${docKey}')">
            <img src="${MOCK_ASSETS.docs[docKey]}" class="w-full h-36 object-cover" alt="${title} Preview" />
            <div class="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/prev:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
              <i data-lucide="maximize-2" class="w-4 h-4"></i> Inspect OCR Data
            </div>
          </div>
        ` : `
          <div onclick="simulateUploadDoc('${docKey}')"
               class="border-2 border-dashed border-slate-300/90 hover:border-indigo-600/80 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-white/40 hover:bg-indigo-50/30 transition-all">
            <div class="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-700 flex items-center justify-center mb-2 transition-colors">
              <i data-lucide="upload-cloud" class="w-5 h-5"></i>
            </div>
            <p class="text-xs font-semibold text-slate-700">Click to upload or drag &amp; drop</p>
            <p class="text-[10px] text-slate-400 mt-1">PNG, JPG or PDF up to 10MB</p>
          </div>
        `}
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        ${isUploaded ? `
          <button onclick="simulateUploadDoc('${docKey}')" class="text-xs text-indigo-700 font-semibold hover:underline flex items-center gap-1">
            <i data-lucide="refresh-cw" class="w-3 h-3"></i> Replace
          </button>
          <button onclick="clearDocUpload('${docKey}')" class="text-xs text-rose-600 font-medium hover:underline">
            Remove
          </button>
        ` : `
          <button onclick="simulateUploadDoc('${docKey}')" class="text-xs text-indigo-900 font-semibold hover:underline flex items-center gap-1">
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Select Sample File
          </button>
        `}
      </div>
    </div>
  `;
}

// Step 2: Live Damage Photos
function renderStep2Photos() {
  const p = AppState.uploads.photos;
  const photosCount = Object.values(p).filter(Boolean).length;

  return `
    <div class="space-y-6">
      <!-- Live Capture Notice Banner -->
      <div class="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-4 flex items-start gap-3.5">
        <div class="p-2 bg-amber-600 text-white rounded-xl shrink-0 mt-0.5">
          <i data-lucide="camera-off" class="w-5 h-5"></i>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-bold text-amber-950">Live Camera Enforcement Active</h4>
            <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded">Fraud Guard</span>
          </div>
          <p class="text-xs text-amber-900/80 mt-1 leading-relaxed">
            Photos must be captured live through the ClaimPilot in-app optical viewfinder. <strong>Gallery upload is disabled</strong> to prevent recycled images and digital metadata tampering.
          </p>
        </div>
      </div>

      <!-- 4 Photo Slots Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        ${renderPhotoSlot('front', 'Front View', 'Bumper, Grille & Headlamps', p.front)}
        ${renderPhotoSlot('rear', 'Rear View', 'Tailgate, Exhaust & Bumper', p.rear)}
        ${renderPhotoSlot('leftSide', 'Left Side', 'Front/Rear Doors & Fender', p.leftSide)}
        ${renderPhotoSlot('rightSide', 'Right Side', 'Body Panels & Sill', p.rightSide)}
      </div>

      <!-- Step Navigation Footer -->
      <div class="flex items-center justify-between pt-4">
        <button onclick="goToStep(1)" class="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-600 bg-white/70 hover:bg-white border border-slate-200/80 flex items-center gap-2">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          <span>Back to Documents</span>
        </button>

        <div class="flex items-center gap-4">
          <span class="text-xs text-slate-500 font-medium">
            ${photosCount} of 4 angles captured
          </span>
          <button onclick="handleStep2Next()" class="btn-indigo text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2">
            <span>Proceed to Review</span>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderPhotoSlot(photoKey, title, subtitle, isUploaded) {
  return `
    <div class="glass-card rounded-2xl p-4 border ${isUploaded ? 'border-indigo-300 bg-indigo-50/20' : 'border-white/80'} flex flex-col justify-between h-full group hover:shadow-md transition-all">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-slate-900">${title}</span>
          ${isUploaded ? `
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Ready</span>
          ` : `
            <span class="text-[10px] text-slate-400 font-medium">Live Req.</span>
          `}
        </div>
        <p class="text-[11px] text-slate-500 mb-3 line-clamp-1">${subtitle}</p>

        <!-- Capture / Preview Box -->
        ${isUploaded ? `
          <div class="relative rounded-xl overflow-hidden border border-slate-200 bg-black aspect-4/3 group/thumb cursor-pointer" onclick="openPhotoPreviewModal('${photoKey}')">
            <img src="${MOCK_ASSETS.damagePhotos[photoKey]}" class="w-full h-full object-cover" alt="${title}" />
            <div class="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
              <i data-lucide="zoom-in" class="w-4 h-4"></i> View AI Box
            </div>
            <div class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white">
              GPS Verified
            </div>
          </div>
        ` : `
          <div onclick="simulateCapturePhoto('${photoKey}')"
               class="border-2 border-dashed border-slate-300 hover:border-indigo-600 rounded-xl p-6 aspect-4/3 flex flex-col items-center justify-center text-center cursor-pointer bg-white/40 hover:bg-indigo-50/40 transition-all">
            <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-900 flex items-center justify-center mb-2">
              <i data-lucide="camera" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-semibold text-slate-800">Tap to Capture</span>
            <span class="text-[10px] text-slate-400 mt-0.5">Live Viewfinder</span>
          </div>
        `}
      </div>

      <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
        ${isUploaded ? `
          <button onclick="simulateCapturePhoto('${photoKey}')" class="text-[11px] text-indigo-700 font-semibold hover:underline">
            Retake
          </button>
          <button onclick="clearPhoto('${photoKey}')" class="text-[11px] text-rose-600 hover:underline">
            Clear
          </button>
        ` : `
          <button onclick="simulateCapturePhoto('${photoKey}')" class="text-[11px] text-indigo-900 font-semibold hover:underline w-full text-center">
            + Capture Angle
          </button>
        `}
      </div>
    </div>
  `;
}

// Step 3: Review & Submit
function renderStep3Review() {
  const scenario = SCENARIOS[AppState.currentScenarioId];
  const docsCount = Object.values(AppState.uploads.docs).filter(Boolean).length;
  const photosCount = Object.values(AppState.uploads.photos).filter(Boolean).length;

  return `
    <div class="space-y-6">
      <div class="glass-card rounded-2xl p-6 border border-white/90">
        <h3 class="text-lg font-bold text-slate-900 mb-1">Pre-Submission Claim Summary</h3>
        <p class="text-xs text-slate-500 mb-6">Confirm ingested artifacts before invoking the autonomous valuation engine.</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Vehicle & Policy Box -->
          <div class="glass-subcard rounded-xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Vehicle Profile</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-900 font-semibold border border-indigo-100">
                ${scenario.vehicle.year} Model
              </span>
            </div>
            <div>
              <div class="text-base font-bold text-slate-900">${scenario.vehicle.make} ${scenario.vehicle.model}</div>
              <div class="text-xs text-slate-500 mt-0.5">Reg: <span class="font-mono font-semibold text-slate-700">${scenario.vehicle.registration}</span> &bull; ${scenario.vehicle.color} &bull; ${scenario.vehicle.fuel}</div>
            </div>
            <div class="pt-2 border-t border-slate-200/60 text-xs text-slate-600 space-y-1">
              <div><span class="text-slate-400">Policy:</span> <span class="font-mono font-semibold">${scenario.policy.number}</span></div>
              <div><span class="text-slate-400">Policyholder:</span> <span class="font-semibold text-slate-800">${scenario.policy.holder}</span></div>
              <div><span class="text-slate-400">Coverage:</span> <span class="font-medium text-emerald-700">${scenario.policy.plan}</span></div>
            </div>
          </div>

          <!-- Ingested Evidence Checklist -->
          <div class="glass-subcard rounded-xl p-4 space-y-3">
            <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Ingested Telemetry &amp; Evidence</span>
            
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-white/70">
                <span class="flex items-center gap-2 text-slate-700">
                  <i data-lucide="file-check" class="w-4 h-4 text-emerald-600"></i>
                  Document Package
                </span>
                <span class="font-semibold ${docsCount === 3 ? 'text-emerald-700' : 'text-amber-600'}">
                  ${docsCount}/3 Verified
                </span>
              </div>

              <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-white/70">
                <span class="flex items-center gap-2 text-slate-700">
                  <i data-lucide="camera" class="w-4 h-4 text-emerald-600"></i>
                  Live Optical Images
                </span>
                <span class="font-semibold ${photosCount === 4 ? 'text-emerald-700' : 'text-amber-600'}">
                  ${photosCount}/4 Captured (EXIF clean)
                </span>
              </div>

              <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-white/70">
                <span class="flex items-center gap-2 text-slate-700">
                  <i data-lucide="shield-check" class="w-4 h-4 text-indigo-600"></i>
                  Integrity Guard
                </span>
                <span class="font-semibold text-indigo-900">Anti-tamper Armed</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit Call to Action Button -->
        <div class="mt-8 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button onclick="goToStep(2)" class="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-600 bg-white/70 hover:bg-white border border-slate-200/80 flex items-center gap-2">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            <span>Modify Photos</span>
          </button>

          <button onclick="startAiProcessing()" class="btn-indigo text-white px-8 py-4 rounded-2xl font-bold text-base shadow-xl flex items-center gap-3 w-full sm:w-auto justify-center group cursor-pointer">
            <i data-lucide="zap" class="w-5 h-5 text-amber-300 group-hover:scale-110 transition-transform"></i>
            <span>Submit Claim &amp; Run AI Adjudication</span>
            <i data-lucide="arrow-right" class="w-5 h-5 group-hover:translate-x-1 transition-transform"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Stepper helpers
function goToStep(stepNumber) {
  AppState.currentStep = stepNumber;
  renderSubmissionScreen();
}

function handleStep1Next() {
  const docs = AppState.uploads.docs;
  if (!docs.rc || !docs.dl || !docs.claimForm) {
    // Auto-fill remaining docs for smooth presenter flow if missing
    simulateUploadDoc('rc');
    simulateUploadDoc('dl');
    simulateUploadDoc('claimForm');
    showToast('Auto-attached sample documents');
  }
  goToStep(2);
}

function handleStep2Next() {
  const p = AppState.uploads.photos;
  if (!p.front || !p.rear || !p.leftSide || !p.rightSide) {
    simulateCapturePhoto('front');
    simulateCapturePhoto('rear');
    simulateCapturePhoto('leftSide');
    simulateCapturePhoto('rightSide');
    showToast('Auto-captured 4-angle damage views');
  }
  goToStep(3);
}

function autoFillDemoData() {
  AppState.uploads.docs.rc = MOCK_ASSETS.docs.rc;
  AppState.uploads.docs.dl = MOCK_ASSETS.docs.dl;
  AppState.uploads.docs.claimForm = MOCK_ASSETS.docs.claimForm;
  AppState.uploads.photos.front = MOCK_ASSETS.damagePhotos.front;
  AppState.uploads.photos.rear = MOCK_ASSETS.damagePhotos.rear;
  AppState.uploads.photos.leftSide = MOCK_ASSETS.damagePhotos.leftSide;
  AppState.uploads.photos.rightSide = MOCK_ASSETS.damagePhotos.rightSide;
  AppState.currentStep = 3;
  renderSubmissionScreen();
  showToast('All documents and live photos auto-filled!');
}

function simulateUploadDoc(docKey) {
  AppState.uploads.docs[docKey] = MOCK_ASSETS.docs[docKey];
  renderSubmissionScreen();
  showToast(`Attached ${docKey.toUpperCase()} certificate`);
}

function clearDocUpload(docKey) {
  AppState.uploads.docs[docKey] = null;
  renderSubmissionScreen();
}

function simulateCapturePhoto(photoKey) {
  AppState.uploads.photos[photoKey] = MOCK_ASSETS.damagePhotos[photoKey];
  renderSubmissionScreen();
  showToast(`Captured ${photoKey} optical frame`);
}

function clearPhoto(photoKey) {
  AppState.uploads.photos[photoKey] = null;
  renderSubmissionScreen();
}

// -------------------------------------------------------------
// AI PROCESSING SIMULATION SCREEN (Alive & Dynamic)
// -------------------------------------------------------------
const PROCESSING_STAGES = [
  {
    title: "Document Extraction & Anti-Tamper",
    desc: "Running OCR on Registration Certificate and Sarathi DL records...",
    icon: "file-search",
    duration: 700
  },
  {
    title: "Computer Vision Damage Segmentation",
    desc: "Detecting impact zones, dent depth & OEM part boundaries...",
    icon: "scan-line",
    duration: 800
  },
  {
    title: "Multi-Source Cost Reconciliation",
    desc: "Reconciling historical claims DB with real-time spare parts catalog...",
    icon: "git-merge",
    duration: 750
  },
  {
    title: "Fraud & Geolocation Parity Checks",
    desc: "Validating perceptual image hashes against 14k prior claims...",
    icon: "shield-alert",
    duration: 650
  },
  {
    title: "Autonomous Adjudication Synthesis",
    desc: "Compiling decision matrix and regulatory audit trail...",
    icon: "sparkles",
    duration: 600
  }
];

function startAiProcessing() {
  setScreen('processing');
  AppState.processingStep = 0;
  AppState.processingProgress = 5;

  function runStage(index) {
    if (index >= PROCESSING_STAGES.length) {
      setTimeout(() => {
        setScreen('dashboard');
        showToast('Claim analysis complete!');
      }, 400);
      return;
    }

    AppState.processingStep = index;
    AppState.processingProgress = Math.min(100, Math.round(((index + 1) / PROCESSING_STAGES.length) * 100));
    renderProcessingScreen();

    setTimeout(() => {
      runStage(index + 1);
    }, PROCESSING_STAGES[index].duration);
  }

  runStage(0);
}

function renderProcessingScreen() {
  const container = document.getElementById('app-content');
  const stage = PROCESSING_STAGES[AppState.processingStep] || PROCESSING_STAGES[0];

  container.innerHTML = `
    <div class="max-w-2xl mx-auto py-12 px-4 animate-fade-in-up">
      <div class="glass-card rounded-3xl p-8 sm:p-10 border border-white/90 text-center relative overflow-hidden shadow-2xl">
        <!-- Ambient animated backdrop glow -->
        <div class="absolute -top-24 -left-24 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Center Pulse Ring Icon -->
        <div class="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-indigo-600/15 animate-ping"></div>
          <div class="absolute inset-2 rounded-full bg-indigo-600/25 animate-pulse"></div>
          <div class="w-16 h-16 rounded-2xl bg-indigo-900 text-white flex items-center justify-center shadow-lg relative z-10">
            <i data-lucide="${stage.icon}" class="w-8 h-8 text-indigo-200"></i>
          </div>
        </div>

        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200/80 mb-3">
          <span class="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          AI Agent Swarm In Progress
        </div>

        <h2 class="text-2xl font-bold font-display text-slate-900 mb-2">
          ${stage.title}
        </h2>
        <p class="text-sm text-slate-600 max-w-md mx-auto mb-8 h-10 leading-relaxed">
          ${stage.desc}
        </p>

        <!-- Progress Bar -->
        <div class="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-0.5 border border-white/60 mb-6">
          <div class="h-full bg-gradient-to-r from-indigo-900 via-indigo-600 to-indigo-400 rounded-full transition-all duration-500 ease-out shimmer-overlay"
               style="width: ${AppState.processingProgress}%"></div>
        </div>

        <!-- Processing Step Badges -->
        <div class="grid grid-cols-5 gap-2 pt-2 border-t border-slate-200/60">
          ${PROCESSING_STAGES.map((st, i) => {
            const isDone = i < AppState.processingStep;
            const isCurrent = i === AppState.processingStep;
            return `
              <div class="flex flex-col items-center gap-1 text-[10px] font-semibold ${isDone ? 'text-emerald-700' : isCurrent ? 'text-indigo-900 font-bold' : 'text-slate-400'}">
                <div class="w-6 h-6 rounded-full flex items-center justify-center ${isDone ? 'bg-emerald-100 text-emerald-700' : isCurrent ? 'bg-indigo-900 text-white ring-2 ring-indigo-300' : 'bg-slate-100 text-slate-400'}">
                  ${isDone ? '<i data-lucide="check" class="w-3 h-3"></i>' : (i + 1)}
                </div>
                <span class="truncate max-w-[60px] hidden sm:inline">${st.title.split(' ')[0]}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// SCREEN 2: CLAIM RESULT / DASHBOARD SCREEN (The Centerpiece)
// -------------------------------------------------------------
function renderDashboard() {
  const container = document.getElementById('app-content');
  const data = SCENARIOS[AppState.currentScenarioId];

  // Helper for Status Badge styling
  let statusBadgeHtml = '';
  if (data.status === 'auto_approved') {
    statusBadgeHtml = `
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-800 border border-emerald-300/80 shadow-sm shadow-emerald-900/5">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Auto-Approved</span>
      </div>
    `;
  } else if (data.status === 'under_review') {
    statusBadgeHtml = `
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-amber-50 text-amber-800 border border-amber-300/80 shadow-sm shadow-amber-900/5">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
        <span>Resolved via AI Review</span>
      </div>
    `;
  } else {
    statusBadgeHtml = `
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-rose-50 text-rose-800 border border-rose-300/80 shadow-sm shadow-rose-900/5">
        <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
        <span>Flagged for Human Review</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-16">
      
      <!-- Top Action Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <button onclick="setScreen('submission')" class="p-2 rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            <span>New Claim</span>
          </button>
          <div>
            <div class="text-xs text-slate-500 font-medium">Claim Case Summary</div>
            <div class="text-sm font-bold text-slate-900 font-mono">${data.claim_id}</div>
          </div>
        </div>

        <!-- Quick Summary Actions -->
        <div class="flex items-center gap-2">
          <button onclick="openExportModal()" class="px-3.5 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-sm text-xs font-semibold flex items-center gap-2 transition-all">
            <i data-lucide="download" class="w-3.5 h-3.5 text-indigo-700"></i>
            <span>Export Case Summary (JSON / PDF)</span>
          </button>
          <button onclick="runLiveRecheck()" class="px-3.5 py-2 rounded-xl btn-indigo text-white shadow-sm text-xs font-semibold flex items-center gap-2">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Re-verify Signals</span>
          </button>
        </div>
      </div>

      <!-- CARD A: HEADER CARD -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 relative overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2.5 mb-2">
              <span class="font-mono text-sm font-bold text-indigo-950 bg-indigo-100/70 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                ${data.claim_id}
              </span>
              <span class="text-xs text-slate-500 font-medium flex items-center gap-1">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                ${data.submission_timestamp}
              </span>
            </div>

            <h1 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 tracking-tight">
              ${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.year})
            </h1>

            <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-600 mt-2">
              <span>Registration: <strong class="font-mono text-slate-800">${data.vehicle.registration}</strong></span>
              <span class="text-slate-300">&bull;</span>
              <span>Policy: <strong class="font-mono text-slate-800">${data.policy.number}</strong></span>
              <span class="text-slate-300">&bull;</span>
              <span>Policyholder: <strong class="text-slate-800">${data.policy.holder}</strong></span>
            </div>
          </div>

          <!-- Large Status Badge Box -->
          <div class="flex flex-col items-start md:items-end gap-1.5 shrink-0">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Adjudication Status</div>
            ${statusBadgeHtml}
            <div class="text-[11px] text-slate-500 max-w-[260px] md:text-right mt-1">
              ${data.status_description}
            </div>
          </div>
        </div>
      </div>

      <!-- 2-COLUMN GRID (Document Verification + Damage Assessment) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- CARD B: DOCUMENT VERIFICATION CARD -->
        <div class="glass-card rounded-3xl p-6 border border-white/90 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
                  <i data-lucide="file-check-2" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Document Verification</h3>
                  <p class="text-[11px] text-slate-500">Government DB &amp; Optical OCR Parity</p>
                </div>
              </div>

              <span class="text-xs font-bold font-mono px-2.5 py-1 rounded-full ${data.document_check.overall_status === 'verified' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : (data.document_check.overall_status === 'resolved' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-800 border border-rose-200')}">
                ${data.document_check.confidence_score}% Score
              </span>
            </div>

            <!-- List of Checked Fields -->
            <div class="space-y-3 mt-4">
              ${data.document_check.fields.map(f => {
                const isPass = f.status === 'verified';
                const isResolved = f.status === 'resolved';
                const isWarn = f.status === 'warning';
                
                return `
                  <div class="p-3 rounded-2xl bg-white/70 border border-slate-200/70 hover:bg-white transition-all space-y-1.5">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full flex items-center justify-center ${isPass ? 'bg-emerald-100 text-emerald-700' : (isResolved ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}">
                          <i data-lucide="${isPass ? 'check' : (isResolved ? 'sparkles' : 'alert-triangle')}" class="w-3 h-3"></i>
                        </span>
                        <span class="text-xs font-bold text-slate-800">${f.name}</span>
                      </div>

                      <div class="flex items-center gap-2">
                        ${f.isResolved ? `
                          <span class="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            Resolved via AI review
                          </span>
                        ` : ''}
                        <span class="text-[11px] font-mono font-bold text-slate-700">${Math.round(f.confidence * 100)}%</span>
                      </div>
                    </div>

                    <div class="flex items-center justify-between text-xs text-slate-600 pl-7">
                      <span class="font-mono text-slate-900 font-semibold">${f.value}</span>
                    </div>
                    
                    <div class="text-[11px] text-slate-500 pl-7 flex items-center gap-1">
                      <i data-lucide="info" class="w-3 h-3 text-slate-400 shrink-0"></i>
                      <span>${f.note}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span class="text-[11px] text-slate-500 font-medium">Digital Vahan &amp; Sarathi Ledger</span>
            <button onclick="openDocPreviewModal('rc')" class="text-xs font-bold text-indigo-800 hover:underline flex items-center gap-1">
              <span>View Extracted RC</span>
              <i data-lucide="external-link" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- CARD C: DAMAGE ASSESSMENT CARD -->
        <div class="glass-card rounded-3xl p-6 border border-white/90 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
                  <i data-lucide="scan-line" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Damage Assessment</h3>
                  <p class="text-[11px] text-slate-500">Computer Vision Pixel Localization</p>
                </div>
              </div>

              <!-- Severity & Tier Badges -->
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${data.damage_assessment.severity === 'minor' ? 'bg-emerald-100 text-emerald-800' : (data.damage_assessment.severity === 'moderate' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}">
                  ${data.damage_assessment.severity_label}
                </span>
                <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  ${data.damage_assessment.vehicle_tier_label}
                </span>
              </div>
            </div>

            <!-- Uploaded Photos Grid -->
            <div class="grid grid-cols-4 gap-2 mb-4">
              ${data.damage_assessment.photos.map((ph, idx) => {
                const keys = ['front', 'rear', 'leftSide', 'rightSide'];
                return `
                  <div onclick="openPhotoPreviewModal('${keys[idx]}')" class="group/p relative rounded-xl overflow-hidden aspect-square border border-slate-200/80 bg-slate-950 cursor-pointer shadow-sm hover:ring-2 hover:ring-indigo-600 transition-all">
                    <img src="${ph.url}" class="w-full h-full object-cover group-hover/p:scale-105 transition-transform" alt="${ph.slot}" />
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/p:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <i data-lucide="zoom-in" class="w-4 h-4"></i>
                    </div>
                    ${ph.flagged ? `
                      <span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white"></span>
                    ` : ''}
                    <div class="absolute bottom-0 inset-x-0 bg-slate-900/80 text-slate-200 text-[9px] font-medium px-1 py-0.5 text-center truncate">
                      ${ph.slot.split(' ')[0]}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Detected Parts Breakdown -->
            <div class="space-y-2">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Identified Component Anomalies</span>
              ${data.damage_assessment.detected_parts.map(dp => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-slate-200/60 text-xs">
                  <div>
                    <div class="font-bold text-slate-800">${dp.part}</div>
                    <div class="text-[11px] text-slate-500">${dp.type} &bull; <span class="text-indigo-900 font-semibold">${dp.action}</span></div>
                  </div>
                  <span class="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    ${dp.confidence}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Primary Impact Zone: <strong class="text-slate-800">${data.damage_assessment.location_label}</strong>
          </div>
        </div>
      </div>

      <!-- CARD D: COST RECONCILIATION CARD (THE CENTERPIECE) -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border-2 border-indigo-100/90 shadow-xl relative overflow-hidden bg-gradient-to-br from-white/90 via-white/80 to-indigo-50/40">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/70">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-900 text-white flex items-center gap-1.5 shadow-sm">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-amber-300"></i>
                Multi-Agent Cost Engine
              </span>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full ${data.cost_estimate.confidence === 'high' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : (data.cost_estimate.confidence === 'medium' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-rose-100 text-rose-800 border border-rose-200')}">
                ${data.cost_estimate.confidence_label}
              </span>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold font-display text-slate-900">
              Autonomous Cost Reconciliation
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              Real-time cross-triangulation between Vision AI, Regional Insurance Ledgers, and OEM Parts Pricing.
            </p>
          </div>

          <!-- Large Prominent Estimated Range Display -->
          <div class="bg-white/90 border border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col items-start lg:items-end">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Final Reconciled Range</div>
            <div class="text-3xl sm:text-4xl font-extrabold font-display text-indigo-950 tracking-tight my-0.5">
              ${data.cost_estimate.formatted_final}
            </div>
            <div class="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <span>Recommended Median:</span>
              <strong class="text-emerald-700 font-mono text-sm">${data.cost_estimate.recommended_payout}</strong>
            </div>
          </div>
        </div>

        <!-- Sources Comparison Rows with Range Bars -->
        <div class="mt-6 space-y-4">
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">Comparative Model Breakdown</div>
          
          <div class="space-y-3">
            ${data.cost_estimate.sources.map(src => {
              // Calculate width and left percentage relative to global scale
              const globalMax = data.cost_estimate.final_high * 1.25;
              const leftPct = Math.round((src.low / globalMax) * 100);
              const widthPct = Math.max(10, Math.round(((src.high - src.low) / globalMax) * 100));

              return `
                <div class="p-4 rounded-2xl bg-white/75 border border-slate-200/70 hover:bg-white transition-all space-y-2.5">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-xl bg-slate-100 text-indigo-950 flex items-center justify-center shrink-0">
                        <i data-lucide="${src.icon}" class="w-4 h-4"></i>
                      </div>
                      <div>
                        <div class="text-sm font-bold text-slate-900">${src.label}</div>
                        <div class="text-[11px] text-slate-500">${src.desc}</div>
                      </div>
                    </div>

                    <div class="text-right">
                      <div class="text-sm font-extrabold font-mono text-slate-900">${src.formatted}</div>
                    </div>
                  </div>

                  <!-- Relative Visual Range Bar -->
                  <div class="range-bar-track">
                    <div class="range-bar-fill" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Reasoning Line -->
        <div class="mt-6 p-4 rounded-2xl ${data.cost_estimate.confidence === 'high' ? 'bg-emerald-50/70 border border-emerald-200 text-emerald-950' : (data.cost_estimate.confidence === 'medium' ? 'bg-amber-50/70 border border-amber-200 text-amber-950' : 'bg-rose-50/70 border border-rose-200 text-rose-950')} flex items-start gap-3">
          <div class="p-1 rounded-lg ${data.cost_estimate.confidence === 'high' ? 'bg-emerald-600 text-white' : (data.cost_estimate.confidence === 'medium' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white')} shrink-0 mt-0.5">
            <i data-lucide="${data.cost_estimate.confidence === 'high' ? 'check-circle' : 'alert-circle'}" class="w-4 h-4"></i>
          </div>
          <div class="text-xs leading-relaxed font-medium">
            <strong>Reconciliation Logic:</strong> ${data.cost_estimate.reasoning}
          </div>
        </div>

        <!-- IRDAI Regulatory Disclaimer -->
        <div class="mt-4 pt-4 border-t border-slate-200/60 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
          <i data-lucide="shield" class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"></i>
          <span>${data.cost_estimate.disclaimer}</span>
        </div>
      </div>

      <!-- 2-COLUMN GRID (Fraud & Consistency Checks + Decision Trail) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- CARD E: FRAUD & CONSISTENCY CHECKS CARD -->
        <div class="glass-card rounded-3xl p-6 border border-white/90 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
                  <i data-lucide="shield-check" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Fraud &amp; Anomaly Gates</h3>
                  <p class="text-[11px] text-slate-500">Perceptual Hash &amp; Metadata Verification</p>
                </div>
              </div>

              <span class="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                4 Gates
              </span>
            </div>

            <!-- Checklist -->
            <div class="space-y-3 mt-4">
              ${data.fraud_checks.map(fc => {
                const isPassed = fc.status === 'passed';
                return `
                  <div class="p-3 rounded-2xl bg-white/70 border border-slate-200/70 space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-800">${fc.name}</span>
                      <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        <i data-lucide="${isPassed ? 'check' : 'alert-circle'}" class="w-3 h-3"></i>
                        ${isPassed ? 'Passed' : 'Flagged'}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-500 leading-normal">${fc.detail}</p>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Insurance Fraud Registry: Clear</span>
            <span class="font-mono">Hash #3a9f02</span>
          </div>
        </div>

        <!-- CARD F: DECISION & REASONING TRAIL CARD -->
        <div class="glass-card rounded-3xl p-6 border border-white/90 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
                  <i data-lucide="git-commit" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Decision &amp; Reasoning Trail</h3>
                  <p class="text-[11px] text-slate-500">Autonomous Step-by-Step Audit Story</p>
                </div>
              </div>
            </div>

            <!-- Vertical Timeline -->
            <div class="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              ${data.decision_trail.map((step, idx) => {
                const isSuccess = step.status === 'success' || step.status === 'completed';
                const isWarning = step.status === 'warning';
                const isConflict = step.status === 'conflict' || step.status === 'flagged';

                return `
                  <div class="relative">
                    <!-- Dot -->
                    <div class="absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${isSuccess ? 'bg-emerald-600' : (isWarning ? 'bg-amber-500' : 'bg-rose-600')}"></div>
                    
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-900">${step.step}</span>
                      <span class="text-[10px] font-mono text-slate-400">${step.timestamp || ''}</span>
                    </div>
                    <div class="text-xs font-semibold ${isSuccess ? 'text-emerald-700' : (isWarning ? 'text-amber-700' : 'text-rose-700')}">
                      ${step.outcome}
                    </div>
                    <div class="text-[11px] text-slate-500 mt-0.5">${step.detail}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
            ${data.status === 'auto_approved' ? `
              <button onclick="triggerSettlementPayout()" class="btn-indigo text-white text-xs font-bold py-2.5 px-4 rounded-xl flex-1 flex items-center justify-center gap-2 shadow-sm">
                <i data-lucide="send" class="w-3.5 h-3.5"></i>
                <span>Disburse Instant Settlement</span>
              </button>
            ` : (data.status === 'under_review' ? `
              <button onclick="triggerConditionalApproval()" class="btn-indigo text-white text-xs font-bold py-2.5 px-4 rounded-xl flex-1 flex items-center justify-center gap-2 shadow-sm">
                <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
                <span>Confirm AI Resolution Note</span>
              </button>
            ` : `
              <button onclick="triggerSurveyorRouting()" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex-1 flex items-center justify-center gap-2 shadow-sm">
                <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
                <span>Assign IRDAI Field Surveyor</span>
              </button>
            `)}
          </div>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// INTERACTIVE MODALS & PREVIEWS
// -------------------------------------------------------------
function openDocPreviewModal(docKey) {
  const scenario = SCENARIOS[AppState.currentScenarioId];
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  const docTitle = docKey === 'rc' ? 'Registration Certificate (RC)' : docKey === 'dl' ? 'Driving License (DL)' : 'Claim Intimation Form';

  modal.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in-up" onclick="closeModal(event)">
      <div class="glass-card rounded-3xl p-6 max-w-2xl w-full bg-white/95 border border-white shadow-2xl relative" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-bold text-slate-900">${docTitle}</h3>
            <p class="text-xs text-slate-500">Optical Character Recognition &amp; Vahan API Layer</p>
          </div>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="my-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex items-center justify-center">
          <img src="${MOCK_ASSETS.docs[docKey]}" class="w-full max-h-80 object-contain rounded-xl" alt="${docTitle}" />
        </div>

        <div class="bg-indigo-50/70 rounded-xl p-3 text-xs text-indigo-950 flex items-center justify-between">
          <span class="flex items-center gap-1.5">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
            Digital Signature Verified: <strong>VAHAN-IND-OK</strong>
          </span>
          <span class="font-mono text-slate-500 font-semibold">Hash: 8f92a188</span>
        </div>

        <div class="mt-4 flex justify-end">
          <button onclick="closeModal()" class="btn-indigo text-white text-xs font-semibold px-4 py-2 rounded-xl">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function openPhotoPreviewModal(photoKey) {
  const scenario = SCENARIOS[AppState.currentScenarioId];
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  const photoTitle = photoKey === 'front' ? 'Front Angle Bounding Box' : photoKey === 'rear' ? 'Rear View Inspection' : photoKey === 'leftSide' ? 'Left Profile Analysis' : 'Right Profile Analysis';

  modal.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in-up" onclick="closeModal(event)">
      <div class="glass-card rounded-3xl p-6 max-w-2xl w-full bg-white/95 border border-white shadow-2xl relative" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-bold text-slate-900">${photoTitle}</h3>
            <p class="text-xs text-slate-500">Computer Vision Damage Bounding Box &amp; Depth Segmentation</p>
          </div>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="my-4 rounded-2xl overflow-hidden border border-slate-800 bg-black p-1 flex items-center justify-center">
          <img src="${MOCK_ASSETS.damagePhotos[photoKey]}" class="w-full max-h-96 object-contain rounded-xl" alt="${photoTitle}" />
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-100 text-slate-700">
            <div class="text-[10px] text-slate-400 uppercase font-bold">Metadata Status</div>
            <div class="font-semibold text-slate-900">Live Viewfinder Capture (Anti-Spoof OK)</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-100 text-slate-700">
            <div class="text-[10px] text-slate-400 uppercase font-bold">Model Confidence</div>
            <div class="font-semibold text-emerald-700">96.4% Pixel Segmentation</div>
          </div>
        </div>

        <div class="mt-4 flex justify-end">
          <button onclick="closeModal()" class="btn-indigo text-white text-xs font-semibold px-4 py-2 rounded-xl">
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function openExportModal() {
  const scenario = SCENARIOS[AppState.currentScenarioId];
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  const jsonStr = JSON.stringify(scenario, null, 2);

  modal.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in-up" onclick="closeModal(event)">
      <div class="glass-card rounded-3xl p-6 max-w-3xl w-full bg-white/95 border border-white shadow-2xl relative" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Export Case Summary</h3>
            <p class="text-xs text-slate-500">Structured JSON payload &amp; IRDAI compliant audit package</p>
          </div>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="my-4">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>API Response Payload (${scenario.claim_id})</span>
            <button onclick="copyDossierJson()" class="text-indigo-700 hover:underline flex items-center gap-1">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy JSON
            </button>
          </div>
          <pre class="bg-slate-900 text-indigo-200 p-4 rounded-2xl text-xs font-mono max-h-72 overflow-y-auto">${jsonStr}</pre>
        </div>

        <div class="flex items-center justify-between pt-2">
          <button onclick="simulatePdfDownload()" class="btn-indigo text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            <span>Download Case Summary PDF</span>
          </button>

          <button onclick="closeModal()" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeModal() {
  const modal = document.getElementById('app-modal');
  if (modal) modal.classList.add('hidden');
}

function copyDossierJson() {
  const scenario = SCENARIOS[AppState.currentScenarioId];
  navigator.clipboard.writeText(JSON.stringify(scenario, null, 2));
  showToast('JSON copied to clipboard!');
}

function simulatePdfDownload() {
  showToast('Generating official IRDAI claim settlement PDF...');
  setTimeout(() => {
    showToast('Case summary downloaded successfully.');
  }, 1200);
}

function runLiveRecheck() {
  showToast('Re-verifying real-time parts index & Vahan status...');
  setTimeout(() => {
    showToast('All signals synchronized.');
  }, 900);
}

function triggerSettlementPayout() {
  showToast('Initiating instant UPI / IMPS settlement of ' + SCENARIOS[AppState.currentScenarioId].cost_estimate.recommended_payout + '...');
}

function triggerConditionalApproval() {
  showToast('AI Resolution Note appended to policyholder file.');
}

function triggerSurveyorRouting() {
  showToast('Dispatched survey request to licensed IRDAI surveyor.');
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;

  toast.innerHTML = `
    <div class="glass-card rounded-2xl px-4 py-3 bg-slate-900/90 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 border border-slate-700 animate-fade-in-up">
      <i data-lucide="info" class="w-4 h-4 text-indigo-400"></i>
      <span>${message}</span>
    </div>
  `;
  toast.classList.remove('hidden');
  lucide.createIcons();

  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// Navigation event listeners
function initEventListeners() {
  const navSubmission = document.getElementById('nav-btn-submission');
  const navDashboard = document.getElementById('nav-btn-dashboard');

  if (navSubmission) {
    navSubmission.addEventListener('click', () => setScreen('submission'));
  }
  if (navDashboard) {
    navDashboard.addEventListener('click', () => setScreen('dashboard'));
  }
}
