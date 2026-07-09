import os
import joblib
import numpy as np
import onnxruntime as ort

# Global references (lazy loaded)
model = None
scaler = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL4_DIR = os.path.join(BASE_DIR, "Kel_4")
MODELS_DIR = os.path.join(BASE_DIR, "sistem_besar_dl", "models")

def load_resources():
    global model, scaler
    if model is not None:
        return
        
    model_file = os.path.join(MODELS_DIR, "kel4_injury.onnx")
    scaler_file = os.path.join(KEL4_DIR, "scaler.pkl")
    
    if os.path.exists(model_file) and os.path.exists(scaler_file):
        try:
            model = ort.InferenceSession(model_file)
            scaler = joblib.load(scaler_file)
            print("[Kel_4] ONNX Model and scaler loaded successfully.")
        except Exception as e:
            print(f"[Kel_4] Error loading resources: {e}")
            model = None
            scaler = None
    else:
        print(f"[Kel_4] Files not found. Expected: {model_file}, {scaler_file}")
        model = None
        scaler = None

def predict_injury_cnn(data):
    load_resources()
    
    if model is None or scaler is None:
        return {"error": "Model atau scaler Kel_4 tidak dapat dimuat."}
        
    # Gender conversion
    gender = data.get("Gender", "Male")
    if gender == "Male" or gender == "1" or gender == 1:
        gender_val = 1
    else:
        gender_val = 0
        
    fields = [
        "Age", "Gender", "Height_cm", "Weight_kg", "BMI",
        "Training_Frequency", "Training_Duration", "Warmup_Time",
        "Sleep_Hours", "Flexibility_Score", "Muscle_Asymmetry",
        "Recovery_Time", "Injury_History", "Stress_Level",
        "Training_Intensity"
    ]
    
    try:
        input_data = [
            float(data.get("Age", 0)),
            float(gender_val),
            float(data.get("Height_cm", 0)),
            float(data.get("Weight_kg", 0)),
            float(data.get("BMI", 0)),
            float(data.get("Training_Frequency", 0)),
            float(data.get("Training_Duration", 0)),
            float(data.get("Warmup_Time", 0)),
            float(data.get("Sleep_Hours", 0)),
            float(data.get("Flexibility_Score", 0)),
            float(data.get("Muscle_Asymmetry", 0)),
            float(data.get("Recovery_Time", 0)),
            float(data.get("Injury_History", 0)),
            float(data.get("Stress_Level", 0)),
            float(data.get("Training_Intensity", 0))
        ]
    except ValueError as e:
        return {"error": f"Nilai input tidak valid: {str(e)}"}
        
    features_arr = np.array([input_data])
    scaled = scaler.transform(features_arr)
    # Reshape for LSTM model (same shape check as in kel4.py)
    lstm_input = scaled.reshape(1, scaled.shape[1], 1)
    
    # Run prediction using ONNX runtime
    input_name = model.get_inputs()[0].name
    prediction = model.run(None, {input_name: lstm_input.astype(np.float32)})[0]
    result = np.argmax(prediction, axis=1)[0]
    
    output = "Risiko Cedera Rendah" if result == 0 else "Risiko Cedera Tinggi"
    
    return {
        "success": True,
        "prediction_text": output,
        "is_high_risk": int(result) == 1,
        "input_data": data
    }
