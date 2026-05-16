from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
import time

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPEAKERS_DIR = os.path.join(BASE_DIR, "speakers")
ALLOWED_AUDIO = {"wav", "mp3", "m4a", "webm", "ogg"}

os.makedirs(SPEAKERS_DIR, exist_ok=True)

@app.route("/")
def home():
    # Serves templates/index.html
    return render_template("index.html")

@app.route("/api/health")
def health():
    return jsonify({"ok": True, "time": int(time.time())})

@app.route("/api/voice/list")
def list_voices():
    files = []
    for fn in os.listdir(SPEAKERS_DIR):
        if fn.lower().split(".")[-1] in ALLOWED_AUDIO:
            files.append(fn)
    files.sort()
    return jsonify({"voices": files})

@app.route("/api/voice/upload", methods=["POST"])
def upload_voice():
    """
    Uploads a recorded audio sample and stores it in ./speakers
    This is NOT voice cloning — just saving your own samples for your project.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file field named 'file'"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty filename"}), 400

    ext = f.filename.lower().split(".")[-1]
    if ext not in ALLOWED_AUDIO:
        return jsonify({"error": f"Unsupported audio type: .{ext}"}), 400

    safe_name = secure_filename(f.filename)
    save_path = os.path.join(SPEAKERS_DIR, safe_name)

    # avoid overwrite
    if os.path.exists(save_path):
        base, dot, ext2 = safe_name.rpartition(".")
        safe_name = f"{base}_{int(time.time())}.{ext2}"
        save_path = os.path.join(SPEAKERS_DIR, safe_name)

    f.save(save_path)
    return jsonify({"ok": True, "savedAs": safe_name})

@app.route("/speakers/<path:filename>")
def serve_speaker_file(filename):
    # lets UI play saved samples
    return send_from_directory(SPEAKERS_DIR, filename, as_attachment=False)

if __name__ == "__main__":
    # Run: python tts_server.py
    app.run(host="127.0.0.1", port=5000, debug=True)