# Cost Agent — Java Spring Boot + Spring AI

This service calculates vehicle repair cost estimates.

## Important design rule

Depreciation is **part-type-aware**.

It is NOT:

`vehicle age -> one depreciation percentage -> entire estimate`

Instead:

- Plastic/Rubber replacement -> 50%
- Fibreglass replacement -> 30%
- Glass replacement -> 0%
- Metal replacement -> age-based slab
- Repair -> no depreciation
- Labor -> no depreciation

## Run

Requirements:

- Java 17+
- Maven 3.9+

```bash
mvn clean test
mvn spring-boot:run
```

The API starts on:

`http://localhost:8082`

## Endpoint

```http
POST /api/cost/estimate
Content-Type: application/json
```

Example:

```json
{
  "vehicleMake": "Hyundai",
  "vehicleModel": "Sonata",
  "variant": "2.0",
  "registrationYear": 2018,
  "damageLocation": "front",
  "damageSeverity": "HIGH",
  "city": "Pune",
  "region": "Maharashtra",
  "idv": 600000,
  "affectedParts": [
    {
      "partName": "front bumper",
      "workType": "REPLACEMENT",
      "materialType": "PLASTIC_RUBBER",
      "severity": "HIGH",
      "estimatedPartCost": 10000,
      "estimatedLaborHours": 4
    },
    {
      "partName": "hood",
      "workType": "REPAIR",
      "materialType": "METAL",
      "severity": "MEDIUM",
      "estimatedPartCost": 18000,
      "estimatedLaborHours": 3
    },
    {
      "partName": "windshield",
      "workType": "REPLACEMENT",
      "materialType": "GLASS",
      "severity": "HIGH",
      "estimatedPartCost": 18000,
      "estimatedLaborHours": 2
    }
  ]
}
```

## Architecture

```text
Controller
    |
    v
CostEstimationService
    |
    +--> PartsPriceService
    |
    +--> DepreciationService
    |
    +--> LaborRateService
    |
    v
CostEstimateResponse
```

Spring AI is included so the service can later add an LLM explanation/reconciliation layer. The deterministic cost calculation should remain separate from the LLM so that the depreciation and 75%-IDV rules are reliable and testable.

## Production changes needed

The included `PartsPriceService` uses demo baseline prices. Replace it with a real parts-price source/database/API.

Likewise, replace `LaborRateService` with the team's actual city/region labor-rate source.

If the upstream vision agent can already identify repair vs replacement and material type, send those fields directly to this service. Do not ask the LLM to guess depreciation from vehicle age alone.
