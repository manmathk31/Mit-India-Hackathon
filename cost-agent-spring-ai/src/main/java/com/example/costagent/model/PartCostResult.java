package com.example.costagent.model;

public record PartCostResult(
        String partName,
        WorkType workType,
        MaterialType materialType,
        double baseCost,
        double depreciationRate,
        double depreciationAmount,
        double postDepreciationCost
) {}
