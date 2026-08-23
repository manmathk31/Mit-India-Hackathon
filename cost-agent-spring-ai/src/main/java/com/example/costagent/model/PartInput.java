package com.example.costagent.model;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PartInput(
        @NotBlank String partName,
        @NotNull WorkType workType,
        // Optional because it can be derived from a known part name. The result
        // always reports the material that was actually used for depreciation.
        MaterialType materialType,
        @NotNull DamageSeverity severity,
        @DecimalMin("0.0") Double estimatedPartCost,
        @DecimalMin("0.0") Double estimatedLaborHours
) {}
