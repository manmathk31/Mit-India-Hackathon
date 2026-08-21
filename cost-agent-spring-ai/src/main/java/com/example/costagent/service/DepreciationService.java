package com.example.costagent.service;

import com.example.costagent.model.MaterialType;
import org.springframework.stereotype.Service;

@Service
public class DepreciationService {

    /**
     * IRDAI-style motor own-damage depreciation treatment:
     * Plastic/rubber: 50%
     * Fibreglass: 30%
     * Glass: 0%
     * Metal: age-based slab
     *
     * IMPORTANT:
     * This method is called only for REPLACEMENT parts.
     */
    public double getDepreciationRate(MaterialType materialType, int vehicleAge) {
        return switch (materialType) {
            case PLASTIC_RUBBER -> 0.50;
            case FIBREGLASS -> 0.30;
            case GLASS -> 0.00;
            case METAL -> metalAgeBasedRate(vehicleAge);
            case UNKNOWN -> 0.00;
        };
    }

    private double metalAgeBasedRate(int age) {
        // IRDAI Motor OD parts depreciation slab for metal components:
        //
        //   Vehicle age               Depreciation
        //   ─────────────────────────  ────────────
        //   ≤ 6 months                 Nil
        //   > 6 months – 1 year        5 %
        //   > 1 year  – 2 years       10 %
        //   > 2 years – 3 years       15 %
        //   > 3 years – 4 years       25 %
        //   > 4 years – 5 years       35 %
        //   > 5 years – 10 years      40 %
        //   > 10 years                50 %
        //
        // Registration year alone cannot determine exact months,
        // so the year-based implementation uses the conservative
        // full-year bucket (age 0 → ≤ 6 months bucket).
        if (age <= 0)  return 0.00;
        if (age <= 1)  return 0.05;
        if (age <= 2)  return 0.10;
        if (age <= 3)  return 0.15;
        if (age <= 4)  return 0.25;
        if (age <= 5)  return 0.35;
        if (age <= 10) return 0.40;
        return 0.50;
    }
}
