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
GENERATED_IMAGES_FOLDER = 'static/generated_images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['GENERATED_IMAGES_FOLDER'] = GENERATED_IMAGES_FOLDER

# API configuration
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
GEMINI_API_KEY = "AIzaSyD923quGIGar90Td3A9qqsl6sQMuHkw6ys"

# Hugging Face API for image generation - Using Stable Diffusion XL (should work)
HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
HUGGING_FACE_API_KEY = "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"

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
        
        # Check for quick answer commands
        if user_message.startswith('/quick ') or user_message.startswith('/q '):
            prompt = user_message.replace('/quick ', '').replace('/q ', '')
            return generate_quick_answer(prompt)
        elif user_message.startswith('/summary ') or user_message.startswith('/summarize '):
            prompt = user_message.replace('/summary ', '').replace('/summarize ', '')
            return generate_summary(prompt)
        elif user_message.startswith('/bullet ') or user_message.startswith('/points '):
            prompt = user_message.replace('/bullet ', '').replace('/points ', '')
            return generate_bullet_points(prompt)
        elif user_message.startswith('/define ') or user_message.startswith('/whatis '):
            prompt = user_message.replace('/define ', '').replace('/whatis ', '')
            return generate_definition(prompt)
        
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
            "X-goog-api-key": GEMINI_API_KEY
        }
        
        print(f"Sending request to Gemini API...")
        response = requests.post(GEMINI_API_URL, json=payload, headers=headers, timeout=60)
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

def generate_quick_answer(prompt):
    """Generate a quick, concise answer"""
    quick_system_prompt = "Provide a very concise and direct answer. Maximum 2-3 sentences. Get straight to the point without introductions or conclusions."
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.3,
            "topP": 0.8,
            "maxOutputTokens": 150
        },
        "systemInstruction": {
            "parts": [{"text": quick_system_prompt}]
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    
    response = requests.post(GEMINI_API_URL, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    
    response_data = response.json()
    ai_response = response_data['candidates'][0]['content']['parts'][0]['text']
    
    return jsonify({
        'status': 'success',
        'response': format_response(ai_response),
        'timestamp': datetime.now().isoformat(),
        'quick_answer': True
    })

def generate_summary(prompt):
    """Generate a summary"""
    summary_system_prompt = "Provide a concise summary of the given text. Focus on key points and main ideas. Keep it brief and to the point."
    
    payload = {
        "contents": [{
            "parts": [{"text": f"Summarize this: {prompt}"}]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.8,
            "maxOutputTokens": 200
        },
        "systemInstruction": {
            "parts": [{"text": summary_system_prompt}]
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    
    response = requests.post(GEMINI_API_URL, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    
    response_data = response.json()
    ai_response = response_data['candidates'][0]['content']['parts'][0]['text']
    
    return jsonify({
        'status': 'success',
        'response': format_response(ai_response),
        'timestamp': datetime.now().isoformat(),
        'summary': True
    })

def generate_bullet_points(prompt):
    """Generate bullet points"""
    bullet_system_prompt = "Provide the information as clear, concise bullet points. Use • for bullets. Maximum 5-6 points. No long explanations."
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.8,
            "maxOutputTokens": 250
        },
        "systemInstruction": {
            "parts": [{"text": bullet_system_prompt}]
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    
    response = requests.post(GEMINI_API_URL, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    
    response_data = response.json()
    ai_response = response_data['candidates'][0]['content']['parts'][0]['text']
    
    return jsonify({
        'status': 'success',
        'response': format_response(ai_response),
        'timestamp': datetime.now().isoformat(),
        'bullet_points': True
    })

def generate_definition(prompt):
    """Generate a definition"""
    definition_system_prompt = "Provide a clear, concise definition. Explain what it is in simple terms. Include key characteristics if relevant."
    
    payload = {
        "contents": [{
            "parts": [{"text": f"What is {prompt}?"}]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "topP": 0.8,
            "maxOutputTokens": 150
        },
        "systemInstruction": {
            "parts": [{"text": definition_system_prompt}]
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    
    response = requests.post(GEMINI_API_URL, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    
    response_data = response.json()
    ai_response = response_data['candidates'][0]['content']['parts'][0]['text']
    
    return jsonify({
        'status': 'success',
        'response': format_response(ai_response),
        'timestamp': datetime.now().isoformat(),
        'definition': True
    })

@app.route('/generate_image', methods=['POST'])
def generate_image():
    """Generate image using Hugging Face Stable Diffusion API"""
    try:
        data = request.json
        prompt = data.get('prompt', '')
        
        if not prompt:
            return jsonify({
                'status': 'error',
                'message': 'No prompt provided'
            }), 400
        
        # Prepare headers for Hugging Face API
        headers = {
            "Authorization": f"Bearer {HUGGING_FACE_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Prepare payload for image generation
        payload = {
            "inputs": prompt,
            "parameters": {
                "num_inference_steps": 20,
                "guidance_scale": 7.5,
                "width": 512,
                "height": 512
            },
            "options": {
                "wait_for_model": True,
                "use_cache": True
            }
        }
        
        print(f"Generating image with prompt: {prompt}")
        
        # Make API request to Hugging Face
        response = requests.post(
            HUGGING_FACE_API_URL,
            headers=headers,
            json=payload,
            timeout=120  # Longer timeout for image generation
        )
        
        if response.status_code == 503:
            # Model is loading, provide feedback
            return jsonify({
                'status': 'loading',
                'message': 'Model is loading, please try again in a few seconds...'
            }), 503
            
        response.raise_for_status()
        
        # Save the generated image
        if not os.path.exists(app.config['GENERATED_IMAGES_FOLDER']):
            os.makedirs(app.config['GENERATED_IMAGES_FOLDER'])
        
        image_filename = f"generated_{uuid.uuid4().hex[:8]}.png"
        image_path = os.path.join(app.config['GENERATED_IMAGES_FOLDER'], image_filename)
        
        with open(image_path, 'wb') as f:
            f.write(response.content)
        
        # Convert image to base64 for immediate display
        image_base64 = base64.b64encode(response.content).decode('utf-8')
        
        return jsonify({
            'status': 'success',
            'image_url': f"/{image_path}",
            'image_base64': f"data:image/png;base64,{image_base64}",
            'prompt': prompt,
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
        
        print(f"Image Generation Error: {error_msg}")
        
        # If the model still doesn't work, provide alternative
        if "404" in error_msg or "not found" in error_msg.lower():
            return jsonify({
                'status': 'error',
                'message': 'Image generation service is temporarily unavailable. Please try again later or use a different prompt.'
            }), 404
            
        return jsonify({
            'status': 'error',
            'message': f"Image generation failed: {error_msg}"
        }), 500
        
    except Exception as e:
        print(f"Unexpected error in image generation: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Unexpected error: {str(e)}"
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
    if not os.path.exists(GENERATED_IMAGES_FOLDER):
        os.makedirs(GENERATED_IMAGES_FOLDER)
    app.run(debug=True, port=5000)