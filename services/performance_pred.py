import os
import sqlite3
import pickle
import json
import numpy as np
import pandas as pd
import tensorflow as tf

AVAILABLE_FEATURES = [
    'potential', 'crossing', 'finishing', 'heading_accuracy',
    'short_passing', 'volleys', 'dribbling', 'curve',
    'long_passing', 'ball_control', 'acceleration', 'sprint_speed',
    'agility', 'reactions', 'balance', 'shot_power', 'jumping',
    'stamina', 'strength', 'long_shots', 'aggression',
    'positioning', 'vision', 'penalties', 'marking',
    'standing_tackle', 'sliding_tackle'
]

SEQ_LEN = 5

# Global references (lazy loaded)
model = None
scaler_X = None
scaler_y = None
metadata = None
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL5_DIR = os.path.join(base_dir, "Kel_5")

def load_resources():
    global model, scaler_X, scaler_y, metadata
    if model is not None:
        return
        
    metadata_path = os.path.join(KEL5_DIR, "model_metadata.json")
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
    else:
        metadata = {
            "metrics": {
                "MAE": 1.1458,
                "RMSE": 1.5515,
                "R2": 0.827
            }
        }
        
    scaler_x_path = os.path.join(KEL5_DIR, "scaler_X.pkl")
    if os.path.exists(scaler_x_path):
        with open(scaler_x_path, 'rb') as f:
            scaler_X = pickle.load(f)
            
    scaler_y_path = os.path.join(KEL5_DIR, "scaler_y.pkl")
    if os.path.exists(scaler_y_path):
        with open(scaler_y_path, 'rb') as f:
            scaler_y = pickle.load(f)
            
    model_path = os.path.join(KEL5_DIR, "model_lstm_soccer.h5")
    if os.path.exists(model_path):
        # compile=False to bypass Keras 3 custom loss/metric deserialization errors
        model = tf.keras.models.load_model(model_path, compile=False)

