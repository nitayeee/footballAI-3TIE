import os
import uuid
import time
from flask import Flask, render_template, request, jsonify, session
from werkzeug.utils import secure_filename

# Import services
from services.gym_assistant import process_gym_video
from services.performance_pred import search_players, predict_manual, predict_player_career
from services.injury_risk import predict_injury_risk
from services.object_detection import detect_in_image, track_in_video
from services.tackle_offence import predict_tackle_offence
from services.soccer_event import classify_soccer_event
from services.epl_predict import get_teams, predict_epl_match

app = Flask(__name__)
app.secret_key = "sistem_besar_deep_learning_secret_key"

# Configure Upload folders inside static/uploads
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024 # 32MB max upload limit

# Helper function to save uploaded file with a unique name
def save_file(uploaded_file, category=""):
    if not uploaded_file or uploaded_file.filename == '':
        return None
    ext = os.path.splitext(uploaded_file.filename)[1].lower()
    unique_name = f"{category}_{uuid.uuid4().hex}{ext}"
    path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
    uploaded_file.save(path)
    return path

# -------------------------------------------------------------
# PAGE ROUTING
# -------------------------------------------------------------
@app.route('/')
def landing_page():
    return render_template('landing.html')

@app.route('/chat')
def chat_page():
    return render_template('chat.html')

# -------------------------------------------------------------
# API: Group 5 - Player Search (Autocomplete)
# -------------------------------------------------------------
@app.route('/api/search_players', methods=['GET'])
def api_search_players():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
    try:
        results = search_players(query)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------
# API: Group 3 - Gym Assistant
# -------------------------------------------------------------
@app.route('/api/predict/gym_assistant', methods=['POST'])
def api_gym_assistant():
    if 'video' not in request.files:
        return jsonify({"error": "No video file uploaded"}), 400
        
    file = request.files['video']
    input_path = save_file(file, "gym_in")
    if not input_path:
        return jsonify({"error": "Failed to save file"}), 400
        
    output_filename = f"gym_out_{uuid.uuid4().hex}.mp4"
    output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
    
    try:
        # Limit processing to 150 frames (~5-10s) for faster chat response
        metrics = process_gym_video(input_path, output_path, limit_frames=150)
        
        # Delete original input to save space
        if os.path.exists(input_path):
            try:
                os.unlink(input_path)
            except PermissionError:
                pass
                
        if not metrics:
            return jsonify({"error": "Failed to process video"}), 500
            
        metrics["processed_video_url"] = f"/static/uploads/{output_filename}"
        return jsonify(metrics)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/gym/video_feed')
