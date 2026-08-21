package com.example.costagent.service;

import com.example.costagent.model.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.util.ArrayList;
import java.util.List;

@Service
public class CostEstimationService {

    private final DepreciationService depreciationService;
    private final PartsPriceService partsPriceService;
    private final LaborRateService laborRateService;

    public CostEstimationService(
            DepreciationService depreciationService,
            PartsPriceService partsPriceService,
            LaborRateService laborRateService) {
        this.depreciationService = depreciationService;
        this.partsPriceService = partsPriceService;
        this.laborRateService = laborRateService;
    }

    public CostEstimateResponse estimate(CostEstimateRequest request) {
        int currentYear = Year.now().getValue();
        int vehicleAge = Math.max(0, currentYear - request.registrationYear());

        // Accumulators — kept separate per IRDAI treatment:
        //   replacementBeforeDep: gross cost of parts being fully replaced
        //   depreciationAmount:   IRDAI depreciation deducted from replacements
        //   repairMaterialCost:   material/consumable cost for REPAIR work (NOT depreciated)
        //   paintingCost:         painting cost after IRDAI painting depreciation
        //   laborHours:           total labor hours across all work items
        double replacementBeforeDep = 0.0;
        double depreciationAmount = 0.0;
        double repairMaterialCost = 0.0;
        double paintingCost = 0.0;
        double laborHours = 0.0;

        List<PartCostResult> breakdown = new ArrayList<>();

        for (PartInput part : request.affectedParts()) {
            double basePartCost = part.estimatedPartCost() != null
                    ? part.estimatedPartCost()
                    : partsPriceService.getPartPrice(part.partName(), part.materialType());

            double depreciationRate = 0.0;
            double depreciation = 0.0;
            double postDepCost;

            switch (part.workType()) {
                case REPLACEMENT -> {
                    depreciationRate = depreciationService.getDepreciationRate(
                            part.materialType(), vehicleAge);
                    depreciation = basePartCost * depreciationRate;
                    postDepCost = basePartCost - depreciation;

                    replacementBeforeDep += basePartCost;
                    depreciationAmount += depreciation;
                }
                case REPAIR -> {
                    // Repair parts are not depreciated — the part is being fixed,
                    // not replaced.  The cost here covers repair materials,
                    // fillers, and consumables.
                    postDepCost = basePartCost;
                    repairMaterialCost += basePartCost;
                }
                case PAINTING -> {
                    // IRDAI painting rule: 50 % depreciation on the material
                    // component.  When a consolidated painting bill is provided,
                    // the material component is taken as 25 % of the total
                    // painting charge.  Effective depreciation on total charge
                    // = 50 % × 25 % = 12.5 %.
                    double materialPortion = basePartCost * 0.25;
                    depreciation = materialPortion * 0.50;
                    depreciationRate = 0.125; // effective rate on total charge
                    postDepCost = basePartCost - depreciation;

                    paintingCost += postDepCost;
                    depreciationAmount += depreciation;
                }
                default -> {
                    postDepCost = basePartCost;
                }
            }

            // Accumulate labor hours.
            if (part.estimatedLaborHours() != null) {
                laborHours += part.estimatedLaborHours();
            } else {
                laborHours += defaultLaborHours(part.severity(), part.workType());
            }

            breakdown.add(new PartCostResult(
                    part.partName(),
                    part.workType(),
                    part.materialType(),
                    round(basePartCost),
                    round(depreciationRate),
                    round(depreciation),
                    round(postDepCost)
            ));
        }

        double replacementPostDep = replacementBeforeDep - depreciationAmount
                + (paintingCost); // painting post-dep is already net of depreciation
        // Correction: depreciationAmount includes painting depreciation, so let's
        // recalculate more clearly.
        double replacementOnlyBeforeDep = 0.0;
        double replacementOnlyDepreciation = 0.0;
        double paintingOnlyDepreciation = 0.0;

        // Recalculate split depreciation for clarity in the response.
        for (PartInput part : request.affectedParts()) {
            double baseCost = part.estimatedPartCost() != null
                    ? part.estimatedPartCost()
                    : partsPriceService.getPartPrice(part.partName(), part.materialType());

            if (part.workType() == WorkType.REPLACEMENT) {
                replacementOnlyBeforeDep += baseCost;
                replacementOnlyDepreciation += baseCost *
                        depreciationService.getDepreciationRate(part.materialType(), vehicleAge);
            } else if (part.workType() == WorkType.PAINTING) {
                paintingOnlyDepreciation += baseCost * 0.25 * 0.50;
            }
        }

        double totalDepreciation = replacementOnlyDepreciation + paintingOnlyDepreciation;
        double replacementAfterDep = replacementOnlyBeforeDep - replacementOnlyDepreciation;
        double totalPartsCost = replacementAfterDep + repairMaterialCost + paintingCost;

        // Labor calculation — hourly rate varies by city/region.
        double hourlyRate = laborRateService.hourlyRate(request.city(), request.region());

        // Add a realistic range around the baseline labor estimate.
        double laborBase = laborHours * hourlyRate;
        double laborMin = laborBase * 0.90;
        double laborMax = laborBase * 1.15;

        double combinedMin = totalPartsCost + laborMin;
        double combinedMax = totalPartsCost + laborMax;

        // Total-loss check: repair exceeds 75 % of IDV.
        Double threshold = request.idv() == null ? null : request.idv() * 0.75;
        double repairCostForCheck = combinedMax;
        boolean exceeds = threshold != null && repairCostForCheck > threshold;

        // Confidence & source reconciliation.
        double confidence = calculateConfidence(request, breakdown);
        String sourceAgreement = determineSourceAgreement(request);
        List<String> sourcesUsed = buildSourcesList(request);

        return new CostEstimateResponse(
                new CostEstimateResponse.VehicleSummary(
                        request.vehicleMake(),
                        request.vehicleModel(),
                        request.variant(),
                        request.registrationYear(),
                        vehicleAge
                ),
                new CostEstimateResponse.PartsCost(
                        round(replacementOnlyBeforeDep),
                        round(totalDepreciation),
                        round(replacementAfterDep),
                        round(repairMaterialCost),
                        round(paintingCost),
                        round(totalPartsCost)
                ),
                new CostEstimateResponse.LaborCost(
                        round(laborMin),
                        round(laborMax)
                ),
                new CostEstimateResponse.CombinedTotal(
                        round(combinedMin),
                        round(combinedMax)
                ),
                new CostEstimateResponse.ConfidenceMetadata(
                        confidence,
                        sourceAgreement,
                        sourcesUsed
                ),
                new CostEstimateResponse.TotalLossCheck(
                        request.idv() == null ? null : round(request.idv()),
                        threshold == null ? null : round(threshold),
                        round(repairCostForCheck),
                        exceeds
                ),
                breakdown
        );
    }

