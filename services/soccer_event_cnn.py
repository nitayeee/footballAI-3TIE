import os
import pickle
import numpy as np
from PIL import Image

# Global references (lazy loaded)
model = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL10_DIR = os.path.join(BASE_DIR, "Kel_10")
MODEL_PATH = os.path.join(KEL10_DIR, "best_model_final.pkl")
IMG_SIZE = (128, 128)

CLASS_NAMES = [
    "Corner_Kick",
    "Free_Kick",
    "Penalty_kick",
    "Red_Card",
    "Yellow_Card",
    "substitute",
    "tackle"
]

def load_resources():
    global model
    if model is not None:
        return
        
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                model = pickle.load(f)
            print("[Kel_10] Pickle model loaded successfully.")
        except Exception as e:
            print(f"[Kel_10] Error loading model: {e}")
            model = None
    else:
        print(f"[Kel_10] Model file not found at: {MODEL_PATH}")
        model = None

def preprocess_image(img_path):
    img = Image.open(img_path).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.array(img).astype("float32") / 255.0
    return np.expand_dims(arr, axis=0)

def classify_event_cnn(image_path):
    load_resources()
    
    if model is None:
        return {"error": "Model Kel_10 gagal dimuat."}
        
    try:
        img_array = preprocess_image(image_path)
        pred = model.predict(img_array)
        pred = np.array(pred)
        
        if len(pred.shape) == 2:
            pred = pred[0]
            
        pred = pred.astype(float)
        pred_idx = np.argmax(pred)
        pred_class = CLASS_NAMES[pred_idx]
        pred_prob = round(float(pred[pred_idx]) * 100, 2)
        
        all_probs = []
        for i in range(len(CLASS_NAMES)):
            all_probs.append({
                "class": CLASS_NAMES[i],
                "prob": round(float(pred[i]) * 100, 2)
            })
            
        # Sort desc by probability
        all_probs.sort(key=lambda x: x["prob"], reverse=True)
        top3_events = all_probs[:3]
        
        return {
            "success": True,
            "event": pred_class,
            "confidence": pred_prob,
            "all_predictions": {item["class"]: item["prob"] for item in all_probs},
            "top3_events": top3_events
        }
    except Exception as e:
        return {"error": f"Kesalahan saat memproses gambar: {str(e)}"}
