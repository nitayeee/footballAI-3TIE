import os
import numpy as np
import onnxruntime as ort
from PIL import Image

# Global references (lazy loaded)
model = None
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL9_DIR = os.path.join(base_dir, "Kel_9")

def load_resources():
    global model
    if model is not None:
        return
    models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
    model_path = os.path.join(models_dir, "model_tackle_classifier.onnx")
    if os.path.exists(model_path):
        model = ort.InferenceSession(model_path)
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
        # EfficientNet preprocess is a pass-through in Keras (values 0-255)
        img = np.expand_dims(img, axis=0)

        # Predict
        input_name = model.get_inputs()[0].name
        prediction = model.run(None, {input_name: img})[0]
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
