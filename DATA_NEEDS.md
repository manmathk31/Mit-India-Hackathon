# ClaimPilot AI — Data Requirements & Schema Specification

This document specifies the exact database tables, columns, data types, relationships, and authentication payloads required for the Supabase Database & Auth implementation.

---

## 1. Authentication & User Profiles

### `auth.users` (Supabase Auth built-in)
| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Unique user authentication identifier |
| `email` | `VARCHAR(255)` | User email address |
| `created_at` | `TIMESTAMPTZ` | Timestamp of account creation |

### `profiles` (User metadata & role)
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | References `auth.users.id` ON DELETE CASCADE | Profile identifier |
| `full_name` | `VARCHAR(150)` | NOT NULL | User's full legal name |
| `phone_number` | `VARCHAR(20)` | NULLABLE | Contact phone number |
| `role` | `VARCHAR(20)` | NOT NULL, DEFAULT `'claimant'` | Role: `'claimant'` or `'admin'` / `'surveyor'` |
| `avatar_url` | `TEXT` | NULLABLE | Profile picture URL |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Profile creation date |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Profile update date |

---

## 2. Insurance Policies

### `policies`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Policy record identifier |
| `user_id` | `UUID` | References `profiles.id` | Policyholder user reference |
| `policy_number` | `VARCHAR(50)` | UNIQUE, NOT NULL | Policy certificate number (e.g. `POL-PAC-9920194`) |
| `holder_name` | `VARCHAR(150)` | NOT NULL | Insured owner full name |
| `plan_name` | `VARCHAR(100)` | NOT NULL | Insurance tier (e.g. Comprehensive Zero Dep) |
| `start_date` | `DATE` | NOT NULL | Policy coverage start date |
| `expiry_date` | `DATE` | NOT NULL | Policy coverage expiration date |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'Active'` | Policy status: `'Active'`, `'Expired'`, `'Suspended'` |
| `idv_amount` | `NUMERIC(12,2)`| NOT NULL | Insured Declared Value in INR (e.g. `550000.00`) |
| `vehicle_make` | `VARCHAR(50)` | NOT NULL | Vehicle brand (e.g. `Maruti Suzuki`) |
| `vehicle_model`| `VARCHAR(50)` | NOT NULL | Vehicle model (e.g. `Swift`) |
| `vehicle_variant`| `VARCHAR(50)`| NOT NULL | Vehicle variant (e.g. `VXI`) |
| `vehicle_year` | `INT` | NOT NULL | Manufacturing year (e.g. `2021`) |
| `rc_number` | `VARCHAR(20)` | NOT NULL | Vehicle registration number (e.g. `MH12RN8842`) |
| `chassis_number`| `VARCHAR(30)`| NOT NULL | 17-character VIN/Chassis number |
| `engine_number` | `VARCHAR(30)` | NULLABLE | Vehicle engine number |

---

## 3. Claims Core Table

### `claims`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Internal claim ID |
| `claim_number` | `VARCHAR(50)` | UNIQUE, NOT NULL | Public claim reference (e.g. `CLM-2026-00842`) |
| `user_id` | `UUID` | References `profiles.id` | Claimant user ID |
| `policy_id` | `UUID` | References `policies.id` | Insured policy reference |
| `incident_date` | `TIMESTAMPTZ`| NOT NULL | Date and time of the accident |
| `incident_location` | `VARCHAR(200)` | NULLABLE | Geographic location / city of crash |
| `incident_description` | `TEXT` | NOT NULL | Verbatim accident narrative from claim form |
| `status` | `VARCHAR(30)` | NOT NULL, DEFAULT `'under_review'` | Adjudication outcome: `'auto_approved'`, `'under_review'`, `'flagged'` |
| `status_label` | `VARCHAR(50)` | NOT NULL | Human-readable label (e.g. `"Auto-Approved"`) |
| `status_description` | `TEXT` | NULLABLE | Explanation of decision status |
| `overall_damage_severity` | `VARCHAR(20)` | NULLABLE | Highest severity: `'minor'`, `'moderate'`, `'severe'` |
| `estimated_cost_low` | `NUMERIC(12,2)`| NULLABLE | Lower bound of estimated repair cost |
| `estimated_cost_high`| `NUMERIC(12,2)`| NULLABLE | Upper bound of estimated repair cost |
| `recommended_payout` | `NUMERIC(12,2)`| NULLABLE | Recommended settlement amount in INR |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Submission timestamp |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Last update timestamp |

---

## 4. Claim Document Verification Records

### `claim_documents`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Record ID |
| `claim_id` | `UUID` | References `claims.id` ON DELETE CASCADE | Associated claim |
| `document_type` | `VARCHAR(30)` | NOT NULL | `'rc'`, `'dl'`, `'claim_form'` |
| `storage_url` | `TEXT` | NOT NULL | Supabase Storage bucket URL |
| `ocr_raw_text` | `TEXT` | NULLABLE | Extracted OCR text |
| `overall_status`| `VARCHAR(20)` | NOT NULL | `'verified'`, `'resolved'`, `'warning'` |
| `confidence_score`| `NUMERIC(4,2)`| NOT NULL | Score between `0.00` and `1.00` |
| `verification_fields`| `JSONB` | NOT NULL | Array of `{ name, value, confidence, status, note, isResolved }` |

---

## 5. Vehicle Damage Detections & Photos

### `claim_photos`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Photo ID |
| `claim_id` | `UUID` | References `claims.id` ON DELETE CASCADE | Associated claim |
| `slot_label` | `VARCHAR(50)` | NOT NULL | `'Front Impact'`, `'Rear Side'`, `'Left Profile'`, `'Right Profile'` |
| `storage_url` | `TEXT` | NOT NULL | Supabase Storage image URL |
| `image_hash` | `VARCHAR(64)` | NULLABLE | Perceptual image hash (dHash) for duplicate checking |
| `is_flagged` | `BOOLEAN` | DEFAULT `FALSE` | True if image failed anti-spoofing or duplicate check |

### `claim_detected_parts`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Detection ID |
| `claim_id` | `UUID` | References `claims.id` ON DELETE CASCADE | Associated claim |
| `photo_id` | `UUID` | References `claim_photos.id` | Associated photo |
| `part_name` | `VARCHAR(100)` | NOT NULL | e.g. `'front bumper'`, `'radiator grille'` |
| `material_type`| `VARCHAR(30)` | NOT NULL | `'plastic-rubber'`, `'metal'`, `'glass'`, `'fibreglass'` |
| `severity` | `VARCHAR(20)` | NOT NULL | `'minor'`, `'moderate'`, `'severe'` |
| `repair_or_replace`| `VARCHAR(20)` | NOT NULL | `'repair'`, `'replace'` |
| `confidence` | `NUMERIC(4,2)` | NOT NULL | Detection confidence (e.g. `0.96`) |
| `bounding_box` | `JSONB` | NOT NULL | `{ x, y, w, h }` in source image pixels |

---

## 6. Fraud Checks & Decision Audit Trail

### `claim_fraud_checks`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Check ID |
| `claim_id` | `UUID` | References `claims.id` ON DELETE CASCADE | Associated claim |
| `check_name` | `VARCHAR(100)` | NOT NULL | e.g. `'Duplicate Claim Hash Check'`, `'Number Plate AI Parity'` |
| `status` | `VARCHAR(20)` | NOT NULL | `'passed'`, `'warning'`, `'failed'` |
| `detail` | `TEXT` | NOT NULL | Explanatory findings |

### `claim_decision_trails`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Audit entry ID |
| `claim_id` | `UUID` | References `claims.id` ON DELETE CASCADE | Associated claim |
| `step_name` | `VARCHAR(100)` | NOT NULL | e.g. `'Validation Gate'`, `'Document Verification'`, `'Final Adjudication'` |
| `outcome` | `VARCHAR(100)` | NOT NULL | High-level result |
| `detail` | `TEXT` | NOT NULL | Audit reasoning |
| `status` | `VARCHAR(20)` | NOT NULL | `'completed'`, `'success'`, `'warning'`, `'flagged'` |
| `timestamp` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Event timestamp |

---

## 7. Admin / Surveyor Overrides & Notes

### `claim_admin_overrides`
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` (PK) | DEFAULT `uuid_generate_v4()` | Override ID |
| `claim_id` | `UUID` | References `claims.id` ON DELETE CASCADE | Associated claim |
| `admin_id` | `UUID` | References `profiles.id` | Reviewing surveyor/manager |
| `original_status` | `VARCHAR(30)` | NOT NULL | AI-recommended status |
| `override_status` | `VARCHAR(30)` | NOT NULL | Human-assigned status: `'auto_approved'`, `'under_review'`, `'flagged'` |
| `review_note` | `TEXT` | NOT NULL | Surveyor's mandatory review rationale |
| `settlement_adjusted_amount` | `NUMERIC(12,2)` | NULLABLE | Modified settlement amount in INR |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Override decision timestamp |

---

## 8. Supabase Storage Buckets
1. **`claim-documents`** (Private, signed URLs only):
   * Folders: `/{user_id}/{claim_id}/rc.jpg`, `dl.jpg`, `claim_form.jpg`
2. **`damage-photos`** (Private, signed URLs only):
   * Folders: `/{user_id}/{claim_id}/front.jpg`, `rear.jpg`, `left.jpg`, `right.jpg`
3. **`avatars`** (Public):
   * User profile pictures.
