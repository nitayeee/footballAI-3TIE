import os
import cv2
import numpy as np
from ultralytics import YOLO

CLASS_NAMES = {
    0: 'ball',
    1: 'goalkeeper',
    2: 'player',
    3: 'referee'
}

# Global references (lazy loaded)
model = None
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL7_DIR = os.path.join(base_dir, "Kel_7")

def load_resources():
    global model
    if model is not None:
        return
    model_path = os.path.join(KEL7_DIR, "weights", "best.pt")
    if os.path.exists(model_path):
        model = YOLO(model_path)

def detect_in_image(image_path, output_image_path, conf_threshold=0.4):
    load_resources()
    if model is None:
        raise RuntimeError("YOLO model not loaded.")
        
    frame = cv2.imread(image_path)
    if frame is None:
        return None
        
    h, w, _ = frame.shape
    results = model.predict(frame, conf=conf_threshold, verbose=False)
    boxes = results[0].boxes
    annotated_frame = results[0].plot()
    
    cv2.imwrite(output_image_path, annotated_frame)
    
    spatial_data = []
    total_players = 0
    
    for box in boxes:
        cls_id = int(box.cls[0].item())
        if cls_id not in CLASS_NAMES:
            continue
        xywh = box.xywh[0].tolist()
        label = CLASS_NAMES[cls_id]
        if label == 'player':
            total_players += 1
            
        spatial_data.append({
            'class': label,
            'x': round((xywh[0] / w) * 100, 2),
            'y': round((xywh[1] / h) * 100, 2)
        })
        
    return {
        'spatial_points': spatial_data,
        'total_players': total_players
    }

def track_in_video(video_path, output_video_path, conf_threshold=0.4, limit_frames=300):
    load_resources()
    if model is None:
        raise RuntimeError("YOLO model not loaded.")
        
    cap = cv2.VideoCapture(video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    
    if width == 0 or height == 0:
        cap.release()
        return None
        
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    
    unique_player_ids = set()
    frame_idx = 0
    
    while cap.isOpened() and frame_idx < limit_frames:
        success, frame = cap.read()
        if not success:
            break
            
        # Process every frame or downsample. For smooth video output we process every frame.
        results = model.track(
            frame,
            conf=conf_threshold,
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False
        )
        
        annotated_frame = results[0].plot()
        boxes = results[0].boxes
        
        current_players = 0
        for box in boxes:
            cls_id = int(box.cls[0].item())
            if cls_id not in CLASS_NAMES:
                continue
            
            track_id = int(box.id.item()) if box.id is not None else None
            
            if CLASS_NAMES[cls_id] == 'player':
                current_players += 1
                if track_id is not None:
                    unique_player_ids.add(track_id)
                    
        # Overlay player counts on frame
        cv2.putText(
            annotated_frame,
            f"Active Players: {current_players}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )
        
        out.write(annotated_frame)
        frame_idx += 1
        
    cap.release()
    out.release()
    
    return {
        'total_unique_players': len(unique_player_ids),
        'total_frames_processed': frame_idx
    }
