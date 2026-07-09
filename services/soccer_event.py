import os
import numpy as np
from PIL import Image
import onnxruntime as ort

SOCCER_EVENTS = [
    "Corner_Kick",
    "Free_Kick",
    "Penalty_kick",
    "Red_Card",
    "Yellow_Card",
    "substitute",
    "tackle"
]

# Global references (lazy loaded)
model = None
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL11_DIR = os.path.join(base_dir, "Kel_11")

def load_resources():
    global model
    if model is not None:
        return
    models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
    model_path = os.path.join(models_dir, 'mobilenetv2_soccer_event.onnx')
    if os.path.exists(model_path):
        model = ort.InferenceSession(model_path)
    else:
        raise FileNotFoundError(f"Model file not found: {model_path}")

def preprocess_image(img):
    img = img.resize((224, 224))
    img_array = np.array(img, dtype='float32')
    # MobileNetV2 scaling to [-1, 1]
    img_array = (img_array / 127.5) - 1.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

def classify_soccer_event(image_path):
    load_resources()
    if model is None:
        raise RuntimeError("Model not loaded.")
        
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = preprocess_image(img)
        
        input_name = model.get_inputs()[0].name
        predictions = model.run(None, {input_name: img_array})[0]
        predicted_class = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class]) * 100
        event_name = SOCCER_EVENTS[predicted_class]
        
        all_predictions = {
            SOCCER_EVENTS[i]: round(float(predictions[0][i]) * 100, 2)
            for i in range(len(SOCCER_EVENTS))
        }
        
        return {
            'success': True,
            'event': event_name,
            'confidence': round(confidence, 2),
            'all_predictions': all_predictions
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
