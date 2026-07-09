import os
import uuid
import json
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[DB] Supabase client initialized successfully.")
    except Exception as e:
        print(f"[DB] Error initializing Supabase: {e}. Falling back to SQLite.")
        supabase_client = None
else:
    print("[DB] Supabase credentials not found in env. Using SQLite fallback.")

# SQLite initialization configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQLITE_PATH = os.path.join(BASE_DIR, "chat_history.db")

def get_sqlite_conn():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite_db():
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_rooms (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()

# Initialize SQLite tables immediately if not using Supabase
if supabase_client is None:
    init_sqlite_db()

def get_rooms():
    if supabase_client:
        try:
            res = supabase_client.table("chat_rooms").select("*").order("updated_at", desc=True).execute()
            return res.data
        except Exception as e:
            print(f"[DB] Supabase get_rooms failed: {e}. Falling back to SQLite.")
            
    # SQLite fallback
    init_sqlite_db()
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_rooms ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def create_room(title="Percakapan Baru"):
    room_id = str(uuid.uuid4())
    now_str = datetime.utcnow().isoformat()
    if supabase_client:
        try:
            res = supabase_client.table("chat_rooms").insert({
                "id": room_id,
                "title": title,
                "created_at": now_str,
                "updated_at": now_str
            }).execute()
            if res.data:
                return res.data[0]["id"]
        except Exception as e:
            print(f"[DB] Supabase create_room failed: {e}. Falling back to SQLite.")
            
    # SQLite fallback
    init_sqlite_db()
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_rooms (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (room_id, title, now_str, now_str)
    )
    conn.commit()
    conn.close()
    return room_id

def delete_room(room_id):
    if supabase_client:
        try:
            res = supabase_client.table("chat_rooms").delete().eq("id", room_id).execute()
            return True
        except Exception as e:
            print(f"[DB] Supabase delete_room failed: {e}. Falling back to SQLite.")
            
    # SQLite fallback
    init_sqlite_db()
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_rooms WHERE id = ?", (room_id,))
    cursor.execute("DELETE FROM chat_messages WHERE room_id = ?", (room_id,))
    conn.commit()
    conn.close()
    return True

def update_room_title(room_id, title):
    now_str = datetime.utcnow().isoformat()
    if supabase_client:
        try:
            res = supabase_client.table("chat_rooms").update({
                "title": title,
                "updated_at": now_str
            }).eq("id", room_id).execute()
            return True
        except Exception as e:
            print(f"[DB] Supabase update_room_title failed: {e}. Falling back to SQLite.")
            
    # SQLite fallback
    init_sqlite_db()
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE chat_rooms SET title = ?, updated_at = ? WHERE id = ?",
        (title, now_str, room_id)
    )
    conn.commit()
    conn.close()
    return True

def get_messages(room_id):
    if supabase_client:
        try:
            res = supabase_client.table("chat_messages").select("*").eq("room_id", room_id).order("id").execute()
            data = res.data
            for msg in data:
                if isinstance(msg.get("metadata"), str):
                    try:
                        msg["metadata"] = json.loads(msg["metadata"])
                    except:
                        pass
            return data
        except Exception as e:
            print(f"[DB] Supabase get_messages failed: {e}. Falling back to SQLite.")
            
    # SQLite fallback
    init_sqlite_db()
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_messages WHERE room_id = ? ORDER BY id ASC", (room_id,))
    rows = cursor.fetchall()
    conn.close()
    
    msgs = []
    for r in rows:
        d = dict(r)
        if d.get("metadata"):
            try:
                d["metadata"] = json.loads(d["metadata"])
            except:
                pass
        msgs.append(d)
    return msgs

def save_message(room_id, sender, content, metadata=None):
    now_str = datetime.utcnow().isoformat()
    
    # Also update the room's updated_at timestamp to bring it to top of list
    try:
        title = get_room_title(room_id)
        update_room_title(room_id, title)
    except:
        pass
        
    if supabase_client:
        try:
            res = supabase_client.table("chat_messages").insert({
                "room_id": room_id,
                "sender": sender,
                "content": content,
                "metadata": metadata,
                "created_at": now_str
            }).execute()
            return True
        except Exception as e:
            print(f"[DB] Supabase save_message failed: {e}. Falling back to SQLite.")
            
    # SQLite fallback
    init_sqlite_db()
    metadata_json = json.dumps(metadata) if metadata else None
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_messages (room_id, sender, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
        (room_id, sender, content, metadata_json, now_str)
    )
    conn.commit()
    conn.close()
    return True

def get_room_title(room_id):
    if supabase_client:
        try:
            res = supabase_client.table("chat_rooms").select("title").eq("id", room_id).execute()
            if res.data:
                return res.data[0]["title"]
        except:
            pass
            
    # SQLite fallback
    init_sqlite_db()
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT title FROM chat_rooms WHERE id = ?", (room_id,))
    row = cursor.fetchone()
    conn.close()
    return row["title"] if row else "Percakapan Baru"
