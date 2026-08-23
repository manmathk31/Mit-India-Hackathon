# ClaimPilot AI — Image/Damage Assessment Agent Microservice

A standalone, production-grade FastAPI microservice that inspects vehicle damage photos, detects damaged parts, identifies material types for depreciation calculations, measures severity, and determines repair/replace actions.

---

## 🏛️ Architecture & Project Structure

```
image_agent/
├── __init__.py
├── main.py                     # FastAPI app: POST /images/analyze, GET /health, validation
├── extractor.py                # Multimodal Vision (Gemini / OpenAI / Custom Model) + Mock runner
├── material_lookup.py          # Deterministic part_name -> material_type lookup table
├── schemas.py                  # Strict Pydantic models matching Orchestrator contract
├── config.py                   # Pydantic-settings (.env loader, rate limits, models)
├── logger.py                   # Structured JSON logging (photo counts, latency, status)
├── requirements.txt            # Microservice dependencies
├── .env.example                # Environment configuration template
├── README.md                   # Complete service contract & Colab custom model guide
└── tests/
    ├── __init__.py
    └── test_material_lookup.py # Unit tests for material mapping & status rules
```

---

## 🚀 Quickstart & Running Standalone

### 1. Install Dependencies
```bash
pip install -r image_agent/requirements.txt
```

### 2. Configure Environment
```bash
cp image_agent/.env.example image_agent/.env
```
*(By default, `MOCK_MODE=true` is enabled — zero API keys or external dependencies needed for initial testing).*

### 3. Run the Microservice
From repository root:
```bash
uvicorn image_agent.main:app --reload --port 8002
```
Or from inside `image_agent/`:
```bash
uvicorn main:app --reload --port 8002
```

Interactive API documentation:
- **Swagger UI**: `http://localhost:8002/docs`
- **ReDoc**: `http://localhost:8002/redoc`

---

## 📡 API Endpoints

### 1. Health Probe
`GET /health`
```json
{
  "status": "ok",
  "service": "ClaimPilot Image Damage Assessment Agent",
  "version": "1.0.0",
  "engine": "gemini",
  "mock_mode": true,
  "timestamp": "2026-08-21T21:50:00Z"
}
```

---

### 2. Analyze Damage Photos
`POST /images/analyze`
**Content-Type**: `multipart/form-data`

#### Multipart Form Parameters:
| Parameter | Type | Description |
|---|---|---|
| `damage_photos` | File Array | 1 to 8 vehicle damage photos (JPEG / PNG / WebP, max 10MB per file) |
| `claim_id` | String (Optional) | Tracking claim identifier for structured audit logging |

---

## 📋 Exact Output Contract (Enforced via Pydantic)

```json
{
  "overall_damage_status": "moderate",
  "detections": [
    {
      "part_name": "front bumper",
      "material_type": "plastic-rubber",
      "severity": "moderate",
      "repair_or_replace": "replace",
      "confidence": 0.96,
      "bounding_box": {
        "x": 320,
        "y": 324,
        "w": 640,
        "h": 252
      },
      "source_image_index": 0
    },
    {
      "part_name": "radiator grille",
      "material_type": "plastic-rubber",
      "severity": "minor",
      "repair_or_replace": "repair",
      "confidence": 0.91,
      "bounding_box": {
        "x": 448,
        "y": 273,
        "w": 384,
        "h": 129
      },
      "source_image_index": 0
    },
    {
      "part_name": "front left fender",
      "material_type": "metal",
      "severity": "moderate",
      "repair_or_replace": "repair",
      "confidence": 0.89,
      "bounding_box": {
        "x": 128,
        "y": 216,
        "w": 448,
        "h": 288
      },
      "source_image_index": 1
    }
  ],
  "photos_analyzed": 2,
  "no_damage_detected": false
}
```

---

## 🧩 Material Classification & Depreciation Logic

Pratik's downstream **Cost Agent** requires exact `material_type` for every detected part under standard Indian insurance regulations:

| Material Type | Depreciation Rate | Common Parts |
|---|---|---|
| **`plastic-rubber`** | **50% Flat** | Bumpers, radiator grilles, headlight casings, side mirror housings, mudguards, cladding. |
| **`fibreglass`** | **30% Flat** | Spoilers, body kits, diffusers, side skirts. |
| **`glass`** | **0% Flat** | Windshields, door windows, quarter glass, sunroofs. |
| **`metal`** | **Age Slab** | Doors, bonnets/hoods, fenders, boot lids, roofs, chassis pillars. |

---

## 🤖 Training a Custom Model in Google Colab (Optional Phase 2)

If you train a custom YOLO model (e.g. YOLOv8 / YOLOv11) on vehicle damage datasets (like CarDD or Roboflow Car Damage) in Google Colab:

1. **Train & Export to ONNX in Colab**:
   ```python
   from ultralytics import YOLO
   model = YOLO("yolov8m.pt")
   model.train(data="car_damage.yaml", epochs=50, imgsz=640)
   model.export(format="onnx")
   ```
2. **Drop the exported file into**: `image_agent/models/damage_yolo.onnx`
3. **Switch config in `.env`**:
   ```ini
   DETECTION_ENGINE=custom
   CUSTOM_MODEL_PATH=models/damage_yolo.onnx
   ```
   The service automatically passes detections through `material_lookup.py` to maintain 100% schema contract compatibility!

---

## 🧪 Automated Unit Tests

```bash
pytest image_agent/tests/ -v
```
