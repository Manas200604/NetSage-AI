import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://twnhwhdjuudienrxdbsp.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

EXCEL_PATH = r"c:\Users\Lenovo\Desktop\NETSAGE AI\NetSage_AI_200_Networking_Cases.xlsx"

def clean_text(val):
    if pd.isna(val):
        return ""
    text = str(val)
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    return text.strip()

def process_and_upload():
    print(f"Reading {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH)
    print(f"Loaded {len(df)} rows from Excel.")

    cases_to_upsert = []
    sql_statements = ["-- NETSAGE AI 200+ NETWORKING CASES SEED SCRIPT", ""]

    for idx, row in df.iterrows():
        case_id = clean_text(row.get("case_id"))
        title = clean_text(row.get("title"))
        symptom = clean_text(row.get("symptom"))
        topology_note = clean_text(row.get("topology_note"))
        show_output = clean_text(row.get("evidence_to_check"))
        expected_fault = clean_text(row.get("expected_fault"))
        osi_layer = clean_text(row.get("affected_osi_layer"))
        concept = clean_text(row.get("concept"))
        severity = clean_text(row.get("severity"))
        next_command = clean_text(row.get("next_command"))
        recommended_fix = clean_text(row.get("detailed_solution"))

        if not case_id or not title:
            continue

        case_obj = {
            "case_id": case_id,
            "title": title,
            "symptom": symptom,
            "topology_note": topology_note,
            "show_output": show_output,
            "expected_fault": expected_fault,
            "osi_layer": osi_layer or "Layer 3",
            "concept": concept or "Routing",
            "severity": severity or "Medium",
            "next_command": next_command or "show ip route",
            "recommended_fix": recommended_fix,
            "version": 1
        }
        cases_to_upsert.append(case_obj)

        # Build SQL statement
        esc = lambda s: "'" + s.replace("'", "''") + "'"
        sql_statements.append(
            f"INSERT INTO public.cases (case_id, title, symptom, topology_note, show_output, expected_fault, osi_layer, concept, severity, next_command, recommended_fix, version)\n"
            f"VALUES ({esc(case_id)}, {esc(title)}, {esc(symptom)}, {esc(topology_note)}, {esc(show_output)}, {esc(expected_fault)}, {esc(osi_layer)}, {esc(concept)}, {esc(severity)}, {esc(next_command)}, {esc(recommended_fix)}, 1)\n"
            f"ON CONFLICT (case_id) DO UPDATE SET title = EXCLUDED.title, symptom = EXCLUDED.symptom, show_output = EXCLUDED.show_output, expected_fault = EXCLUDED.expected_fault, recommended_fix = EXCLUDED.recommended_fix;\n"
        )

    # 1. Save SQL file
    sql_file_path = r"c:\Users\Lenovo\Desktop\NETSAGE AI\supabase\seed_200_cases.sql"
    with open(sql_file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_statements))
    print(f"[SUCCESS] Generated SQL seed file with {len(cases_to_upsert)} cases at {sql_file_path}.")

    # 2. Batch upsert into Supabase database
    print("Upserting cases into Supabase database `cases` table...")
    batch_size = 50
    success_count = 0
    try:
        for i in range(0, len(cases_to_upsert), batch_size):
            batch = cases_to_upsert[i:i+batch_size]
            res = supabase.table("cases").upsert(batch, on_conflict="case_id").execute()
            if res.data:
                success_count += len(res.data)
                print(f"  Upserted batch {i//batch_size + 1}: {len(res.data)} cases.")

        print(f"\n[SUCCESS] Successfully uploaded {success_count} networking cases directly to your Supabase database!")
    except Exception as e:
        print(f"\n[NOTICE] Supabase table `public.cases` is not yet created in remote database.")
        print(f"         Please run `supabase/schema.sql` in your Supabase SQL Editor first, then run `supabase/seed_200_cases.sql` or re-run this script!")

if __name__ == "__main__":
    process_and_upload()
