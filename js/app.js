/**
 * ClaimPilot AI - Production Single Page Application Core Controller
 * Modular multi-view architecture with Auth, User Dashboard, Claim Detail, and Admin Portal
 */

// ==============================================================================
// 1. APPLICATION STATE & ROUTER
// ==============================================================================

const AppState = {
  // Authentication & Persona
  currentUser: MOCK_USERS.claimant, // MOCK_USERS.claimant | MOCK_USERS.admin | null
  
  // Navigation Router:
  // 'login' | 'signup' | 'user-dashboard' | 'claim-submission' | 'claim-processing' | 'claim-detail' | 'admin-dashboard' | 'admin-claim-detail'
  currentView: 'user-dashboard',
  selectedClaimId: 'CLM-2026-00842',
  
  // Claims Database in local memory
  claims: JSON.parse(JSON.stringify(ALL_CLAIMS_DATABASE)),
  adminOverrides: {}, // { [claimId]: { overrideStatus, reviewerName, reviewNote, timestamp } }
  
  // UI Edge States for Testing: 'normal' | 'loading' | 'error' | 'empty'
  uiState: 'normal',
  errorMessage: 'Unable to load claim records. Connection to microservice timed out.',
  
  // Filters & Search
  claimantFilter: 'all', // 'all' | 'auto_approved' | 'under_review' | 'flagged'
  adminFilter: 'needs_action', // 'all' | 'needs_action' | 'auto_approved' | 'under_review' | 'flagged'
  searchQuery: '',
  adminSortBy: 'date_desc', // 'date_desc' | 'date_asc' | 'cost_desc' | 'cost_asc'

  // Claim Submission Uploads State
  currentStep: 1, // 1: Documents, 2: Photos, 3: Review
  uploads: {
    docs: { rc: null, dl: null, claimForm: null },
    photos: { front: null, rear: null, leftSide: null, rightSide: null }
  },

  // Modals & Active Overlays
  activeModal: null // { type, data }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Restore session or default to claimant dashboard
  if (!AppState.currentUser) {
    AppState.currentView = 'login';
  }
  renderApp();
});

// Main Render Dispatcher
function renderApp() {
  renderHeader();
  renderCurrentView();
  setTimeout(() => lucide.createIcons(), 30);
}