    // ─── Labor hour defaults ──────────────────────────────────────────

    private double defaultLaborHours(DamageSeverity severity, WorkType workType) {
        if (workType == WorkType.REPAIR) {
            return switch (severity) {
                case LOW -> 1.5;
                case MEDIUM -> 3.0;
                case HIGH -> 5.0;
                case SEVERE -> 8.0;
            };
        }

        if (workType == WorkType.PAINTING) {
            return switch (severity) {
                case LOW -> 1.0;
                case MEDIUM -> 2.0;
                case HIGH -> 3.0;
                case SEVERE -> 4.0;
            };
        }

        // REPLACEMENT
        return switch (severity) {
            case LOW -> 2.0;
            case MEDIUM -> 3.5;
            case HIGH -> 5.5;
            case SEVERE -> 8.0;
        };
    }

    // ─── Confidence & source reconciliation ───────────────────────────

    private double calculateConfidence(
            CostEstimateRequest request,
            List<PartCostResult> breakdown) {

        // If upstream source assessments are provided, use them.
        if (request.sourceAssessments() != null && !request.sourceAssessments().isEmpty()) {
            double avg = request.sourceAssessments().stream()
                    .mapToDouble(SourceAssessment::confidence)
                    .average()
                    .orElse(0.70);
            return Math.min(0.99, round(avg));
        }

        // Fallback heuristic when no source assessments are supplied.
        double score = 0.70;

        if (request.variant() != null && !request.variant().isBlank()) score += 0.05;
        if (request.idv() != null) score += 0.05;
        if (request.city() != null && !request.city().isBlank()) score += 0.05;

        boolean allMaterialsKnown = breakdown.stream()
                .noneMatch(x -> x.materialType() == MaterialType.UNKNOWN);

        if (allMaterialsKnown) score += 0.05;

        boolean allCostsKnown = breakdown.stream()
                .allMatch(x -> x.baseCost() > 0);

        if (allCostsKnown) score += 0.10;

        return Math.min(0.99, round(score));
    }

    /**
     * Determines agreement level across upstream sources.
     *
     * HIGH    — all sources agree (or only one source)
     * PARTIAL — some sources agree, some disagree
     * LOW     — no sources agree (all disagree)
     * N/A     — no source assessments provided
     */
    private String determineSourceAgreement(CostEstimateRequest request) {
        if (request.sourceAssessments() == null || request.sourceAssessments().isEmpty()) {
            // No upstream assessments — fall back to heuristic-based agreement.
            double confidence = 0.70;
            if (request.variant() != null && !request.variant().isBlank()) confidence += 0.05;
            if (request.idv() != null) confidence += 0.05;
            if (request.city() != null && !request.city().isBlank()) confidence += 0.05;
            return confidence >= 0.85 ? "HIGH" : confidence >= 0.70 ? "MEDIUM" : "LOW";
        }

        long total = request.sourceAssessments().size();
        long agreeing = request.sourceAssessments().stream()
                .filter(sa -> sa.agreesWithEstimate() != null && sa.agreesWithEstimate())
                .count();

        if (agreeing == total) return "HIGH";
        if (agreeing == 0) return "LOW";
        return "PARTIAL";
    }

    private List<String> buildSourcesList(CostEstimateRequest request) {
        List<String> sources = new ArrayList<>();

        if (request.sourceAssessments() != null) {
            request.sourceAssessments().stream()
                    .map(SourceAssessment::source)
                    .forEach(sources::add);
        }

        // Always include the deterministic sources used by this service.
        sources.add("baseline parts pricing");
        sources.add("IRDAI depreciation rules");
        sources.add("regional labor-rate model");

        return sources;
    }

    // ─── Utility ──────────────────────────────────────────────────────

    private double round(double value) {
        return BigDecimal.valueOf(value)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
