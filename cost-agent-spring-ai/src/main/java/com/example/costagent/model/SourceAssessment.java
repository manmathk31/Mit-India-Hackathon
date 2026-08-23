package com.example.costagent.model;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

/** Confidence reported by one upstream source, such as vision or price history. */
public record SourceAssessment(
        @NotBlank String source,
        @DecimalMin("0.0") @DecimalMax("1.0") double confidence,
        Boolean agreesWithEstimate
) {}
