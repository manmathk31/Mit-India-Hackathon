/**
 * ClaimPilot AI - High Fidelity Mock Data Repository & Claims Store
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
      <circle cx="340" cy="100" r="26" fill="%23FEF08A" opacity="0.4" stroke="%23EAB308" stroke-dasharray="3,3"/>
      <text x="323" y="104" fill="%23854D0E" font-family="sans-serif" font-size="9" font-weight="bold">VALID</text>
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
      <rect x="25" y="68" width="75" height="95" rx="6" fill="%23E2E8F0"/>
      <circle cx="62" cy="102" r="20" fill="%2394A3B8"/>
      <path d="M40 148 C40 125, 85 125, 85 148 Z" fill="%2394A3B8"/>
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
      <rect width="400" height="300" fill="%230F172A"/>
      <path d="M 60 170 C 90 90, 310 90, 340 170 L 370 230 C 370 250, 30 250, 30 230 Z" fill="%2364748B"/>
      <path d="M 100 115 C 130 95, 270 95, 300 115 L 320 160 L 80 160 Z" fill="%2338BDF8" opacity="0.75"/>
      <rect x="130" y="180" width="140" height="35" rx="6" fill="%231E293B"/>
      <polygon points="70,165 120,165 105,185 65,180" fill="%23FEF08A" opacity="0.9"/>
      <polygon points="330,165 280,165 295,185 335,180" fill="%23FEF08A" opacity="0.9"/>
      <g>
        <rect x="95" y="195" width="210" height="55" rx="6" fill="%23EF4444" fill-opacity="0.15" stroke="%23EF4444" stroke-width="2" stroke-dasharray="4,3"/>
        <rect x="95" y="180" width="130" height="18" rx="4" fill="%23EF4444"/>
        <text x="100" y="193" fill="%23FFFFFF" font-family="sans-serif" font-size="10" font-weight="bold">DAM_FRT_BMPR (96%)</text>
        <path d="M 140 210 L 165 235 L 180 220 L 205 240 L 230 215" stroke="%23DC2626" stroke-width="3.5" fill="none"/>
        <circle cx="165" cy="235" r="4" fill="%23B91C1C"/>
      </g>
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">LIVE CAPTURE: 18.5204N, 73.8567E &bull; EXIF VERIFIED</text>
    </svg>`,
    rear: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect width="400" height="300" fill="%230F172A"/>
      <path d="M 70 160 C 100 80, 300 80, 330 160 L 360 235 C 360 255, 40 255, 40 235 Z" fill="%2364748B"/>
      <path d="M 105 105 C 135 90, 265 90, 295 105 L 315 155 L 85 155 Z" fill="%2338BDF8" opacity="0.75"/>
      <polygon points="65,160 110,160 95,185 60,180" fill="%23EF4444" opacity="0.9"/>
      <polygon points="335,160 290,160 305,185 340,180" fill="%23EF4444" opacity="0.9"/>
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">LIVE CAPTURE: REAR ELEVATION (UNDAMAGED)</text>
    </svg>`,
    leftSide: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect width="400" height="300" fill="%230F172A"/>
      <path d="M 40 210 L 80 140 L 150 110 L 280 110 L 330 150 L 360 210 Z" fill="%2364748B"/>
      <circle cx="100" cy="215" r="32" fill="%231E293B" stroke="%23CBD5E1" stroke-width="4"/>
      <circle cx="290" cy="215" r="32" fill="%231E293B" stroke="%23CBD5E1" stroke-width="4"/>
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">LIVE CAPTURE: LEFT FLANK PROFILE</text>
    </svg>`,
    rightSide: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect width="400" height="300" fill="%230F172A"/>
      <path d="M 360 210 L 320 140 L 250 110 L 120 110 L 70 150 L 40 210 Z" fill="%2364748B"/>
      <circle cx="300" cy="215" r="32" fill="%231E293B" stroke="%23CBD5E1" stroke-width="4"/>
      <circle cx="110" cy="215" r="32" fill="%231E293B" stroke="%23CBD5E1" stroke-width="4"/>
      <rect x="15" y="265" width="370" height="24" rx="4" fill="%23000000" opacity="0.7"/>
      <text x="25" y="281" fill="%23E2E8F0" font-family="monospace" font-size="10">LIVE CAPTURE: RIGHT FLANK PROFILE</text>
    </svg>`
  }
};

// Mock Users Store
const MOCK_USERS = {
  claimant: {
    id: "usr_101",
    name: "Rajesh Anand Kumar",
    email: "rajesh.kumar@gmail.com",
    role: "user",
    phone: "+91 98230 19284",
    policyNumber: "POL-PAC-9920194",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
  },
  admin: {
    id: "adm_909",
    name: "Vikram Malhotra",
    email: "v.malhotra@claimpilot.ai",
    role: "admin",
    phone: "+91 94220 88190",
    badgeNumber: "IRDAI-SURV-4481",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
  }
};

// Canonical Scenario Objects
const SCENARIOS = {
  clean_approval: {
    id: "clean_approval",
    claim_id: "CLM-2026-00842",
    title: "Scenario 1: Clean Approval",
    tagline: "High confidence auto-adjudication, all cross-verifications passed",
    badgeLabel: "Clean Approval",
    submission_timestamp: "21 Aug 2026, 09:42 AM IST",
    status: "auto_approved",
    status_label: "Auto-Approved",
    status_description: "Claim meets all autonomous settlement criteria. No human surveyor required.",
    user_id: "usr_101",
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
        { part: "Front Bumper Fascia", type: "Fracture & Dent", action: "Replace & Paint", confidence: "96%", material_type: "plastic-rubber" },
        { part: "Lower Radiator Grille", type: "Dislodged Clips", action: "Repair & Refit", confidence: "91%", material_type: "plastic-rubber" },
        { part: "Front Number Plate Frame", type: "Bent", action: "Replace", confidence: "99%", material_type: "plastic-rubber" }
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
        { type: "vision", icon: "camera", label: "Computer Vision Model", low: 17500, high: 22000, formatted: "₹17,500 – ₹22,000", desc: "Pixel-level damage segmentation & parts catalog matrix" },
        { type: "historical", icon: "database", label: "Historical Claims Database", low: 19000, high: 25500, formatted: "₹19,000 – ₹25,500", desc: "Benchmarked against 1,420 Swift claims in Pune region" },
        { type: "live_search", icon: "globe", label: "Live OEM Market Rates", low: 18200, high: 23800, formatted: "₹18,200 – ₹23,800", desc: "Real-time Maruti Suzuki OEM spare parts index" }
      ],
      reasoning: "All 3 pricing models agree within 11.8% variance. High confidence threshold satisfied.",
      disclaimer: "Pre-inspection estimate. Final payout subject to IRDAI limits."
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

  discrepancy_resolved: {
    id: "discrepancy_resolved",
    claim_id: "CLM-2026-00791",
    title: "Scenario 2: Discrepancy Resolved",
    tagline: "Minor name abbreviation resolved via secondary fuzzy matching",
    badgeLabel: "Fuzzy Resolved",
    submission_timestamp: "21 Aug 2026, 10:14 AM IST",
    status: "under_review",
    status_label: "Under Review: Resolved Parity",
    status_description: "Discrepancy resolved via AI verification. Fast-track 1-click adjuster sign-off required.",
    user_id: "usr_101",
    vehicle: {
      make: "Hyundai",
      model: "Creta SX(O)",
      year: 2022,
      color: "Polar White",
      registration: "MH-14-GH-4190",
      fuel: "Diesel"
    },
    policy: {
      number: "POL-PAC-8812930",
      holder: "Priya Ramesh Verma",
      plan: "Zero Depreciation Gold Shield",
      expiry: "04 Jan 2027",
      status: "Active"
    },
    document_check: {
      overall_status: "resolved",
      confidence_score: 92.1,
      fields: [
        { name: "Owner Name", value: "Priya R Verma", confidence: 0.93, status: "resolved", note: "Middle name abbreviated on DL; cross-matched with Policy DB", isResolved: true },
        { name: "RC Number", value: "MH14GH4190", confidence: 0.99, status: "verified", note: "VAHAN Live API validated" },
        { name: "DL Number", value: "MH-1420190011822", confidence: 0.96, status: "verified", note: "Valid LMV transport endorsement" },
        { name: "Vehicle / Chassis Match", value: "MALC141209NZ8811", confidence: 0.98, status: "verified", note: "Confirmed against Hyundai VIN registry" }
      ]
    },
    damage_assessment: {
      severity: "moderate",
      severity_label: "Moderate",
      location: "left_fender",
      location_label: "Left Front Fender & Headlamp Cluster",
      vehicle_tier: "mid_suv",
      vehicle_tier_label: "Mid-Size SUV",
      detected_parts: [
        { part: "Left Front Wing / Fender", type: "Deep Crease & Paint Peel", action: "Repair & Repaint", confidence: "94%", material_type: "metal" },
        { part: "LED Projector Headlamp Assembly", type: "Mounting Tab Sheared", action: "Replace Unit", confidence: "97%", material_type: "plastic-rubber" }
      ],
      photos: [
        { slot: "Front Damage", url: MOCK_ASSETS.damagePhotos.front, label: "Left Corner Impact", flagged: false },
        { slot: "Rear Side", url: MOCK_ASSETS.damagePhotos.rear, label: "Rear Structure (Clean)", flagged: false },
        { slot: "Left Profile", url: MOCK_ASSETS.damagePhotos.leftSide, label: "Left Wing Scrape", flagged: false },
        { slot: "Right Profile", url: MOCK_ASSETS.damagePhotos.rightSide, label: "Right Wing (Clean)", flagged: false }
      ]
    },
    cost_estimate: {
      final_low: 32000,
      final_high: 41000,
      formatted_final: "₹32,000 — ₹41,000",
      recommended_payout: "₹36,500",
      currency: "INR",
      confidence: "high",
      confidence_label: "High Agreement (91%)",
      sources: [
        { type: "vision", icon: "camera", label: "Computer Vision Model", low: 31500, high: 39000, formatted: "₹31,500 – ₹39,000", desc: "LED assembly replacement and panel denting quote" },
        { type: "historical", icon: "database", label: "Historical Claims Database", low: 33000, high: 43000, formatted: "₹33,000 – ₹43,000", desc: "Benchmarked against 890 Creta headlight claims" },
        { type: "live_search", icon: "globe", label: "Live OEM Market Rates", low: 32500, high: 40500, formatted: "₹32,500 – ₹40,500", desc: "Hyundai Genuine Parts index" }
      ],
      reasoning: "Panel repair approved. LED assembly requires OEM replacement.",
      disclaimer: "Subject to adjuster sign-off on resolved name parity."
    },
    fraud_checks: [
      { name: "Duplicate Claim Hash Check", status: "passed", detail: "No prior matching crash imagery found" },
      { name: "Number Plate AI Parity", status: "passed", detail: "MH-14-GH-4190 verified across all uploads" },
      { name: "Form vs. Image Metadata Consistency", status: "passed", detail: "Claimant statement matches physical impact zone" },
      { name: "Live Camera Anti-Spoofing", status: "passed", detail: "Live capture confirmed via lens EXIF parity" }
    ],
    decision_trail: [
      { step: "Validation Gate", outcome: "Passed", detail: "Policy in force, zero lapses", status: "completed", timestamp: "10:14:03 AM" },
      { step: "Document Verification", outcome: "Resolved, 92.1% confidence", detail: "Name abbreviation verified against government ledger", status: "completed", timestamp: "10:14:09 AM" },
      { step: "Damage Assessment", outcome: "Moderate, left fender", detail: "2 parts identified with 95.5% precision", status: "completed", timestamp: "10:14:16 AM" },
      { step: "Cost Reconciliation", outcome: "High agreement at ₹36,500", detail: "Multi-agent quote converged", status: "completed", timestamp: "10:14:22 AM" },
      { step: "Fraud & Anomaly Scan", outcome: "Clean", detail: "Zero fraud triggers detected", status: "completed", timestamp: "10:14:25 AM" },
      { step: "Final Adjudication", outcome: "Referred to Adjuster", detail: "Queued for 1-click human verification of name parity", status: "warning", timestamp: "10:14:27 AM" }
    ]
  },

  fraud_alert: {
    id: "fraud_alert",
    claim_id: "CLM-2026-00654",
    title: "Scenario 3: Fraud Alert & Breach",
    tagline: "Expired licence on incident date + narrative contradiction",
    badgeLabel: "Fraud Alert",
    submission_timestamp: "21 Aug 2026, 11:05 AM IST",
    status: "flagged",
    status_label: "Flagged: Forensic Discrepancy",
    status_description: "Critical fraud indicators detected. Automatic settlement blocked and routed to SIU.",
    user_id: "usr_202",
    vehicle: {
      make: "Tata Motors",
      model: "Nexon EV Max",
      year: 2023,
      color: "Daytona Grey",
      registration: "MH-02-DW-9111",
      fuel: "Electric"
    },
    policy: {
      number: "POL-PAC-7719201",
      holder: "Amit Devendra Patel",
      plan: "EV Comprehensive Shield",
      expiry: "19 Dec 2026",
      status: "Active"
    },
    document_check: {
      overall_status: "warning",
      confidence_score: 54.2,
      fields: [
        { name: "Owner Name", value: "Amit D Patel", confidence: 0.91, status: "resolved", note: "Name matches policy record", isResolved: true },
        { name: "RC Number", value: "MH02DW9111", confidence: 0.99, status: "verified", note: "VAHAN Live API validated" },
        { name: "DL Expiry on Incident Date", value: "Expired: 10-Jan-2024", confidence: 0.99, status: "warning", note: "Driving Licence was expired before the crash date (Policy Breach)" },
        { name: "Chassis Match", value: "MAT612984PX0019", confidence: 0.98, status: "verified", note: "VIN verified" }
      ]
    },
    damage_assessment: {
      severity: "severe",
      severity_label: "Severe",
      location: "front_bumper",
      location_label: "Front Radiator Support & Crash Bar",
      vehicle_tier: "compact_suv",
      vehicle_tier_label: "Compact Electric SUV",
      detected_parts: [
        { part: "Front Crash Beam & Bumper", type: "Severe Structural Deformation", action: "Replace & Structural Pull", confidence: "98%", material_type: "metal" },
        { part: "Cooling Pack Radiator", type: "Punctured & Leaking", action: "Replace Unit", confidence: "95%", material_type: "metal" }
      ],
      photos: [
        { slot: "Front Damage", url: MOCK_ASSETS.damagePhotos.front, label: "Front Structural Damage", flagged: true },
        { slot: "Rear Side", url: MOCK_ASSETS.damagePhotos.rear, label: "Rear Structure (Clean)", flagged: false },
        { slot: "Left Profile", url: MOCK_ASSETS.damagePhotos.leftSide, label: "Left Profile", flagged: false },
        { slot: "Right Profile", url: MOCK_ASSETS.damagePhotos.rightSide, label: "Right Profile", flagged: false }
      ]
    },
    cost_estimate: {
      final_low: 58000,
      final_high: 78000,
      formatted_final: "₹58,000 — ₹78,000",
      recommended_payout: "₹68,000",
      currency: "INR",
      confidence: "medium",
      confidence_label: "Surveyor Required (> ₹50k)",
      sources: [
        { type: "vision", icon: "camera", label: "Computer Vision Model", low: 62000, high: 82000, formatted: "₹62,000 – ₹82,000", desc: "Structural damage quote" },
        { type: "historical", icon: "database", label: "Historical Claims Database", low: 54000, high: 75000, formatted: "₹54,000 – ₹75,000", desc: "Benchmarked against Nexon claims" }
      ],
      reasoning: "Estimate exceeds statutory ₹50,000 IRDAI threshold.",
      disclaimer: "Mandatory on-site physical inspection required by law."
    },
    fraud_checks: [
      { name: "Duplicate Claim Hash Check", status: "passed", detail: "Perceptual hash clear" },
      { name: "Number Plate AI Parity", status: "passed", detail: "MH-02-DW-9111 matched" },
      { name: "Form vs. Image Metadata Consistency", status: "warning", detail: "Directional Discrepancy: Form describes rear impact, but photos only show front damage" },
      { name: "Driver Licence Validity", status: "failed", detail: "CRITICAL BREACH: Licence expired 10-Jan-2024, accident was 21-Aug-2026" }
    ],
    decision_trail: [
      { step: "Validation Gate", outcome: "Passed", detail: "Policy in force", status: "completed", timestamp: "11:05:01 AM" },
      { step: "Document Verification", outcome: "Warning: DL Expired", detail: "Driver licence expired prior to loss date", status: "flagged", timestamp: "11:05:07 AM" },
      { step: "Damage Assessment", outcome: "Severe front damage", detail: "Structural deformation isolated", status: "completed", timestamp: "11:05:14 AM" },
      { step: "Cost Reconciliation", outcome: "Exceeds ₹50,000", detail: "Estimate exceeds statutory limit", status: "warning", timestamp: "11:05:20 AM" },
      { step: "Fraud & Anomaly Scan", outcome: "Critical Fraud Alert", detail: "Licence breach and narrative contradiction", status: "flagged", timestamp: "11:05:24 AM" },
      { step: "Final Adjudication", outcome: "Flagged for SIU Investigation", detail: "Automated payout blocked", status: "flagged", timestamp: "11:05:26 AM" }
    ]
  }
};

// Initial Claims Repository for the full product view
const ALL_CLAIMS_DATABASE = [
  { ...SCENARIOS.clean_approval },
  { ...SCENARIOS.discrepancy_resolved },
  { ...SCENARIOS.fraud_alert },
  {
    id: "clm_irdai_limit",
    claim_id: "CLM-2026-00512",
    title: "Mahindra XUV700 Front Axle Damage",
    tagline: "High cost claim exceeding ₹50,000 threshold",
    badgeLabel: "Surveyor Mandated",
    submission_timestamp: "20 Aug 2026, 04:30 PM IST",
    status: "flagged",
    status_label: "Flagged: Statutory Surveyor Required",
    status_description: "Repair estimate exceeds ₹50,000. Physical inspection mandated by IRDAI regulations.",
    user_id: "usr_101",
    vehicle: {
      make: "Mahindra",
      model: "XUV700 AX7 L",
      year: 2023,
      color: "Midnight Black",
      registration: "MH-12-XU-7700",
      fuel: "Diesel"
    },
    policy: {
      number: "POL-PAC-9910112",
      holder: "Rajesh Anand Kumar",
      plan: "Titanium Zero Dep Engine Protect",
      expiry: "15 Oct 2026",
      status: "Active"
    },
    document_check: {
      overall_status: "verified",
      confidence_score: 99.1,
      fields: [
        { name: "Owner Name", value: "Rajesh Anand Kumar", confidence: 0.99, status: "verified", note: "Exact match across VAHAN & Policy" },
        { name: "RC Number", value: "MH12XU7700", confidence: 0.99, status: "verified", note: "VAHAN Live API validated" },
        { name: "DL Number", value: "MH-1420180092144", confidence: 0.98, status: "verified", note: "Valid LMV transport endorsement" }
      ]
    },
    damage_assessment: {
      severity: "severe",
      severity_label: "Severe",
      location: "front_suspension",
      location_label: "Front Suspension & Wheel Assembly",
      vehicle_tier: "premium_suv",
      vehicle_tier_label: "Premium SUV",
      detected_parts: [
        { part: "Right Front Lower Control Arm", type: "Bent", action: "Replace Unit", confidence: "98%", material_type: "metal" },
        { part: "Alloy Wheel Rim (18 Inch)", type: "Cracked Rim", action: "Replace & Rebalance", confidence: "96%", material_type: "metal" }
      ],
      photos: [
        { slot: "Front Damage", url: MOCK_ASSETS.damagePhotos.front, label: "Right Suspension Angle", flagged: false },
        { slot: "Rear Side", url: MOCK_ASSETS.damagePhotos.rear, label: "Rear", flagged: false },
        { slot: "Left Profile", url: MOCK_ASSETS.damagePhotos.leftSide, label: "Left Flank", flagged: false },
        { slot: "Right Profile", url: MOCK_ASSETS.damagePhotos.rightSide, label: "Right Wheel Damage", flagged: false }
      ]
    },
    cost_estimate: {
      final_low: 74000,
      final_high: 94000,
      formatted_final: "₹74,000 — ₹94,000",
      recommended_payout: "₹84,200",
      currency: "INR",
      confidence: "high",
      confidence_label: "Surveyor Mandated (> ₹50k)",
      sources: [
        { type: "vision", icon: "camera", label: "Computer Vision Model", low: 72000, high: 92000, formatted: "₹72,000 – ₹92,000", desc: "Suspension and alloy wheel quote" }
      ],
      reasoning: "Repair estimate exceeds ₹50,000 IRDAI threshold.",
      disclaimer: "Mandatory on-site physical inspection by a licensed surveyor required by IRDAI regulations."
    },
    fraud_checks: [
      { name: "Duplicate Claim Hash Check", status: "passed", detail: "Perceptual hash clear" },
      { name: "Number Plate AI Parity", status: "passed", detail: "MH-12-XU-7700 matched" },
      { name: "Form vs. Image Metadata Consistency", status: "passed", detail: "Accident description matches wheel curb impact" },
      { name: "Live Camera Anti-Spoofing", status: "passed", detail: "Live capture verified" }
    ],
    decision_trail: [
      { step: "Validation Gate", outcome: "Passed", detail: "Policy in force", status: "completed", timestamp: "04:30:02 PM" },
      { step: "Document Verification", outcome: "Verified, 99.1%", detail: "All documents valid", status: "completed", timestamp: "04:30:08 PM" },
      { step: "Damage Assessment", outcome: "Severe suspension damage", detail: "Suspension components isolated", status: "completed", timestamp: "04:30:15 PM" },
      { step: "Cost Reconciliation", outcome: "High cost (₹84,200)", detail: "Exceeds ₹50,000 threshold", status: "warning", timestamp: "04:30:20 PM" },
      { step: "Fraud & Anomaly Scan", outcome: "Clean", detail: "Zero fraud triggers", status: "completed", timestamp: "04:30:24 PM" },
      { step: "Final Adjudication", outcome: "Flagged for Surveyor Inspection", detail: "Physical surveyor assigned as per IRDAI", status: "flagged", timestamp: "04:30:26 PM" }
    ]
  },
  {
    id: "clm_honda_city",
    claim_id: "CLM-2026-00438",
    title: "Honda City Minor Scratch & Mirror",
    tagline: "Instant settlement under ₹15,000",
    badgeLabel: "Fast Track Approved",
    submission_timestamp: "19 Aug 2026, 02:15 PM IST",
    status: "auto_approved",
    status_label: "Auto-Approved",
    status_description: "Claim meets all autonomous settlement criteria. Instant disbursement approved.",
    user_id: "usr_101",
    vehicle: {
      make: "Honda",
      model: "City ZX",
      year: 2022,
      color: "Radiant Red",
      registration: "MH-12-HC-1420",
      fuel: "Petrol"
    },
    policy: {
      number: "POL-PAC-6619022",
      holder: "Rajesh Anand Kumar",
      plan: "Comprehensive Bumper-to-Bumper",
      expiry: "11 Dec 2026",
      status: "Active"
    },
    document_check: {
      overall_status: "verified",
      confidence_score: 99.5,
      fields: [
        { name: "Owner Name", value: "Rajesh Anand Kumar", confidence: 0.99, status: "verified", note: "Exact match across VAHAN & Policy" },
        { name: "RC Number", value: "MH12HC1420", confidence: 0.99, status: "verified", note: "VAHAN Live API validated" }
      ]
    },
    damage_assessment: {
      severity: "minor",
      severity_label: "Minor",
      location: "side_mirror",
      location_label: "Left Side Mirror Housing",
      vehicle_tier: "sedan",
      vehicle_tier_label: "Executive Sedan",
      detected_parts: [
        { part: "Left Side Mirror Casing", type: "Scuffed Housing", action: "Repair & Paint", confidence: "95%", material_type: "plastic-rubber" }
      ],
      photos: [
        { slot: "Front Damage", url: MOCK_ASSETS.damagePhotos.leftSide, label: "Left Mirror View", flagged: false }
      ]
    },
    cost_estimate: {
      final_low: 12000,
      final_high: 16000,
      formatted_final: "₹12,000 — ₹16,000",
      recommended_payout: "₹14,200",
      currency: "INR",
      confidence: "high",
      confidence_label: "High Agreement (96%)",
      sources: [
        { type: "vision", icon: "camera", label: "Computer Vision Model", low: 11800, high: 15500, formatted: "₹11,800 – ₹15,500", desc: "Mirror paint & repair estimate" }
      ],
      reasoning: "Instant auto-approval eligible (Amount < ₹50,000).",
      disclaimer: "Settlement disbursed to registered bank account."
    },
    fraud_checks: [
      { name: "Duplicate Claim Hash Check", status: "passed", detail: "Clean" },
      { name: "Number Plate AI Parity", status: "passed", detail: "Matched" }
    ],
    decision_trail: [
      { step: "Validation Gate", outcome: "Passed", detail: "Policy in force", status: "completed", timestamp: "02:15:02 PM" },
      { step: "Document Verification", outcome: "Verified, 99.5%", detail: "Valid", status: "completed", timestamp: "02:15:06 PM" },
      { step: "Damage Assessment", outcome: "Minor mirror scratch", detail: "Minor repair", status: "completed", timestamp: "02:15:10 PM" },
      { step: "Cost Reconciliation", outcome: "High confidence (₹14,200)", detail: "Approved", status: "completed", timestamp: "02:15:14 PM" },
      { step: "Fraud & Anomaly Scan", outcome: "Clean", detail: "Zero anomalies", status: "completed", timestamp: "02:15:17 PM" },
      { step: "Final Adjudication", outcome: "Auto-Approved", detail: "Settlement order issued", status: "success", timestamp: "02:15:19 PM" }
    ]
  }
];
