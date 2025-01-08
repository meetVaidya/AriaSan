from supabase import create_client, Client
import os

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

def authenticate_user(user_id: str) -> bool:
    """Check if the user is authenticated and has an active subscription."""
    user = supabase.table("users").select("*").eq("user_id", user_id).execute()
    return len(user.data) > 0 and user.data[0]["subscription_status"] == "active"