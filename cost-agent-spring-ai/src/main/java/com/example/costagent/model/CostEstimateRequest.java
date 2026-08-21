package com.example.costagent.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CostEstimateRequest(
        @NotBlank String vehicleMake,
        @NotBlank String vehicleModel,
        String variant,
        @NotNull @Min(1900) Integer registrationYear,
        @NotBlank String damageLocation,
        @NotNull DamageSeverity damageSeverity,
        @NotBlank String city,
        String region,
        List<@Valid SourceAssessment> sourceAssessments,
        Double idv,
        @NotEmpty List<@Valid PartInput> affectedParts
) {}
