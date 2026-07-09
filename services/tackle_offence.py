import os
import json
import base64
import numpy as np
import cv2
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# Global references (lazy loaded)
model = None
base_model = None
threshold = 0.5
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL8_DIR = os.path.join(base_dir, "Kel_8")

def load_resources():
    global model, base_model, threshold
    if model is not None:
        return
        
    config_path = os.path.join(KEL8_DIR, "model_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                threshold = float(json.load(f)["threshold"])
        except Exception as e:
            print(f"Warning: could not load threshold: {e}")
            threshold = 0.5
            
    keras_path = os.path.join(KEL8_DIR, "model_offence.keras")
    h5_path = os.path.join(KEL8_DIR, "model_offence.h5")
    
    loaded = False
    for path, kwargs in [
        (keras_path, {"safe_mode": False}),
        (h5_path, {"compile": False}),
    ]:
        if os.path.exists(path):
            try:
                # Use compile=False to handle potential version discrepancies
                model = tf.keras.models.load_model(path, **kwargs)
                print(f"[SUCCESS] Loaded Kel_8 model from: {path}")
                loaded = True
                break
            except Exception as e:
                print(f"[ERROR] Failed loading {path}: {e}")
                
    if not loaded:
        raise RuntimeError("Failed to load Kel_8 model files.")
        
    base_model = tf.keras.applications.MobileNetV2(
        include_top=False,
        weights="imagenet",
        pooling="avg"
    )
    base_model.trainable = False

def extract_frames(video_path, n_frames=16):
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total == 0:
        cap.release()
        return np.zeros((n_frames, 224, 224, 3), np.float32)
    segments = np.linspace(0, total, n_frames + 1, dtype=int)
    frames = []
    for i in range(n_frames):
        start, end = segments[i], segments[i + 1]
        frame_idx = np.random.randint(start, max(start + 1, end))
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            frames.append(np.zeros((224, 224, 3), np.float32))
            continue
        frame = cv2.resize(frame, (224, 224))
        frames.append(frame.astype(np.float32))
    cap.release()
    return np.array(frames, np.float32)

def encode_frame_to_base64(frame):
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

def get_clip_frames(video_path, n_frames=16):
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total == 0:
        cap.release()
        return [np.zeros((224, 224, 3), dtype=np.uint8) for _ in range(n_frames)]
    segments = np.linspace(0, total, n_frames + 1, dtype=int)
    frames = []
    for i in range(n_frames):
        start, end = segments[i], segments[i + 1]
        frame_idx = np.random.randint(start, max(start + 1, end))
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            frame = np.zeros((224, 224, 3), dtype=np.uint8)
        else:
            frame = cv2.resize(frame, (224, 224))
        frames.append(frame)
    cap.release()
    return frames

def compute_motion(frames):
    flows = []
    prev = cv2.cvtColor(frames[0].astype(np.uint8), cv2.COLOR_BGR2GRAY)
    for i in range(1, len(frames)):
        curr = cv2.cvtColor(frames[i].astype(np.uint8), cv2.COLOR_BGR2GRAY)
        flow = cv2.calcOpticalFlowFarneback(prev, curr, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        flows.append(np.mean(flow))
        prev = curr
    flows = np.array(flows + [0.0])  # pad last frame
    return flows.reshape(-1, 1)

def extract_features(frames):
    processed = preprocess_input(frames.astype(np.float32))
    return base_model.predict(processed, verbose=0)

def format_result(raw_score, limit_threshold):
    label = "Offense" if raw_score >= limit_threshold else "No Offense"
    confidence = float(raw_score) * 100 if raw_score >= limit_threshold else (1 - float(raw_score)) * 100
    return {
        "success": True,
        "prediction": float(raw_score),
        "threshold": float(limit_threshold),
        "label": label,
        "confidence": round(confidence, 2),
        "display_label": label,
    }

def predict_tackle_offence(video_paths):
    """
    video_paths: dict of {'clip_0': path, 'clip_1': path, 'clip_2': path}
    Requires at least one valid path.
    """
    load_resources()
    if model is None:
        raise RuntimeError("Tackle offence model not loaded.")
        
    try:
        clip_features = [
            np.zeros((16, 1281), np.float32),  # clip_0
            np.zeros((16, 1281), np.float32),  # clip_1
            np.zeros((16, 1281), np.float32)   # clip_2
        ]
        
        all_frames_uint8 = []
        
        for clip_idx in range(3):
            clip_key = f"clip_{clip_idx}"
            video_path = video_paths.get(clip_key)
            
            if video_path:
                try:
                    rng_state = np.random.get_state()
                    frames_float = extract_frames(video_path, n_frames=16)
                    np.random.set_state(rng_state)
                    frames_uint8 = get_clip_frames(video_path, n_frames=16)
                    
                    frame_feat = extract_features(frames_float)
                    motion_feat = compute_motion(frames_float)
                    clip_features[clip_idx] = np.concatenate([frame_feat, motion_feat], axis=1)
                    
                    all_frames_uint8.extend(frames_uint8)
                except Exception as e:
                    print(f"Warning: could not process {clip_key}: {e}")
                    all_frames_uint8.extend([np.zeros((224, 224, 3), dtype=np.uint8) for _ in range(16)])
            else:
                all_frames_uint8.extend([np.zeros((224, 224, 3), dtype=np.uint8) for _ in range(16)])
                
        # Stack inputs to expected shape: (batch, n_clips, n_frames, feat_dim)
        input_data = np.expand_dims(np.stack(clip_features, axis=0), axis=0)
        
        raw_score = float(model.predict(input_data, verbose=0)[0][0])
        result = format_result(raw_score, threshold)
        
        # Base64-encode frames to send back to client for rendering highlights
        frames_b64 = []
        for frm in all_frames_uint8:
            # Only encode non-black frames to save payload size
            if np.max(frm) > 0.0:
                frames_b64.append(encode_frame_to_base64(frm))
        if frames_b64:
            # Return up to 16 select keyframes (e.g. 1 per clip segments)
            result["frames"] = frames_b64[:16] # keep payload small
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}