function navigateTo(viewName, claimId = null) {
  AppState.currentView = viewName;
  if (claimId) {
    AppState.selectedClaimId = claimId;
  }
  AppState.uiState = 'normal'; // Reset edge state on navigation
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ------------------------------------------------------------------------------
// 2. PERSISTENT HEADER & APP SHELL
// ------------------------------------------------------------------------------

function renderHeader() {
  const headerContainer = document.querySelector('header');
  if (!headerContainer) return;

  const user = AppState.currentUser;
  const isAdmin = user && user.role === 'admin';
  const isAuthPage = AppState.currentView === 'login' || AppState.currentView === 'signup';

  headerContainer.innerHTML = `
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      
      <!-- Brand & Version Tag -->
      <div class="flex items-center gap-3 cursor-pointer" onclick="handleBrandClick()">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-950 via-indigo-900 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-950/20 border border-white/40">
          <i data-lucide="shield-check" class="w-5 h-5 text-indigo-200"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-display font-extrabold text-xl text-slate-900 tracking-tight">ClaimPilot<span class="text-indigo-700">.ai</span></span>
            <span class="text-[10px] font-bold uppercase tracking-wider bg-indigo-100/90 text-indigo-950 px-2 py-0.5 rounded-full border border-indigo-200">
              Autonomous v2.4
            </span>
          </div>
          <p class="text-[11px] text-slate-500 font-medium">Motor OD Claims &amp; IRDAI Adjudication</p>
        </div>
      </div>

      ${!isAuthPage && user ? `
        <!-- Main Navigation Links -->
        <nav class="flex items-center p-1 rounded-2xl glass-subcard border border-white/80 shadow-xs" aria-label="Main Navigation">
          ${!isAdmin ? `
            <button onclick="navigateTo('user-dashboard')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${AppState.currentView === 'user-dashboard' ? 'bg-indigo-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/60'}">
              <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
              <span>My Claims</span>
            </button>
            <button onclick="startNewClaimFlow()" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${AppState.currentView === 'claim-submission' ? 'bg-indigo-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/60'}">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              <span>File New Claim</span>
            </button>
          ` : `
            <button onclick="navigateTo('admin-dashboard')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${AppState.currentView === 'admin-dashboard' ? 'bg-indigo-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/60'}">
              <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-300"></i>
              <span>Surveyor Action Queue</span>
            </button>
            <button onclick="setAdminFilter('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${AppState.currentView === 'admin-dashboard' && AppState.adminFilter === 'all' ? 'bg-indigo-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/60'}">
              <i data-lucide="layers" class="w-3.5 h-3.5"></i>
              <span>All Claims Ledger</span>
            </button>
          `}
        </nav>

        <!-- User Profile & Logout -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/90 border border-slate-200 shadow-xs">
            <img src="${user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}" class="w-7 h-7 rounded-full ring-2 ${isAdmin ? 'ring-rose-500' : 'ring-indigo-600'} object-cover" alt="${user.name}" />
            <div class="text-left hidden sm:block">
              <div class="text-xs font-bold text-slate-800 leading-tight">${user.name}</div>
              <div class="text-[10px] font-bold ${isAdmin ? 'text-rose-600' : 'text-indigo-700'} uppercase tracking-wider">${isAdmin ? 'Surveyor / Admin' : 'Policyholder'}</div>
            </div>
          </div>

          <!-- Logout -->
          <button onclick="handleLogout()" title="Sign Out" class="w-9 h-9 rounded-2xl bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 flex items-center justify-center transition-all shadow-xs cursor-pointer">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </div>
      ` : `
        <!-- Auth Header Links -->
        <div class="flex items-center gap-2">
          <button onclick="navigateTo('login')" class="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-white/80 rounded-xl transition-all">
            Login
          </button>
          <button onclick="navigateTo('signup')" class="px-4 py-2 text-xs font-bold text-white bg-indigo-900 hover:bg-indigo-950 rounded-xl shadow-sm transition-all">
            Sign Up
          </button>
        </div>
      `}

    </div>
  `;
}

function handleBrandClick() {
  if (!AppState.currentUser) {
    navigateTo('login');
  } else if (AppState.currentUser.role === 'admin') {
    navigateTo('admin-dashboard');
  } else {
    navigateTo('user-dashboard');
  }
}

function switchPersona(role) {
  if (role === 'admin') {
    AppState.currentUser = MOCK_USERS.admin;
    showToast('Switched to Insurance Surveyor / Admin Persona');
    navigateTo('admin-dashboard');
  } else {
    AppState.currentUser = MOCK_USERS.claimant;
    showToast('Switched to Claimant Persona');
    navigateTo('user-dashboard');
  }
}

function setUiState(state) {
  AppState.uiState = state;
  renderApp();
  showToast(`Simulating ${state.toUpperCase()} UI state`);
}

function handleLogout() {
  AppState.currentUser = null;
  showToast('Logged out successfully');
  navigateTo('login');
}

// ------------------------------------------------------------------------------
// 3. VIEW ROUTER DISPATCHER
// ------------------------------------------------------------------------------

function renderCurrentView() {
  const container = document.getElementById('app-content');
  if (!container) return;

  // 1. Edge state overrides
  if (AppState.uiState === 'loading') {
    renderLoadingSkeleton(container);
    return;
  }
  if (AppState.uiState === 'error') {
    renderErrorState(container);
    return;
  }
  if (AppState.uiState === 'empty') {
    renderEmptyState(container);
    return;
  }

  // 2. Main View Routing
  switch (AppState.currentView) {
    case 'login':
      renderLoginView(container);
      break;
    case 'signup':
      renderSignupView(container);
      break;
    case 'user-dashboard':
      renderUserDashboardView(container);
      break;
    case 'claim-submission':
      renderSubmissionScreen(container);
      break;
    case 'claim-processing':
      renderProcessingScreen(container);
      break;
    case 'claim-detail':
      renderClaimDetailView(container, AppState.selectedClaimId, false);
      break;
    case 'admin-dashboard':
      renderAdminDashboardView(container);
      break;
    case 'admin-claim-detail':
      renderClaimDetailView(container, AppState.selectedClaimId, true);
      break;
    default:
      renderUserDashboardView(container);
  }
}

// ------------------------------------------------------------------------------
// 4. AUTH VIEWS: LOGIN & SIGNUP (With Validation & Loading States)
// ------------------------------------------------------------------------------

function renderLoginView(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto my-8 animate-fade-in-up">
      <div class="glass-card rounded-3xl p-8 border border-white/90 shadow-2xl relative overflow-hidden">
        
        <!-- Header -->
        <div class="text-center mb-6">
          <div class="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-950 via-indigo-900 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-900/30 border border-white/40 mb-3">
            <i data-lucide="shield-check" class="w-7 h-7 text-indigo-200"></i>
          </div>
          <h1 class="text-2xl font-extrabold font-display text-slate-900">Welcome to ClaimPilot.ai</h1>
          <p class="text-xs text-slate-500 mt-1">Autonomous Motor OD Adjudication Gateway</p>
        </div>

        <!-- Quick Demo Credentials Auto-Fill Banner -->
        <div class="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200/70 mb-5 flex items-center justify-between">
          <div class="text-[11px] text-indigo-950">
            <span class="font-bold">Demo Quick Fill:</span>
            <div class="text-slate-500">Pick a persona to test instantly</div>
          </div>
          <div class="flex gap-1.5">
            <button onclick="fillLoginCredentials('claimant')" class="px-2.5 py-1 text-[10px] font-bold bg-white text-indigo-900 border border-indigo-200 rounded-lg shadow-xs hover:bg-indigo-50">
              Claimant
            </button>
            <button onclick="fillLoginCredentials('admin')" class="px-2.5 py-1 text-[10px] font-bold bg-indigo-900 text-white rounded-lg shadow-xs hover:bg-indigo-950">
              Surveyor
            </button>
          </div>
        </div>

        <!-- Login Form -->
        <form id="login-form" onsubmit="handleLoginSubmit(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Work or Personal Email</label>
            <div class="relative">
              <i data-lucide="mail" class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5"></i>
              <input type="email" id="login-email" required placeholder="name@example.com" class="w-full pl-10 pr-4 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-800 font-medium" />
            </div>
            <p id="login-email-err" class="text-[11px] text-rose-600 mt-1 hidden"></p>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-bold text-slate-700">Password</label>
              <a href="javascript:void(0)" onclick="showToast('Password reset link sent to registered email')" class="text-[11px] font-bold text-indigo-700 hover:underline">Forgot password?</a>
            </div>
            <div class="relative">
              <i data-lucide="lock" class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5"></i>
              <input type="password" id="login-password" required placeholder="••••••••" class="w-full pl-10 pr-4 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-800 font-medium" />
            </div>
            <p id="login-password-err" class="text-[11px] text-rose-600 mt-1 hidden"></p>
          </div>

          <!-- Submit Button with Loading State -->
          <button type="submit" id="login-submit-btn" class="w-full btn-indigo text-white py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2">
            <span>Sign In to ClaimPilot</span>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
        </form>

        <!-- Footer -->
        <div class="mt-6 pt-4 border-t border-slate-200/60 text-center text-xs text-slate-500">
          Don't have an account? 
          <button onclick="navigateTo('signup')" class="font-bold text-indigo-700 hover:underline">Sign up now</button>
        </div>

      </div>
    </div>
  `;
}

function fillLoginCredentials(role) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (role === 'admin') {
    if (emailInput) emailInput.value = MOCK_USERS.admin.email;
    if (passInput) passInput.value = 'Surveyor@Pass2026';
    showToast('Filled Surveyor / Admin credentials');
  } else {
    if (emailInput) emailInput.value = MOCK_USERS.claimant.email;
    if (passInput) passInput.value = 'Claimant@Pass2026';
    showToast('Filled Claimant credentials');
  }
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const btn = document.getElementById('login-submit-btn');

  btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> <span>Verifying credentials...</span>`;
  btn.disabled = true;

  setTimeout(() => {
    if (email.includes('admin') || email.includes('claimpilot.ai') || email === MOCK_USERS.admin.email) {
      AppState.currentUser = MOCK_USERS.admin;
      showToast(`Welcome, Surveyor Vikram Malhotra (Admin Portal)`);
      navigateTo('admin-dashboard');
    } else {
      AppState.currentUser = MOCK_USERS.claimant;
      showToast(`Welcome back, Rajesh Kumar!`);
      navigateTo('user-dashboard');
    }
  }, 600);
}

function renderSignupView(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto my-8 animate-fade-in-up">
      <div class="glass-card rounded-3xl p-8 border border-white/90 shadow-2xl">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-extrabold font-display text-slate-900">Create Claimant Account</h1>
          <p class="text-xs text-slate-500 mt-1">Instant registration for autonomous motor insurance settlement</p>
        </div>

        <form onsubmit="handleSignupSubmit(event)" class="space-y-3.5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Full Legal Name</label>
            <input type="text" id="signup-name" required placeholder="Rajesh Anand Kumar" class="w-full px-3.5 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input type="email" id="signup-email" required placeholder="name@example.com" class="w-full px-3.5 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Create Password</label>
            <input type="password" id="signup-pass" required placeholder="Minimum 8 characters" class="w-full px-3.5 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
            <input type="password" id="signup-pass-confirm" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600" />
          </div>

          <button type="submit" class="w-full btn-indigo text-white py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2">
            <span>Create Account &amp; Continue</span>
            <i data-lucide="check" class="w-4 h-4"></i>
          </button>
        </form>

        <div class="mt-5 pt-4 border-t border-slate-200/60 text-center text-xs text-slate-500">
          Already registered? 
          <button onclick="navigateTo('login')" class="font-bold text-indigo-700 hover:underline">Log in</button>
        </div>
      </div>
    </div>
  `;
}

function handleSignupSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass1 = document.getElementById('signup-pass').value;
  const pass2 = document.getElementById('signup-pass-confirm').value;

  if (pass1 !== pass2) {
    alert("Passwords do not match. Please re-enter.");
    return;
  }

  AppState.currentUser = {
    ...MOCK_USERS.claimant,
    name: name || "New Claimant",
    email: email || "user@claimpilot.ai"
  };

  showToast('Account created successfully!');
  navigateTo('user-dashboard');
}

// ------------------------------------------------------------------------------
// 5. USER DASHBOARD (Main Landing View for Claimants)
// ------------------------------------------------------------------------------

function renderUserDashboardView(container) {
  const user = AppState.currentUser || MOCK_USERS.claimant;
  const userClaims = AppState.claims.filter(c => !c.user_id || c.user_id === user.id);

  // Compute Metrics
  const totalCount = userClaims.length;
  const approvedCount = userClaims.filter(c => c.status === 'auto_approved').length;
  const reviewCount = userClaims.filter(c => c.status === 'under_review').length;
  const flaggedCount = userClaims.filter(c => c.status === 'flagged').length;

  // Filter Claims
  let filtered = userClaims;
  if (AppState.claimantFilter !== 'all') {
    filtered = filtered.filter(c => c.status === AppState.claimantFilter);
  }
  if (AppState.searchQuery) {
    const q = AppState.searchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      c.claim_id.toLowerCase().includes(q) ||
      (c.vehicle && (c.vehicle.make.toLowerCase().includes(q) || c.vehicle.model.toLowerCase().includes(q) || c.vehicle.registration.toLowerCase().includes(q)))
    );
  }

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in-up">
      
      <!-- Welcome & Hero Header -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden bg-gradient-to-r from-white/90 via-white/80 to-indigo-50/50">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Policy Active &bull; Zero Dep Comprehensive
            </span>
            <span class="text-xs text-slate-500 font-mono">${user.policyNumber || 'POL-PAC-9920194'}</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
            Welcome back, ${user.name}
          </h1>
          <p class="text-sm text-slate-500 mt-1">
            Track your autonomous motor claim settlements, document validations, and live payouts.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button onclick="startNewClaimFlow()" class="btn-indigo text-white px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-lg flex items-center gap-2 cursor-pointer shrink-0">
            <i data-lucide="plus-circle" class="w-4 h-4 text-amber-300"></i>
            <span>File New Claim</span>
          </button>
        </div>
      </div>

      <!-- 4 Summary KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div onclick="setClaimantFilter('all')" class="glass-card p-5 rounded-2xl border border-white/80 cursor-pointer hover:border-indigo-300 transition-all ${AppState.claimantFilter === 'all' ? 'ring-2 ring-indigo-600 bg-white' : ''}">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Total Claims</span>
            <i data-lucide="files" class="w-4 h-4 text-indigo-700"></i>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">${totalCount}</div>
          <div class="text-[11px] text-slate-500 mt-1">Lifetime claim history</div>
        </div>

        <div onclick="setClaimantFilter('auto_approved')" class="glass-card p-5 rounded-2xl border border-white/80 cursor-pointer hover:border-emerald-300 transition-all ${AppState.claimantFilter === 'auto_approved' ? 'ring-2 ring-emerald-600 bg-white' : ''}">
          <div class="flex items-center justify-between text-emerald-700 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Auto-Approved</span>
            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold font-display text-emerald-950">${approvedCount}</div>
          <div class="text-[11px] text-emerald-700 font-medium mt-1">Instant digital payouts</div>
        </div>

        <div onclick="setClaimantFilter('under_review')" class="glass-card p-5 rounded-2xl border border-white/80 cursor-pointer hover:border-amber-300 transition-all ${AppState.claimantFilter === 'under_review' ? 'ring-2 ring-amber-600 bg-white' : ''}">
          <div class="flex items-center justify-between text-amber-700 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Under Review</span>
            <i data-lucide="clock" class="w-4 h-4 text-amber-600"></i>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold font-display text-amber-950">${reviewCount}</div>
          <div class="text-[11px] text-amber-700 font-medium mt-1">1-click adjuster signoff</div>
        </div>

        <div onclick="setClaimantFilter('flagged')" class="glass-card p-5 rounded-2xl border border-white/80 cursor-pointer hover:border-rose-300 transition-all ${AppState.claimantFilter === 'flagged' ? 'ring-2 ring-rose-600 bg-white' : ''}">
          <div class="flex items-center justify-between text-rose-700 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Surveyor Inspection</span>
            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600"></i>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold font-display text-rose-950">${flaggedCount}</div>
          <div class="text-[11px] text-rose-700 font-medium mt-1">Mandated by IRDAI &gt; ₹50k</div>
        </div>

      </div>

      <!-- My Claims Table Header & Filters -->
      <div class="glass-card rounded-3xl p-6 border border-white/90 shadow-lg">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-lg font-bold text-slate-900 font-display">My Submitted Claims</h2>
            <p class="text-xs text-slate-500">Click on any claim record to inspect full forensic AI breakdown</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- Search -->
            <div class="relative">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
              <input type="text" oninput="handleSearchInput(event)" value="${AppState.searchQuery}" placeholder="Search ID, model, plate..." class="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 w-48 sm:w-60" />
            </div>

            <!-- Status Filter Tabs -->
            <div class="flex items-center p-1 bg-slate-100/80 rounded-xl text-xs font-semibold">
              <button onclick="setClaimantFilter('all')" class="px-2.5 py-1 rounded-lg ${AppState.claimantFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}">All</button>
              <button onclick="setClaimantFilter('auto_approved')" class="px-2.5 py-1 rounded-lg ${AppState.claimantFilter === 'auto_approved' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'}">Approved</button>
              <button onclick="setClaimantFilter('under_review')" class="px-2.5 py-1 rounded-lg ${AppState.claimantFilter === 'under_review' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500'}">Review</button>
              <button onclick="setClaimantFilter('flagged')" class="px-2.5 py-1 rounded-lg ${AppState.claimantFilter === 'flagged' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-500'}">Flagged</button>
            </div>
          </div>
        </div>

        <!-- Claims List Grid/Table -->
        ${filtered.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full text-left claim-table">
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>Vehicle &amp; Regn</th>
                  <th>Incident Date</th>
                  <th>Damage &amp; Location</th>
                  <th>Estimate / Payout</th>
                  <th>Status</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(c => {
                  const isApproved = c.status === 'auto_approved';
                  const isReview = c.status === 'under_review';
                  const isFlagged = c.status === 'flagged';
                  
                  return `
                    <tr class="cursor-pointer transition-colors" onclick="navigateTo('claim-detail', '${c.claim_id}')">
                      <td class="font-mono font-bold text-indigo-900">${c.claim_id}</td>
                      <td>
                        <div class="font-bold text-slate-800">${c.vehicle.make} ${c.vehicle.model}</div>
                        <div class="text-[11px] font-mono text-slate-500">${c.vehicle.registration}</div>
                      </td>
                      <td class="text-xs text-slate-600">${c.submission_timestamp.split(',')[0]}</td>
                      <td>
                        <div class="text-xs font-semibold text-slate-700">${c.damage_assessment.location_label}</div>
                        <div class="text-[11px] text-slate-500">${c.damage_assessment.detected_parts.length} parts identified</div>
                      </td>
                      <td>
                        <div class="font-bold text-slate-900">${c.cost_estimate.recommended_payout}</div>
                        <div class="text-[11px] text-slate-500 font-mono">${c.cost_estimate.formatted_final}</div>
                      </td>
                      <td>
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isApproved ? 'badge-auto-approved' : (isReview ? 'badge-under-review' : 'badge-flagged')}">
                          <span class="w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-600' : (isReview ? 'bg-amber-600' : 'bg-rose-600')}"></span>
                          ${c.status_label.split(':')[0]}
                        </span>
                      </td>
                      <td class="text-right">
                        <button class="px-3 py-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors inline-flex items-center gap-1">
                          <span>View Detail</span>
                          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="p-12 text-center">
            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <i data-lucide="search-x" class="w-6 h-6"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-800">No claims match your filter criteria</h3>
            <p class="text-xs text-slate-500 mt-1">Try changing the search query or status filter above.</p>
            <button onclick="setClaimantFilter('all')" class="mt-4 px-4 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl">
              Reset Filters
            </button>
          </div>
        `}

      </div>

    </div>
  `;
}

