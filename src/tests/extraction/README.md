# Extraction Evaluation Framework

Comprehensive testing framework for evaluating extraction services.

## Quick Start

### 1. Prepare Test Data

Create test case files in `test-data/` directory. Each test case should be a JSON file:

```json
{
  "id": "test-case-1",
  "name": "Test Case Name",
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
  ],
  "metadata": {
    "description": "Test case description",
    "source": "synthetic|real-world"
  }
}
```

### 2. Run Evaluation

**Evaluate Unified Service:**
```bash
node run-evaluation.js
```

**Evaluate Specific Service:**
```bash
node run-evaluation.js --service unified
node run-evaluation.js --service robust
```

**Compare All Services:**
```bash
node run-evaluation.js --compare
```

**Custom Test Data Directory:**
```bash
node run-evaluation.js --test-data-dir /path/to/test/data
```

**Custom Output Path:**
```bash
node run-evaluation.js --output /path/to/report.json
```

## Metrics

The evaluation framework measures:

- **Accuracy**: % of test cases passed
- **Precision**: % of found contacts that are correct
- **Recall**: % of expected contacts that were found
- **F1 Score**: Harmonic mean of precision and recall
- **Processing Time**: Average time per extraction
- **Cost**: Estimated cost per extraction
- **False Positives**: Invalid contacts found
- **False Negatives**: Valid contacts missed

## Test Case Format

### Required Fields

- `id`: Unique identifier
- `name`: Human-readable name
- `text`: Call sheet text to extract from
- `expectedContacts`: Array of expected contact objects

### Optional Fields

- `format`: Format type (structured, semi-structured, unstructured, tabular)
- `difficulty`: Difficulty level (easy, medium, hard)
- `metadata`: Additional metadata

### Contact Object Format

```json
{
  "name": "Full Name",
  "role": "ROLE",
  "email": "email@example.com",
  "phone": "phone-number",
  "company": "Company Name (optional)"
}
```

## Example Test Cases

See `test-data/` directory for example test cases:

- `template.json`: Basic template
- `sunday-times-example.json`: Sunday Times format example

## Adding New Test Cases

1. Create a new JSON file in `test-data/` directory
2. Follow the test case format
3. Include ground truth `expectedContacts`
4. Run evaluation to test

## Interpreting Results

### Good Results
- Accuracy > 95%
- Precision > 95%
- Recall > 95%
- F1 Score > 95%
- False Positives < 2%
- False Negatives < 5%

### Areas for Improvement
- Low recall: Missing valid contacts → Improve extraction patterns/prompts
- Low precision: Finding invalid contacts → Improve validation
- High false positives: Too many invalid contacts → Improve filtering
- High false negatives: Missing contacts → Improve extraction coverage

## Continuous Evaluation

Run evaluation regularly to:
- Track improvements over time
- Identify regressions
- Guide optimization efforts
- Measure impact of changes

## Integration with CI/CD

Add to your CI/CD pipeline:

```yaml
# .github/workflows/evaluation.yml
- name: Run Extraction Evaluation
  run: |
    cd backend/src/tests/extraction
    node run-evaluation.js --compare
```

