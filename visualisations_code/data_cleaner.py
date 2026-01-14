import pandas as pd
import os

data_path = r"C:\Users\nicol\OneDrive - TU Eindhoven\Desktop\Visualizations\visualisations_code" 

source_files = [
    "communications_data.csv", "demographics_data.csv", "economy_data.csv",
    "energy_data.csv", "geography_data.csv", "government_and_civics_data.csv",
    "transportation_data.csv"
]

originally_removed = [
    'telephone_fixed_subscriptions_total', 'mobile_cellular_subscriptions_total',
    'internet_country_code', 'internet_users_total', 'broadband_fixed_subscriptions_total',
    'Population_Growth_Rate', 'Median_Age', 'Sex_Ratio', 'Infant_Mortality_Rate', 'Total_Fertility_Rate',
    'Total_Literacy_Rate', 'Male_Literacy_Rate', 'Female_Literacy_Rate',
    'Youth_Unemployment_Rate', 'GDP_Official_Exchange_Rate_billion_USD',
    'Budget_Surplus_billion_USD', 'Budget_Deficit_percent_of_GDP',
    'Public_Debt_percent_of_GDP', 'Fiscal_Year', 'Exchange_Rate_per_USD',
    'Capital_Coordinates', 'Suffrage_Age', 'airports_paved_runways_count',
    'airports_unpaved_runways_count', 'heliports_count', 'Geographic_Coordinates'
]

merged_df = None

print("Starting merge and relevance filtering...")

for file_name in source_files:
    full_path = os.path.join(data_path, file_name)
    
    try:
        df = pd.read_csv(full_path)
        
        cols_to_keep = [c for c in df.columns if c not in originally_removed]
        df = df[cols_to_keep]
        
        if merged_df is None:
            merged_df = df
        else:
            merged_df = pd.merge(merged_df, df, on='Country', how='outer')
            
        print(f" Successfully processed: {file_name}")
    except FileNotFoundError:
        print(f" Error: Could not find {full_path}. Check your folder structure!")

if merged_df is not None:
    threshold = 0.30
    row_limit = len(merged_df) * threshold
    
    final_columns = []
    
    print(f"\nApplying 30% null threshold (Limit: {row_limit:.1f} missing values)...")
    
    for col in merged_df.columns:
        null_count = merged_df[col].isnull().sum()
        
        if null_count <= row_limit or col in ['Country', 'Government_Type']:
            final_columns.append(col)
        else:
            print(f" Dropping: {col} ({null_count} nulls)")

    df_final = merged_df[final_columns]

    output_name = "final_cleaned_climate_data.csv"
    df_final.to_csv(output_name, index=False)
    
    print("-" * 30)
    print(f"Success! Final file saved as: {output_name}")
    print(f"Final column count: {len(df_final.columns)}")
    print(f"Total rows: {len(df_final)}")
else:
    print("Merge failed. No data to process.")