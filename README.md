# Y Combinator Startups Dataset

This repository contains a structured dataset of **5,956** Y Combinator-funded companies, compiled on **June 10, 2026**.

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
* **Total Companies**: 5,956
* **YC Top Companies 🏆**: 91 (companies recognized for high growth/valuation)
* **Currently Hiring 💼**: 1,480
* **Non-Profits 🎗️**: 42

### 🔄 Operational Status
* **Active**: 4,105 (68.9%)
* **Inactive**: 1,040 (17.5%)
* **Acquired**: 788 (13.2%)
* **Public**: 23 (0.4%)

### 🏢 Top 10 Industries
* **B2B**: 3,044 companies
* **Consumer**: 869 companies
* **Healthcare**: 679 companies
* **Fintech**: 632 companies
* **Industrials**: 389 companies
* **Real Estate and Construction**: 159 companies
* **Education**: 125 companies
* **Government**: 41 companies
* **Unspecified**: 18 companies

### 🏷️ Top 15 Tags
* **SaaS**: 1,100 companies
* **B2B**: 1,100 companies
* **Artificial Intelligence**: 916 companies
* **AI**: 836 companies
* **Fintech**: 700 companies
* **Developer Tools**: 534 companies
* **Marketplace**: 305 companies
* **Generative AI**: 257 companies
* **Consumer**: 243 companies
* **Machine Learning**: 230 companies
* **Healthcare**: 205 companies
* **E-commerce**: 188 companies
* **Analytics**: 186 companies
* **Health Tech**: 172 companies
* **Open Source**: 167 companies

### 📅 Top 10 Batches by Company Count
* **Winter 2022**: 398 companies
* **Summer 2021**: 391 companies
* **Winter 2021**: 336 companies
* **Winter 2023**: 274 companies
* **Winter 2024**: 249 companies
* **Summer 2024**: 248 companies
* **Summer 2022**: 234 companies
* **Winter 2020**: 229 companies
* **Summer 2023**: 219 companies
* **Summer 2020**: 208 companies

---

## How to Update the Dataset

You can run the generator script again to pull the latest updates directly from the index:

```bash
python3 generate_dataset.py
```

*Note: This data is compiled from the public directory of launched startups. Startups in stealth mode or those that chose not to list publicly are not included.*