def gym_video_feed():
    from flask import Response
    from services.gym_assistant import generate_gym_webcam_frames
    return Response(generate_gym_webcam_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/gym/status')
def gym_status():
    from services.gym_assistant import webcam_status
    return jsonify(webcam_status)

@app.route('/api/gym/reset', methods=['POST'])
def gym_reset():
    from services.gym_assistant import reset_gym_webcam_counter
    reset_gym_webcam_counter()
    return jsonify(success=True)

# -------------------------------------------------------------
# API: Group 5 - Soccer Performance Prediction
# -------------------------------------------------------------
@app.route('/api/predict/performance_manual', methods=['POST'])
def api_performance_manual():
    data = request.json or {}
    try:
        result = predict_manual(data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict/performance_player/<int:player_id>', methods=['GET'])
def api_performance_player(player_id):
    years_ahead = request.args.get('years', 5, type=int)
    try:
        result = predict_player_career(player_id, years_ahead)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------
# API: Group 6 - Sport Injury Risk
# -------------------------------------------------------------
@app.route('/api/predict/injury_risk', methods=['POST'])
def api_injury_risk():
    data = request.json or {}
    try:
        result = predict_injury_risk(data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------
# API: Group 7 - Object Detection
# -------------------------------------------------------------
@app.route('/api/predict/object_detection', methods=['POST'])
def api_object_detection():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    filename = file.filename.lower()
    conf_threshold = float(request.form.get('confidence', 0.4))
    
    image_exts = ('.jpg', '.jpeg', '.png', '.webp', '.bmp')
    video_exts = ('.mp4', '.avi', '.mov', '.mkv')
    
    if filename.endswith(image_exts):
        input_path = save_file(file, "obj_in")
        output_filename = f"obj_out_{uuid.uuid4().hex}.jpg"
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        try:
            result = detect_in_image(input_path, output_path, conf_threshold)
            if os.path.exists(input_path):
                os.unlink(input_path)
                
            if not result:
                return jsonify({"error": "Failed to process image"}), 500
                
            result["file_type"] = "image"
            result["annotated_image_url"] = f"/static/uploads/{output_filename}"
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    elif filename.endswith(video_exts):
        input_path = save_file(file, "obj_in")
        output_filename = f"obj_out_{uuid.uuid4().hex}.mp4"
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        try:
            # Limit frames to 150 for speedy response
            result = track_in_video(input_path, output_path, conf_threshold, limit_frames=150)
            if os.path.exists(input_path):
                try:
                    os.unlink(input_path)
                except PermissionError:
                    pass
                    
            if not result:
                return jsonify({"error": "Failed to process video"}), 500
                
            result["file_type"] = "video"
            result["annotated_video_url"] = f"/static/uploads/{output_filename}"
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Unsupported file format. Use images or video."}), 400

# -------------------------------------------------------------
# API: Group 8 - Tackle Offence Prediction
# -------------------------------------------------------------
@app.route('/api/predict/tackle_offence', methods=['POST'])
def api_tackle_offence():
    video_paths = {}
    temp_files = []
    
    clip_keys = ["clip_0", "clip_1", "clip_2"]
    has_clips = False
    
    for key in clip_keys:
        if key in request.files:
            file = request.files[key]
            path = save_file(file, f"tackle_{key}")
            if path:
                video_paths[key] = path
                temp_files.append(path)
                has_clips = True
                
    if not has_clips:
        return jsonify({"error": "At least one clip file is required (clip_0, clip_1, or clip_2)"}), 400
        
    try:
        result = predict_tackle_offence(video_paths)
        
        # Clean up temp files
        for p in temp_files:
            if os.path.exists(p):
                try:
                    os.unlink(p)
                except PermissionError:
                    pass
                    
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------
# API: Group 9 - Tackle Image Classifier
# -------------------------------------------------------------
@app.route('/api/predict/tackle_image', methods=['POST'])
def api_tackle_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    input_path = save_file(file, "tackle_img_in")
    if not input_path:
        return jsonify({"error": "Failed to save file"}), 400
        
    try:
        from services.tackle_image import predict_tackle_image
        result = predict_tackle_image(input_path)
        
        if not result.get("success"):
            return jsonify({"error": result.get("error", "Prediction failed")}), 500
            
        filename = os.path.basename(input_path)
        result["image_url"] = f"/static/uploads/{filename}"
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------
# API: Group 11 - Soccer Event Classifier
# -------------------------------------------------------------
@app.route('/api/predict/soccer_event', methods=['POST'])
def api_soccer_event():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    input_path = save_file(file, "event_in")
    if not input_path:
        return jsonify({"error": "Failed to save file"}), 400
        
    try:
        result = classify_soccer_event(input_path)
        if os.path.exists(input_path):
            os.unlink(input_path)
            
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------------------------------------
# API: Group 2 - EPL Match Outcome Predictor
# -------------------------------------------------------------
@app.route('/api/epl/teams', methods=['GET'])
def api_epl_teams():
    try:
        teams = get_teams()
        return jsonify(teams)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict/epl_match', methods=['POST'])
def api_epl_match():
    data = request.json or {}
    team = data.get('team', '').strip()
    if not team:
        return jsonify({"error": "Nama tim harus disertakan"}), 400
    try:
        result = predict_epl_match(team)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5050)
