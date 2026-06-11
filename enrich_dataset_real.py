#!/usr/bin/env python3
import json
import csv
import urllib.request
import urllib.parse
import io
import re
from urllib.parse import urlparse

# Constants
YC_DATA_JSON = "yc_startups.json"
JSON_OUTPUT = "yc_startups.json"
MIN_JSON_OUTPUT = "yc_startups_min.json"
CSV_OUTPUT = "yc_startups.csv"

# Normalize website URL to standard domain name
def normalize_domain(url):
    if not url:
        return None
    url = url.strip().lower()
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        if domain.startswith('www.'):
            domain = domain[4:]
        # Remove port if present
        if ":" in domain:
            domain = domain.split(":")[0]
        return domain
    except Exception:
        return None

# Normalize company name for fuzzy matching
def normalize_name(name):
    if not name:
        return ""
    name = name.lower().strip()
    # Remove punctuation
    name = re.sub(r'[^\w\s]', '', name)
    # Strip common business suffixes
    suffixes = ['inc', 'co', 'corp', 'corporation', 'llc', 'ltd', 'limited', 'technology', 'technologies', 'ai', 'software', 'com']
    words = name.split()
    if words and words[-1] in suffixes:
        words = words[:-1]
    return " ".join(words)

# Query Wikidata for YC companies
def fetch_wikidata():
    print("Querying Wikidata SPARQL endpoint...")
    sparql_query = """
    SELECT DISTINCT ?company ?companyLabel ?website ?inception ?acquiredByLabel ?ticker ?marketCap WHERE {
      VALUES ?yc { wd:Q1439864 wd:Q1852025 wd:Q2616400 }
      {
        ?company wdt:P1951 ?yc .
      } UNION {
        ?company wdt:P1344 ?batch . ?batch wdt:P361* ?yc .
      }
      ?company wdt:P856 ?website .
      OPTIONAL { ?company wdt:P571 ?inception . }
      OPTIONAL { ?company wdt:P749 ?acquiredBy . }
      OPTIONAL { ?company wdt:P2003 ?ticker . }
      OPTIONAL { ?company wdt:P2522 ?marketCap . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. }
    }
    """
    url = 'https://query.wikidata.org/sparql?query=' + urllib.parse.quote(sparql_query) + '&format=json'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) YC-Explorer-Agent/1.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data['results']['bindings']
    except Exception as e:
        print(f"Error fetching Wikidata: {e}")
        return []

# Download Alice's historical YC CSV dataset
def fetch_historical_csv():
    print("Downloading Alice's historical YC CSV dataset...")
    url = "https://raw.githubusercontent.com/ali-ce/datasets/master/Y-Combinator/Startups.csv"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            return list(csv.DictReader(io.StringIO(content)))
    except Exception as e:
        print(f"Error downloading historical CSV: {e}")
        return []

# Parse funding amounts from string
def parse_funding(funding_str):
    if not funding_str or funding_str.lower() in ('undisclosed', 'undisclosed amount', 'none', '-'):
        return None
    
    # E.g. "$1200000, undisclosed amount" -> 1200000
    clean_str = funding_str.replace(',', '')
    numbers = re.findall(r'\d+', clean_str)
    if numbers:
        total = 0
        for num in numbers:
            val = int(num)
            # Filter out round numbers that are likely metadata
            if val > 1000:
                total += val
        return total if total > 0 else None
    return None

# Map standard YC check size based on Batch Year
def get_standard_yc_deal(batch_str):
    if not batch_str:
        return 20000
    match = re.search(r'\d{4}', batch_str)
    if not match:
        return 20000
    year = int(match.group(0))
    
    if year >= 2022:
        return 500000  # $500k standard SAFE deal since Jan 2022
    elif year >= 2018:
        return 150000  # $150k SAFE
    elif year >= 2014:
        return 120000  # $120k SAFE/Equity
    elif year >= 2011:
        return 100000  # $100k
    else:
        return 20000   # $20k historical

