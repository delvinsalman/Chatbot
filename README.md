# 🤖 **AI ChatBot**

An advanced, interactive AI chatbot developed using **Flask, Python, Gemini 2.0 Flash, JavaScript, HTML, and CSS**. This bot features a modern, responsive interface and provides sophisticated capabilities, including real-time conversation history, multi-file analysis, and deep model customization.

---

## 📋 **Overview**

The **AI ChatBot** is engineered for an exceptional user experience, combining a sleek, modern interface with the power of the **Gemini 2.0 Flash** model. Users can engage in natural, human-like conversations, leverage advanced **Multi-Media Analysis**, and fine-tune the AI's behavior through a comprehensive **Settings Panel**. The application includes a persistent conversation history system, ensuring seamless interaction across sessions.

---

## ✨ **Enhanced Features**

### 🧠 **Advanced AI Configuration**
Customize the core intelligence of the chatbot in the Settings Panel:
* **System Prompt:** Define the AI's personality, role, or specific instructions for the entire conversation (e.g., "You are a professional Python programmer").
* **Temperature Control:** Adjust the model's creativity and randomness using a slider (0.0 for deterministic, 1.0 for highly creative).

### 📂 **Multi-Media & Document Analysis**
The bot can process and analyze various file types, providing detailed insights and context-aware responses:
* **Image Analysis:** Upload and analyze images (`.png`, `.jpg`, `.jpeg`, `.gif`).
* **Document Analysis:** Upload and analyze text documents, including **PDFs, Word documents, and text files** (`.pdf`, `.docx`, `.txt`).

### 💬 **Full Conversation Management**
A persistent sidebar allows for organized and continuous interaction:
* **Conversation History:** Automatically save and load previous chats across sessions.
* **New Chat:** Easily start a fresh conversation.
* **Search & Clear:** Search through conversation titles and clear all history.

### 🖥️ **Modern UI/UX**
The user interface is built for responsiveness and aesthetic appeal:
* **Dynamic Theming:** Supports **Dark, Light, and Auto** themes, which can be toggled via the header button or settings panel.
* **Code Highlighting:** Automatically formats and highlights code blocks in the AI's response for readability (via `highlight.js`).
* **Message Actions:** Includes utility features like **Copy to Clipboard** and **Regenerate Response** buttons on bot messages.

---

## 🖼️ **Displays**

A look at the key features and interface elements of the AI ChatBot.

### 🏠 **Main Interface & Conversation**
The core chat view, showcasing natural language conversation and the responsive layout.

<img width="1512" height="763" alt="Screenshot 2025-10-08 at 4 50 37 PM" src="https://github.com/user-attachments/assets/36ef518a-bb4a-456b-8c90-ed7ea160c10a" />


### ⚙️ **Settings Panel**
Demonstrates the customization options for the System Prompt and Temperature control.

<img width="1512" height="763" alt="Screenshot 2025-10-08 at 9 51 23 PM" src="https://github.com/user-attachments/assets/a912680b-de2f-4678-b248-726f142da8e3" />


### 📂 **Multi-File Analysis**
Highlights the capability to upload and analyze various file types (image, PDF, etc.).

<img width="1512" height="763" alt="Screenshot 2025-10-08 at 9 51 55 PM" src="https://github.com/user-attachments/assets/94c185b8-b7df-4996-8b50-397f4553dbce" />

---

## 📦 **Installation & Deployment**

Follow these steps to get the **AI ChatBot** running on your local machine.

### 🔽 **1. Setup**
1.  **Download** or clone the repository files.
2.  **Install Python** (if you haven't already).
3.  **Install required packages** by navigating to the project directory in your terminal and running:
    ```bash
    pip install -r requirements.txt
    ```

### 🔑 **2. Configure API Key**
1.  Get a Gemini API Key from Google AI Studio.
2.  Open the `app.py` file.
3.  Replace the placeholder text with your actual API Key in the `API_KEY` variable:

    ```python
    # API configuration
    API_KEY = "YOUR_ACTUAL_API_KEY_HERE"
    ```

### ▶️ **3. Run the Application**
1.  In your terminal (within the project directory), run the Flask application:
    ```bash
    python app.py
    ```
2.  Open your web browser and navigate to the address displayed in the terminal (typically `http://127.0.0.1:5000/`).
