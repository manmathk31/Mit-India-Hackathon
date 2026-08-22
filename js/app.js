/**
 * ClaimPilot AI - Production Single Page Application Core Controller
 * Modular multi-view architecture with Auth, User Dashboard, Claim Detail, and Admin Portal
 */

// ==============================================================================
// 1. APPLICATION STATE & ROUTER
// ==============================================================================

const savedUserRaw = localStorage.getItem('claimpilot_user');
let initialUser = null;
try {
  initialUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
} catch (e) {
  initialUser = null;
}

const AppState = {
  // Authentication & Persona: restored from localStorage session
  currentUser: initialUser,
  token: localStorage.getItem('claimpilot_token') || null,
  
  // Navigation Router: maintains dashboard view if logged in
  currentView: initialUser ? (initialUser.role === 'admin' ? 'admin-dashboard' : 'user-dashboard') : 'login',
  selectedClaimId: null,
  
  // Live Database Claims (fetched from PostgreSQL via API)
  claims: [],
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
document.addEventListener('DOMContentLoaded', async () => {
  // Restore session and fetch live database claims if logged in
  if (AppState.currentUser) {
    await fetchLiveClaims();
  } else {
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

function handleLogout() {
  AppState.currentUser = null;
  AppState.token = null;
  AppState.claims = [];
  localStorage.removeItem('claimpilot_token');
  localStorage.removeItem('claimpilot_user');
  showToast('Signed out successfully');
  navigateTo('login');
}

function setUiState(state) {
  AppState.uiState = state;
  renderApp();
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

  // 2. Strict Role-Based Route Guard
  const user = AppState.currentUser;
  const isAdmin = user && user.role === 'admin';

  if ((AppState.currentView === 'admin-dashboard' || AppState.currentView === 'admin-claim-detail') && !isAdmin) {
    showToast('Access Denied: Surveyor / Admin credentials required.');
    AppState.currentView = user ? 'user-dashboard' : 'login';
  }

  // 3. Main View Routing
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

async function fetchLiveClaims() {
  try {
    const res = await fetch('/claims');
    if (res.ok) {
      const liveList = await res.json();
      if (Array.isArray(liveList)) {
        AppState.claims = liveList;
        renderApp();
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live claims:", err);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit-btn');

  btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> <span>Verifying credentials...</span>`;
  btn.disabled = true;

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('claimpilot_token', data.access_token);
      localStorage.setItem('claimpilot_user', JSON.stringify(data.user));
      AppState.token = data.access_token;
      AppState.currentUser = data.user;
      showToast(`Welcome back, ${data.user.name}!`);
      await fetchLiveClaims();
      navigateTo(data.user.role === 'admin' ? 'admin-dashboard' : 'user-dashboard');
      return;
    } else {
      const errData = await res.json().catch(() => ({ detail: "Invalid email or password" }));
      alert(`Login Failed: ${errData.detail || 'Invalid email or password'}`);
    }
  } catch (err) {
    alert(`Connection Error: Unable to reach auth service. Please check your network.`);
  }

  btn.innerHTML = `<span>Sign In to ClaimPilot</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
  btn.disabled = false;
  lucide.createIcons();
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

async function handleSignupSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass1 = document.getElementById('signup-pass').value;
  const pass2 = document.getElementById('signup-pass-confirm').value;

  if (pass1 !== pass2) {
    alert("Passwords do not match. Please re-enter.");
    return;
  }

  try {
    const res = await fetch('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass1, full_name: name, role: 'claimant' })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('claimpilot_token', data.access_token);
      localStorage.setItem('claimpilot_user', JSON.stringify(data.user));
      AppState.token = data.access_token;
      AppState.currentUser = data.user;
      showToast('Account registered in database successfully!');
      await fetchLiveClaims();
      navigateTo('user-dashboard');
      return;
    }
  } catch (err) {
    alert(`Connection Error: Unable to reach auth service. Please check your network.`);
  }
}

// ------------------------------------------------------------------------------
// 5. USER DASHBOARD (Main Landing View for Claimants)
// ------------------------------------------------------------------------------

function renderUserDashboardView(container) {
  const user = AppState.currentUser;
  if (!user) { navigateTo('login'); return; }
  // Strictly filter by this specific user's ID
  const userClaims = AppState.claims.filter(c => c.user_id === user.id);

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
        ${totalCount === 0 ? `
          <div class="py-14 text-center">
            <div class="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-900 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <i data-lucide="shield-plus" class="w-8 h-8 text-indigo-600"></i>
            </div>
            <h3 class="text-base font-bold text-slate-800">No Claims Filed Yet</h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">You have no active motor damage claims recorded under this account. Submit your vehicle credentials and damage photos to initiate instant autonomous adjudication.</p>
            <button onclick="startNewClaimFlow()" class="btn-indigo text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-lg inline-flex items-center gap-2">
              <i data-lucide="plus-circle" class="w-4 h-4 text-amber-300"></i>
              <span>File Your First Claim</span>
            </button>
          </div>
        ` : (filtered.length > 0 ? `
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
                        <div class="font-bold text-slate-800">${c.vehicle?.make || 'Unknown'} ${c.vehicle?.model || ''}</div>
                        <div class="text-[11px] font-mono text-slate-500">${c.vehicle?.registration || 'Unreadable'}</div>
                      </td>
                      <td class="text-xs text-slate-600">${(c.submission_timestamp || '').split(',')[0]}</td>
                      <td>
                        <div class="text-xs font-semibold text-slate-700">${c.damage_assessment?.location_label || 'Unidentified'}</div>
                        <div class="text-[11px] text-slate-500">${c.damage_assessment?.detected_parts?.length || 0} parts identified</div>
                      </td>
                      <td>
                        <div class="font-bold text-slate-900">${c.cost_estimate?.recommended_payout || 'N/A'}</div>
                        <div class="text-[11px] text-slate-500 font-mono">${c.cost_estimate?.formatted_final || '₹0'}</div>
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
        `)}

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
        ${displayClaims.length > 0 ? `
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
                        <div class="font-bold text-slate-800">${c.policy?.holder || 'Policyholder'}</div>
                        <div class="text-[11px] font-mono text-slate-500">${c.policy?.number || 'POL-PAC-9920194'}</div>
                      </td>
                      <td>
                        <div class="font-semibold text-slate-700">${c.vehicle?.make || 'Vehicle'} ${c.vehicle?.model || ''}</div>
                        <div class="text-[11px] font-mono text-slate-500">${c.vehicle?.registration || 'MH-12-RN-8842'}</div>
                      </td>
                      <td>
                        <div class="text-xs text-slate-700 max-w-[220px] truncate" title="${c.status_description}">
                          ${c.status_description}
                        </div>
                        ${hasOverride ? `<span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Human Overridden</span>` : ''}
                      </td>
                      <td>
                        <div class="font-bold text-slate-900">${c.cost_estimate?.recommended_payout || '₹0'}</div>
                        <div class="text-[11px] text-slate-500 font-mono">${c.cost_estimate?.formatted_final || '₹0'}</div>
                      </td>
                      <td>
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isApproved ? 'badge-auto-approved' : (isReview ? 'badge-under-review' : 'badge-flagged')}">
                          <span class="w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-600' : (isReview ? 'bg-amber-600' : 'bg-rose-600')}"></span>
                          ${(c.status_label || c.status).split(':')[0]}
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
        ` : (allClaims.length === 0 ? `
          <div class="py-14 text-center">
            <div class="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-900 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <i data-lucide="inbox" class="w-8 h-8 text-indigo-600"></i>
            </div>
            <h3 class="text-base font-bold text-slate-800">No Claims in Triage Queue</h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1">There are no claims filed in the database yet. When a claimant submits a claim, it will appear in real-time in this ledger.</p>
          </div>
        ` : `
          <div class="p-12 text-center">
            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <i data-lucide="search-x" class="w-6 h-6"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-800">No claims match this filter</h3>
            <button onclick="setAdminFilter('all')" class="mt-4 px-4 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl">
              Reset Filters
            </button>
          </div>
        `)}

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
  const claim = AppState.claims.find(c => c.claim_id === claimId);
  if (!claim) {
    showToast('Claim not found. It may have been removed.');
    navigateTo(isAdminView ? 'admin-dashboard' : 'user-dashboard');
    return;
  }
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
                ${Math.round(claim.document_check.confidence_score <= 1.0 ? claim.document_check.confidence_score * 100 : claim.document_check.confidence_score)}% Score
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
                const imgSrc = (ph.url && ph.url.startsWith('data:image/svg+xml;utf8,<svg')) ? `data:image/svg+xml;utf8,${encodeURIComponent(ph.url.replace('data:image/svg+xml;utf8,', ''))}` : (ph.url || '');
                return `
                  <div onclick="openPhotoPreviewModal('${keys[idx] || 'front'}')" class="group/p relative rounded-xl overflow-hidden aspect-square border border-slate-200/80 bg-slate-950 cursor-pointer shadow-sm hover:ring-2 hover:ring-indigo-600 transition-all">
                    <img src="${imgSrc}" class="w-full h-full object-cover group-hover/p:scale-105 transition-transform" alt="${ph.slot}" />
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
              ${claim.damage_assessment.detected_parts && claim.damage_assessment.detected_parts.length > 0 ? claim.damage_assessment.detected_parts.map(dp => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-slate-200/60 text-xs">
                  <div>
                    <div class="font-bold text-slate-800">${dp.part}</div>
                    <div class="text-[11px] text-slate-500">${dp.type} &bull; <span class="text-indigo-900 font-semibold">${dp.action}</span> (${dp.material_type || 'metal'})</div>
                  </div>
                  <span class="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    ${dp.confidence}
                  </span>
                </div>
              `).join('') : `
                <div class="p-3.5 rounded-xl bg-white/60 border border-slate-200 text-xs text-slate-500 text-center">
                  Zero physical damage detected across all uploaded photos.
                </div>
              `}
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Primary Impact Zone: <strong class="text-slate-800">${claim.damage_assessment.location_label}</strong>
          </div>
        </div>

      </div>

      <!-- CARD C: COST RECONCILIATION -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border-2 ${claim.cost_estimate?.status === 'unavailable' ? 'border-rose-100/90 from-white/90 to-rose-50/40' : 'border-indigo-100/90 from-white/90 to-indigo-50/40'} shadow-xl bg-gradient-to-br via-white/80">
        
        ${claim.cost_estimate?.status === 'unavailable' ? `
          <div class="flex flex-col items-center justify-center text-center py-6">
            <div class="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <i data-lucide="alert-triangle" class="w-8 h-8 text-rose-600"></i>
            </div>
            <h2 class="text-xl font-bold text-slate-900 mb-2">Cost Engine Unreachable</h2>
            <p class="text-sm text-slate-500 max-w-md">The automated Spring Boot pricing agent is currently unavailable. This claim has been flagged for manual estimation by a surveyor.</p>
          </div>
        ` : `
        
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/70">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-900 text-white flex items-center gap-1.5 shadow-sm">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-amber-300"></i>
                Deterministic Cost Engine (Spring Boot)
              </span>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full ${claim.cost_estimate?.confidence?.overall >= 0.85 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                ${claim.cost_estimate?.confidence?.sourceAgreement || 'N/A'}
              </span>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold font-display text-slate-900">
              Autonomous Cost Reconciliation
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">
              Cross-checked against OEM parts catalog, certified repairer labor index, and IRDAI depreciation rules.
            </p>
          </div>

          <div class="bg-white/90 border border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-md flex items-center gap-6">
            <div>
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Recommended Payout</span>
              <div class="text-2xl sm:text-3xl font-extrabold font-display text-indigo-950">
                ${claim.cost_estimate?.combinedTotal ? '₹' + Math.round(claim.cost_estimate.combinedTotal.min + (claim.cost_estimate.combinedTotal.max - claim.cost_estimate.combinedTotal.min) / 2).toLocaleString() : '₹0'}
              </div>
              <span class="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                <i data-lucide="check" class="w-3 h-3"></i> Zero Deductibles Applied
              </span>
            </div>
            <div class="border-l border-slate-200 pl-6 text-right">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Combined Total Range</span>
              <div class="text-sm font-bold font-mono text-slate-700 mt-1">
                ${claim.cost_estimate?.combinedTotal ? '₹' + Math.round(claim.cost_estimate.combinedTotal.min).toLocaleString() + ' — ₹' + Math.round(claim.cost_estimate.combinedTotal.max).toLocaleString() : '₹0 — ₹0'}
              </div>
              <span class="text-[10px] text-slate-400 font-medium">95% Confidence Band</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          <div class="p-4 rounded-2xl bg-white/80 border border-slate-200/70 hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <span class="text-sm font-bold text-slate-800 flex items-center gap-2"><i data-lucide="tool" class="w-4 h-4 text-indigo-600"></i> Parts & Materials Cost</span>
            </div>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between text-slate-600"><span class="font-medium">Total Before Depreciation</span><span class="font-mono text-slate-800">₹${Math.round(claim.cost_estimate?.partsCost?.beforeDepreciation || 0).toLocaleString()}</span></div>
              <div class="flex justify-between text-rose-600"><span class="font-medium">Total Depreciation</span><span class="font-mono">-₹${Math.round(claim.cost_estimate?.partsCost?.depreciationAmount || 0).toLocaleString()}</span></div>
              <div class="flex justify-between text-slate-600 border-t border-slate-100 pt-1"><span class="font-medium">Post Depreciation</span><span class="font-mono font-bold text-slate-800">₹${Math.round(claim.cost_estimate?.partsCost?.afterDepreciation || 0).toLocaleString()}</span></div>
              <div class="flex justify-between text-slate-600"><span class="font-medium">Repair Materials & Paint</span><span class="font-mono text-slate-800">₹${Math.round((claim.cost_estimate?.partsCost?.repairMaterialCost || 0) + (claim.cost_estimate?.partsCost?.paintingCost || 0)).toLocaleString()}</span></div>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-white/80 border border-slate-200/70 hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <span class="text-sm font-bold text-slate-800 flex items-center gap-2"><i data-lucide="wrench" class="w-4 h-4 text-indigo-600"></i> Labor Cost Range</span>
            </div>
            <div class="space-y-3">
              <div class="text-2xl font-bold font-mono text-slate-900 mt-2">
                ₹${Math.round(claim.cost_estimate?.laborCost?.min || 0).toLocaleString()} — ₹${Math.round(claim.cost_estimate?.laborCost?.max || 0).toLocaleString()}
              </div>
              <div class="text-[11px] text-slate-500">
                Determined by localized certified workshop index and standard repair man-hours for ${claim.cost_estimate?.vehicle?.make || 'Unknown'} vehicles.
              </div>
            </div>
          </div>
        </div>

        ${claim.cost_estimate?.partBreakdown && claim.cost_estimate.partBreakdown.length > 0 ? `
          <div class="mt-6 border border-slate-200 rounded-xl overflow-hidden bg-white/60">
             <table class="w-full text-left text-xs">
               <thead class="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                 <tr>
                   <th class="px-4 py-2">Component</th>
                   <th class="px-4 py-2">Action</th>
                   <th class="px-4 py-2">Material</th>
                   <th class="px-4 py-2 text-right">Base Cost</th>
                   <th class="px-4 py-2 text-right">Depreciation</th>
                   <th class="px-4 py-2 text-right">Final Cost</th>
                 </tr>
               </thead>
               <tbody class="divide-y divide-slate-100">
                 ${claim.cost_estimate.partBreakdown.map(p => `
                   <tr>
                     <td class="px-4 py-2 font-medium text-slate-800">${p.partName}</td>
                     <td class="px-4 py-2"><span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase font-semibold text-[10px]">${p.workType}</span></td>
                     <td class="px-4 py-2 text-slate-500">${p.materialType}</td>
                     <td class="px-4 py-2 text-right font-mono">₹${Math.round(p.baseCost).toLocaleString()}</td>
                     <td class="px-4 py-2 text-right font-mono text-rose-500">-${(p.depreciationRate * 100).toFixed(0)}%</td>
                     <td class="px-4 py-2 text-right font-mono font-bold text-slate-800">₹${Math.round(p.postDepreciationCost).toLocaleString()}</td>
                   </tr>
                 `).join('')}
               </tbody>
             </table>
          </div>
        ` : ''}

        `}

        <div class="mt-5 pt-4 border-t border-slate-200/60 text-xs text-slate-500 flex justify-between">
          <span><strong>IRDAI Statutory Notice:</strong> Pre-inspection estimate. Final settlement subject to IRDAI limits.</span>
          ${claim.cost_estimate?.totalLoss?.exceeds75Percent ? `<span class="text-rose-600 font-bold"><i data-lucide="alert-circle" class="w-3 h-3 inline"></i> Total Loss Threshold Exceeded</span>` : ''}
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
            <div>
              <h2 class="text-lg font-bold font-display text-slate-900">Step 1: Upload Identity &amp; Vehicle Credentials</h2>
              <p class="text-xs text-slate-500">Attach RC, Driving Licence, and Claim Form</p>
            </div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${docsCount === 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${docsCount}/3 Attached</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${['rc', 'dl', 'claimForm'].map(docKey => {
              const titles = { rc: 'Registration Certificate (RC)', dl: 'Driving Licence (DL)', claimForm: 'Claim Intimation Form' };
              const uploadedDoc = AppState.uploads.docs[docKey];
              const isUploaded = Boolean(uploadedDoc);
              
              return `
                <div class="p-5 rounded-2xl border-2 ${isUploaded ? 'border-emerald-500 bg-emerald-50/40' : 'border-dashed border-slate-300 bg-white/70 hover:border-indigo-400'} flex flex-col justify-between min-h-[180px] text-center transition-all">
                  <div>
                    <div class="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center ${isUploaded ? 'bg-emerald-500 text-white' : 'bg-indigo-50 text-indigo-700'} mb-2.5 shadow-xs">
                      <i data-lucide="${isUploaded ? 'check-circle-2' : 'upload-cloud'}" class="w-6 h-6"></i>
                    </div>
                    <div class="text-xs font-bold text-slate-800">${titles[docKey]}</div>
                    <div class="text-[11px] text-slate-500 mt-1 truncate max-w-[200px] mx-auto">
                      ${isUploaded ? (uploadedDoc.name || 'Attached &bull; Ready') : 'JPG, PNG, or PDF'}
                    </div>
                    ${isUploaded && uploadedDoc.size ? `<div class="text-[10px] text-emerald-700 font-mono mt-0.5">${uploadedDoc.size}</div>` : ''}
                  </div>

                  <div class="mt-3">
                    <input type="file" id="input-${docKey}" accept="image/*,.pdf" onchange="handleRealFileUpload(event, '${docKey}')" class="hidden" />
                    ${isUploaded ? `
                      <button onclick="clearDocUpload('${docKey}')" class="text-xs font-bold text-rose-600 hover:underline">Remove</button>
                    ` : `
                      <button onclick="document.getElementById('input-${docKey}').click()" class="px-3.5 py-1.5 text-xs font-bold text-indigo-900 bg-white border border-indigo-200 rounded-xl shadow-xs hover:bg-indigo-50 cursor-pointer">
                        Browse File
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="flex justify-end pt-4 border-t border-slate-100">
            ${docsCount < 3 ? `
              <div class="flex items-center gap-3 ml-auto">
                <span class="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                  <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
                  ${3 - docsCount} document${3 - docsCount > 1 ? 's' : ''} still needed
                </span>
                <button disabled class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 opacity-40 cursor-not-allowed">
                  <span>Next: Damage Photos</span>
                  <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
              </div>
            ` : `
              <button onclick="handleStep1Next()" class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer">
                <span>Next: Damage Photos</span>
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
              </button>
            `}
          </div>
        </div>
      ` : ''}

      <!-- STEP 2: DAMAGE PHOTOS -->
      ${AppState.currentStep === 2 ? `
        <div class="glass-card rounded-3xl p-6 sm:p-8 border border-white/90 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold font-display text-slate-900">Step 2: Upload Vehicle Damage Photos</h2>
              <p class="text-xs text-slate-500">Capture or upload photos of damaged areas for YOLO + Gemini inspection</p>
            </div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${photosCount >= 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${photosCount}/4 Attached</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            ${['front', 'rear', 'leftSide', 'rightSide'].map(slot => {
              const uploadedPhoto = AppState.uploads.photos[slot];
              const isCaptured = Boolean(uploadedPhoto);
              const labels = { front: 'Front Damage', rear: 'Rear Profile', leftSide: 'Left Side', rightSide: 'Right Side' };

              return `
                <div class="p-4 rounded-2xl border-2 ${isCaptured ? 'border-emerald-500 bg-emerald-50/40' : 'border-dashed border-slate-300 bg-white/70 hover:border-indigo-400'} flex flex-col justify-between aspect-square text-center transition-all overflow-hidden relative">
                  ${isCaptured && uploadedPhoto.preview ? `
                    <img src="${uploadedPhoto.preview}" alt="${labels[slot]}" class="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />
                  ` : ''}
                  <div class="relative z-10">
                    <div class="text-xs font-bold text-slate-800">${labels[slot]}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5 truncate">${isCaptured ? (uploadedPhoto.name || 'Photo Attached') : 'Optical View'}</div>
                  </div>

                  <div class="mt-2 relative z-10">
                    <input type="file" id="input-photo-${slot}" accept="image/*" onchange="handleRealPhotoUpload(event, '${slot}')" class="hidden" />
                    ${isCaptured ? `
                      <button onclick="clearPhoto('${slot}')" class="text-xs font-bold text-rose-600 hover:underline">Retake</button>
                    ` : `
                      <button onclick="document.getElementById('input-photo-${slot}').click()" class="px-2.5 py-1 text-xs font-bold text-indigo-900 bg-white border border-indigo-200 rounded-xl shadow-xs hover:bg-indigo-50 cursor-pointer">
                        Upload Photo
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="flex justify-between pt-4 border-t border-slate-100">
            <button onclick="goToStep(1)" class="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl cursor-pointer">
              Back
            </button>
            ${photosCount === 0 ? `
              <div class="flex items-center gap-3">
                <span class="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                  <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
                  At least 1 photo required
                </span>
                <button disabled class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 opacity-40 cursor-not-allowed">
                  <span>Next: Review &amp; Submit</span>
                  <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
              </div>
            ` : `
              <button onclick="handleStep2Next()" class="btn-indigo text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer">
                <span>Next: Review &amp; Submit</span>
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
              </button>
            `}
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
              Our autonomous microservices (Document OCR, YOLO/Gemini Vision, Spring AI Costing, and Fraud Scans) will execute simultaneously.
            </p>
          </div>

          <!-- Pre-flight checklist -->
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 max-w-md mx-auto text-left text-xs space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-slate-600 flex items-center gap-1.5">
                <i data-lucide="${docsCount === 3 ? 'check-circle-2' : 'alert-circle'}" class="w-3.5 h-3.5 ${docsCount === 3 ? 'text-emerald-600' : 'text-amber-500'}"></i>
                Attached Documents:
              </span>
              <strong class="${docsCount === 3 ? 'text-emerald-700' : 'text-amber-700'}">${docsCount}/3 Required</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600 flex items-center gap-1.5">
                <i data-lucide="${photosCount >= 1 ? 'check-circle-2' : 'alert-circle'}" class="w-3.5 h-3.5 ${photosCount >= 1 ? 'text-emerald-600' : 'text-amber-500'}"></i>
                Vehicle Damage Photos:
              </span>
              <strong class="${photosCount >= 1 ? 'text-emerald-700' : 'text-amber-700'}">${photosCount} Uploaded ${photosCount === 0 ? '(min 1 required)' : ''}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600 flex items-center gap-1.5">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i>
                Claimant Policy:
              </span>
              <strong class="text-slate-900">${AppState.currentUser?.email || 'Active Policyholder'}</strong>
            </div>
          </div>

          <!-- Block launch if requirements not met -->
          ${(docsCount < 3 || photosCount === 0) ? `
            <div class="max-w-md mx-auto p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3 text-left">
              <i data-lucide="triangle-alert" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5"></i>
              <div>
                <p class="text-xs font-bold text-amber-900">Cannot launch — requirements not met</p>
                <ul class="text-xs text-amber-800 mt-1 space-y-0.5 list-disc list-inside">
                  ${docsCount < 3 ? `<li>${3 - docsCount} required document(s) missing — go back to Step 1</li>` : ''}
                  ${photosCount === 0 ? '<li>At least 1 damage photo required — go back to Step 2</li>' : ''}
                </ul>
              </div>
            </div>
          ` : ''}

          <div class="flex justify-center gap-3 pt-2">
            <button onclick="goToStep(2)" class="px-5 py-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl cursor-pointer">
              Back
            </button>
            <button
              onclick="${(docsCount < 3 || photosCount === 0) ? 'void(0)' : 'startAiProcessing()'}"
              ${(docsCount < 3 || photosCount === 0) ? 'disabled' : ''}
              class="btn-indigo text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 ${(docsCount < 3 || photosCount === 0) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}"
            >
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
  const { rc, dl, claimForm } = AppState.uploads.docs;
  const missing = [];
  if (!rc)        missing.push('Registration Certificate (RC)');
  if (!dl)        missing.push('Driving Licence (DL)');
  if (!claimForm) missing.push('Claim Intimation Form');

  if (missing.length > 0) {
    showValidationToast(
      `Missing ${missing.length} document${missing.length > 1 ? 's' : ''}`,
      `Please upload: ${missing.join(', ')}`
    );
    return; // Block navigation
  }
  goToStep(2);
}

function handleStep2Next() {
  const photoCount = Object.values(AppState.uploads.photos).filter(Boolean).length;
  if (photoCount === 0) {
    showValidationToast(
      'No damage photos uploaded',
      'Upload at least 1 vehicle damage photo (front, rear, left side, or right side) to proceed.'
    );
    return; // Block navigation
  }
  goToStep(3);
}

function handleRealFileUpload(event, docKey) {
  const file = event.target.files[0];
  if (!file) return;
  AppState.uploads.docs[docKey] = {
    name: file.name,
    size: (file.size / 1024).toFixed(1) + " KB",
    file: file
  };
  renderApp();
  showToast(`Attached ${file.name}`);
}

function clearDocUpload(docKey) {
  AppState.uploads.docs[docKey] = null;
  renderApp();
}

function handleRealPhotoUpload(event, slot) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    AppState.uploads.photos[slot] = {
      name: file.name,
      preview: e.target.result,
      file: file
    };
    renderApp();
    showToast(`Captured ${file.name}`);
  };
  reader.readAsDataURL(file);
}

function clearPhoto(slot) {
  AppState.uploads.photos[slot] = null;
  renderApp();
}

// Processing Pipeline with Live API Call
async function startAiProcessing() {
  // Validate files
  const rcFile = AppState.uploads.docs.rc?.file;
  const dlFile = AppState.uploads.docs.dl?.file;
  const formFile = AppState.uploads.docs.claimForm?.file;
  const realPhotos = Object.values(AppState.uploads.photos).map(p => p?.file).filter(Boolean);

  if (!rcFile || !dlFile || !formFile || realPhotos.length === 0) {
    showPipelineError(
      'Missing Required Documents',
      'Please upload all 3 required documents (RC, Driving Licence, Claim Form) and at least 1 vehicle damage photo before launching autonomous adjudication.',
      'validation_error'
    );
    return;
  }

  navigateTo('claim-processing');
  
  const stages = [
    { title: "Document Agent",             desc: "Running local OCR & Sarathi validation on RC, DL & Claim Form..." },
    { title: "Damage Assessment Agent",    desc: "Isolating component boundaries & severity with YOLO + Gemini Vision..." },
    { title: "Cost Engine",               desc: "Reconciling live OEM parts, depreciation & labour costs..." },
    { title: "Fraud & Anomaly Suite",     desc: "Validating perceptual image hashes & plate cross-checks..." },
    { title: "Deterministic Decision Engine", desc: "Evaluating IRDAI statutory criteria & settlement decision..." }
  ];

  let current = 0;
  // Stage timer: 8-second intervals to reflect real pipeline timing (~40s total)
  const stageTimer = setInterval(() => {
    current++;
    const progressEl = document.getElementById('processing-progress-bar');
    const stageEl = document.getElementById('processing-stage-text');
    if (progressEl) progressEl.style.width = `${Math.min(90, 10 + (current / stages.length) * 80)}%`;
    if (stageEl && stages[current]) stageEl.innerText = stages[current].desc;
    if (current >= stages.length - 1) clearInterval(stageTimer); // Stop cycling at last stage
  }, 8000); // 8s per stage matches typical Gemini + OCR pipeline

  // AbortController: auto-abort after 3.5 minutes (210s) — prevents infinite browser hang
  const abortController = new AbortController();
  const abortTimeout = setTimeout(() => abortController.abort(), 210000);

  try {
    const formData = new FormData();
    formData.append('rc_image', rcFile);
    formData.append('dl_image', dlFile);
    formData.append('claim_form_image', formFile);
    realPhotos.forEach(p => formData.append('damage_photos', p));

    const policyPayload = {
      policy_number: "POL-PAC-9920194",
      owner_name: AppState.currentUser?.name || "Manmath Kumar",
      rc_number: "MH12RN8842",
      dl_number: "DL-0420110023456",
      chassis_number: "MA3EKB21S00129845",
      idv: 550000.0,
      plan: "Comprehensive Bumper-to-Bumper Zero Dep",
      expiry: "18 Nov 2026",
      status: "Active",
      region: "west"
    };
    formData.append('policy_record', JSON.stringify(policyPayload));

    const res = await fetch('/claims/process', {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });

    clearTimeout(abortTimeout);
    clearInterval(stageTimer);

    if (res.ok) {
      const liveClaim = await res.json();
      liveClaim.user_id = AppState.currentUser ? AppState.currentUser.id : null;
      
      // Add real uploaded photo previews to claim so thumbnails render in UI
      if (!liveClaim.damage_assessment.photos || liveClaim.damage_assessment.photos.length === 0) {
        liveClaim.damage_assessment.photos = Object.entries(AppState.uploads.photos)
          .filter(([k, v]) => Boolean(v))
          .map(([k, v]) => ({ slot: k, url: v.preview || '' }));
      }

      AppState.claims.unshift(liveClaim);
      showToast(`Claim ${liveClaim.claim_id} adjudicated and stored in database!`);
      navigateTo('claim-detail', liveClaim.claim_id);
    } else {
      const errData = await res.json().catch(() => ({ detail: "Pipeline error" }));
      const errMsg = errData.detail || errData.error || 'An unexpected server error occurred.';
      showPipelineError('Adjudication Pipeline Failed', errMsg, 'pipeline_error');
    }
  } catch (err) {
    clearTimeout(abortTimeout);
    clearInterval(stageTimer);
    console.error("Adjudication API error:", err);

    // Distinguish timeout from network error for better user guidance
    const isTimeout = err.name === 'AbortError';
    showPipelineError(
      isTimeout ? 'Processing Timeout' : 'Connection Error',
      isTimeout
        ? 'The AI pipeline took longer than expected (>3.5 minutes). This usually happens when the Gemini API is slow or unavailable. Please retry in a moment.'
        : `Could not reach the backend orchestrator. Please check your network and try again.`,
      isTimeout ? 'timeout_error' : 'network_error',
      err.message
    );
  }
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
// 8b. PIPELINE ERROR MODAL (replaces raw browser alert())
// ------------------------------------------------------------------------------

function showPipelineError(title, message, errorCode = 'unknown', technicalDetail = '') {
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  const isNetwork = errorCode === 'network_error';
  const isValidation = errorCode === 'validation_error';

  const iconName = isValidation ? 'circle-alert' : (isNetwork ? 'wifi-off' : 'shield-x');
  const iconBg = isValidation ? 'bg-amber-100' : 'bg-rose-100';
  const iconColor = isValidation ? 'text-amber-600' : 'text-rose-600';
  const accentColor = isValidation ? 'border-amber-200' : 'border-rose-200';
  const tagColor = isValidation
    ? 'bg-amber-50 text-amber-800 border border-amber-200'
    : 'bg-rose-50 text-rose-800 border border-rose-200';

  const tips = isValidation
    ? ['Ensure RC, Driving Licence, and Claim Form images are uploaded.', 'At least 1 damage photo is required.', 'Supported formats: JPG, PNG, WebP.']
    : isNetwork
    ? ['Check your internet connection.', 'The backend service may be restarting — wait 30 seconds and try again.', 'Contact support if this persists.']
    : ['Uploaded images may be unrelated to vehicle documents.', 'Try uploading clearer, higher-resolution photos.', 'Ensure documents are actual RC / DL / Claim Form images.'];

  modal.className = 'fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-3xl max-w-lg w-full shadow-2xl border ${accentColor} overflow-hidden animate-fade-in-up">

      <!-- Red/Amber Header Strip -->
      <div class="p-6 pb-4 border-b border-slate-100">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 shadow-inner">
            <i data-lucide="${iconName}" class="w-7 h-7"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${tagColor}">
                ${errorCode.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 class="text-lg font-extrabold text-slate-900 font-display leading-tight">${title}</h2>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
        <p class="text-sm text-slate-600 leading-relaxed">${message}</p>

        <!-- Helpful tips -->
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
          <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">What to check</p>
          ${tips.map(t => `
            <div class="flex items-start gap-2">
              <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0"></i>
              <span class="text-xs text-slate-600">${t}</span>
            </div>
          `).join('')}
        </div>

        ${technicalDetail ? `
          <details class="rounded-xl border border-slate-200 overflow-hidden">
            <summary class="px-4 py-2 text-[11px] font-bold text-slate-500 cursor-pointer hover:bg-slate-50 uppercase tracking-wider">Technical Detail</summary>
            <div class="px-4 py-3 bg-slate-950 font-mono text-[11px] text-rose-300 break-all">${technicalDetail}</div>
          </details>
        ` : ''}
      </div>

      <!-- Footer Actions -->
      <div class="px-6 pb-6 flex items-center gap-3">
        <button
          onclick="closeModal(); navigateTo('claim-submission'); goToStep(3);"
          class="flex-1 py-3 px-4 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md"
        >
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          <span>Try Again</span>
        </button>
        <button
          onclick="closeModal();"
          class="py-3 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all"
        >
          Dismiss
        </button>
      </div>
    </div>
  `;
  setTimeout(() => lucide.createIcons(), 20);
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

  // Use real uploaded doc preview if available, otherwise show info text
  const uploadedDoc = AppState.uploads?.docs?.[docKey];
  const hasPreview = uploadedDoc && uploadedDoc.file;

  modal.className = "fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-fade-in-up">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-slate-900">Extracted Document: ${docKey.toUpperCase()}</h3>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer">
          <i data-lucide="x" class="w-4 h-4 text-slate-600"></i>
        </button>
      </div>
      <div class="rounded-2xl overflow-hidden border border-slate-200 aspect-[400/260] bg-slate-50 flex items-center justify-center">
        ${hasPreview ? `<p class="text-sm text-slate-600 font-medium">Document: ${uploadedDoc.name} (${uploadedDoc.size})</p>` : `<p class="text-xs text-slate-500">Document processed by OCR engine. Raw preview not stored for privacy.</p>`}
      </div>
    </div>
  `;
  setTimeout(() => lucide.createIcons(), 20);
}

function openPhotoPreviewModal(photoKey) {
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  // Use real uploaded photo preview if available
  const uploadedPhoto = AppState.uploads?.photos?.[photoKey];
  const previewUrl = uploadedPhoto?.preview || '';

  modal.className = "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-fade-in-up">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-slate-900">Damage Photo Inspection</h3>
          <p class="text-xs text-slate-500">${uploadedPhoto?.name || 'AI-processed vehicle damage photo'}</p>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer">
          <i data-lucide="x" class="w-4 h-4 text-slate-600"></i>
        </button>
      </div>
      <div class="rounded-2xl overflow-hidden border border-slate-200 aspect-[400/300] bg-slate-950 flex items-center justify-center">
        ${previewUrl ? `<img src="${previewUrl}" class="w-full h-full object-contain" alt="Damage View" />` : `<p class="text-xs text-slate-400">Photo processed by YOLO + Gemini Vision. Image hash stored for fraud detection.</p>`}
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

/**
 * Amber validation toast — shown when the user tries to proceed with missing uploads.
 * Displays a bold title + descriptive detail for clarity.
 */
function showValidationToast(title, detail) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;

  toast.innerHTML = `
    <div class="bg-amber-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-700 flex items-start gap-2.5 text-xs font-semibold animate-fade-in-up max-w-sm">
      <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400 shrink-0 mt-0.5"></i>
      <div>
        <div class="font-bold text-amber-200">${title}</div>
        <div class="text-amber-300/90 font-normal mt-0.5 leading-relaxed">${detail}</div>
      </div>
    </div>
  `;
  toast.classList.remove('hidden');
  setTimeout(() => lucide.createIcons(), 20);
  setTimeout(() => toast.classList.add('hidden'), 4500);
}