def get_db_connection():
    db_path = os.path.join(KEL5_DIR, "database.sqlite")
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def search_players(query):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT player_api_id, player_name
        FROM Player
        WHERE player_name LIKE ?
        LIMIT 10
    """, (f"%{query}%",))
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r["player_api_id"], "name": r["player_name"]} for r in rows]

def generate_strategic_insight(data, rating, label):
    label_key = str(label).strip().lower()
    
    attack_score = np.mean([data.get('finishing', 50), data.get('shot_power', 50), data.get('positioning', 50), data.get('volleys', 50)])
    speed_skill = np.mean([data.get('acceleration', 50), data.get('sprint_speed', 50), data.get('dribbling', 50), data.get('ball_control', 50)])
    midfield_score = np.mean([data.get('short_passing', 50), data.get('long_passing', 50), data.get('vision', 50)])
    defense_score = np.mean([data.get('marking', 50), data.get('standing_tackle', 50), data.get('sliding_tackle', 50)])
    
    positions = {
        'Penyerang Utama / Striker': attack_score,
        'Pemain Sayap / Winger': speed_skill,
        'Gelandang / Midfielder': midfield_score,
        'Pemain Bertahan / Defender': defense_score
    }
    best_position = max(positions, key=positions.get)
    
    if label_key in {'world class', 'premier player', 'excellent'}:
        potential = "Sangat Tinggi. Berada di performa puncak karier global."
        training = "Fokus pada perawatan fisik makro, pencegahan cedera, dan simulasi taktik tingkat tinggi."
        decision = "Starter Utama Mutlak. Struktur permainan tim wajib dibangun di sekitar peran pemain ini."
    elif label_key in {'core player', 'good'}:
        potential = "Cukup Berpotensi. Stabil untuk kompetisi level tertinggi."
        training = "Peningkatan spesifikasi atribut utama penunjang posisi inti (misal: akurasi crossing atau intercept)."
        decision = "Opsi Rotasi Skuad Utama. Sangat ideal sebagai opsi rotasi krusial jadwal padat atau sebagai 'Super Sub'."
    elif label_key in {'developing player', 'average'}:
        potential = "Moderat. Prospek perkembangan bergantung pada peningkatan jam terbang bermain."
        training = "Memerlukan porsi latihan fisik dasar (stamina & kekuatan) serta pendalaman transisi bertahan-menyerang."
        decision = "Pemain Pelapis / Tim Cadangan. Disarankan masuk list peminjaman ke klub lain untuk menambah menit bermain."
    else:
        potential = "Rendah. Sulit bersaing di skuad utama tim dalam kondisi taktis saat ini."
        training = "Wajib mendapatkan pelatihan fundamental total (basic technical drills) dari tingkat dasar."
        decision = "Evaluasi Kinerja / Ditransfer. Direkomendasikan untuk diturunkan ke tim akademi atau dilepas pada bursa transfer."
        
    return {
        'best_position': best_position,
        'potential': potential,
        'training_needs': training,
        'strategic_decision': decision
    }

def predict_manual(data):
    load_resources()
    features_list = []
    for col in AVAILABLE_FEATURES:
        val = data.get(col, 50)
        features_list.append(float(val))
        
    if model is not None and scaler_X and scaler_y:
        try:
            raw_input = np.array(features_list).reshape(1, -1)
            scaled_input = scaler_X.transform(raw_input)
            lstm_input = np.repeat(scaled_input[:, np.newaxis, :], SEQ_LEN, axis=1)
            pred_scaled = model.predict(lstm_input, verbose=0)
            pred_real = scaler_y.inverse_transform(pred_scaled).flatten()
            rating = float(pred_real[0])
        except Exception as e:
            print(f"Error predicting manual: {e}")
            rating = np.mean(features_list)
    else:
        # Fallback calculation
        potential = float(data.get('potential', 50))
        reactions = float(data.get('reactions', 50))
        ball_control = float(data.get('ball_control', 50))
        avg_all = sum(features_list) / len(features_list)
        rating = (potential * 0.4) + (reactions * 0.2) + (ball_control * 0.1) + (avg_all * 0.3)
        
    rating = max(30, min(99, round(rating)))
    
    if rating >= 85:
        category, desc = "WORLD CLASS", "Pemain elite kelas dunia"
    elif rating >= 78:
        category, desc = "PREMIER PLAYER", "Pemain level liga utama"
    elif rating >= 70:
        category, desc = "CORE PLAYER", "Pemain inti yang konsisten"
    else:
        category, desc = "DEVELOPING PLAYER", "Pemain muda/cadangan potensial"
        
    insights = generate_strategic_insight(data, rating, category)
    
    return {
        'rating': rating,
        'category': category,
        'desc': desc,
        'insights': insights
    }

def predict_player_career(player_id, years_ahead=5):
    load_resources()
    conn = get_db_connection()
    query = f"""
        SELECT date, {', '.join(AVAILABLE_FEATURES)}, overall_rating
        FROM Player_Attributes
        WHERE player_api_id = ? 
        ORDER BY date ASC
    """
    df_p = pd.read_sql(query, conn, params=(player_id,))
    conn.close()
    
    if df_p.empty:
        return {'error': 'Data pemain kosong'}
        
    df_p.dropna(subset=AVAILABLE_FEATURES + ['overall_rating'], inplace=True)
    if df_p.empty:
         return {'error': 'Atribut pemain memiliki nilai kosong (null)'}
         
    df_p['date'] = pd.to_datetime(df_p['date'])
    df_p['year'] = df_p['date'].dt.year
    
    hist_year = df_p.groupby('year')['overall_rating'].mean().reset_index()
    actual_years = [int(y) for y in hist_year['year'].tolist()]
    actual_ratings = [round(float(r), 1) for r in hist_year['overall_rating'].tolist()]
    
    latest_row = df_p.iloc[-1].to_dict()
    latest_attributes = {feat: int(latest_row[feat]) for feat in AVAILABLE_FEATURES}
    
    pred_years = []
    pred_ratings = []
    
    if model is not None and scaler_X and scaler_y:
        try:
            player_X = scaler_X.transform(df_p[AVAILABLE_FEATURES])
            player_y = scaler_y.transform(df_p[['overall_rating']]).flatten()
            
            if len(player_X) < SEQ_LEN:
                pad_size = SEQ_LEN - len(player_X)
                pad_X = np.repeat(player_X[0:1], pad_size, axis=0)
                pad_y = np.repeat(player_y[0:1], pad_size, axis=0)
                player_X = np.concatenate([pad_X, player_X], axis=0)
                player_y = np.concatenate([pad_y, player_y], axis=0)
                
            seed_X = player_X[-SEQ_LEN:]
            seed_y = player_y[-SEQ_LEN:]
            
            current_X = seed_X.copy()
            pred_ratings_scaled = []
            
            for _ in range(years_ahead):
                inp = current_X.reshape(1, SEQ_LEN, len(AVAILABLE_FEATURES))
                y_next_sc = model.predict(inp, verbose=0)[0, 0]
                pred_ratings_scaled.append(y_next_sc)
                
                # Slide sequence step
                current_X = np.roll(current_X, -1, axis=0)
                current_X[-1] = current_X[-2]
                
            pred_ratings_raw = scaler_y.inverse_transform(np.array(pred_ratings_scaled).reshape(-1, 1)).flatten()
            pred_ratings = [round(float(r), 1) for r in pred_ratings_raw]
            
        except Exception as e:
            print(f"Error autoregressive forecasting: {e}")
            last_rating = actual_ratings[-1]
            pred_ratings = [round(last_rating + (i+1)*0.5, 1) for i in range(years_ahead)]
    else:
        last_rating = actual_ratings[-1]
        potential = latest_attributes['potential']
        for i in range(1, years_ahead + 1):
            if last_rating < potential:
                step_rating = last_rating + (potential - last_rating) * 0.15
            else:
                step_rating = last_rating - 0.5
            pred_ratings.append(round(step_rating, 1))
            last_rating = step_rating
            
    last_year = actual_years[-1]
    pred_years = [int(last_year + i + 1) for i in range(years_ahead)]
    
    # Generate insights based on the latest predictions
    latest_predicted_rating = pred_ratings[-1]
    if latest_predicted_rating >= 85:
        category = "WORLD CLASS"
    elif latest_predicted_rating >= 78:
        category = "PREMIER PLAYER"
    elif latest_predicted_rating >= 70:
        category = "CORE PLAYER"
    else:
        category = "DEVELOPING PLAYER"
        
    insights = generate_strategic_insight(latest_attributes, latest_predicted_rating, category)
    
    return {
        'latest_attributes': latest_attributes,
        'actual_years': actual_years,
        'actual_ratings': actual_ratings,
        'pred_years': pred_years,
        'pred_ratings': pred_ratings,
        'category': category,
        'insights': insights
    }
