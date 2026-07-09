import os
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

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
    model_path = os.path.join(KEL11_DIR, 'Model', 'mobilenetv2_soccer_event.keras')
    if os.path.exists(model_path):
        model = tf.keras.models.load_model(model_path)
    else:
        raise FileNotFoundError(f"Model file not found: {model_path}")

def preprocess_image(img):
    img = img.resize((224, 224))
    img_array = np.array(img)
    img_array = img_array.astype('float32')
    img_array = np.expand_dims(img_array, axis=0)
    img_array = preprocess_input(img_array)
    return img_array

def classify_soccer_event(image_path):
    load_resources()
    if model is None:
        raise RuntimeError("Model not loaded.")
        
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = preprocess_image(img)
        
        predictions = model.predict(img_array, verbose=0)
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
