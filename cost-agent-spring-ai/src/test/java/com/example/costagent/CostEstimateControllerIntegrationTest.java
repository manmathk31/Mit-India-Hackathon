package com.example.costagent;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class CostEstimateControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void estimateReturns200WithValidRequest() throws Exception {
        String body = """
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
                """;

        mockMvc.perform(post("/api/cost/estimate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicle.make").value("Hyundai"))
                .andExpect(jsonPath("$.vehicle.vehicleAge").isNumber())
                .andExpect(jsonPath("$.partsCost.beforeDepreciation").value(28000.0))
                .andExpect(jsonPath("$.partsCost.depreciationAmount").value(5000.0))
                .andExpect(jsonPath("$.partsCost.afterDepreciation").value(23000.0))
                .andExpect(jsonPath("$.partsCost.repairMaterialCost").value(18000.0))
                .andExpect(jsonPath("$.partsCost.totalPartsCost").value(41000.0))
                .andExpect(jsonPath("$.laborCost.min").isNumber())
                .andExpect(jsonPath("$.laborCost.max").isNumber())
                .andExpect(jsonPath("$.combinedTotal.min").isNumber())
                .andExpect(jsonPath("$.combinedTotal.max").isNumber())
                .andExpect(jsonPath("$.confidence.overall").isNumber())
                .andExpect(jsonPath("$.confidence.sourceAgreement").isString())
                .andExpect(jsonPath("$.totalLoss.idv").value(600000.0))
                .andExpect(jsonPath("$.totalLoss.threshold75Percent").value(450000.0))
                .andExpect(jsonPath("$.totalLoss.exceeds75Percent").value(false))
                .andExpect(jsonPath("$.partBreakdown").isArray())
                .andExpect(jsonPath("$.partBreakdown.length()").value(3));
    }

    @Test
    void estimateReturns400WhenMissingRequiredFields() throws Exception {
        String body = """
                {
                  "variant": "2.0"
                }
                """;

        mockMvc.perform(post("/api/cost/estimate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Validation failed"));
    }

    @Test
    void estimateWithSourceAssessments() throws Exception {
        String body = """
                {
                  "vehicleMake": "Tata",
                  "vehicleModel": "Nexon",
                  "variant": "XZ+",
                  "registrationYear": 2022,
                  "damageLocation": "rear",
                  "damageSeverity": "MEDIUM",
                  "city": "Chennai",
                  "sourceAssessments": [
                    { "source": "vision-model", "confidence": 0.90, "agreesWithEstimate": true },
                    { "source": "historical-data", "confidence": 0.85, "agreesWithEstimate": true }
                  ],
                  "idv": 900000,
                  "affectedParts": [
                    {
                      "partName": "rear bumper",
                      "workType": "REPLACEMENT",
                      "materialType": "PLASTIC_RUBBER",
                      "severity": "MEDIUM",
                      "estimatedPartCost": 12000,
                      "estimatedLaborHours": 3
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/cost/estimate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confidence.sourceAgreement").value("HIGH"))
                .andExpect(jsonPath("$.confidence.sourcesUsed").isArray());
    }

    @Test
    void estimateWithPaintingWorkType() throws Exception {
        String body = """
                {
                  "vehicleMake": "Honda",
                  "vehicleModel": "City",
                  "variant": "VX",
                  "registrationYear": 2021,
                  "damageLocation": "side",
                  "damageSeverity": "MEDIUM",
                  "city": "Delhi",
                  "idv": 700000,
                  "affectedParts": [
                    {
                      "partName": "door panel",
                      "workType": "PAINTING",
                      "materialType": "METAL",
                      "severity": "MEDIUM",
                      "estimatedPartCost": 10000,
                      "estimatedLaborHours": 2
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/cost/estimate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.partsCost.depreciationAmount").value(1250.0))
                .andExpect(jsonPath("$.partsCost.paintingCost").value(8750.0));
    }

    @Test
    void healthEndpointReturnsUp() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
