import os
import numpy as np
import tensorflow as tf
from PIL import Image
from tensorflow.keras.applications.efficientnet import preprocess_input

# Global references (lazy loaded)
model = None
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL9_DIR = os.path.join(base_dir, "Kel_9")

def load_resources():
    global model
    if model is not None:
        return
    model_path = os.path.join(KEL9_DIR, "model_tackle_classifier.h5")
    if os.path.exists(model_path):
        model = tf.keras.models.load_model(model_path, compile=False)
        print(f"[SUCCESS] Loaded Kel_9 model from: {model_path}")
    else:
        raise FileNotFoundError(f"Model Kel_9 not found at: {model_path}")

def predict_tackle_image(image_path):
    load_resources()
    if model is None:
        raise RuntimeError("Model Kel_9 is not loaded.")

    try:
        # Preprocess
        img = Image.open(image_path).convert("RGB")
        img = img.resize((224, 224))
        img = np.array(img, dtype=np.float32)
        img = preprocess_input(img)
        img = np.expand_dims(img, axis=0)

        # Predict
        prediction = model.predict(img, verbose=0)
        score = float(prediction[0][0])

        if score > 0.5:
            label = "Foul Tackle"
            display_label = "Pelanggaran (Foul Tackle)"
            confidence = score * 100
        else:
            label = "Clean Tackle"
            display_label = "Bersih (Clean Tackle)"
            confidence = (1 - score) * 100

        return {
            "success": True,
            "prediction": score,
            "label": label,
            "display_label": display_label,
            "confidence": round(confidence, 2)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
