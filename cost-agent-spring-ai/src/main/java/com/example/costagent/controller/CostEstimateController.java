package com.example.costagent.controller;

import com.example.costagent.model.CostEstimateRequest;
import com.example.costagent.model.CostEstimateResponse;
import com.example.costagent.service.CostEstimationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cost")
public class CostEstimateController {

    private final CostEstimationService costEstimationService;

    public CostEstimateController(CostEstimationService costEstimationService) {
        this.costEstimationService = costEstimationService;
    }

    @PostMapping("/estimate")
    public ResponseEntity<CostEstimateResponse> estimate(
            @Valid @RequestBody CostEstimateRequest request) {

        return ResponseEntity.ok(costEstimationService.estimate(request));
    }
}
