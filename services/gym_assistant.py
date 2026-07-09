import os
import cv2
import numpy as np
from ultralytics import YOLO

# COCO Keypoint Indices
KEYPOINTS = {
    'nose': 0, 'left_eye': 1, 'right_eye': 2, 'left_ear': 3, 'right_ear': 4,
    'left_shoulder': 5, 'right_shoulder': 6, 'left_elbow': 7, 'right_elbow': 8,
    'left_wrist': 9, 'right_wrist': 10, 'left_hip': 11, 'right_hip': 12,
    'left_knee': 13, 'right_knee': 14, 'left_ankle': 15, 'right_ankle': 16
}

def get_angle(a, b, c):
    """Calculate angle between three points (a-b-c) in degrees"""
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle

def extract_keypoints(results):
    """Extract keypoints from YOLOv8-pose results"""
    keypoints_dict = {}
    if results.keypoints is not None and len(results.keypoints) > 0:
        kpts = results.keypoints.data[0].cpu().numpy()  # shape (17,3)
        for name, idx in KEYPOINTS.items():
            x, y, conf = kpts[idx]
            if conf > 0.3:
                keypoints_dict[name] = (int(x), int(y))
            else:
                keypoints_dict[name] = None
    return keypoints_dict

class RepCounter:
    def __init__(self):
        self.reps = 0
        self.stage = None

    def reset(self):
        self.reps = 0
        self.stage = None

    def update_curl(self, angle):
        if angle > 160:
            self.stage = "down"
        if angle < 60 and self.stage == "down":
            self.stage = "up"
            self.reps += 1
        return self.reps

    def update_press(self, angle):
        if angle < 90:
            self.stage = "down"
        if angle > 160 and self.stage == "down":
            self.stage = "up"
            self.reps += 1
        return self.reps

    def update_squat(self, angle):
        if self.stage is None:
            self.stage = "up"
        if angle < 90 and self.stage == "up":
            self.stage = "down"
        if angle > 160 and self.stage == "down":
            self.stage = "up"
            self.reps += 1
        return self.reps

    def update_hammer_curl(self, angle):
        if self.stage is None:
            self.stage = "down"
        if angle < 60 and self.stage == "down":
            self.stage = "up"
        if angle > 140 and self.stage == "up":
            self.stage = "down"
            self.reps += 1
        return self.reps

    def update_pushup(self, angle):
        if self.stage is None:
            self.stage = "up"
        if angle < 90 and self.stage == "up":
            self.stage = "down"
        if angle > 160 and self.stage == "down":
            self.stage = "up"
            self.reps += 1
        return self.reps

# Global models (lazy loaded)
cls_model = None
pose_model = None

def load_models():
    global cls_model, pose_model
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if cls_model is None:
        cls_path = os.path.join(base_dir, "Kel_3", "ai_gym_classification50.pt")
        cls_model = YOLO(cls_path)
    if pose_model is None:
        pose_path = os.path.join(base_dir, "Kel_3", "yolov8n-pose.pt")
        pose_model = YOLO(pose_path)

