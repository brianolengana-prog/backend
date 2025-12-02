# Quick Start: Running Extraction Evaluation

## 🚀 Run Your First Evaluation

### Step 1: Navigate to Test Directory
```bash
cd backend/src/tests/extraction
```

### Step 2: Run Evaluation
```bash
# Evaluate Unified Service (default)
node run-evaluation.js

# Evaluate specific service
node run-evaluation.js --service unified
node run-evaluation.js --service robust

# Compare all services
node run-evaluation.js --compare
```

### Step 3: View Results
Results are printed to console and saved to `evaluation-report.json`

## 📊 Understanding Results

### Metrics Explained

- **Accuracy**: % of test cases passed completely
- **Precision**: % of found contacts that are correct (low false positives)
- **Recall**: % of expected contacts that were found (low false negatives)
- **F1 Score**: Overall quality metric (harmonic mean of precision & recall)
- **Processing Time**: Average time per extraction (ms)
- **Cost**: Estimated cost per extraction ($)

### Good Results
- ✅ Accuracy > 95%
- ✅ Precision > 95%
- ✅ Recall > 95%
- ✅ F1 Score > 95%
- ✅ False Positives < 2%
- ✅ False Negatives < 5%

## 📝 Adding Test Cases

1. Create JSON file in `test-data/` directory
2. Use `template.json` as reference
3. Include:
   - `text`: Call sheet text
   - `expectedContacts`: Array of expected contacts
   - `format`: Format type
   - `difficulty`: Difficulty level

Example:
```json
{
  "id": "my-test",
  "name": "My Test Case",
  "format": "structured",
  "difficulty": "easy",
  "text": "PHOTOGRAPHER: John Doe / john@example.com / 555-1234",
  "expectedContacts": [
    {
      "name": "John Doe",
      "role": "PHOTOGRAPHER",
      "email": "john@example.com",
      "phone": "555-1234"
    }
  ]
}
```

## 🔍 Troubleshooting

### No Test Cases Found
- Ensure test data files are in `test-data/` directory
- Files must end with `.json`
- Check file permissions

### Service Not Found
- Ensure service is imported in `run-evaluation.js`
- Check service has `extractContacts` method
- Verify service path is correct

### Evaluation Fails
- Check OpenAI API key is set (for AI services)
- Verify test case format is valid JSON
- Check service returns expected format

## 📚 More Information

- Full documentation: `README.md`
- Implementation plan: `../../../../EXTRACTION_EVALUATION_AND_IMPLEMENTATION_PLAN.md`
- Summary: `../../../../EXTRACTION_EVALUATION_SUMMARY.md`

