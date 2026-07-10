import os
import joblib
import numpy as np
import onnxruntime as ort
from datetime import datetime

# Global references (lazy loaded)
model = None
scaler = None
# Try parent directory first (local PC), then current repository folder (VPS fallback)
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL6_DIR = os.path.join(base_dir, "Kel_6")
if not os.path.exists(KEL6_DIR) or not os.path.exists(os.path.join(KEL6_DIR, "scaler.pkl")):
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    KEL6_DIR = os.path.join(repo_dir, "Kel_6")

def load_resources():
    global model, scaler
    if model is not None:
        return
    models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
    model_path = os.path.join(models_dir, "best_sport_injury_revisi_model.onnx")
    scaler_path = os.path.join(KEL6_DIR, "scaler.pkl")
    if os.path.exists(model_path):
        model = ort.InferenceSession(model_path)
    if os.path.exists(scaler_path):
        scaler = joblib.load(scaler_path)

def predict_injury_risk(data):
    """
    data dict contains:
      Age, Gender, Height_cm, Weight_kg, BMI, Training_Frequency, 
      Training_Duration, Warmup_Time, Sleep_Hours, Flexibility_Score,
      Recovery_Time, Injury_History, Stress_Level, Training_Intensity
    """
    load_resources()
    if model is None or scaler is None:
        raise RuntimeError("Model or scaler not loaded.")
        
    fields = [
        'Age', 'Gender', 'Height_cm', 'Weight_kg', 'BMI',
        'Training_Frequency', 'Training_Duration', 'Warmup_Time',
        'Sleep_Hours', 'Flexibility_Score',
        'Recovery_Time', 'Injury_History', 'Stress_Level',
        'Training_Intensity'
    ]
    
    values = [float(data.get(field, 0)) for field in fields]
    input_data = np.array([values])
    
    scaled_data = scaler.transform(input_data)
    input_name = model.get_inputs()[0].name
    prediction = model.run(None, {input_name: scaled_data.astype(np.float32)})[0]
    
    probability = float(prediction[0][0])
    prob_percent = probability * 100
    
    if probability >= 0.5:
        risk_status = 'Risiko Cedera Tinggi'
        recommendation = (
            'Metrik atlet menunjukkan indikasi risiko cedera yang tinggi. '
            'Turunkan intensitas latihan, tambah durasi recovery dan pemanasan, '
            'serta jadwalkan observasi biomekanik dengan fisioterapis.'
        )
    else:
        risk_status = 'Risiko Cedera Rendah'
        recommendation = (
            'Parameter latihan atlet berada dalam zona risiko cedera yang rendah. '
            'Pertahankan konsistensi pola istirahat, intensitas latihan yang terukur, '
            'dan rutinitas pemanasan untuk menjaga performa.'
        )
        
    return {
        'risk_status': risk_status,
        'prob_percent': round(prob_percent, 2),
        'recommendation': recommendation,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
