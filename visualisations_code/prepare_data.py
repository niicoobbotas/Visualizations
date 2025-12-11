import pandas as pd
import json
import os

# --- PATH FIX (Ensures script finds files in the same folder) ---
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# 1. Load Data
try:
    geo_df = pd.read_csv('geography_data.csv')
    energy_df = pd.read_csv('energy_data.csv')
    print("✅ Files loaded.")
except FileNotFoundError:
    print("❌ Error: CSV files not found. Please check filenames.")
    exit()

# 2. Clean Data
def clean_percent(x):
    if isinstance(x, str):
        return float(x.replace('%', ''))
    return 0.0

if 'Arable_Land (% of Total Agricultural Land)' in geo_df.columns:
    geo_df['arable_pct'] = geo_df['Arable_Land (% of Total Agricultural Land)'].apply(clean_percent)
else:
    # Fallback search
    for col in geo_df.columns:
        if "Arable_Land" in col:
            geo_df['arable_pct'] = geo_df[col].apply(clean_percent)
            break

# 3. Rename Columns for easier JS access
# Note: We are specifically ensuring Exports/Imports are clear
energy_map = {
    'electricity_generating_capacity_kW': 'Elec. Capacity',
    'coal_metric_tons': 'Coal Production',
    'petroleum_bbl_per_day': 'Petroleum Prod.',
    'refined_petroleum_products_bbl_per_day': 'Refined Prod.',
    'refined_petroleum_exports_bbl_per_day': 'Petroleum Exports', # Renamed for clarity
    'refined_petroleum_imports_bbl_per_day': 'Petroleum Imports', # Renamed for clarity
    'natural_gas_cubic_meters': 'Natural Gas',
    'carbon_dioxide_emissions_Mt': 'CO2 Emissions',
    'electricity_access_percent': 'Elec. Access %'
}

# 4. Merge
merged = pd.merge(geo_df[['Country', 'arable_pct']], energy_df, on='Country', how='left').fillna(0)

# 5. Calculate Max Values (Global Max)
max_values = {}
for col_raw, col_pretty in energy_map.items():
    if col_raw in merged.columns:
        max_values[col_pretty] = float(merged[col_raw].max())

# 6. Build JSON Structure
output_data = {
    "max_values": max_values,
    "countries": {}
}

for _, row in merged.iterrows():
    country_name = str(row['Country']).title()
    
    attributes = {}
    for col_raw, col_pretty in energy_map.items():
        if col_raw in row:
            attributes[col_pretty] = row[col_raw]
        else:
            attributes[col_pretty] = 0

    output_data["countries"][country_name] = {
        "arable": row['arable_pct'],
        "energy": attributes
    }

# 7. Save
with open('map_data.js', 'w') as f:
    f.write("var mapData = " + json.dumps(output_data, indent=4) + ";")

print("✅ 'map_data.js' updated with Trade Data.")