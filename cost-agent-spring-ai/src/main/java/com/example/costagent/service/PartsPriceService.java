package com.example.costagent.service;

import com.example.costagent.model.MaterialType;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;

@Service
public class PartsPriceService {

    /*
     * Demo baseline prices.
     *
     * In production this service should be replaced by a real parts-price
     * source/database/API. The cost-agent architecture intentionally keeps
     * price retrieval separate from depreciation calculation.
     */
    private static final Map<String, Double> BASE_PRICES = Map.ofEntries(
            Map.entry("bumper", 12000.0),
            Map.entry("front bumper", 12000.0),
            Map.entry("rear bumper", 12000.0),
            Map.entry("hood", 18000.0),
            Map.entry("bonnet", 18000.0),
            Map.entry("fender", 10000.0),
            Map.entry("front fender", 10000.0),
            Map.entry("rear fender", 11000.0),
            Map.entry("door", 22000.0),
            Map.entry("front door", 22000.0),
            Map.entry("rear door", 22000.0),
            Map.entry("windshield", 18000.0),
            Map.entry("front windshield", 18000.0),
            Map.entry("headlight", 16000.0),
            Map.entry("tail light", 9000.0),
            Map.entry("mirror", 7000.0)
    );

    public double getPartPrice(String partName, MaterialType materialType) {
        String key = partName.toLowerCase(Locale.ROOT).trim();

        Double exact = BASE_PRICES.get(key);
        if (exact != null) return exact;

        // Material-based fallback keeps the service usable for unknown parts.
        return switch (materialType) {
            case GLASS -> 15000.0;
            case PLASTIC_RUBBER -> 10000.0;
            case FIBREGLASS -> 12000.0;
            case METAL -> 18000.0;
            case UNKNOWN -> 12000.0;
        };
    }
}
