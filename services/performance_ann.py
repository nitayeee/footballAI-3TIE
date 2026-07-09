import os
import joblib
import numpy as np
import tensorflow as tf

# Global references (lazy loaded)
MODELS = {}
SCALERS = {}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL1_BACKEND_DIR = os.path.join(BASE_DIR, "Kel_1", "Backend")

POSITION_FEATURES = {
    "attacker": [
        "potential", "finishing", "positioning", "shot_power", "dribbling",
        "ball_control", "acceleration", "sprint_speed", "agility", "reactions",
        "crossing", "heading_accuracy", "volleys",
    ],
    "midfielder": [
        "potential", "short_passing", "long_passing", "vision", "ball_control",
        "dribbling", "stamina", "reactions", "crossing", "interceptions",
        "standing_tackle", "finishing", "positioning",
    ],
    "defender": [
        "potential", "standing_tackle", "sliding_tackle", "marking", "interceptions",
        "heading_accuracy", "strength", "aggression", "reactions", "jumping",
    ],
    "gk": [
        "potential", "gk_diving", "gk_handling", "gk_kicking", "gk_positioning",
        "gk_reflexes", "reactions",
    ],
}

def load_resources(position):
    global MODELS, SCALERS
    if position in MODELS and position in SCALERS:
        return
        
    model_file = os.path.join(KEL1_BACKEND_DIR, f"model_{position}_ann.h5")
    scaler_file = os.path.join(KEL1_BACKEND_DIR, f"scaler_{position}.pkl")
    
    if os.path.exists(model_file) and os.path.exists(scaler_file):
        try:
            MODELS[position] = tf.keras.models.load_model(model_file, compile=False)
            SCALERS[position] = joblib.load(scaler_file)
            print(f"[Kel_1] Model and scaler loaded successfully for position: {position}")
        except Exception as e:
            print(f"[Kel_1] Error loading resources for {position}: {e}")
            MODELS[position] = None
            SCALERS[position] = None
    else:
        print(f"[Kel_1] Files not found for position {position}. Expected: {model_file}, {scaler_file}")
        MODELS[position] = None
        SCALERS[position] = None

def predict_performance_ann(position, form_data):
    position = position.strip().lower()
    if position not in POSITION_FEATURES:
        return {"error": f"Posisi tidak valid: {position}"}
        
    load_resources(position)
    
    model = MODELS.get(position)
    scaler = SCALERS.get(position)
    
    if model is None or scaler is None:
        return {"error": f"Model/scaler untuk posisi {position} gagal dimuat."}
        
    features = POSITION_FEATURES[position]
    values = []
    try:
        for feat in features:
            val = form_data.get(feat, "")
            if val == "":
                return {"error": f"Atribut '{feat}' harus diisi."}
            values.append(float(val))
    except ValueError as e:
        return {"error": f"Nilai atribut harus berupa angka: {str(e)}"}
        
    input_array = np.array(values, dtype=np.float32).reshape(1, -1)
    scaled = scaler.transform(input_array)
    pred = model.predict(scaled, verbose=0)
    score = float(pred[0][0])
    
    # Generate simple rating description
    rating = round(score, 2)
    if rating >= 85:
        category, desc = "WORLD CLASS", "Pemain elite kelas dunia"
    elif rating >= 78:
        category, desc = "PREMIER PLAYER", "Pemain level liga utama"
    elif rating >= 70:
        category, desc = "CORE PLAYER", "Pemain inti yang konsisten"
    else:
        category, desc = "DEVELOPING PLAYER", "Pemain muda/cadangan potensial"
        
    return {
        "success": True,
        "rating": rating,
        "category": category,
        "desc": desc,
        "position": position.upper(),
        "features": {feat: float(form_data[feat]) for feat in features}
    }