function setClaimantFilter(status) {
  AppState.claimantFilter = status;
  renderApp();
}

function handleSearchInput(e) {
  AppState.searchQuery = e.target.value;
  renderApp();
}

function startNewClaimFlow() {
  AppState.currentStep = 1;
  AppState.uploads = {
    docs: { rc: null, dl: null, claimForm: null },
    photos: { front: null, rear: null, leftSide: null, rightSide: null }
  };
  navigateTo('claim-submission');
}

// ------------------------------------------------------------------------------
// 6. ADMIN / SURVEYOR PORTAL (Priority Human Action Queue)
// ------------------------------------------------------------------------------

function renderAdminDashboardView(container) {
  const allClaims = AppState.claims;
  
  // Calculate Admin KPIs
  const totalClaims = allClaims.length;
  const priorityClaims = allClaims.filter(c => c.status === 'flagged' || c.status === 'under_review');
  const autoApproved = allClaims.filter(c => c.status === 'auto_approved').length;
  const autoRate = totalClaims > 0 ? Math.round((autoApproved / totalClaims) * 100) : 0;
  
  let totalDisbursed = 0;
  allClaims.forEach(c => {
    if (c.status === 'auto_approved' && c.cost_estimate && c.cost_estimate.recommended_payout) {
      const num = parseInt(c.cost_estimate.recommended_payout.replace(/[^\d]/g, '')) || 0;
      totalDisbursed += num;
    }
  });

  // Filter Table
  let displayClaims = allClaims;
  if (AppState.adminFilter === 'needs_action') {
    displayClaims = priorityClaims;
  } else if (AppState.adminFilter !== 'all') {
    displayClaims = displayClaims.filter(c => c.status === AppState.adminFilter);
  }

  if (AppState.searchQuery) {
    const q = AppState.searchQuery.toLowerCase();
    displayClaims = displayClaims.filter(c => 
      c.claim_id.toLowerCase().includes(q) ||
      (c.policy && c.policy.holder && c.policy.holder.toLowerCase().includes(q)) ||
      (c.vehicle && (c.vehicle.make.toLowerCase().includes(q) || c.vehicle.registration.toLowerCase().includes(q)))
    );
  }

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in-up">
      
      <!-- Admin Header -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-2xl relative overflow-hidden">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-amber-300"></i>
              IRDAI Licensed Surveyor Portal
            </span>
            <span class="text-xs text-indigo-300 font-mono">BADGE #IRDAI-SURV-4481</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold font-display">
            Autonomous Claims Triage &amp; Human Surveyor Queue
          </h1>
          <p class="text-sm text-slate-300 mt-1">
            Review claims flagged for physical inspection, fraud anomalies, or claims exceeding statutory ₹50,000 threshold.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="text-right hidden sm:block">
            <div class="text-xs text-slate-400 font-semibold uppercase">Pending Human Triage</div>
            <div class="text-2xl font-bold font-display text-amber-300">${priorityClaims.length} Claims</div>
          </div>
        </div>
      </div>

      <!-- KPI Metric Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div onclick="setAdminFilter('needs_action')" class="glass-card p-5 rounded-2xl border-2 border-amber-300/80 shadow-md cursor-pointer hover:scale-[1.02] transition-all ${AppState.adminFilter === 'needs_action' ? 'bg-amber-50/70 ring-2 ring-amber-500' : ''}">
          <div class="flex items-center justify-between text-amber-800 mb-2">
            <span class="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              Needs Human Action
            </span>
            <i data-lucide="alert-octagon" class="w-4 h-4 text-amber-600"></i>
          </div>
          <div class="text-3xl font-extrabold font-display text-amber-950">${priorityClaims.length}</div>
          <div class="text-[11px] text-amber-800 font-semibold mt-1">Mandatory surveyor queue</div>
        </div>

        <div onclick="setAdminFilter('auto_approved')" class="glass-card p-5 rounded-2xl border border-white/80 cursor-pointer hover:border-emerald-300 transition-all ${AppState.adminFilter === 'auto_approved' ? 'bg-white ring-2 ring-emerald-600' : ''}">
          <div class="flex items-center justify-between text-emerald-700 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Autonomous Rate</span>
            <i data-lucide="zap" class="w-4 h-4 text-emerald-600"></i>
          </div>
          <div class="text-3xl font-extrabold font-display text-emerald-950">${autoRate}%</div>
          <div class="text-[11px] text-emerald-700 font-medium mt-1">${autoApproved} claims zero-touch settled</div>
        </div>

        <div onclick="setAdminFilter('flagged')" class="glass-card p-5 rounded-2xl border border-white/80 cursor-pointer hover:border-rose-300 transition-all ${AppState.adminFilter === 'flagged' ? 'bg-white ring-2 ring-rose-600' : ''}">
          <div class="flex items-center justify-between text-rose-700 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">High Risk / &gt;₹50k</span>
            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600"></i>
          </div>
          <div class="text-3xl font-extrabold font-display text-rose-950">${allClaims.filter(c => c.status === 'flagged').length}</div>
          <div class="text-[11px] text-rose-700 font-medium mt-1">IRDAI or fraud warning</div>
        </div>

        <div onclick="setAdminFilter('all')" class="glass-card p-5 rounded-2xl border border-white/80 cursor-pointer hover:border-indigo-300 transition-all ${AppState.adminFilter === 'all' ? 'bg-white ring-2 ring-indigo-600' : ''}">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Total Disbursed</span>
            <i data-lucide="badge-indian-rupee" class="w-4 h-4 text-indigo-700"></i>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">₹${totalDisbursed.toLocaleString('en-IN')}</div>
          <div class="text-[11px] text-slate-500 font-medium mt-1">Across all autonomous payouts</div>
        </div>

      </div>

      <!-- PRIORITY SECTION: HUMAN SURVEYOR ACTION QUEUE -->
      ${AppState.adminFilter === 'needs_action' ? `
        <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-2 border-amber-400/80 shadow-md flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <i data-lucide="user-check" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-amber-950 font-display">Surveyor &amp; Adjuster Action Queue (IRDAI Mandated)</h3>
              <p class="text-xs text-amber-900/80">These claims cannot auto-settle. They require human physical inspection, manual review, or forensic fraud check sign-off.</p>
            </div>
          </div>
          <span class="px-3 py-1 bg-amber-500 text-white font-bold text-xs rounded-full shadow-xs shrink-0">
            ${priorityClaims.length} Action Items
          </span>
        </div>
      ` : ''}

      <!-- Admin All Claims Ledger -->
      <div class="glass-card rounded-3xl p-6 border border-white/90 shadow-lg">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-lg font-bold text-slate-900 font-display">Master Adjudication Ledger</h2>
            <p class="text-xs text-slate-500">Live multi-agent claim stream across all registered insured vehicles</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- Search Input -->
            <div class="relative">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
              <input type="text" oninput="handleSearchInput(event)" value="${AppState.searchQuery}" placeholder="Search claimant, claim ID, plate..." class="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 w-48 sm:w-64" />
            </div>

            <!-- Filter Tabs -->
            <div class="flex items-center p-1 bg-slate-100/80 rounded-xl text-xs font-semibold">
              <button onclick="setAdminFilter('needs_action')" class="px-2.5 py-1 rounded-lg ${AppState.adminFilter === 'needs_action' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'text-slate-600'}">Needs Action (${priorityClaims.length})</button>
              <button onclick="setAdminFilter('all')" class="px-2.5 py-1 rounded-lg ${AppState.adminFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}">All</button>
              <button onclick="setAdminFilter('auto_approved')" class="px-2.5 py-1 rounded-lg ${AppState.adminFilter === 'auto_approved' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'}">Approved</button>
              <button onclick="setAdminFilter('under_review')" class="px-2.5 py-1 rounded-lg ${AppState.adminFilter === 'under_review' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500'}">Review</button>
              <button onclick="setAdminFilter('flagged')" class="px-2.5 py-1 rounded-lg ${AppState.adminFilter === 'flagged' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-500'}">Flagged</button>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left claim-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Claimant &amp; Policy</th>
                <th>Vehicle &amp; Regn</th>
                <th>AI Recommendation</th>
                <th>Estimate Amount</th>
                <th>Status</th>
                <th class="text-right">Surveyor Action</th>
              </tr>
            </thead>
            <tbody>
              ${displayClaims.map(c => {
                const isApproved = c.status === 'auto_approved';
                const isReview = c.status === 'under_review';
                const isFlagged = c.status === 'flagged';
                const hasOverride = AppState.adminOverrides[c.claim_id];

                return `
                  <tr class="cursor-pointer transition-colors" onclick="navigateTo('admin-claim-detail', '${c.claim_id}')">
                    <td class="font-mono font-bold text-indigo-900">${c.claim_id}</td>
                    <td>
                      <div class="font-bold text-slate-800">${c.policy.holder}</div>
                      <div class="text-[11px] font-mono text-slate-500">${c.policy.number}</div>
                    </td>
                    <td>
                      <div class="font-semibold text-slate-700">${c.vehicle.make} ${c.vehicle.model}</div>
                      <div class="text-[11px] font-mono text-slate-500">${c.vehicle.registration}</div>
                    </td>
                    <td>
                      <div class="text-xs text-slate-700 max-w-[220px] truncate" title="${c.status_description}">
                        ${c.status_description}
                      </div>
                      ${hasOverride ? `<span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Human Overridden</span>` : ''}
                    </td>
                    <td>
                      <div class="font-bold text-slate-900">${c.cost_estimate.recommended_payout}</div>
                      <div class="text-[11px] text-slate-500 font-mono">${c.cost_estimate.formatted_final}</div>
                    </td>
                    <td>
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isApproved ? 'badge-auto-approved' : (isReview ? 'badge-under-review' : 'badge-flagged')}">
                        <span class="w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-600' : (isReview ? 'bg-amber-600' : 'bg-rose-600')}"></span>
                        ${c.status_label.split(':')[0]}
                      </span>
                    </td>
                    <td class="text-right">
                      <button class="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-900 hover:bg-indigo-950 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs">
                        <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                        <span>Review &amp; Override</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  `;
}

function setAdminFilter(status) {
  AppState.adminFilter = status;
  renderApp();
}

// ------------------------------------------------------------------------------
// 7. PARAMETERIZED CLAIM DETAIL VIEW + ADMIN OVERRIDE PANEL
// ------------------------------------------------------------------------------

function renderClaimDetailView(container, claimId, isAdminView = false) {
  const claim = AppState.claims.find(c => c.claim_id === claimId) || SCENARIOS.clean_approval;
  const isApproved = claim.status === 'auto_approved';
  const isReview = claim.status === 'under_review';
  const isFlagged = claim.status === 'flagged';
  const override = AppState.adminOverrides[claim.claim_id];

  container.innerHTML = `
    <div class="space-y-6 animate-fade-in-up">
      
      <!-- Back Button & Breadcrumbs Navigation -->
      <div class="flex items-center justify-between">
        <button onclick="navigateTo('${isAdminView ? 'admin-dashboard' : 'user-dashboard'}')" class="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-xs flex items-center gap-2 transition-all">
          <i data-lucide="arrow-left" class="w-4 h-4 text-indigo-700"></i>
          <span>Back to ${isAdminView ? 'Surveyor Action Queue' : 'My Claims'}</span>
        </button>

        <div class="flex items-center gap-2">
          <button onclick="openExportModal('${claim.claim_id}')" class="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-xs flex items-center gap-1.5">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Export Report (PDF)</span>
          </button>
        </div>
      </div>

      <!-- ADMIN OVERRIDE ACTION PANEL (Prominent for Surveyors) -->
      ${isAdminView ? `
        <div class="glass-card rounded-3xl p-6 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-amber-50/50 shadow-xl">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-indigo-900 text-white flex items-center justify-center shadow-md">
                <i data-lucide="sliders" class="w-5 h-5 text-amber-300"></i>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900 font-display">Surveyor Adjudication &amp; Override Panel</h3>
                <p class="text-xs text-slate-500">Official human surveyor sign-off pursuant to IRDAI Motor Insurance guidelines</p>
              </div>
            </div>
            ${override ? `
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                Override Applied on ${override.timestamp}
              </span>
            ` : ''}
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
            <div class="lg:col-span-2 space-y-3">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Surveyor / Adjuster Inspection Notes</label>
              <textarea id="admin-override-notes" rows="3" placeholder="Enter surveyor findings, workshop inspection notes, or fraud override reasoning..." class="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-600 text-slate-800">${override ? override.reviewNote : ''}</textarea>
            </div>

            <div class="space-y-3">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Assign Final Status</label>
              <div class="grid grid-cols-1 gap-2">
                <button onclick="applyAdminOverride('${claim.claim_id}', 'auto_approved')" class="px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 flex items-center justify-between transition-colors">
                  <span class="flex items-center gap-1.5"><i data-lucide="check-circle" class="w-4 h-4"></i> Approve &amp; Settle</span>
                  <i data-lucide="arrow-right" class="w-3 h-3"></i>
                </button>
                <button onclick="applyAdminOverride('${claim.claim_id}', 'under_review')" class="px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 flex items-center justify-between transition-colors">
                  <span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4"></i> Request More Info</span>
                  <i data-lucide="arrow-right" class="w-3 h-3"></i>
                </button>
                <button onclick="applyAdminOverride('${claim.claim_id}', 'flagged')" class="px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 flex items-center justify-between transition-colors">
                  <span class="flex items-center gap-1.5"><i data-lucide="x-circle" class="w-4 h-4"></i> Reject / SIU Fraud</span>
                  <i data-lucide="arrow-right" class="w-3 h-3"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- TOP SUMMARY HERO CARD -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 shadow-xl relative overflow-hidden bg-gradient-to-r from-white/90 via-white/80 to-indigo-50/40">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/70">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-100 text-indigo-950 border border-indigo-200">
                ${claim.claim_id}
              </span>
              <span class="text-xs text-slate-500 font-medium">Submitted: ${claim.submission_timestamp}</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
              ${claim.vehicle.make} ${claim.vehicle.model} (${claim.vehicle.year})
            </h1>
            <p class="text-xs sm:text-sm text-slate-600 mt-1">
              ${claim.status_description}
            </p>
          </div>

          <!-- Status Indicator Pill -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="px-5 py-3 rounded-2xl flex items-center gap-3 shadow-md ${isApproved ? 'bg-emerald-600 text-white' : (isReview ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white')}">
              <i data-lucide="${isApproved ? 'check-circle-2' : (isReview ? 'clock' : 'alert-octagon')}" class="w-6 h-6 shrink-0"></i>
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold opacity-90">Adjudication Result</div>
                <div class="text-base font-bold font-display leading-tight">${claim.status_label}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vehicle & Policy Ledger Strip -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
          <div>
            <span class="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Registration Plate</span>
            <span class="font-mono font-bold text-slate-900 text-sm">${claim.vehicle.registration}</span>
          </div>
          <div>
            <span class="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Policyholder</span>
            <span class="font-bold text-slate-900 text-sm truncate block">${claim.policy.holder}</span>
          </div>
          <div>
            <span class="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Insurance Plan</span>
            <span class="font-bold text-indigo-900 text-sm truncate block">${claim.policy.plan}</span>
          </div>
          <div>
            <span class="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Policy Status</span>
            <span class="font-bold text-emerald-700 text-sm flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${claim.policy.status} (Exp: ${claim.policy.expiry})
            </span>
          </div>
        </div>
      </div>

      <!-- 2-COLUMN AGENT BREAKDOWN -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- CARD A: DOCUMENT VERIFICATION -->
        <div class="glass-card rounded-3xl p-6 border border-white/90 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
                  <i data-lucide="file-check-2" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Document Verification Agent</h3>
                  <p class="text-[11px] text-slate-500">Government DB &amp; Optical OCR Parity</p>
                </div>
              </div>

              <span class="text-xs font-bold font-mono px-2.5 py-1 rounded-full ${claim.document_check.overall_status === 'verified' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : (claim.document_check.overall_status === 'resolved' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-800 border border-rose-200')}">
                ${claim.document_check.confidence_score}% Score
              </span>
            </div>

            <!-- List of Checked Fields -->
            <div class="space-y-3 mt-4">
              ${claim.document_check.fields.map(f => {
                const isPass = f.status === 'verified';
                const isRes = f.status === 'resolved';
                
                return `
                  <div class="p-3 rounded-2xl bg-white/70 border border-slate-200/70 hover:bg-white transition-all space-y-1">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full flex items-center justify-center ${isPass ? 'bg-emerald-100 text-emerald-700' : (isRes ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}">
                          <i data-lucide="${isPass ? 'check' : (isRes ? 'sparkles' : 'alert-triangle')}" class="w-3 h-3"></i>
                        </span>
                        <span class="text-xs font-bold text-slate-800">${f.name}</span>
                      </div>
                      <span class="text-[11px] font-mono font-bold text-slate-700">${Math.round(f.confidence * 100)}%</span>
                    </div>
                    <div class="font-mono text-xs text-slate-900 font-semibold pl-7">${f.value}</div>
                    <div class="text-[11px] text-slate-500 pl-7">${f.note}</div>
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

        <!-- CARD B: DAMAGE ASSESSMENT -->
        <div class="glass-card rounded-3xl p-6 border border-white/90 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
                  <i data-lucide="scan-line" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Damage Assessment Agent</h3>
                  <p class="text-[11px] text-slate-500">Computer Vision Pixel Localization</p>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${claim.damage_assessment.severity === 'minor' ? 'bg-emerald-100 text-emerald-800' : (claim.damage_assessment.severity === 'moderate' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}">
                  ${claim.damage_assessment.severity_label}
                </span>
              </div>
            </div>

            <!-- Uploaded Photos Grid -->
            <div class="grid grid-cols-4 gap-2 mb-4">
              ${(claim.damage_assessment.photos || []).map((ph, idx) => {
                const keys = ['front', 'rear', 'leftSide', 'rightSide'];
                return `
                  <div onclick="openPhotoPreviewModal('${keys[idx] || 'front'}')" class="group/p relative rounded-xl overflow-hidden aspect-square border border-slate-200/80 bg-slate-950 cursor-pointer shadow-sm hover:ring-2 hover:ring-indigo-600 transition-all">
                    <img src="${ph.url}" class="w-full h-full object-cover group-hover/p:scale-105 transition-transform" alt="${ph.slot}" />
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/p:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <i data-lucide="zoom-in" class="w-4 h-4"></i>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Detected Parts Breakdown -->
            <div class="space-y-2">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Identified Component Damage</span>
              ${claim.damage_assessment.detected_parts.map(dp => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-slate-200/60 text-xs">
                  <div>
                    <div class="font-bold text-slate-800">${dp.part}</div>
                    <div class="text-[11px] text-slate-500">${dp.type} &bull; <span class="text-indigo-900 font-semibold">${dp.action}</span> (${dp.material_type || 'metal'})</div>
                  </div>
                  <span class="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    ${dp.confidence}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Primary Impact Zone: <strong class="text-slate-800">${claim.damage_assessment.location_label}</strong>
          </div>
        </div>

      </div>

      <!-- CARD C: COST RECONCILIATION -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border-2 border-indigo-100/90 shadow-xl bg-gradient-to-br from-white/90 via-white/80 to-indigo-50/40">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/70">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-900 text-white flex items-center gap-1.5 shadow-sm">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-amber-300"></i>
                Multi-Agent Cost Engine (Spring AI)
              </span>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full ${claim.cost_estimate.confidence === 'high' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                ${claim.cost_estimate.confidence_label}
              </span>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold font-display text-slate-900">
              Autonomous Cost Reconciliation
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">
              Cross-checked against OEM parts catalog, certified repairer labor index, and historical regional claims.
            </p>
          </div>

          <div class="bg-white/90 border border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-md flex items-center gap-6">
            <div>
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Recommended Payout</span>
              <div class="text-2xl sm:text-3xl font-extrabold font-display text-indigo-950">${claim.cost_estimate.recommended_payout}</div>
              <span class="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                <i data-lucide="check" class="w-3 h-3"></i> Zero Deductibles Applied
              </span>
            </div>
            <div class="border-l border-slate-200 pl-6 text-right">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Model Variance Range</span>
              <div class="text-sm font-bold font-mono text-slate-700 mt-1">${claim.cost_estimate.formatted_final}</div>
              <span class="text-[10px] text-slate-400 font-medium">95% Confidence Band</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          ${(claim.cost_estimate.sources || []).map(s => `
            <div class="p-4 rounded-2xl bg-white/80 border border-slate-200/70 hover:shadow-md transition-all">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-800">${s.label}</span>
                <i data-lucide="${s.icon || 'activity'}" class="w-4 h-4 text-indigo-700"></i>
              </div>
              <div class="text-lg font-bold font-mono text-slate-900">${s.formatted}</div>
              <p class="text-[11px] text-slate-500 mt-1">${s.desc}</p>
            </div>
          `).join('')}
        </div>

        <div class="mt-5 pt-4 border-t border-slate-200/60 text-xs text-slate-500">
          <strong>IRDAI Statutory Notice:</strong> ${claim.cost_estimate.disclaimer}
        </div>
      </div>

      <!-- CARD D: FRAUD CHECKS & DECISION TRAIL -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Fraud Verification Suite -->
        <div class="glass-card rounded-3xl p-6 border border-white/90">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
              <i data-lucide="shield-alert" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Fraud &amp; Anomaly Scan</h3>
              <p class="text-[11px] text-slate-500">Perceptual Hash, Plate Parity, Anti-Spoofing</p>
            </div>
          </div>

          <div class="space-y-3">
            ${claim.fraud_checks.map(fc => {
              const isPass = fc.status === 'passed';
              const isWarn = fc.status === 'warning';
              
              return `
                <div class="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-800">${fc.name}</span>
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isPass ? 'bg-emerald-100 text-emerald-800' : (isWarn ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}">
                      ${fc.status}
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-500">${fc.detail}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Decision Audit Trail Timeline -->
        <div class="glass-card rounded-3xl p-6 border border-white/90">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center">
              <i data-lucide="git-commit" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Decision Trail &amp; Audit Log</h3>
              <p class="text-[11px] text-slate-500">Deterministic Multi-Agent Execution</p>
            </div>
          </div>

          <div class="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            ${claim.decision_trail.map(dt => `
              <div class="relative pl-7 text-xs">
                <span class="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${dt.status === 'success' || dt.status === 'completed' ? 'bg-emerald-500' : (dt.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500')}"></span>
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-800">${dt.step}</span>
                  <span class="text-[10px] font-mono text-slate-400">${dt.timestamp}</span>
                </div>
                <div class="text-indigo-900 font-semibold">${dt.outcome}</div>
                <div class="text-[11px] text-slate-500">${dt.detail}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

    </div>
  `;
}

function applyAdminOverride(claimId, overrideStatus) {
  const notesEl = document.getElementById('admin-override-notes');
  const reviewNote = notesEl ? notesEl.value.trim() : "Surveyor manual override applied.";

  if (!reviewNote) {
    alert("Please enter mandatory surveyor inspection notes before applying an override.");
    return;
  }

  const claim = AppState.claims.find(c => c.claim_id === claimId);
  if (!claim) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Update in local state
  claim.status = overrideStatus;
  claim.status_label = overrideStatus === 'auto_approved' ? 'Settled (Surveyor Override)' : (overrideStatus === 'under_review' ? 'Pending Info' : 'Rejected by Surveyor');
  claim.status_description = `Manually overridden by Surveyor Vikram Malhotra: "${reviewNote}"`;

  // Append to decision trail
  claim.decision_trail.push({
    step: "Surveyor Override",
    outcome: `Status updated to ${overrideStatus.toUpperCase()}`,
    detail: reviewNote,
    status: overrideStatus === 'auto_approved' ? 'success' : 'flagged',
    timestamp: timeStr
  });

  AppState.adminOverrides[claimId] = {
    overrideStatus,
    reviewerName: "Vikram Malhotra (IRDAI-SURV-4481)",
    reviewNote,
    timestamp: timeStr
  };

  showToast(`Applied ${overrideStatus.toUpperCase()} override to ${claimId}`);
  renderApp();
}

// ------------------------------------------------------------------------------
// 8. CLAIM SUBMISSION & PROCESSING PIPELINE
// ------------------------------------------------------------------------------

function renderSubmissionScreen(container) {
  const docsCount = Object.values(AppState.uploads.docs).filter(Boolean).length;
  const photosCount = Object.values(AppState.uploads.photos).filter(Boolean).length;

  container.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      
      <!-- Intake Title -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
            Motor OD Claim Intake Gateway
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Upload vehicle registration credentials and live damage photos for autonomous AI adjudication.
          </p>
        </div>

        <button onclick="autoFillDemoData()" class="px-4 py-2 text-xs font-bold text-indigo-950 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs flex items-center gap-1.5">
          <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-600"></i>
          <span>Auto-Fill Demo Assets</span>
        </button>
      </div>

      <!-- Stepper Header -->
      <div class="grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <div class="p-3 rounded-2xl ${AppState.currentStep >= 1 ? 'bg-indigo-900 text-white shadow-sm' : 'bg-white/70 text-slate-400'}">
          1. Vehicle Credentials
        </div>
        <div class="p-3 rounded-2xl ${AppState.currentStep >= 2 ? 'bg-indigo-900 text-white shadow-sm' : 'bg-white/70 text-slate-400'}">
          2. Damage Photos
        </div>
        <div class="p-3 rounded-2xl ${AppState.currentStep >= 3 ? 'bg-indigo-900 text-white shadow-sm' : 'bg-white/70 text-slate-400'}">
          3. Live Adjudication
        </div>
      </div>

      <!-- STEP 1: DOCUMENTS -->
      ${AppState.currentStep === 1 ? `
        <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold font-display text-slate-900">Step 1: Upload Identity &amp; Vehicle Credentials</h2>
            <span class="text-xs font-semibold text-slate-500">${docsCount}/3 Documents Attached</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${['rc', 'dl', 'claimForm'].map(docKey => {
              const titles = { rc: 'Registration Certificate (RC)', dl: 'Driving Licence (DL)', claimForm: 'Claim Intimation Form' };
              const isUploaded = Boolean(AppState.uploads.docs[docKey]);
              
              return `
                <div class="p-5 rounded-2xl border-2 ${isUploaded ? 'border-emerald-500 bg-emerald-50/40' : 'border-dashed border-slate-300 bg-white/70'} flex flex-col justify-between min-h-[160px] text-center">
                  <div>
                    <div class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${isUploaded ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'} mb-2">
                      <i data-lucide="${isUploaded ? 'check' : 'file-up'}" class="w-5 h-5"></i>
                    </div>
                    <div class="text-xs font-bold text-slate-800">${titles[docKey]}</div>
                    <div class="text-[11px] text-slate-500 mt-1">${isUploaded ? 'Attached &bull; Ready for OCR' : 'JPEG / PNG / PDF'}</div>
                  </div>

                  <div class="mt-3">
                    ${isUploaded ? `
                      <button onclick="clearDocUpload('${docKey}')" class="text-xs font-bold text-rose-600 hover:underline">Remove</button>
                    ` : `
                      <button onclick="simulateUploadDoc('${docKey}')" class="px-3 py-1.5 text-xs font-bold text-indigo-900 bg-white border border-indigo-200 rounded-xl shadow-xs hover:bg-indigo-50">
                        Upload Sample
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="flex justify-end pt-4 border-t border-slate-100">
            <button onclick="handleStep1Next()" class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
              <span>Next: Damage Photos</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- STEP 2: DAMAGE PHOTOS -->
      ${AppState.currentStep === 2 ? `
        <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold font-display text-slate-900">Step 2: Upload Vehicle Damage Photos</h2>
            <span class="text-xs font-semibold text-slate-500">${photosCount}/4 Views Captured</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            ${['front', 'rear', 'leftSide', 'rightSide'].map(slot => {
              const isCaptured = Boolean(AppState.uploads.photos[slot]);
              const labels = { front: 'Front Damage', rear: 'Rear Profile', leftSide: 'Left Side', rightSide: 'Right Side' };

              return `
                <div class="p-4 rounded-2xl border-2 ${isCaptured ? 'border-emerald-500 bg-emerald-50/40' : 'border-dashed border-slate-300 bg-white/70'} flex flex-col justify-between aspect-square text-center">
                  <div>
                    <div class="text-xs font-bold text-slate-800">${labels[slot]}</div>
                    <div class="text-[10px] text-slate-500">${isCaptured ? 'Live Frame Stored' : 'Angle Required'}</div>
                  </div>

                  <div class="mt-2">
                    ${isCaptured ? `
                      <button onclick="clearPhoto('${slot}')" class="text-xs font-bold text-rose-600 hover:underline">Retake</button>
                    ` : `
                      <button onclick="simulateCapturePhoto('${slot}')" class="px-2.5 py-1 text-xs font-bold text-indigo-900 bg-white border border-indigo-200 rounded-xl shadow-xs">
                        Capture
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="flex justify-between pt-4 border-t border-slate-100">
            <button onclick="goToStep(1)" class="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl">
              Back
            </button>
            <button onclick="handleStep2Next()" class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
              <span>Next: Review &amp; Submit</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- STEP 3: REVIEW & LIVE ADJUDICATE -->
      ${AppState.currentStep === 3 ? `
        <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 space-y-6 text-center">
          <div class="w-16 h-16 rounded-3xl bg-indigo-900 text-white flex items-center justify-center mx-auto shadow-xl">
            <i data-lucide="zap" class="w-8 h-8 text-amber-300"></i>
          </div>

          <div>
            <h2 class="text-2xl font-bold font-display text-slate-900">Ready for Multi-Agent AI Adjudication</h2>
            <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              Our 4 autonomous microservices (Document OCR, Vision Detection, Spring AI Costing, and Fraud Scans) will execute simultaneously.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 max-w-md mx-auto text-left text-xs space-y-2">
            <div class="flex justify-between text-slate-600"><span>Attached Documents:</span> <strong class="text-slate-900">RC, DL, Claim Form (3)</strong></div>
            <div class="flex justify-between text-slate-600"><span>Vehicle Damage Photos:</span> <strong class="text-slate-900">4 Optical Views</strong></div>
            <div class="flex justify-between text-slate-600"><span>Insurance Policy:</span> <strong class="text-slate-900">POL-PAC-9920194 (Active)</strong></div>
          </div>

          <div class="flex justify-center gap-3 pt-2">
            <button onclick="goToStep(2)" class="px-5 py-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl">
              Back
            </button>
            <button onclick="startAiProcessing()" class="btn-indigo text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 cursor-pointer">
              <i data-lucide="play" class="w-4 h-4 text-amber-300 fill-amber-300"></i>
              <span>Launch Autonomous Settlement</span>
            </button>
          </div>
        </div>
      ` : ''}

    </div>
  `;
}

function goToStep(s) {
  AppState.currentStep = s;
  renderApp();
}

function handleStep1Next() {
  simulateUploadDoc('rc');
  simulateUploadDoc('dl');
  simulateUploadDoc('claimForm');
  goToStep(2);
}

function handleStep2Next() {
  simulateCapturePhoto('front');
  simulateCapturePhoto('rear');
  simulateCapturePhoto('leftSide');
  simulateCapturePhoto('rightSide');
  goToStep(3);
}

function simulateUploadDoc(k) {
  AppState.uploads.docs[k] = MOCK_ASSETS.docs[k];
  renderApp();
}

function clearDocUpload(k) {
  AppState.uploads.docs[k] = null;
  renderApp();
}

function simulateCapturePhoto(k) {
  AppState.uploads.photos[k] = MOCK_ASSETS.damagePhotos[k];
  renderApp();
}

function clearPhoto(k) {
  AppState.uploads.photos[k] = null;
  renderApp();
}

function autoFillDemoData() {
  simulateUploadDoc('rc');
  simulateUploadDoc('dl');
  simulateUploadDoc('claimForm');
  simulateCapturePhoto('front');
  simulateCapturePhoto('rear');
  simulateCapturePhoto('leftSide');
  simulateCapturePhoto('rightSide');
  AppState.currentStep = 3;
  renderApp();
  showToast('Auto-filled all credentials and optical frames!');
}

// Processing Pipeline Simulation
function startAiProcessing() {
  navigateTo('claim-processing');
  
  const stages = [
    { title: "Document Agent", desc: "Running local OCR & Sarathi validation..." },
    { title: "Damage Assessment Agent", desc: "Isolating component boundaries & depth..." },
    { title: "Spring AI Cost Agent", desc: "Reconciling live OEM parts & labour..." },
    { title: "Fraud & Anomaly Suite", desc: "Validating perceptual image hashes..." },
    { title: "Deterministic Decision Engine", desc: "Evaluating IRDAI statutory criteria..." }
  ];

  let current = 0;
  const timer = setInterval(() => {
    current++;
    const progressEl = document.getElementById('processing-progress-bar');
    const stageEl = document.getElementById('processing-stage-text');
    if (progressEl) progressEl.style.width = `${(current / stages.length) * 100}%`;
    if (stageEl && stages[current]) stageEl.innerText = stages[current].desc;

    if (current >= stages.length) {
      clearInterval(timer);
      showToast('Autonomous claim adjudication completed!');
      navigateTo('claim-detail', 'CLM-2026-00842');
    }
  }, 500);
}

function renderProcessingScreen(container) {
  container.innerHTML = `
    <div class="max-w-xl mx-auto my-12 text-center space-y-6 animate-fade-in-up">
      <div class="w-20 h-20 rounded-3xl bg-indigo-900 text-white flex items-center justify-center mx-auto shadow-2xl animate-pulse">
        <i data-lucide="cpu" class="w-10 h-10 text-amber-300"></i>
      </div>

      <div>
        <h2 class="text-2xl font-bold font-display text-slate-900">Autonomous Settlement in Progress</h2>
        <p id="processing-stage-text" class="text-xs text-slate-500 mt-1">Concurrently querying Document, Vision, and Cost agents...</p>
      </div>

      <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
        <div id="processing-progress-bar" class="bg-gradient-to-r from-indigo-700 via-indigo-500 to-amber-400 h-full rounded-full transition-all duration-300" style="width: 20%"></div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------------------
// 9. EDGE STATES: SKELETON LOADING, ERROR BANNER, EMPTY STATE
// ------------------------------------------------------------------------------

function renderLoadingSkeleton(container) {
  container.innerHTML = `
    <div class="space-y-6 max-w-6xl mx-auto">
      <div class="h-44 skeleton rounded-3xl"></div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="h-28 skeleton rounded-2xl"></div>
        <div class="h-28 skeleton rounded-2xl"></div>
        <div class="h-28 skeleton rounded-2xl"></div>
        <div class="h-28 skeleton rounded-2xl"></div>
      </div>
      <div class="h-96 skeleton rounded-3xl"></div>
    </div>
  `;
}

function renderErrorState(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto my-16 text-center space-y-4 p-8 rounded-3xl glass-card border border-rose-200 shadow-xl">
      <div class="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
        <i data-lucide="wifi-off" class="w-7 h-7"></i>
      </div>
      <h2 class="text-xl font-bold text-slate-900 font-display">Service Connection Error</h2>
      <p class="text-xs text-slate-500">${AppState.errorMessage}</p>
      <div class="pt-2">
        <button onclick="setUiState('normal')" class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs font-bold">
          Retry Connection
        </button>
      </div>
    </div>
  `;
}

function renderEmptyState(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto my-16 text-center space-y-4 p-8 rounded-3xl glass-card border border-slate-200 shadow-xl">
      <div class="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
        <i data-lucide="file-plus-2" class="w-8 h-8"></i>
      </div>
      <h2 class="text-xl font-bold text-slate-900 font-display">No Claims Recorded Yet</h2>
      <p class="text-xs text-slate-500">You haven't filed any motor insurance claims under policy POL-PAC-9920194.</p>
      <div class="pt-2">
        <button onclick="startNewClaimFlow()" class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs font-bold">
          File Your First Claim
        </button>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------------------
// 10. MODAL DIALOGS & TOAST SYSTEM
// ------------------------------------------------------------------------------

function openDocPreviewModal(docKey) {
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  modal.className = "fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-fade-in-up">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-slate-900">Extracted Registration Certificate (RC)</h3>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4 text-slate-600"></i>
        </button>
      </div>
      <div class="rounded-2xl overflow-hidden border border-slate-200 aspect-[400/260] bg-slate-50">
        <img src="${MOCK_ASSETS.docs[docKey] || MOCK_ASSETS.docs.rc}" class="w-full h-full object-contain" alt="RC Preview" />
      </div>
    </div>
  `;
  setTimeout(() => lucide.createIcons(), 20);
}

function openPhotoPreviewModal(photoKey) {
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  modal.className = "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-fade-in-up">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-slate-900">Damage Photo Optical Inspection</h3>
          <p class="text-xs text-slate-500">AI Bounding Box Overlay &bull; Front Bumper Fascia (96% Confidence)</p>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4 text-slate-600"></i>
        </button>
      </div>
      <div class="rounded-2xl overflow-hidden border border-slate-200 aspect-[400/300] bg-slate-950">
        <img src="${MOCK_ASSETS.damagePhotos[photoKey] || MOCK_ASSETS.damagePhotos.front}" class="w-full h-full object-contain" alt="Damage View" />
      </div>
    </div>
  `;
  setTimeout(() => lucide.createIcons(), 20);
}

function openExportModal(claimId) {
  showToast(`Exported formal adjudication PDF for claim ${claimId}`);
}

function closeModal() {
  const modal = document.getElementById('app-modal');
  if (modal) modal.className = "hidden";
}

function showToast(message) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;

  toast.innerHTML = `
    <div class="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 text-xs font-semibold animate-fade-in-up">
      <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
      <span>${message}</span>
    </div>
  `;
  toast.classList.remove('hidden');
  setTimeout(() => lucide.createIcons(), 20);
  setTimeout(() => toast.classList.add('hidden'), 3200);
}