def process_gym_video(video_path, output_filename, limit_frames=300):
    """Processes video, saves annotated version, counts reps and returns final metrics"""
    load_models()
    
    cap = cv2.VideoCapture(video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    
    if width == 0 or height == 0:
        cap.release()
        return None
        
    out_dir = os.path.dirname(output_filename)
    os.makedirs(out_dir, exist_ok=True)
    
    # Use MP4V codec which is generally supported on Windows and browsers
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_filename, fourcc, fps, (width, height))
    
    counter = RepCounter()
    current_exercise = "Unknown"
    confidence = 0.0
    feedback = "Ready"
    reps = 0
    angle = 0
    
    frame_idx = 0
    while cap.isOpened() and frame_idx < limit_frames:
        success, frame = cap.read()
        if not success:
            break
            
        # 1. Classification
        cls_results = cls_model(frame, verbose=False)[0]
        class_id = cls_results.probs.top1
        exercise = cls_results.names[class_id]
        confidence = float(cls_results.probs.top1conf)
        current_exercise = exercise
        
        # 2. Pose estimation
        pose_results = pose_model(frame, verbose=False)[0]
        keypoints = extract_keypoints(pose_results)
        
        # Plot YOLO poses on the frame
        annotated_frame = pose_results.plot()
        
        # 3. Calculate metrics based on exercise
        angle = None
        
        if exercise == "barbell biceps curl":
            if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
                angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
                reps = counter.update_curl(angle)
                feedback = "Curl Up" if angle > 70 else "Good"
        elif exercise == "shoulder press":
            if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
                angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
                reps = counter.update_press(angle)
                feedback = "Push Higher" if angle < 150 else "Good"
        elif exercise == "squat":
            if keypoints.get("right_hip") and keypoints.get("right_knee") and keypoints.get("right_ankle"):
                angle = get_angle(keypoints["right_hip"], keypoints["right_knee"], keypoints["right_ankle"])
                reps = counter.update_squat(angle)
                feedback = "Down" if angle < 90 else "Stand Up"
        elif exercise == "hammer curl":
            if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
                angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
                reps = counter.update_hammer_curl(angle)
                feedback = "Curl Up" if angle > 70 else "Good"
        elif exercise == "push-up":
            if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
                angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
                reps = counter.update_pushup(angle)
                feedback = "Go Down" if angle < 90 else "Push Up"
                
        # Draw customized text HUD overlays on the frame
        hud_color = (0, 255, 0) # Green
        cv2.rectangle(annotated_frame, (10, 10), (320, 180), (0, 0, 0), -1) # Semi-transparent backdrop overlay
        cv2.putText(annotated_frame, f"Exercise: {exercise.upper()}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
        cv2.putText(annotated_frame, f"Confidence: {confidence*100:.1f}%", (20, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
        cv2.putText(annotated_frame, f"Reps: {reps}", (20, 100),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
        cv2.putText(annotated_frame, f"Feedback: {feedback}", (20, 130),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
        if angle is not None:
            cv2.putText(annotated_frame, f"Angle: {int(angle)} deg", (20, 160),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
                        
        out.write(annotated_frame)
        frame_idx += 1
        
    cap.release()
    out.release()
    
    return {
        "exercise": current_exercise,
        "confidence": round(confidence * 100, 2),
        "reps": reps,
        "feedback": feedback,
        "total_frames_processed": frame_idx
    }

# Webcam streaming state
webcam_counter = RepCounter()
webcam_status = {
    "exercise": "Unknown",
    "confidence": 0.0,
    "reps": 0,
    "feedback": "Ready",
    "angle": 0.0
}

def process_single_frame(frame):
    global webcam_status
    load_models()
    
    # 1. Classification
    cls_results = cls_model(frame, verbose=False)[0]
    class_id = cls_results.probs.top1
    exercise = cls_results.names[class_id]
    confidence = float(cls_results.probs.top1conf)
    
    # 2. Pose estimation
    pose_results = pose_model(frame, verbose=False)[0]
    keypoints = extract_keypoints(pose_results)
    
    # Plot YOLO poses on the frame
    annotated_frame = pose_results.plot()
    
    # 3. Calculate metrics based on exercise
    angle = None
    feedback = "Ready"
    reps = webcam_counter.reps
    
    if exercise == "barbell biceps curl":
        if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
            angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
            reps = webcam_counter.update_curl(angle)
            feedback = "Curl Up" if angle > 70 else "Good"
    elif exercise == "shoulder press":
        if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
            angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
            reps = webcam_counter.update_press(angle)
            feedback = "Push Higher" if angle < 150 else "Good"
    elif exercise == "squat":
        if keypoints.get("right_hip") and keypoints.get("right_knee") and keypoints.get("right_ankle"):
            angle = get_angle(keypoints["right_hip"], keypoints["right_knee"], keypoints["right_ankle"])
            reps = webcam_counter.update_squat(angle)
            feedback = "Down" if angle < 90 else "Stand Up"
    elif exercise == "hammer curl":
        if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
            angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
            reps = webcam_counter.update_hammer_curl(angle)
            feedback = "Curl Up" if angle > 70 else "Good"
    elif exercise == "push-up":
        if keypoints.get("right_shoulder") and keypoints.get("right_elbow") and keypoints.get("right_wrist"):
            angle = get_angle(keypoints["right_shoulder"], keypoints["right_elbow"], keypoints["right_wrist"])
            reps = webcam_counter.update_pushup(angle)
            feedback = "Go Down" if angle < 90 else "Push Up"
            
    # Update global status
    webcam_status = {
        "exercise": exercise,
        "confidence": round(confidence * 100, 2),
        "reps": reps,
        "feedback": feedback,
        "angle": round(angle, 1) if angle is not None else 0.0
    }
    
    # Draw customized text HUD overlays on the frame
    hud_color = (0, 255, 0) # Green
    cv2.rectangle(annotated_frame, (10, 10), (320, 180), (0, 0, 0), -1) # Semi-transparent backdrop overlay
    cv2.putText(annotated_frame, f"Exercise: {exercise.upper()}", (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
    cv2.putText(annotated_frame, f"Confidence: {confidence*100:.1f}%", (20, 70),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
    cv2.putText(annotated_frame, f"Reps: {reps}", (20, 100),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
    cv2.putText(annotated_frame, f"Feedback: {feedback}", (20, 130),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
    if angle is not None:
        cv2.putText(annotated_frame, f"Angle: {int(angle)} deg", (20, 160),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, hud_color, 2)
                    
    return annotated_frame

def generate_gym_webcam_frames():
    cap = cv2.VideoCapture(0)
    try:
        while True:
            success, frame = cap.read()
            if not success:
                break
            annotated = process_single_frame(frame)
            ret, buffer = cv2.imencode('.jpg', annotated)
            if ret:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    finally:
        cap.release()

def reset_gym_webcam_counter():
    webcam_counter.reset()