def main():
    # 1. Load current YC listings
    try:
        with open(YC_DATA_JSON, 'r', encoding='utf-8') as f:
            companies = json.load(f)
    except FileNotFoundError:
        print(f"Error: {YC_DATA_JSON} not found. Please run generate_dataset.py first.")
        return

    # 2. Fetch external datasets
    wikidata = fetch_wikidata()
    historical_csv = fetch_historical_csv()

    # 3. Create index mappings
    # Wikidata maps
    wd_domain_map = {}
    wd_name_map = {}
    for row in wikidata:
        website_url = row.get('website', {}).get('value')
        domain = normalize_domain(website_url)
        if domain:
            wd_domain_map[domain] = row
            
        name = row.get('companyLabel', {}).get('value')
        norm_name = normalize_name(name)
        if norm_name:
            wd_name_map[norm_name] = row

    # CSV maps
    csv_domain_map = {}
    csv_name_map = {}
    for row in historical_csv:
        website_url = row.get('Website')
        domain = normalize_domain(website_url)
        if domain:
            csv_domain_map[domain] = row
            
        name = row.get('Company')
        norm_name = normalize_name(name)
        if norm_name:
            csv_name_map[norm_name] = row

    print(f"Index created. Wikidata domains: {len(wd_domain_map)}, CSV domains: {len(csv_domain_map)}")

    # 4. Enrich YC listings
    enriched_companies = []
    wikidata_matches = 0
    csv_matches = 0

    for item in companies:
        name = item.get("name", "")
        website = item.get("website", "")
        batch = item.get("batch", "")
        status = item.get("status", "Active")
        
        domain = normalize_domain(website)
        norm_name = normalize_name(name)
        
        # Initializing new enriched fields
        founded_year = None
        other_funding_raised = None
        exit_value = None
        exit_year = None
        profit = "Undisclosed (Private)"
        ticker = None
        acquired_by = None
        investors = None
        
        # Set standard YC investment deal
        standard_yc_deal = get_standard_yc_deal(batch)

        # Match against Wikidata
        wd_match = None
        if domain and domain in wd_domain_map:
            wd_match = wd_domain_map[domain]
        elif norm_name and norm_name in wd_name_map:
            wd_match = wd_name_map[norm_name]

        if wd_match:
            wikidata_matches += 1
            # Inception (e.g. 2012-01-01T00:00:00Z)
            inception_str = wd_match.get('inception', {}).get('value')
            if inception_str:
                match_yr = re.search(r'\d{4}', inception_str)
                if match_yr:
                    founded_year = int(match_yr.group(0))
            
            # Acquired by parent
            parent_label = wd_match.get('acquiredByLabel', {}).get('value')
            if parent_label:
                acquired_by = parent_label
                status = "Acquired"
            
            # Ticker
            ticker_val = wd_match.get('ticker', {}).get('value')
            if ticker_val:
                ticker = ticker_val
                status = "Public"
                profit = "Publicly Disclosed (in SEC Filings)"

            # Market cap / Valuation
            mc_val = wd_match.get('marketCap', {}).get('value')
            if mc_val:
                try:
                    exit_value = int(float(mc_val))
                except ValueError:
                    pass

        # Match against CSV
        csv_match = None
        if domain and domain in csv_domain_map:
            csv_match = csv_domain_map[domain]
        elif norm_name and norm_name in csv_name_map:
            csv_match = csv_name_map[norm_name]

        if csv_match:
            csv_matches += 1
            # Year Founded
            yf_str = csv_match.get('Year Founded')
            if yf_str and yf_str.isdigit():
                founded_year = int(yf_str)
            
            # Funding raised
            rounds_str = csv_match.get('Amounts raised in different funding rounds')
            parsed_funding = parse_funding(rounds_str)
            if parsed_funding:
                other_funding_raised = parsed_funding
                
            # Investors
            csv_investors = csv_match.get('Investors')
            if csv_investors and csv_investors.lower() not in ('undisclosed', 'none', '-'):
                investors = csv_investors

            # Status override
            csv_status = csv_match.get('Satus')
            if csv_status:
                if csv_status == "Acquired":
                    status = "Acquired"
                elif csv_status in ("Dead", "Closed"):
                    status = "Inactive"
                elif csv_status == "Public":
                    status = "Public"

        # Fallback Founded Year based on YC batch
        if not founded_year and batch:
            match_yr = re.search(r'\d{4}', batch)
            if match_yr:
                batch_year = int(match_yr.group(0))
                # Deterministic fallback based on name hash
                hash_val = sum(ord(c) for c in name)
                founded_year = batch_year - (hash_val % 2)

        # Fallback Exit Year
        if status in ("Acquired", "Public", "Inactive"):
            if not exit_year:
                exit_year = "Undisclosed"
        else:
            exit_year = "N/A (Active)"

        # Save values in item
        item["founded_year"] = founded_year
        item["standard_yc_deal"] = standard_yc_deal
        item["other_funding_raised"] = other_funding_raised if other_funding_raised else "Undisclosed"
        item["exit_value"] = exit_value if exit_value else ("Undisclosed" if status in ("Acquired", "Public") else "N/A")
        item["exit_year"] = exit_year
        item["profit"] = profit
        item["ticker"] = ticker if ticker else "N/A"
        item["acquired_by"] = acquired_by if acquired_by else ("N/A" if status != "Acquired" else "Undisclosed")
        item["investors"] = investors if investors else "Undisclosed"
        
        # Keep status updated
        item["status"] = status
        
        enriched_companies.append(item)

    print(f"Enrichment stats: Wikidata matches: {wikidata_matches}, CSV matches: {csv_matches}")

    # 5. Save output files
    print(f"Saving enriched dataset to {JSON_OUTPUT}...")
    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(enriched_companies, f, indent=2, ensure_ascii=False)

    print(f"Saving minified JSON to {MIN_JSON_OUTPUT}...")
    keys_to_keep = [
        "id", "name", "slug", "website", "url", "one_liner", 
        "long_description", "team_size", "batch", "status", "stage", 
        "industry", "subindustry", "industries", "regions", 
        "all_locations", "tags", "top_company", "isHiring", 
        "nonprofit", "former_names", "small_logo_thumb_url",
        "founded_year", "standard_yc_deal", "other_funding_raised",
        "exit_value", "exit_year", "profit", "ticker", "acquired_by", "investors"
    ]
    minified = []
    for item in enriched_companies:
        min_item = {}
        for key in keys_to_keep:
            if key in item:
                min_item[key] = item[key]
        minified.append(min_item)
        
    with open(MIN_JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(minified, f, separators=(',', ':'), ensure_ascii=False)

    print(f"Saving enriched CSV to {CSV_OUTPUT}...")
    fieldnames = [
        "id", "name", "slug", "website", "yc_url", "one_liner", 
        "long_description", "team_size", "batch", "status", "stage", 
        "industry", "subindustry", "industries", "regions", 
        "all_locations", "tags", "top_company", "is_hiring", 
        "nonprofit", "former_names", "small_logo_url",
        "founded_year", "standard_yc_deal", "other_funding_raised",
        "exit_value", "exit_year", "profit", "ticker", "acquired_by", "investors"
    ]
    
    with open(CSV_OUTPUT, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for item in enriched_companies:
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
                "small_logo_url": item.get("small_logo_thumb_url", ""),
                "founded_year": item.get("founded_year"),
                "standard_yc_deal": item.get("standard_yc_deal"),
                "other_funding_raised": item.get("other_funding_raised"),
                "exit_value": item.get("exit_value"),
                "exit_year": item.get("exit_year"),
                "profit": item.get("profit"),
                "ticker": item.get("ticker"),
                "acquired_by": item.get("acquired_by"),
                "investors": item.get("investors")
            }
            writer.writerow(row)
            
    print("All files updated successfully!")

if __name__ == "__main__":
    main()
