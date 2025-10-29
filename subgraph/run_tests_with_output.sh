#!/bin/bash

# Script to run graph test and capture raw output
# Usage: bash run_tests_with_output.sh

OUTPUT_FILE="test_results_raw_$(date +%Y%m%d_%H%M%S).txt"

echo "========================================" | tee "$OUTPUT_FILE"
echo "MATCHSTICK TEST RUN - RAW OUTPUT" | tee -a "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "========================================" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Run graph test with docker and capture ALL output
graph test -d 2>&1 | tee -a "$OUTPUT_FILE"

echo "" | tee -a "$OUTPUT_FILE"
echo "========================================" | tee -a "$OUTPUT_FILE"
echo "Test run completed. Output saved to: $OUTPUT_FILE" | tee -a "$OUTPUT_FILE"
echo "========================================" | tee -a "$OUTPUT_FILE"

# Display summary
echo ""
echo "SUMMARY:"
grep -E "(✓|𝖷|passed|failed)" "$OUTPUT_FILE" | tail -20
