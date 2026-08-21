package com.example.costagent;

import com.example.costagent.model.*;
import com.example.costagent.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CostEstimationServiceTest {

    private CostEstimationService service;

    @BeforeEach
    void setUp() {
        service = new CostEstimationService(
                new DepreciationService(),
                new PartsPriceService(),
                new LaborRateService()
        );
    }

    // ─── Replacement depreciation by material type ────────────────────

    @Test
    void plasticReplacementGets50PercentDepreciation() {
        CostEstimateRequest request = request(
                "Hyundai", "Sonata", "2.0", 2018, "front",
                DamageSeverity.HIGH, "Pune", "Maharashtra", null, 600000.0,
                List.of(part("front bumper", WorkType.REPLACEMENT,
                        MaterialType.PLASTIC_RUBBER, DamageSeverity.HIGH,
                        10000.0, 4.0))
        );

        CostEstimateResponse r = service.estimate(request);

        assertEquals(10000.0, r.partsCost().beforeDepreciation());
        assertEquals(5000.0, r.partsCost().depreciationAmount());
        assertEquals(5000.0, r.partsCost().afterDepreciation());
    }

    @Test
    void glassReplacementGetsZeroDepreciation() {
        CostEstimateRequest request = request(
                "Hyundai", "Sonata", "2.0", 2020, "front",
                DamageSeverity.HIGH, "Pune", "Maharashtra", null, 600000.0,
                List.of(part("windshield", WorkType.REPLACEMENT,
                        MaterialType.GLASS, DamageSeverity.HIGH,
                        18000.0, 2.0))
        );

        CostEstimateResponse r = service.estimate(request);

        assertEquals(18000.0, r.partsCost().beforeDepreciation());
        assertEquals(0.0, r.partsCost().depreciationAmount());
        assertEquals(18000.0, r.partsCost().afterDepreciation());
    }

    @Test
    void fibreglassReplacementGets30PercentDepreciation() {
        CostEstimateRequest request = request(
                "Toyota", "Innova", "2.4", 2019, "rear",
                DamageSeverity.MEDIUM, "Delhi", null, null, 800000.0,
                List.of(part("rear panel", WorkType.REPLACEMENT,
                        MaterialType.FIBREGLASS, DamageSeverity.MEDIUM,
                        20000.0, 3.0))
        );

        CostEstimateResponse r = service.estimate(request);

        assertEquals(20000.0, r.partsCost().beforeDepreciation());
        assertEquals(6000.0, r.partsCost().depreciationAmount()); // 30% of 20000
        assertEquals(14000.0, r.partsCost().afterDepreciation());
    }

    // ─── Metal age-based depreciation (IRDAI slab) ────────────────────

    @Test
    void metalDepreciationUsesCorrectIrdaiSlab() {
        DepreciationService dep = new DepreciationService();

        // ≤ 6 months (age 0)
        assertEquals(0.00, dep.getDepreciationRate(MaterialType.METAL, 0));
        // > 6 months – 1 year (age 1)
        assertEquals(0.05, dep.getDepreciationRate(MaterialType.METAL, 1));
        // > 1 year – 2 years (age 2)
        assertEquals(0.10, dep.getDepreciationRate(MaterialType.METAL, 2));
        // > 2 years – 3 years (age 3)
        assertEquals(0.15, dep.getDepreciationRate(MaterialType.METAL, 3));
        // > 3 years – 4 years (age 4)
        assertEquals(0.25, dep.getDepreciationRate(MaterialType.METAL, 4));
        // > 4 years – 5 years (age 5)
        assertEquals(0.35, dep.getDepreciationRate(MaterialType.METAL, 5));
        // > 5 years – 10 years (age 7)
        assertEquals(0.40, dep.getDepreciationRate(MaterialType.METAL, 7));
        // > 5 years – 10 years (age 10)
        assertEquals(0.40, dep.getDepreciationRate(MaterialType.METAL, 10));
        // > 10 years (age 11)
        assertEquals(0.50, dep.getDepreciationRate(MaterialType.METAL, 11));
        // > 10 years (age 15)
        assertEquals(0.50, dep.getDepreciationRate(MaterialType.METAL, 15));
    }

    // ─── Repair — no depreciation ─────────────────────────────────────

    @Test
    void repairDoesNotGetPartsDepreciation() {
        CostEstimateRequest request = request(
                "Hyundai", "Sonata", "2.0", 2018, "front",
                DamageSeverity.HIGH, "Pune", "Maharashtra", null, 600000.0,
                List.of(part("hood", WorkType.REPAIR,
                        MaterialType.METAL, DamageSeverity.HIGH,
                        18000.0, 5.0))
        );

        CostEstimateResponse r = service.estimate(request);

        // Repair → no replacement parts, so beforeDepreciation = 0
        assertEquals(0.0, r.partsCost().beforeDepreciation());
        assertEquals(0.0, r.partsCost().depreciationAmount());
        assertEquals(0.0, r.partsCost().afterDepreciation());
        // But repair material cost IS tracked
        assertEquals(18000.0, r.partsCost().repairMaterialCost());
        assertEquals(18000.0, r.partsCost().totalPartsCost());
        assertTrue(r.laborCost().min() > 0);
    }

    @Test
    void repairPartsShowInRepairMaterialCost() {
        CostEstimateRequest request = request(
                "Maruti", "Swift", "VXI", 2021, "side",
                DamageSeverity.LOW, "Jaipur", "Rajasthan", null, 500000.0,
                List.of(
                        part("fender", WorkType.REPAIR, MaterialType.METAL,
                                DamageSeverity.LOW, 5000.0, 2.0),
                        part("door", WorkType.REPAIR, MaterialType.METAL,
                                DamageSeverity.MEDIUM, 8000.0, 3.0)
                )
        );

        CostEstimateResponse r = service.estimate(request);

        assertEquals(0.0, r.partsCost().beforeDepreciation());
        assertEquals(13000.0, r.partsCost().repairMaterialCost()); // 5000 + 8000
        assertEquals(13000.0, r.partsCost().totalPartsCost());
    }

    // ─── Mixed parts ──────────────────────────────────────────────────

    @Test
    void mixedPartsApplyCorrectDepreciationPerPart() {
        CostEstimateRequest request = request(
                "Hyundai", "Sonata", "2.0", 2018, "front",
                DamageSeverity.HIGH, "Pune", "Maharashtra", null, 600000.0,
                List.of(
                        // Plastic replacement → 50% dep
                        part("front bumper", WorkType.REPLACEMENT,
                                MaterialType.PLASTIC_RUBBER, DamageSeverity.HIGH,
                                10000.0, 4.0),
                        // Metal repair → no dep
                        part("hood", WorkType.REPAIR,
                                MaterialType.METAL, DamageSeverity.MEDIUM,
                                18000.0, 3.0),
                        // Glass replacement → 0% dep
                        part("windshield", WorkType.REPLACEMENT,
                                MaterialType.GLASS, DamageSeverity.HIGH,
                                18000.0, 2.0)
                )
        );

        CostEstimateResponse r = service.estimate(request);

        // Replacement parts total: 10000 (bumper) + 18000 (windshield) = 28000
        assertEquals(28000.0, r.partsCost().beforeDepreciation());
        // Depreciation: 5000 (bumper 50%) + 0 (windshield 0%) = 5000
        assertEquals(5000.0, r.partsCost().depreciationAmount());
        // After dep: 28000 - 5000 = 23000
        assertEquals(23000.0, r.partsCost().afterDepreciation());
        // Repair material: 18000 (hood)
        assertEquals(18000.0, r.partsCost().repairMaterialCost());
        // Total parts: 23000 + 18000 = 41000
        assertEquals(41000.0, r.partsCost().totalPartsCost());

        // 3 parts in breakdown
        assertEquals(3, r.partBreakdown().size());
    }

    // ─── Total loss ───────────────────────────────────────────────────

    @Test
    void totalLossFlagUses75PercentOfIdv() {
        CostEstimateRequest request = request(
                "Test", "Car", "Base", 2020, "front",
                DamageSeverity.SEVERE, "Pune", "Maharashtra", null, 100000.0,
                List.of(part("hood", WorkType.REPLACEMENT,
                        MaterialType.METAL, DamageSeverity.SEVERE,
                        80000.0, 50.0))
        );

        CostEstimateResponse r = service.estimate(request);

        assertTrue(r.totalLoss().exceeds75Percent());
        assertEquals(75000.0, r.totalLoss().threshold75Percent());
    }

    @Test
    void noIdvSkipsTotalLossCheck() {
        CostEstimateRequest request = request(
                "Test", "Car", "Base", 2022, "front",
                DamageSeverity.HIGH, "Mumbai", null, null, null,
                List.of(part("hood", WorkType.REPLACEMENT,
                        MaterialType.METAL, DamageSeverity.HIGH,
                        50000.0, 5.0))
        );

        CostEstimateResponse r = service.estimate(request);

        assertNull(r.totalLoss().idv());
        assertNull(r.totalLoss().threshold75Percent());
        assertFalse(r.totalLoss().exceeds75Percent());
    }

    // ─── Labor rates ──────────────────────────────────────────────────

    @Test
    void nonMetroCityGetsLowerLaborRate() {
        // Jaipur is not in the metro list → 800/hr vs metro 1200/hr
        CostEstimateRequest metroReq = request(
                "Hyundai", "i20", null, 2022, "front",
                DamageSeverity.MEDIUM, "Mumbai", null, null, 500000.0,
                List.of(part("bumper", WorkType.REPLACEMENT,
                        MaterialType.PLASTIC_RUBBER, DamageSeverity.MEDIUM,
                        10000.0, 4.0))
        );
        CostEstimateRequest nonMetroReq = request(
                "Hyundai", "i20", null, 2022, "front",
                DamageSeverity.MEDIUM, "Jaipur", "Rajasthan", null, 500000.0,
                List.of(part("bumper", WorkType.REPLACEMENT,
                        MaterialType.PLASTIC_RUBBER, DamageSeverity.MEDIUM,
                        10000.0, 4.0))
        );

        CostEstimateResponse metro = service.estimate(metroReq);
        CostEstimateResponse nonMetro = service.estimate(nonMetroReq);

        // Same parts cost, but metro labor should be higher.
        assertEquals(metro.partsCost().afterDepreciation(),
                nonMetro.partsCost().afterDepreciation());
        assertTrue(metro.laborCost().min() > nonMetro.laborCost().min(),
                "Metro labor should be higher than non-metro");
    }

    // ─── Painting depreciation ────────────────────────────────────────

    @Test
    void paintingApplies50PercentOn25PercentMaterial() {
        CostEstimateRequest request = request(
                "Honda", "City", "VX", 2021, "side",
                DamageSeverity.MEDIUM, "Delhi", null, null, 700000.0,
                List.of(part("door panel", WorkType.PAINTING,
                        MaterialType.METAL, DamageSeverity.MEDIUM,
                        10000.0, 2.0))
        );

        CostEstimateResponse r = service.estimate(request);

        // Painting: material = 25% of 10000 = 2500
        // Depreciation on material = 50% of 2500 = 1250
        assertEquals(1250.0, r.partsCost().depreciationAmount());
        // Painting cost after dep = 10000 - 1250 = 8750
        assertEquals(8750.0, r.partsCost().paintingCost());
        // No replacement parts
        assertEquals(0.0, r.partsCost().beforeDepreciation());
        assertEquals(0.0, r.partsCost().afterDepreciation());
    }

    // ─── Source assessment reconciliation ──────────────────────────────

    @Test
    void sourceAssessmentReconciliation() {
        List<SourceAssessment> sources = List.of(
                new SourceAssessment("vision-model", 0.92, true),
                new SourceAssessment("historical-data", 0.88, true),
                new SourceAssessment("manual-estimate", 0.75, false)
        );

        CostEstimateRequest request = request(
                "Tata", "Nexon", "XZ+", 2022, "rear",
                DamageSeverity.MEDIUM, "Chennai", null, sources, 900000.0,
                List.of(part("rear bumper", WorkType.REPLACEMENT,
                        MaterialType.PLASTIC_RUBBER, DamageSeverity.MEDIUM,
                        12000.0, 3.0))
        );

        CostEstimateResponse r = service.estimate(request);

        // Average confidence: (0.92 + 0.88 + 0.75) / 3 = 0.85
        assertEquals(0.85, r.confidence().overall());
        // 2 out of 3 agree → PARTIAL
        assertEquals("PARTIAL", r.confidence().sourceAgreement());
        // Sources should include the 3 assessments + 3 deterministic sources
        assertTrue(r.confidence().sourcesUsed().contains("vision-model"));
        assertTrue(r.confidence().sourcesUsed().contains("historical-data"));
        assertTrue(r.confidence().sourcesUsed().contains("IRDAI depreciation rules"));
    }

    @Test
    void allSourcesAgreeGivesHighAgreement() {
        List<SourceAssessment> sources = List.of(
                new SourceAssessment("vision-model", 0.95, true),
                new SourceAssessment("historical-data", 0.90, true)
        );

        CostEstimateRequest request = request(
                "Tata", "Nexon", "XZ+", 2022, "rear",
                DamageSeverity.MEDIUM, "Chennai", null, sources, 900000.0,
                List.of(part("rear bumper", WorkType.REPLACEMENT,
                        MaterialType.PLASTIC_RUBBER, DamageSeverity.MEDIUM,
                        12000.0, 3.0))
        );

        CostEstimateResponse r = service.estimate(request);

        assertEquals("HIGH", r.confidence().sourceAgreement());
    }

    // ─── Vehicle summary ──────────────────────────────────────────────

    @Test
    void vehicleSummaryReflectsInput() {
        CostEstimateRequest request = request(
                "Maruti", "Baleno", "Alpha", 2020, "front",
                DamageSeverity.LOW, "Pune", "Maharashtra", null, 600000.0,
                List.of(part("bumper", WorkType.REPLACEMENT,
                        MaterialType.PLASTIC_RUBBER, DamageSeverity.LOW,
                        8000.0, 2.0))
        );

        CostEstimateResponse r = service.estimate(request);

        assertEquals("Maruti", r.vehicle().make());
        assertEquals("Baleno", r.vehicle().model());
        assertEquals("Alpha", r.vehicle().variant());
        assertEquals(2020, r.vehicle().registrationYear());
        assertTrue(r.vehicle().vehicleAge() >= 5); // 2026 - 2020 = 6
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private static CostEstimateRequest request(
            String make, String model, String variant, int regYear,
            String damageLocation, DamageSeverity severity,
            String city, String region,
            List<SourceAssessment> sourceAssessments,
            Double idv,
            List<PartInput> parts) {
        return new CostEstimateRequest(
                make, model, variant, regYear,
                damageLocation, severity,
                city, region,
                sourceAssessments,
                idv,
                parts
        );
    }

    private static PartInput part(
            String name, WorkType workType, MaterialType material,
            DamageSeverity severity, Double cost, Double laborHours) {
        return new PartInput(name, workType, material, severity, cost, laborHours);
    }
}
