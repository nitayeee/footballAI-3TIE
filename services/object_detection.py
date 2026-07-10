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
    models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
    model_path = os.path.join(models_dir, "kel7_yolov8.onnx")
    if os.path.exists(model_path):
        model = YOLO(model_path, task="detect")

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
    player_count = 0
    ball_count = 0
    goalkeeper_count = 0
    referee_count = 0
    
    for box in boxes:
        cls_id = int(box.cls[0].item())
        if cls_id not in CLASS_NAMES:
            continue
        xywh = box.xywh[0].tolist()
        label = CLASS_NAMES[cls_id]
        if label == 'player':
            player_count += 1
        elif label == 'ball':
            ball_count += 1
        elif label == 'goalkeeper':
            goalkeeper_count += 1
        elif label == 'referee':
            referee_count += 1
            
        spatial_data.append({
            'class': label,
            'x': round((xywh[0] / w) * 100, 2),
            'y': round((xywh[1] / h) * 100, 2)
        })
        
    return {
        'spatial_points': spatial_data,
        'player_count': player_count,
        'ball_count': ball_count,
        'goalkeeper_count': goalkeeper_count,
        'referee_count': referee_count,
        'total_count': len(spatial_data)
    }

def track_in_video(video_path, output_video_path, conf_threshold=0.4, limit_frames=150):
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
    unique_ball_ids = set()
    unique_keeper_ids = set()
    unique_ref_ids = set()
    
    # Trackers for non-tracked classes, fallback to max per frame
    max_balls = 0
    max_keepers = 0
    max_refs = 0
    max_players = 0
    
    frame_idx = 0
    spatial_data = [] # Store spatial data of the last frame with detections for map rendering
    
    while cap.isOpened() and frame_idx < limit_frames:
        success, frame = cap.read()
        if not success:
            break
            
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
        current_balls = 0
        current_keepers = 0
        current_refs = 0
        
        frame_spatial = []
        
        for box in boxes:
            cls_id = int(box.cls[0].item())
            if cls_id not in CLASS_NAMES:
                continue
            
            label = CLASS_NAMES[cls_id]
            xywh = box.xywh[0].tolist()
            track_id = int(box.id.item()) if box.id is not None else None
            
            frame_spatial.append({
                'class': label,
                'x': round((xywh[0] / width) * 100, 2),
                'y': round((xywh[1] / height) * 100, 2)
            })
            
            if label == 'player':
                current_players += 1
                if track_id is not None:
                    unique_player_ids.add(track_id)
            elif label == 'ball':
                current_balls += 1
                if track_id is not None:
                    unique_ball_ids.add(track_id)
            elif label == 'goalkeeper':
                current_keepers += 1
                if track_id is not None:
                    unique_keeper_ids.add(track_id)
            elif label == 'referee':
                current_refs += 1
                if track_id is not None:
                    unique_ref_ids.add(track_id)
                    
        max_players = max(max_players, current_players)
        max_balls = max(max_balls, current_balls)
        max_keepers = max(max_keepers, current_keepers)
        max_refs = max(max_refs, current_refs)
        
        if frame_spatial:
            spatial_data = frame_spatial
            
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
    
    # Calculate unique tracked counts or fall back to maximums
    final_players = len(unique_player_ids) if len(unique_player_ids) > 0 else max_players
    final_balls = len(unique_ball_ids) if len(unique_ball_ids) > 0 else max_balls
    final_keepers = len(unique_keeper_ids) if len(unique_keeper_ids) > 0 else max_keepers
    final_refs = len(unique_ref_ids) if len(unique_ref_ids) > 0 else max_refs
    
    return {
        'total_unique_players': final_players,
        'player_count': final_players,
        'ball_count': final_balls,
        'goalkeeper_count': final_keepers,
        'referee_count': final_refs,
        'total_count': final_players + final_balls + final_keepers + final_refs,
        'total_frames_processed': frame_idx,
        'spatial_points': spatial_data
    }

