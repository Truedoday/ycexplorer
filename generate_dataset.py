#!/usr/bin/env python3
import urllib.request
import json
import csv
import os
from collections import Counter
from datetime import datetime

# URL of the YC Open Source API with all companies
DATA_URL = "https://yc-oss.github.io/api/companies/all.json"
JSON_OUTPUT = "yc_startups.json"
CSV_OUTPUT = "yc_startups.csv"
README_OUTPUT = "README.md"

def fetch_data(url):
    print(f"Fetching data from {url}...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        if response.status != 200:
            raise Exception(f"HTTP error: {response.status}")
        return json.loads(response.read().decode('utf-8'))

def save_json(data, filename):
    print(f"Saving JSON dataset to {filename}...")
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def save_csv(data, filename):
    print(f"Saving CSV dataset to {filename}...")
    
    # Define fields for the CSV
    fieldnames = [
        "id", "name", "slug", "website", "yc_url", "one_liner", 
        "long_description", "team_size", "batch", "status", "stage", 
        "industry", "subindustry", "industries", "regions", 
        "all_locations", "tags", "top_company", "is_hiring", 
        "nonprofit", "former_names", "launched_at", "small_logo_url"
    ]
    
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for item in data:
            # Flatten or format list fields
            industries_str = "; ".join(item.get("industries", [])) if item.get("industries") else ""
            regions_str = "; ".join(item.get("regions", [])) if item.get("regions") else ""
            tags_str = "; ".join(item.get("tags", [])) if item.get("tags") else ""
            former_names_str = "; ".join(item.get("former_names", [])) if item.get("former_names") else ""
            
            row = {
                "id": item.get("id"),
                "name": item.get("name", ""),
                "slug": item.get("slug", ""),
                "website": item.get("website", ""),
                "yc_url": item.get("url", ""),
                "one_liner": item.get("one_liner", ""),
                "long_description": item.get("long_description", ""),
                "team_size": item.get("team_size"),
                "batch": item.get("batch", ""),
                "status": item.get("status", ""),
                "stage": item.get("stage", ""),
                "industry": item.get("industry", ""),
                "subindustry": item.get("subindustry", ""),
                "industries": industries_str,
                "regions": regions_str,
                "all_locations": item.get("all_locations", ""),
                "tags": tags_str,
                "top_company": item.get("top_company", False),
                "is_hiring": item.get("isHiring", False),
                "nonprofit": item.get("nonprofit", False),
                "former_names": former_names_str,
                "launched_at": item.get("launched_at"),
                "small_logo_url": item.get("small_logo_thumb_url", "")
            }
            writer.writerow(row)

def compute_statistics(data):
    stats = {}
    stats['total_count'] = len(data)
    
    # Operational Status
    status_counts = Counter(item.get('status', 'Unknown') for item in data)
    stats['status'] = dict(status_counts.most_common())
    
    # Top Industries
    industry_counts = Counter(item.get('industry', 'Unknown') for item in data)
    stats['industries'] = dict(industry_counts.most_common(10))
    
    # Top Tags
    tags = []
    for item in data:
        tags.extend(item.get('tags', []))
    tag_counts = Counter(tags)
    stats['tags'] = dict(tag_counts.most_common(15))
    
    # Batch distribution (Top 10 batches and total batch count)
    batch_counts = Counter(item.get('batch', 'Unknown') for item in data)
    stats['batches'] = dict(batch_counts.most_common())
    
    # Hiring stats
    hiring_count = sum(1 for item in data if item.get('isHiring', False))
    stats['hiring'] = hiring_count
    
    # Top Company count
    top_count = sum(1 for item in data if item.get('top_company', False))
    stats['top_companies'] = top_count
    
    # Non-profit count
    nonprofit_count = sum(1 for item in data if item.get('nonprofit', False))
    stats['nonprofits'] = nonprofit_count
    
    return stats

def generate_readme(stats, filename):
    print(f"Generating README.md with summary statistics...")
    
    # Get current date
    date_str = datetime.now().strftime("%B %d, %Y")
    
    status_md = "\n".join(f"* **{k}**: {v:,} ({v/stats['total_count']*100:.1f}%)" for k, v in stats['status'].items())
    industries_md = "\n".join(f"* **{k}**: {v:,} companies" for k, v in stats['industries'].items())
    tags_md = "\n".join(f"* **{k}**: {v:,} companies" for k, v in stats['tags'].items())
    
    # Top batches
    top_batches = list(stats['batches'].items())[:10]
    batches_md = "\n".join(f"* **{k}**: {v:,} companies" for k, v in top_batches)
    
    content = f"""# Y Combinator Startups Dataset

This repository contains a structured dataset of **{stats['total_count']:,}** Y Combinator-funded companies, compiled on **{date_str}**.

The dataset is derived from Y Combinator's official startup directory (retrieved programmatically from their public search index) and structured into both **CSV** (for easy spreadsheet analysis) and **JSON** (for development and API consumption) formats.

---

## Dataset Files

* **[`yc_startups.json`](./yc_startups.json)**: The complete raw dataset with full nested metadata.
* **[`yc_startups.csv`](./yc_startups.csv)**: A flattened tabular format. Lists (like tags, former names, industries, and regions) are converted into semicolon-separated strings (`; `) for compatibility with Excel, Google Sheets, Pandas, etc.
* **[`generate_dataset.py`](./generate_dataset.py)**: The Python script used to fetch, process, and output the data files.

---

## Data Schema (CSV fields)

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer | Unique YC directory ID of the startup. |
| `name` | String | Name of the startup. |
| `slug` | String | URL slug of the startup on YC's directory. |
| `website` | String | Official website URL of the startup. |
| `yc_url` | String | URL of the startup's profile page on YC. |
| `one_liner` | String | A short tagline or description. |
| `long_description` | String | Full detailed description. |
| `team_size` | Integer | Estimated/disclosed number of employees. |
| `batch` | String | YC batch (e.g., `Winter 2012`, `Summer 2023`). |
| `status` | String | Current operating status (e.g., `Active`, `Acquired`, `Public`, `Inactive`). |
| `stage` | String | Growth stage (e.g., `Early`, `Growth`). |
| `industry` | String | Primary high-level industry. |
| `subindustry` | String | Detailed subindustry taxonomy. |
| `industries` | String | Semicolon-separated list of all relevant industries. |
| `regions` | String | Semicolon-separated list of geographical regions. |
| `all_locations` | String | Location details (cities/countries). |
| `tags` | String | Semicolon-separated list of tags (e.g. `SaaS`, `AI`, `B2B`). |
| `top_company` | Boolean | Highlighted as a YC Top Company. |
| `is_hiring` | Boolean | Startup is actively hiring on the YC Work at a Startup portal. |
| `nonprofit` | Boolean | Startup is registered as a non-profit. |
| `former_names` | String | Semicolon-separated list of former company names. |
| `launched_at` | Integer | Unix timestamp of the YC profile creation. |
| `small_logo_url` | String | URL of the thumbnail logo image. |

---

## Dataset Summary Statistics

### 📊 Overview
* **Total Companies**: {stats['total_count']:,}
* **YC Top Companies 🏆**: {stats['top_companies']:,} (companies recognized for high growth/valuation)
* **Currently Hiring 💼**: {stats['hiring']:,}
* **Non-Profits 🎗️**: {stats['nonprofits']:,}

### 🔄 Operational Status
{status_md}

### 🏢 Top 10 Industries
{industries_md}

### 🏷️ Top 15 Tags
{tags_md}

### 📅 Top 10 Batches by Company Count
{batches_md}

---

## How to Update the Dataset

You can run the generator script again to pull the latest updates directly from the index:

```bash
python3 generate_dataset.py
```

*Note: This data is compiled from the public directory of launched startups. Startups in stealth mode or those that chose not to list publicly are not included.*
"""

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    try:
        raw_data = fetch_data(DATA_URL)
        
        # Sort companies by name for consistent order
        raw_data.sort(key=lambda x: x.get('name', '').lower())
        
        save_json(raw_data, JSON_OUTPUT)
        save_csv(raw_data, CSV_OUTPUT)
        
        stats = compute_statistics(raw_data)
        generate_readme(stats, README_OUTPUT)
        
        print("Dataset generation completed successfully!")
    except Exception as e:
        print(f"Error during dataset generation: {e}")

if __name__ == "__main__":
    main()
