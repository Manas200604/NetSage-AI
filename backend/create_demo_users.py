import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://twnhwhdjuudienrxdbsp.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

DEMO_USERS = [
    {
        "email": "admin@netsage.lab",
        "password": "AdminPassword123!",
        "name": "NetSage Administrator",
        "role": "admin"
    },
    {
        "email": "user@netsage.lab",
        "password": "UserPassword123!",
        "name": "Network Lab Engineer",
        "role": "user"
    }
]

def create_demo_users():
    print("Connecting to Supabase Auth Admin...")
    
    for u in DEMO_USERS:
        email = u["email"]
        password = u["password"]
        name = u["name"]
        role = u["role"]

        print(f"\nProcessing demo account: {email} ({role})...")
        
        try:
            # 1. Check if user already exists in auth
            auth_res = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "name": name,
                    "role": role
                }
            })
            user_id = auth_res.user.id
            print(f"  [CREATED AUTH USER] ID: {user_id}")
        except Exception as e:
            err_str = str(e)
            print(f"  Note: {err_str}")
            # If user exists, fetch user id from profiles or auth
            prof_fetch = supabase.table("profiles").select("id").eq("email", email).execute()
            if prof_fetch.data:
                user_id = prof_fetch.data[0]["id"]
            else:
                user_id = None

        if user_id:
            # 2. Upsert into public.profiles table
            supabase.table("profiles").upsert({
                "id": user_id,
                "name": name,
                "email": email,
                "role": role
            }).execute()
            print(f"  [PROFILE UPDATED] Role set to '{role}' in profiles table.")

    print("\n" + "="*60)
    print("[SUCCESS] DEMO ACCOUNTS CREATED SUCCESSFULLY!")
    print("="*60)
    print("  ADMIN ACCOUNT:")
    print("   Email:    admin@netsage.lab")
    print("   Password: AdminPassword123!")
    print("   Role:     Administrator (Full access to Dataset CRUD & Corrections)")
    print()
    print("  USER ACCOUNT:")
    print("   Email:    user@netsage.lab")
    print("   Password: UserPassword123!")
    print("   Role:     Network User (Troubleshooting Wizard & Personal Sessions)")
    print("="*60)

if __name__ == "__main__":
    create_demo_users()
