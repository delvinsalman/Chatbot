from flask import Flask, render_template, request, jsonify, session
import requests
from datetime import datetime
import os
import uuid
import base64
from werkzeug.utils import secure_filename
import json

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Configuration
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# API configuration
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
API_KEY = "AIzaSyD923quGIGar90Td3A9qqsl6sQMuHkw6ys"  # Your actual API key

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    if 'chat_id' not in session:
        session['chat_id'] = str(uuid.uuid4())
        session['conversation_name'] = "New Conversation"
    return render_template('index.html')

@app.route('/send_message', methods=['POST'])
def send_message():
    try:
        data = request.json
        user_message = data.get('message', '')
        files = data.get('files', [])
        system_prompt = data.get('system_prompt', '')
        temperature = float(data.get('temperature', 0.7))
        
        # Create conversation payload
        payload = {
            "contents": [{
                "parts": []
            }],
            "generationConfig": {
                "temperature": temperature,
                "topP": 0.95,
                "maxOutputTokens": 2048
            }
        }
        
        # Add system instruction if provided
        if system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }
        
        # Add user message
        if user_message:
            payload["contents"][0]["parts"].append({"text": user_message})
        
        # Add files if any
        for file_data in files:
            if file_data.get('type', '').startswith('image/'):
                # For image files, include as inline data
                payload["contents"][0]["parts"].append({
                    "inline_data": {
                        "mime_type": file_data.get("type"),
                        "data": file_data.get("data")
                    }
                })
            else:
                # For non-image files, include as text reference
                payload["contents"][0]["parts"].append({
                    "text": f"[Attached file: {file_data.get('name', 'file')}]"
                })
        
        # Make API request
        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": API_KEY
        }
        
        print(f"Sending request to Gemini API...")
        response = requests.post(API_URL, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        
        # Process response
        response_data = response.json()
        
        # Extract the response text safely
        if 'candidates' in response_data and len(response_data['candidates']) > 0:
            candidate = response_data['candidates'][0]
            if 'content' in candidate and 'parts' in candidate['content'] and len(candidate['content']['parts']) > 0:
                ai_response = candidate['content']['parts'][0].get('text', 'No response generated')
            else:
                ai_response = "No content in response"
        else:
            ai_response = "No candidates in response"
        
        # Format response with markdown support
        formatted_response = format_response(ai_response)
        
        return jsonify({
            'status': 'success',
            'response': formatted_response,
            'timestamp': datetime.now().isoformat()
        })
        
    except requests.exceptions.RequestException as e:
        error_msg = str(e)
        if hasattr(e, 'response') and e.response:
            try:
                error_details = e.response.json()
                error_msg = error_details.get('error', {}).get('message', error_msg)
            except:
                pass
        print(f"API Error: {error_msg}")
        return jsonify({
            'status': 'error',
            'response': f"Sorry, I encountered an error: {error_msg}",
            'timestamp': datetime.now().isoformat()
        }), 500
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({
            'status': 'error',
            'response': f"Unexpected error: {str(e)}",
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/update_conversation_name', methods=['POST'])
def update_conversation_name():
    data = request.json
    session['conversation_name'] = data.get('name', 'New Conversation')
    return jsonify({'status': 'success'})

def format_response(text):
    """Format the AI response with markdown support"""
    # Convert markdown to HTML
    formatted = text.replace('**', '<strong>').replace('**', '</strong>')
    formatted = formatted.replace('*', '<em>').replace('*', '</em>')
    formatted = formatted.replace('`', '<code>').replace('`', '</code>')
    
    # Handle paragraphs and lists
    paragraphs = formatted.split('\n\n')
    formatted = '<p>' + '</p><p>'.join(paragraphs) + '</p>'
    
    formatted = formatted.replace('\n- ', '<br>- ')
    formatted = formatted.replace('\n* ', '<br>* ')
    
    return formatted

@app.route('/upload_file', methods=['POST'])
def upload_file():
    """Handle file uploads separately if needed"""
    try:
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            # Return file info
            return jsonify({
                'status': 'success',
                'filename': filename,
                'file_path': file_path
            })
        else:
            return jsonify({'status': 'error', 'message': 'File type not allowed'}), 400
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True, port=5000)