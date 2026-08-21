package com.example.costagent.model;

import java.util.List;

public record CostEstimateResponse(
        VehicleSummary vehicle,
        PartsCost partsCost,
        LaborCost laborCost,
        CombinedTotal combinedTotal,
        ConfidenceMetadata confidence,
        TotalLossCheck totalLoss,
        List<PartCostResult> partBreakdown
) {
    public record VehicleSummary(
            String make,
            String model,
            String variant,
            int registrationYear,
            int vehicleAge
    ) {}

    public record PartsCost(
            double beforeDepreciation,
            double depreciationAmount,
            double afterDepreciation,
            double repairMaterialCost,
            double paintingCost,
            double totalPartsCost
    ) {}

    public record LaborCost(
            double min,
            double max
    ) {}

    public record CombinedTotal(
            double min,
            double max
    ) {}

    public record ConfidenceMetadata(
            double overall,
            String sourceAgreement,
            List<String> sourcesUsed
    ) {}

    public record TotalLossCheck(
            Double idv,
            Double threshold75Percent,
            double repairCostForCheck,
            boolean exceeds75Percent
    ) {}
}
