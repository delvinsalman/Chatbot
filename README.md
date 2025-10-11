# 🤖 **AI ChatBot**

An advanced, interactive AI chatbot developed using **Flask, Python, Gemini 2.0 Flash, JavaScript, HTML, and CSS**. This bot features a modern, responsive interface and provides sophisticated, dual-model capabilities, including **real-time image generation**, multi-file analysis, and deep model customization.

---

## 📋 **Overview**

The **AI ChatBot** is engineered for an exceptional user experience, combining a sleek, modern interface with the power of the **Gemini 2.0 Flash** model for conversation and the **Hugging Face Stable Diffusion XL** model for image generation. The application enables **natural, human-like conversations**, leverages advanced **Multi-Media Analysis**, and supports the creation of new visuals on demand. It includes a persistent conversation history system, ensuring seamless interaction across sessions.

---

## ✨ **Enhanced Features**

### 🎨 **Generative AI Capabilities**
The chatbot utilizes a powerful, dual-model architecture to offer comprehensive AI functionality:
* **Text & Data Processing (Gemini 2.0 Flash):** Provides the core intelligence for natural conversation and sophisticated data analysis.
* **Image Generation (Hugging Face AI):** Generates high-quality, custom images directly within the chat using the **Stable Diffusion XL** model, powered by the **Hugging Face Inference API**.

### 🧠 **Advanced AI Configuration**
The core intelligence of the chatbot can be customized in the **Settings Panel**:
* **System Prompt:** Defines the AI's personality, role, or specific instructions for the entire conversation (e.g., "You are a professional Python programmer").
* **Temperature Control:** Adjusts the model's creativity and randomness using a slider (0.0 for deterministic, 1.0 for highly creative).

### 📂 **Multi-Media & Document Analysis**
The bot is capable of processing and analyzing various file types, providing detailed insights and context-aware responses:
* **Image Analysis:** Supports uploading and analyzing images (`.png`, `.jpg`, `.jpeg`, `.gif`).
* **Document Analysis:** Supports uploading and analyzing text documents, including **PDFs, Word documents, and text files** (`.pdf`, `.docx`, `.txt`).

### 💬 **Full Conversation Management**
A persistent sidebar allows for organized and continuous interaction:
* **Conversation History:** Automatically saves and loads previous chats across sessions.
* **New Chat:** Provides an easy way to start a fresh conversation.
* **Search & Clear:** Functions to search through conversation titles and clear all history.

### 🖥️ **Modern UI/UX**
The user interface is built for responsiveness and aesthetic appeal:
* **Dynamic Theming:** Supports **Dark, Light, and Auto** themes, toggleable via the header button or settings panel.
* **Code Highlighting:** Automatically formats and highlights code blocks in the AI's response for readability (via `highlight.js`).
* **Message Actions:** Includes utility features like **Copy to Clipboard** and **Reate Response** buttons on bot messages.
* **Fullscreen Mode:** Allows for easily toggling the application to full-screen view.

---

## 🖼️ **Displays**

A visual look at the key features and interface elements of the AI ChatBot.

### 🏠 **Main Interface & Conversation**
The core chat view, showcasing natural language conversation and the responsive layout.

<img width="1512" height="757" alt="mainn" src="https://github.com/user-attachments/assets/34f3520e-46ee-46b1-b654-6488720c029e" />

### ⚙️ **Settings Panel**
Demonstrates the customization options for the System Prompt and Temperature control.

<img width="1512" height="757" alt="settings" src="https://github.com/user-attachments/assets/4cd626bb-a333-4e7e-970d-d2b285a0ff29" />

### 📂 **Multi-File Analysis**
Highlights the capability to upload and analyze various file types (image, PDF, etc.).

<img width="1512" height="757" alt="Screenshot 2025-10-10 at 5 35 37 PM" src="https://github.com/user-attachments/assets/96500091-78d6-4fd5-a44f-4e8bf36f6507" />

### 🌅 **Text-Image Generation**
Displays the capability of making us of AI models to generate images from text prompts. 

<img width="1512" height="757" alt="Screenshot 2025-10-11 at 12 48 04 PM" src="https://github.com/user-attachments/assets/a0f80b35-d0fa-4327-bc14-bc7d18a08927" />

---

## 📦 **Installation & Deployment**

Follow these steps to get the **AI ChatBot** running on your local machine.

### 🔽 **1. Setup**
1.  **Download** or clone the repository files.
2.  **Install Python** (if not already installed).
3.  **Install required packages** by navigating to the project directory in your terminal and running:
    ```bash
    pip install -r requirements.txt
    ```

### 🔑 **2. Configure API Keys**
This application requires two API keys: one for Google's Gemini model and one for Hugging Face's Stable Diffusion XL model.

1.  Obtain a **Gemini API Key** from Google AI Studio.
2.  Obtain a **Hugging Face API Key** from the Hugging Face website.
3.  Open the `app.py` file and replace the placeholder text with your actual API Keys:

    ```python
    # API configuration
    GEMINI_API_KEY = "YOUR_ACTUAL_GEMINI_API_KEY_HERE"
    
    # Hugging Face API for image generation
    HUGGING_FACE_API_KEY = "YOUR_ACTUAL_HUGGING_FACE_API_KEY_HERE"
    ```

### ▶️ **3. Run the Application**
1.  In your terminal (within the project directory), run the Flask application:
    ```bash
    python app.py
    ```
2.  Open your web browser and navigate to the address displayed in the terminal (typically `http://127.0.0.1:5000/`).
