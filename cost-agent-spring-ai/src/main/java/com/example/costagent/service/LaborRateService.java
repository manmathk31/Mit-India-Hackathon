package com.example.costagent.service;

import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class LaborRateService {

    public double hourlyRate(String city, String region) {
        String value = ((city == null ? "" : city) + " " +
                (region == null ? "" : region)).toLowerCase(Locale.ROOT);

        if (containsAny(value, "mumbai", "pune", "delhi", "new delhi",
                "bengaluru", "bangalore", "hyderabad", "chennai",
                "kolkata", "ahmedabad")) {
            return 1200.0;
        }

        if (containsAny(value, "metro")) {
            return 1200.0;
        }

        return 800.0;
    }

    private boolean containsAny(String value, String... words) {
        for (String word : words) {
            if (value.contains(word)) return true;
        }
        return false;
    }
}
