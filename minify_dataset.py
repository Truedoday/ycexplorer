#!/usr/bin/env python3
import json

def minify():
    print("Loading yc_startups.json...")
    try:
        with open('yc_startups.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Error: yc_startups.json not found in the current directory.")
        return

    minified = []
    keys_to_keep = [
        "id", "name", "slug", "website", "url", "one_liner", 
        "long_description", "team_size", "batch", "status", "stage", 
        "industry", "subindustry", "industries", "regions", 
        "all_locations", "tags", "top_company", "isHiring", 
        "nonprofit", "former_names", "small_logo_thumb_url"
    ]
    
    for item in data:
        min_item = {}
        for key in keys_to_keep:
            if key in item:
                min_item[key] = item[key]
        minified.append(min_item)
        
    print(f"Saving {len(minified)} items to yc_startups_min.json...")
    with open('yc_startups_min.json', 'w', encoding='utf-8') as f:
        # Save as highly compressed single-line JSON to minimize load times
        json.dump(minified, f, separators=(',', ':'), ensure_ascii=False)
    print("Done minifying!")

if __name__ == "__main__":
    minify()
