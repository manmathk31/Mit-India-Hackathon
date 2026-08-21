/**
 * ClaimPilot AI - High Fidelity Mock Data Repository
 * Realistic data shapes matching insurtech & fintech standards
 */

// Embedded vector graphics for high-fidelity offline previews
const MOCK_ASSETS = {
  docs: {
    rc: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="100%" height="100%">
      <rect width="400" height="260" rx="12" fill="%23FFFFFF" stroke="%23CBD5E1" stroke-width="2"/>
      <rect x="15" y="15" width="370" height="42" rx="6" fill="%231E2761"/>
      <text x="30" y="38" fill="%23FFFFFF" font-family="sans-serif" font-size="13" font-weight="700">GOVERNMENT OF INDIA - CERTIFICATE OF REGISTRATION</text>
      <text x="30" y="50" fill="%2394A3B8" font-family="sans-serif" font-size="9">MINISTRY OF ROAD TRANSPORT &amp; HIGHWAYS</text>
      
      <!-- Security Watermark & Hologram -->
      <circle cx="340" cy="100" r="26" fill="%23FEF08A" opacity="0.4" stroke="%23EAB308" stroke-dasharray="3,3"/>
      <text x="323" y="104" fill="%23854D0E" font-family="sans-serif" font-size="9" font-weight="bold">VALID</text>
      
      <!-- Fields -->
      <text x="30" y="85" fill="%2364748B" font-family="sans-serif" font-size="10">REGN NO:</text>
      <text x="120" y="85" fill="%230F172A" font-family="sans-serif" font-size="12" font-weight="bold">MH-12-RN-8842</text>
      
      <text x="30" y="115" fill="%2364748B" font-family="sans-serif" font-size="10">OWNER NAME:</text>
      <text x="120" y="115" fill="%230F172A" font-family="sans-serif" font-size="11" font-weight="600">RAJESH ANAND KUMAR</text>
      
      <text x="30" y="145" fill="%2364748B" font-family="sans-serif" font-size="10">MAKER/MODEL:</text>
      <text x="120" y="145" fill="%230F172A" font-family="sans-serif" font-size="11">MARUTI SUZUKI SWIFT VXI (2021)</text>
      
      <text x="30" y="175" fill="%2364748B" font-family="sans-serif" font-size="10">CHASSIS NO:</text>
      <text x="120" y="175" fill="%230F172A" font-family="monospace" font-size="11">MBH12349098ZXC091</text>
      
      <text x="30" y="205" fill="%2364748B" font-family="sans-serif" font-size="10">FUEL/ENGINE:</text>
      <text x="120" y="205" fill="%230F172A" font-family="sans-serif" font-size="11">PETROL / 1197 CC BS6</text>

      <rect x="25" y="225" width="350" height="20" rx="4" fill="%23F1F5F9"/>
      <text x="35" y="238" fill="%23475569" font-family="monospace" font-size="9">DIGITAL RC AUTHENTICATED VIA VAHAN API &bull; QR HASH: e4b29c91</text>
    </svg>`,
    dl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="100%" height="100%">
      <rect width="400" height="260" rx="12" fill="%23FFFFFF" stroke="%23CBD5E1" stroke-width="2"/>
      <rect x="15" y="15" width="370" height="38" rx="6" fill="%230F766E"/>
      <text x="30" y="38" fill="%23FFFFFF" font-family="sans-serif" font-size="13" font-weight="700">UNION OF INDIA DRIVING LICENCE</text>
      
      <!-- Photo & Chip box -->
      <rect x="25" y="68" width="75" height="95" rx="6" fill="%23E2E8F0"/>
      <circle cx="62" cy="102" r="20" fill="%2394A3B8"/>
      <path d="M40 148 C40 125, 85 125, 85 148 Z" fill="%2394A3B8"/>
      <rect x="30" y="172" width="65" height="15" rx="3" fill="%23CBD5E1"/>
      <text x="38" y="183" fill="%23475569" font-family="sans-serif" font-size="8">CHIP EMBED</text>
      
      <!-- DL Info -->
      <text x="120" y="80" fill="%2364748B" font-family="sans-serif" font-size="9">DL NUMBER:</text>
      <text x="120" y="96" fill="%230F172A" font-family="sans-serif" font-size="12" font-weight="bold">MH-1420180092144</text>
      
      <text x="120" y="120" fill="%2364748B" font-family="sans-serif" font-size="9">NAME &amp; DOB:</text>
      <text x="120" y="135" fill="%230F172A" font-family="sans-serif" font-size="11" font-weight="600">RAJESH ANAND KUMAR &bull; 14-08-1989</text>
      
      <text x="120" y="160" fill="%2364748B" font-family="sans-serif" font-size="9">VALIDITY (NT):</text>
      <text x="120" y="175" fill="%23059669" font-family="sans-serif" font-size="11" font-weight="600">VALID TILL 13-08-2039</text>
      
      <text x="120" y="200" fill="%2364748B" font-family="sans-serif" font-size="9">CLASS OF VEHICLE:</text>
      <text x="120" y="215" fill="%230F172A" font-family="sans-serif" font-size="11">LMV-NT, MCWG</text>

      <rect x="25" y="228" width="350" height="18" rx="4" fill="%23F0FDF4"/>
      <text x="35" y="240" fill="%23166534" font-family="sans-serif" font-size="9" font-weight="600">&bull; SARATHI PORTAL VERIFIED &bull; BIOMETRIC MATCH 99.4%</text>
    </svg>`,
    claimForm: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="100%" height="100%">
      <rect width="400" height="260" rx="12" fill="%23FFFFFF" stroke="%23CBD5E1" stroke-width="2"/>
      <rect x="15" y="15" width="370" height="34" rx="6" fill="%23334155"/>
      <text x="30" y="37" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="700">MOTOR OD MOTOR CLAIM INTIMATION DRAFT</text>
      
      <text x="30" y="75" fill="%2364748B" font-family="sans-serif" font-size="10">INCIDENT DATE &amp; TIME:</text>
      <text x="170" y="75" fill="%230F172A" font-family="sans-serif" font-size="11">21-Aug-2026, 09:15 AM</text>
      
      <text x="30" y="105" fill="%2364748B" font-family="sans-serif" font-size="10">LOCATION OF INCIDENT:</text>
      <text x="170" y="105" fill="%230F172A" font-family="sans-serif" font-size="11">S.B. Road Junction, Pune</text>
      
      <text x="30" y="135" fill="%2364748B" font-family="sans-serif" font-size="10">CAUSE OF ACCIDENT:</text>
      <text x="170" y="135" fill="%230F172A" font-family="sans-serif" font-size="11">Front bumper impact with stationary bollard</text>
      
      <text x="30" y="165" fill="%2364748B" font-family="sans-serif" font-size="10">POLICY NUMBER:</text>
      <text x="170" y="165" fill="%231E2761" font-family="monospace" font-size="11" font-weight="bold">POL-PAC-9920194</text>
      
      <rect x="30" y="190" width="140" height="45" rx="6" fill="%23F8FAFC" stroke="%23E2E8F0"/>
      <text x="40" y="208" fill="%2364748B" font-family="sans-serif" font-size="8">CLAIMANT SIGNATURE</text>
      <path d="M42 225 C60 210, 80 230, 110 215 C130 205, 145 220, 160 218" stroke="%231E2761" stroke-width="2" fill="none"/>
      
      <rect x="230" y="190" width="140" height="45" rx="6" fill="%23EFF6FF" stroke="%23BFDBFE"/>
      <text x="240" y="208" fill="%231E40AF" font-family="sans-serif" font-size="8">DIGITAL AUDIT STAMP</text>
      <text x="240" y="224" fill="%231D4ED8" font-family="monospace" font-size="9">SECURE HASH: 8f92a1</text>
    </svg>`
  },
  damagePhotos: {
    front: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="carGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%2394A3B8"/>
          <stop offset="100%" stop-color="%2364748B"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="%230F172A"/>
      <!-- Grid backdrop -->
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="%231E293B" stroke-width="1"/>
      </pattern>
      <rect width="400" height="300" fill="url(%23grid)" opacity="0.6"/>
      
      <!-- Front of Car Body -->
      <path d="M 60 170 C 90 90, 310 90, 340 170 L 370 230 C 370 250, 30 250, 30 230 Z" fill="url(%23carGrad)"/>
      <path d="M 100 115 C 130 95, 270 95, 300 115 L 320 160 L 80 160 Z" fill="%2338BDF8" opacity="0.75"/>
      <!-- Grille -->
      <rect x="130" y="180" width="140" height="35" rx="6" fill="%231E293B"/>
      <!-- Headlights -->
      <polygon points="70,165 120,165 105,185 65,180" fill="%23FEF08A" opacity="0.9"/>
      <polygon points="330,165 280,165 295,185 335,180" fill="%23FEF08A" opacity="0.9"/>
      
      <!-- DAMAGE OVERLAY (Front Bumper Dent & Tear) -->
      <g>
        <!-- AI Bounding Box -->
        <rect x="95" y="195" width="210" height="55" rx="6" fill="%23EF4444" fill-opacity="0.15" stroke="%23EF4444" stroke-width="2" stroke-dasharray="4,3"/>
        <rect x="95" y="180" width="130" height="18" rx="4" fill="%23EF4444"/>
        <text x="100" y="193" fill="%23FFFFFF" font-family="sans-serif" font-size="10" font-weight="bold">DAM_FRT_BMPR (96%)</text>
        
        <!-- Crack / Impact marks -->
        <path d="M 140 210 L 165 235 L 180 220 L 205 240 L 230 215" stroke="%23DC2626" stroke-width="3.5" fill="none"/>
        <circle cx="165" cy="235" r="4" fill="%23B91C1C"/>
      </g>
      
      <!-- Timestamp & Geotag overlay -->
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">LIVE CAPTURE: 18.5204N, 73.8567E &bull; EXIF VERIFIED</text>
    </svg>`,
    rear: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect width="400" height="300" fill="%230F172A"/>
      <!-- Car Rear -->
      <path d="M 70 160 C 100 80, 300 80, 330 160 L 360 235 C 360 255, 40 255, 40 235 Z" fill="%2364748B"/>
      <path d="M 105 105 C 135 90, 265 90, 295 105 L 315 155 L 85 155 Z" fill="%2338BDF8" opacity="0.75"/>
      <!-- Taillights -->
      <polygon points="65,160 110,160 95,185 60,180" fill="%23EF4444" opacity="0.9"/>
      <polygon points="335,160 290,160 305,185 340,180" fill="%23EF4444" opacity="0.9"/>
      <!-- Number plate -->
      <rect x="150" y="195" width="100" height="24" rx="4" fill="%23FEF08A" stroke="%23CA8A04"/>
      <text x="160" y="211" fill="%23000000" font-family="sans-serif" font-size="9" font-weight="bold">MH-12-RN-8842</text>
      
      <!-- AI Pass box -->
      <rect x="50" y="145" width="300" height="100" rx="6" fill="%2310B981" fill-opacity="0.08" stroke="%2310B981" stroke-width="1.5" stroke-dasharray="6,4"/>
      <rect x="50" y="130" width="110" height="18" rx="4" fill="%2310B981"/>
      <text x="56" y="143" fill="%23FFFFFF" font-family="sans-serif" font-size="10" font-weight="bold">NO DAMAGE (98%)</text>
      
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">REAR VIEW &bull; 0 DEFECTS DETECTED</text>
    </svg>`,
    leftSide: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect width="400" height="300" fill="%230F172A"/>
      <!-- Side Profile -->
      <path d="M 40 210 C 60 170, 110 140, 170 130 L 290 130 C 330 150, 360 180, 370 210 L 360 230 L 40 230 Z" fill="%2364748B"/>
      <!-- Wheels -->
      <circle cx="100" cy="230" r="28" fill="%231E293B" stroke="%2394A3B8" stroke-width="4"/>
      <circle cx="300" cy="230" r="28" fill="%231E293B" stroke="%2394A3B8" stroke-width="4"/>
      <!-- Window -->
      <path d="M 120 145 L 260 145 L 275 175 L 105 175 Z" fill="%2338BDF8" opacity="0.75"/>
      
      <!-- AI Minor scuff mark -->
      <rect x="60" y="170" width="100" height="40" rx="4" fill="%23F59E0B" fill-opacity="0.15" stroke="%23F59E0B" stroke-width="1.5"/>
      <rect x="60" y="156" width="90" height="16" rx="3" fill="%23F59E0B"/>
      <text x="64" y="168" fill="%23000000" font-family="sans-serif" font-size="9" font-weight="bold">SCUFF_MINOR (82%)</text>
      
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">LEFT PROFILE &bull; MINOR FENDER RUB</text>
    </svg>`,
    rightSide: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect width="400" height="300" fill="%230F172A"/>
      <!-- Side Profile -->
      <path d="M 360 210 C 340 170, 290 140, 230 130 L 110 130 C 70 150, 40 180, 30 210 L 40 230 L 360 230 Z" fill="%2364748B"/>
      <!-- Wheels -->
      <circle cx="300" cy="230" r="28" fill="%231E293B" stroke="%2394A3B8" stroke-width="4"/>
      <circle cx="100" cy="230" r="28" fill="%231E293B" stroke="%2394A3B8" stroke-width="4"/>
      
      <!-- AI Pass box -->
      <rect x="60" y="140" width="280" height="85" rx="6" fill="%2310B981" fill-opacity="0.08" stroke="%2310B981" stroke-width="1.5" stroke-dasharray="6,4"/>
      <rect x="60" y="125" width="100" height="18" rx="4" fill="%2310B981"/>
      <text x="66" y="138" fill="%23FFFFFF" font-family="sans-serif" font-size="10" font-weight="bold">CLEAN BODY (99%)</text>
      
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">RIGHT PROFILE &bull; NO DEFECTS</text>
    </svg>`
  }
};

const SCENARIOS = {
  // Scenario 1: Clean Approval (High confidence, all green, instant auto-approval)
  clean_approval: {
    id: "clean_approval",
    title: "Scenario 1: Clean Approval",
    tagline: "High confidence auto-adjudication, all cross-verifications passed",
    badgeLabel: "Clean Approval",
    claim_id: "CLM-2026-00842",
    submission_timestamp: "21 Aug 2026, 09:42 AM IST",
    status: "auto_approved",
    status_label: "Auto-Approved",
    status_description: "Claim meets all autonomous settlement criteria. No human surveyor required.",
    vehicle: {
      make: "Maruti Suzuki",
      model: "Swift VXi",
      year: 2021,
      color: "Magma Grey",
      registration: "MH-12-RN-8842",
      fuel: "Petrol"
    },
    policy: {
      number: "POL-PAC-9920194",
      holder: "Rajesh Anand Kumar",
      plan: "Comprehensive Bumper-to-Bumper Zero Dep",
      expiry: "18 Nov 2026",
      status: "Active"
    },
    document_check: {
      overall_status: "verified",
      confidence_score: 98.4,
      fields: [
        { name: "Owner Name", value: "Rajesh Anand Kumar", confidence: 0.99, status: "verified", note: "Exact match across RC, DL & Policy DB" },
        { name: "RC Number", value: "MH12RN8842", confidence: 0.98, status: "verified", note: "VAHAN Live API validated" },
        { name: "DL Number", value: "MH-1420180092144", confidence: 0.97, status: "verified", note: "Valid LMV class, no suspensions" },
        { name: "Vehicle / Chassis Match", value: "MBH12349098ZXC091", confidence: 0.99, status: "verified", note: "Parity confirmed with OEM ledger" }
      ]
    },
    damage_assessment: {
      severity: "moderate",
      severity_label: "Moderate",
      location: "front_bumper",
      location_label: "Front Bumper & Lower Grille",
      vehicle_tier: "economy",
      vehicle_tier_label: "Economy Hatchback",
      detected_parts: [
        { part: "Front Bumper Fascia", type: "Fracture & Dent", action: "Replace & Paint", confidence: "96%" },
        { part: "Lower Radiator Grille", type: "Dislodged Clips", action: "Repair & Refit", confidence: "91%" },
        { part: "Front Number Plate Frame", type: "Bent", action: "Replace", confidence: "99%" }
      ],
      photos: [
        { slot: "Front Damage", url: MOCK_ASSETS.damagePhotos.front, label: "Front Impact Zone (Primary)", flagged: false },
        { slot: "Rear Side", url: MOCK_ASSETS.damagePhotos.rear, label: "Rear Structure (Undamaged)", flagged: false },
        { slot: "Left Profile", url: MOCK_ASSETS.damagePhotos.leftSide, label: "Left Wing & Fender", flagged: false },
        { slot: "Right Profile", url: MOCK_ASSETS.damagePhotos.rightSide, label: "Right Wing (Undamaged)", flagged: false }
      ]
    },
    cost_estimate: {
      final_low: 18000,
      final_high: 24000,
      formatted_final: "₹18,000 — ₹24,000",
      recommended_payout: "₹21,200",
      currency: "INR",
      confidence: "high",
      confidence_label: "High Agreement (94%)",
      sources: [
        { 
          type: "vision", 
          icon: "camera",
          label: "Computer Vision Model", 
          low: 17500, 
          high: 22000, 
          formatted: "₹17,500 – ₹22,000",
          desc: "Automated pixel-level damage segmentation & parts catalog cost matrix"
        },
        { 
          type: "historical", 
          icon: "database",
          label: "Historical Claims Database", 
          low: 19000, 
          high: 25500, 
          formatted: "₹19,000 – ₹25,500",
          desc: "Benchmarked against 1,420 similar Swift front bumper claims in Pune region"
        },
        { 
          type: "live_search", 
          icon: "globe",
          label: "Live OEM Market Rates", 
          low: 18200, 
          high: 23800, 
          formatted: "₹18,200 – ₹23,800",
          desc: "Real-time Maruti Suzuki OEM spare parts & certified workshop labor rate index"
        }
      ],
      reasoning: "All 3 pricing models agree within 11.8% margin of variance. High confidence settlement threshold satisfied.",
      disclaimer: "Pre-inspection estimate. Final payout subject to physical inspection by a licensed surveyor, as required by IRDAI regulations for claims above ₹50,000."
    },
    fraud_checks: [
      { name: "Duplicate Claim Hash Check", status: "passed", detail: "No prior claim matches image perceptual hash (0/14,000)" },
      { name: "Number Plate AI Parity", status: "passed", detail: "MH-12-RN-8842 verified on live photos against RC" },
      { name: "Form vs. Image Metadata Consistency", status: "passed", detail: "Timestamp, GPS geotag & accident description match" },
      { name: "Live Camera Anti-Spoofing", status: "passed", detail: "Exif depth map and glare texture verify live capture" }
    ],
    decision_trail: [
      { step: "Validation Gate", outcome: "Passed", detail: "Policy in force, zero active disputes", status: "completed", timestamp: "09:42:02 AM" },
      { step: "Document Verification", outcome: "Verified, 98.4% confidence", detail: "Owner, RC, and DL verified via Vahan API", status: "completed", timestamp: "09:42:08 AM" },
      { step: "Damage Assessment", outcome: "Moderate damage, front bumper", detail: "Vision pipeline isolated 3 parts with 96% accuracy", status: "completed", timestamp: "09:42:15 AM" },
      { step: "Cost Reconciliation", outcome: "High agreement across sources", detail: "Multi-agent pricing converged at ₹21,200", status: "completed", timestamp: "09:42:21 AM" },
      { step: "Fraud & Anomaly Scan", outcome: "Zero anomalies detected", detail: "Image hashes and tamper tests 100% clean", status: "completed", timestamp: "09:42:25 AM" },
      { step: "Final Adjudication", outcome: "Auto-Approved", detail: "Automated digital settlement order generated", status: "success", timestamp: "09:42:28 AM" }
    ]
  },

  // Scenario 2: Minor Mismatch (Amber, resolved via AI review, approved with an explanatory note)
  minor_mismatch: {
    id: "minor_mismatch",
    title: "Scenario 2: Minor Mismatch (Resolved)",
    tagline: "Minor typo in owner name & slight rate variance auto-reconciled with fallback verification",
    badgeLabel: "Minor Mismatch",
    claim_id: "CLM-2026-00915",
    submission_timestamp: "21 Aug 2026, 11:15 AM IST",
    status: "under_review",
    status_label: "Under AI Review (Resolved)",
    status_description: "Discrepancy reconciled via cross-referencing Aadhaar & Vahan records. Proceeding with conditional approval.",
    vehicle: {
      make: "Hyundai",
      model: "Creta SX",
      year: 2022,
      color: "Polar White",
      registration: "DL-08-CQ-4109",
      fuel: "Diesel"
    },
    policy: {
      number: "POL-PAC-7718290",
      holder: "Priyanka S. Verma",
      plan: "Standard Comprehensive with Engine Protect",
      expiry: "04 Feb 2027",
      status: "Active"
    },
    document_check: {
      overall_status: "resolved",
      confidence_score: 89.2,
      fields: [
        { name: "Owner Name", value: "Priyanka Verma", confidence: 0.84, status: "resolved", note: "Spelling difference 'Priyanka S.' vs 'Priyanka' resolved via Aadhaar-linked phone OTP match", isResolved: true },
        { name: "RC Number", value: "DL08CQ4109", confidence: 0.96, status: "verified", note: "VAHAN DB registered" },
        { name: "DL Number", value: "DL-04201991023", confidence: 0.95, status: "verified", note: "Valid Commercial/Private endorsement" },
        { name: "Vehicle / Chassis Match", value: "MALC381920KK29108", confidence: 0.94, status: "verified", note: "Chassis match verified" }
      ]
    },
    damage_assessment: {
      severity: "moderate",
      severity_label: "Moderate to Heavy",
      location: "front_left_quarter",
      location_label: "Left Front Fender & Headlight Pod",
      vehicle_tier: "mid_range",
      vehicle_tier_label: "Mid-Range SUV",
      detected_parts: [
        { part: "Left LED Projector Headlamp", type: "Housing Fracture", action: "Replace Unit", confidence: "94%" },
        { part: "Front Left Fender Panel", type: "Creased Dent", action: "Denting & Painting", confidence: "88%" },
        { part: "Front Bumper Corner", type: "Deep Paint Scrape", action: "Repaint", confidence: "90%" }
      ],
      photos: [
        { slot: "Front Damage", url: MOCK_ASSETS.damagePhotos.front, label: "Front Left Impact Zone", flagged: false },
        { slot: "Rear Side", url: MOCK_ASSETS.damagePhotos.rear, label: "Rear Structure", flagged: false },
        { slot: "Left Profile", url: MOCK_ASSETS.damagePhotos.leftSide, label: "Left Quarter Panel & Lens", flagged: false },
        { slot: "Right Profile", url: MOCK_ASSETS.damagePhotos.rightSide, label: "Right Profile", flagged: false }
      ]
    },
    cost_estimate: {
      final_low: 32000,
      final_high: 41000,
      formatted_final: "₹32,000 — ₹41,000",
      recommended_payout: "₹36,800",
      currency: "INR",
      confidence: "medium",
      confidence_label: "Moderate Agreement (81%)",
      sources: [
        { 
          type: "vision", 
          icon: "camera",
          label: "Computer Vision Model", 
          low: 30000, 
          high: 38000, 
          formatted: "₹30,000 – ₹38,000",
          desc: "Vision model identified LED assembly replacement cost"
        },
        { 
          type: "historical", 
          icon: "database",
          label: "Historical Claims Database", 
          low: 34500, 
          high: 44000, 
          formatted: "₹34,500 – ₹44,000",
          desc: "Based on 890 Creta SX front-left collision claims in NCR"
        },
        { 
          type: "live_search", 
          icon: "globe",
          label: "Live OEM Market Rates", 
          low: 33000, 
          high: 41500, 
          formatted: "₹33,000 – ₹41,500",
          desc: "Hyundai Genuine Parts LED headlamp unit + labor rates"
        }
      ],
      reasoning: "16.4% cost variance detected due to LED headlamp unit availability vs aftermarket repairs. Reconciled to median OEM rate.",
      disclaimer: "Pre-inspection estimate. Final payout subject to physical inspection by a licensed surveyor, as required by IRDAI regulations for claims above ₹50,000."
    },
    fraud_checks: [
      { name: "Duplicate Claim Hash Check", status: "passed", detail: "No prior duplicate claim found" },
      { name: "Number Plate AI Parity", status: "passed", detail: "Registration DL-08-CQ-4109 matches vehicle tag" },
      { name: "Form vs. Image Metadata Consistency", status: "warning", detail: "Minor timestamp discrepancy (1.5 hrs), accepted under standard claim buffer" },
      { name: "Live Camera Anti-Spoofing", status: "passed", detail: "Live stream verification passed" }
    ],
    decision_trail: [
      { step: "Validation Gate", outcome: "Passed", detail: "Active policy, deductible calculated", status: "completed", timestamp: "11:15:04 AM" },
      { step: "Document Verification", outcome: "Resolved via AI review", detail: "Minor middle name omission reconciled with UIDAI token", status: "warning", timestamp: "11:15:12 AM" },
      { step: "Damage Assessment", outcome: "Moderate damage, left fender & lamp", detail: "3 parts flagged with replacement suggested", status: "completed", timestamp: "11:15:20 AM" },
      { step: "Cost Reconciliation", outcome: "Medium agreement, reconciled to median", detail: "LED unit price weighted against OEM list", status: "completed", timestamp: "11:15:26 AM" },
      { step: "Fraud & Anomaly Scan", outcome: "1 minor warning resolved", detail: "No fraudulent intent detected", status: "completed", timestamp: "11:15:30 AM" },
      { step: "Final Adjudication", outcome: "Approved with AI Resolution Note", detail: "Fast-track approval with surveyor sign-off waived", status: "warning", timestamp: "11:15:34 AM" }
    ]
  },

  // Scenario 3: Flagged for Review (Red, source conflict shown clearly, routed to human surveyor)
  flagged: {
    id: "flagged",
    title: "Scenario 3: Flagged for Human Review",
    tagline: "High cost conflict (>32%) and prior damage pattern detected — routed to senior claims investigator",
    badgeLabel: "Flagged Conflict",
    claim_id: "CLM-2026-01048",
    submission_timestamp: "21 Aug 2026, 01:28 PM IST",
    status: "flagged",
    status_label: "Flagged for Human Review",
    status_description: "High variance between vision assessment and historical repair rates. Structural firewall damage suspected.",
    vehicle: {
      make: "Honda",
      model: "City ZX",
      year: 2020,
      color: "Radiant Red",
      registration: "KA-01-MJ-9912",
      fuel: "Petrol"
    },
    policy: {
      number: "POL-PAC-3319028",
      holder: "Vikramaditya Rao",
      plan: "Comprehensive Standard",
      expiry: "12 Dec 2026",
      status: "Active"
    },
    document_check: {
      overall_status: "warning",
      confidence_score: 72.1,
      fields: [
        { name: "Owner Name", value: "Vikramaditya Rao", confidence: 0.94, status: "verified", note: "Matches policy records" },
        { name: "RC Number", value: "KA01MJ9912", confidence: 0.92, status: "verified", note: "VAHAN DB active" },
        { name: "DL Number", value: "KA-0120150029311", confidence: 0.68, status: "warning", note: "DL expired 14 days ago (Renewal in progress - pending receipt)" },
        { name: "Vehicle / Chassis Match", value: "MAKGM2650081921", confidence: 0.89, status: "verified", note: "Chassis stamped match" }
      ]
    },
    damage_assessment: {
      severity: "severe",
      severity_label: "Severe / Structural",
      location: "front_end_chassis",
      location_label: "Front Impact & Apron Rail Distortion",
      vehicle_tier: "premium",
      vehicle_tier_label: "Executive Sedan",
      detected_parts: [
        { part: "Front Sub-Frame / Apron", type: "Structural Buckling", action: "Bench Pull & Realignment", confidence: "87%" },
        { part: "Radiator & Condenser Assembly", type: "Punctured Core & Fluid Leak", action: "Full Replacement", confidence: "96%" },
        { part: "Hood & Both Front Fenders", type: "Heavy Crumple", action: "Replace Panels", confidence: "94%" },
        { part: "Steering Rack Alignment", type: "Potential Tie-Rod Deflection", action: "Physical Inspection Required", confidence: "73%" }
      ],
      photos: [
        { slot: "Front Damage", url: MOCK_ASSETS.damagePhotos.front, label: "Front Crumple Zone & Apron", flagged: true },
        { slot: "Rear Side", url: MOCK_ASSETS.damagePhotos.rear, label: "Rear Compartment", flagged: false },
        { slot: "Left Profile", url: MOCK_ASSETS.damagePhotos.leftSide, label: "Left Wheel Hub & Apron Gap", flagged: true },
        { slot: "Right Profile", url: MOCK_ASSETS.damagePhotos.rightSide, label: "Right Wing Crumple", flagged: false }
      ]
    },
    cost_estimate: {
      final_low: 78000,
      final_high: 115000,
      formatted_final: "₹78,000 — ₹1,15,000",
      recommended_payout: "Pending Surveyor Inspection",
      currency: "INR",
      confidence: "low",
      confidence_label: "Low Agreement / High Conflict (34% Variance)",
      sources: [
        { 
          type: "vision", 
          icon: "camera",
          label: "Computer Vision Model", 
          low: 65000, 
          high: 82000, 
          formatted: "₹65,000 – ₹82,000",
          desc: "Vision model detected cosmetic + radiator damage only (hidden sub-frame occluded)"
        },
        { 
          type: "historical", 
          icon: "database",
          label: "Historical Claims Database", 
          low: 95000, 
          high: 130000, 
          formatted: "₹95,000 – ₹1,30,000",
          desc: "Historical records show apron rail distortion on similar impacts costs >₹1.1L"
        },
        { 
          type: "live_search", 
          icon: "globe",
          label: "Live OEM Market Rates", 
          low: 84000, 
          high: 110000, 
          formatted: "₹84,000 – ₹1,10,000",
          desc: "Honda Authorized Body Shop labor & OEM chassis structural parts index"
        }
      ],
      reasoning: "Conflict detected: 34.2% variance between Vision estimate and Historical claims data due to suspected underlying apron/chassis damage. Exceeds auto-approval limit of ₹50,000.",
      disclaimer: "Mandatory physical survey required under Section 64UM of Insurance Act & IRDAI regulations for claims exceeding ₹50,000 or structural conflicts."
    },
    fraud_checks: [
      { name: "Duplicate Claim Hash Check", status: "passed", detail: "Perceptual image hash clean" },
      { name: "Number Plate AI Parity", status: "passed", detail: "KA-01-MJ-9912 verified on vehicle" },
      { name: "Form vs. Image Consistency", status: "warning", detail: "Accident described as 'low speed impact' but crumple severity suggests >45 km/h" },
      { name: "Driver License Validity Check", status: "warning", detail: "Driving license renewal pending past grace window" }
    ],
    decision_trail: [
      { step: "Validation Gate", outcome: "Policy Valid", detail: "Comprehensive coverage active", status: "completed", timestamp: "01:28:04 PM" },
      { step: "Document Verification", outcome: "DL Renewal Warning", detail: "License expired 14 days ago; requires proof of renewal application", status: "warning", timestamp: "01:28:11 PM" },
      { step: "Damage Assessment", outcome: "Severe structural damage flagged", detail: "Potential chassis apron damage requires physical laser alignment gauge", status: "warning", timestamp: "01:28:19 PM" },
      { step: "Cost Reconciliation", outcome: "High Source Conflict (34% variance)", detail: "Cross-source threshold breached (>20% allowable variance)", status: "conflict", timestamp: "01:28:25 PM" },
      { step: "Fraud & Consistency Scan", outcome: "Speed/Impact Inconsistency Flagged", detail: "Damage profile contradicts statement of 10km/h minor scrape", status: "conflict", timestamp: "01:28:30 PM" },
      { step: "Final Adjudication", outcome: "Routed to Senior Claims Surveyor", detail: "Case assigned to Surveyor Er. S. Mukherjee (Lic #IRDA/S/0912)", status: "flagged", timestamp: "01:28:34 PM" }
    ]
  }
};
