document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const chatContainer = document.getElementById('chat-container');
  const promptInput = document.getElementById('prompt');
  const sendButton = document.getElementById('send-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const menuBtn = document.getElementById('menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const themeToggle = document.getElementById('theme-toggle');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  const settingsBtns = document.querySelectorAll('#sidebar-settings-btn, #header-settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.getElementById('close-settings');
  const typingIndicator = document.getElementById('typing-indicator');
  const quickPrompts = document.querySelectorAll('.quick-prompt');
  const attachBtn = document.getElementById('attach-btn');
  const fileUpload = document.getElementById('file-upload');
  const fileAttachments = document.getElementById('file-attachments');
  const temperatureSlider = document.getElementById('temperature');
  const tempValue = document.getElementById('temp-value');
  const conversationTitle = document.getElementById('conversation-title');
  const conversationName = document.getElementById('conversation-name');
  const systemPromptInput = document.getElementById('system-prompt');
  const saveSettingsBtn = document.getElementById('save-settings');
  const resetSettingsBtn = document.getElementById('reset-settings');
  const clearAllBtn = document.getElementById('clear-all');
  const searchInput = document.getElementById('search-input');
  const historyList = document.getElementById('history-list');
  
  // State
  let currentConversationId = generateId();
  let isProcessing = false;
  let attachedFiles = [];
  let currentSettings = {
    theme: 'dark',
    temperature: 0.7,
    systemPrompt: '',
    conversationName: 'New Conversation'
  };

  // Initialize
  initializeApp();
  
  function initializeApp() {
    loadSettings();
    loadConversationHistory();
    setupEventListeners();
    setupMarkdownRenderer();
    updateUIFromSettings();
  }
  
  function setupEventListeners() {
    // Send message
    sendButton.addEventListener('click', sendMessage);
    promptInput.addEventListener('keydown', handleKeyDown);
    
    // UI interactions
    newChatBtn.addEventListener('click', startNewChat);
    menuBtn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeAllPanels);
    
    // Theme and settings
    themeToggle.addEventListener('click', toggleTheme);
    fullscreenToggle.addEventListener('click', toggleFullscreen);
    settingsBtns.forEach(btn => btn.addEventListener('click', openSettings));
    closeSettings.addEventListener('click', closeSettingsPanel);
    saveSettingsBtn.addEventListener('click', saveSettings);
    resetSettingsBtn.addEventListener('click', resetSettings);
    
    // Quick prompts
    quickPrompts.forEach(prompt => {
      prompt.addEventListener('click', () => {
        const promptText = prompt.getAttribute('data-prompt');
        promptInput.value = promptText;
        promptInput.focus();
        autoResizeTextarea();
      });
    });
    
    // File handling
    attachBtn.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', handleFileUpload);
    
    // Settings controls
    temperatureSlider.addEventListener('input', updateTemperatureValue);
    conversationName.addEventListener('change', updateConversationName);
    
    // History management
    clearAllBtn.addEventListener('click', clearAllHistory);
    searchInput.addEventListener('input', filterHistory);
    
    // Auto-resize textarea
    promptInput.addEventListener('input', autoResizeTextarea);
    
    // Theme options
    document.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', function() {
        const theme = this.getAttribute('data-theme');
        currentSettings.theme = theme;
        applyTheme(theme);
        
        // Update active state
        document.querySelectorAll('.theme-option').forEach(opt => {
          opt.classList.remove('active');
        });
        this.classList.add('active');
      });
    });
  }
  
  function setupMarkdownRenderer() {
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.warn(`Error highlighting code for language ${lang}:`, err);
          }
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
  
  function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  }
  
  async function sendMessage() {
    const message = promptInput.value.trim();
    
    if ((!message && attachedFiles.length === 0) || isProcessing) return;
    
    // Check if this is an image generation request
    if (message.startsWith('/image') || message.startsWith('/generate')) {
      const imagePrompt = message.replace(/^\/image\s+|\/generate\s+/, '').trim();
      if (imagePrompt) {
        await generateImage(imagePrompt);
        promptInput.value = '';
        autoResizeTextarea();
        return;
      }
    }
    
    // Add user message
    addMessage(message, 'user', attachedFiles);
    promptInput.value = '';
    autoResizeTextarea();
    
    // Show typing indicator
    showTypingIndicator();
    isProcessing = true;
    sendButton.disabled = true;
    
    try {
      // Prepare files for API
      const fileData = await Promise.all(
        attachedFiles.map(async (file) => {
          if (file.type.startsWith('image/')) {
            const base64 = await fileToBase64(file);
            return {
              type: file.type,
              data: base64.split(',')[1],
              name: file.name
            };
          } else {
            // For non-image files, we'll send the filename as reference
            const textContent = await readFileAsText(file);
            return {
              type: file.type,
              data: null,
              name: file.name,
              content: textContent
            };
          }
        })
      );
      
      const response = await fetch('/send_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          files: fileData,
          system_prompt: currentSettings.systemPrompt,
          temperature: parseFloat(currentSettings.temperature)
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        addMessage(data.response, 'bot');
        saveToHistory(message, data.response);
      } else {
        throw new Error(data.response);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage(`Sorry, I encountered an error: ${error.message}`, 'bot');
    } finally {
      hideTypingIndicator();
      isProcessing = false;
      sendButton.disabled = false;
      clearAttachments();
    }
  }
  
  // Helper function to read file as text
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  }
  
  async function generateImage(prompt) {
    if (!prompt) {
      showToast('Please provide a prompt for image generation');
      return;
    }
    
    // Add user message showing the generation request
    addMessage(`Generate image: "${prompt}"`, 'user');
    
    // Show typing indicator for image generation
    showTypingIndicator();
    isProcessing = true;
    sendButton.disabled = true;
    
    try {
      const response = await fetch('/generate_image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Add image message
        addImageMessage(data.image_base64, prompt, data.timestamp);
        saveToHistory(`Generate image: "${prompt}"`, `![Generated Image](${data.image_base64})`);
        showToast('Image generated successfully!');
      } else if (data.status === 'loading') {
        addMessage(`The image generation model is currently loading. This usually takes 20-30 seconds. Please try again in a moment.`, 'bot');
        showToast('Model is loading, please wait...');
      } else {
        throw new Error(data.message || 'Image generation failed');
      }
      
    } catch (error) {
      console.error('Error generating image:', error);
      const errorMessage = error.message.includes('unavailable') 
        ? error.message 
        : `Sorry, I couldn't generate the image: ${error.message}. Please try a different prompt or try again later.`;
      addMessage(errorMessage, 'bot');
      showToast('Image generation failed');
    } finally {
      hideTypingIndicator();
      isProcessing = false;
      sendButton.disabled = false;
    }
  }
  
  function addImageMessage(imageData, prompt, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    
    const displayTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = generateId();
    messageDiv.dataset.messageId = messageId;
    
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <img src="/static/Icon.gif" alt="AI Assistant">
      </div>
      <div class="message-content">
        <div class="message-bubble">
          <div class="generated-image-container">
            <h4>🎨 Generated Image</h4>
            <p><strong>Prompt:</strong> "${prompt}"</p>
            <div class="image-result">
              <img src="${imageData}" alt="Generated image: ${prompt}" class="generated-image" onclick="showImageModal('${imageData}')">
            </div>
            <div class="image-actions">
              <button class="image-action download-btn" data-image="${imageData}" data-filename="generated_image_${Date.now()}.png">
                <i class="fas fa-download"></i> Download
              </button>
              <button class="image-action regenerate-image-btn" data-prompt="${prompt.replace(/"/g, '&quot;')}">
                <i class="fas fa-redo"></i> Regenerate
              </button>
              <button class="image-action enhance-prompt-btn" data-prompt="${prompt.replace(/"/g, '&quot;')}">
                <i class="fas fa-magic"></i> Enhance & Retry
              </button>
            </div>
          </div>
        </div>
        <div class="message-meta">
          <span class="message-time">${displayTime}</span>
          <div class="message-actions">
            <button class="message-action copy-btn" title="Copy prompt">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Remove welcome screen if it exists
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.remove();
    }
    
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Add event listeners
    const downloadBtn = messageDiv.querySelector('.download-btn');
    const regenerateBtn = messageDiv.querySelector('.regenerate-image-btn');
    const enhanceBtn = messageDiv.querySelector('.enhance-prompt-btn');
    const copyBtn = messageDiv.querySelector('.copy-btn');
    
    downloadBtn.addEventListener('click', () => downloadImage(imageData, downloadBtn.dataset.filename));
    regenerateBtn.addEventListener('click', () => generateImage(prompt));
    enhanceBtn.addEventListener('click', () => enhanceAndRegenerate(prompt));
    copyBtn.addEventListener('click', () => copyToClipboard(prompt));
  }
  
  async function enhanceAndRegenerate(originalPrompt) {
    // Use AI to enhance the prompt for better image generation
    showToast('Enhancing prompt for better results...');
    
    try {
      const response = await fetch('/send_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Improve this image generation prompt for better results, make it more descriptive and detailed but keep the core idea: "${originalPrompt}". Return only the improved prompt without any explanations.`,
          system_prompt: "You are a prompt engineering expert. Improve image generation prompts by making them more descriptive, detailed, and specific while maintaining the original intent. Return only the improved prompt without any additional text.",
          temperature: 0.7
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        const enhancedPrompt = data.response.replace(/<[^>]*>/g, '').trim();
        promptInput.value = `/image ${enhancedPrompt}`;
        autoResizeTextarea();
        generateImage(enhancedPrompt);
      } else {
        throw new Error('Failed to enhance prompt');
      }
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      // If enhancement fails, just regenerate with original prompt
      generateImage(originalPrompt);
    }
  }
  
  function downloadImage(imageData, filename) {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Image downloaded successfully!');
  }
  
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
  
  function addMessage(content, sender, files = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = generateId();
    messageDiv.dataset.messageId = messageId;
    
    let messageContent = '';
    
    if (sender === 'bot') {
      messageContent = marked.parse(content);
    } else {
      messageContent = content;
    }
    
    messageDiv.innerHTML = `
      <div class="message-avatar">
        ${sender === 'user' 
          ? '<i class="fas fa-user"></i>' 
          : `<img src="/static/Icon.gif" alt="AI Assistant">`
        }
      </div>
      <div class="message-content">
        <div class="message-bubble">
          ${messageContent}
          ${files.length > 0 ? createFileAttachments(files) : ''}
        </div>
        <div class="message-meta">
          <span class="message-time">${timestamp}</span>
          <div class="message-actions">
            <button class="message-action copy-btn" title="Copy">
              <i class="fas fa-copy"></i>
            </button>
            ${sender === 'bot' ? `
              <button class="message-action regenerate-btn" title="Regenerate">
                <i class="fas fa-redo"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    // Remove welcome screen if it exists
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.remove();
    }
    
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Add event listeners for message actions
    const copyBtn = messageDiv.querySelector('.copy-btn');
    const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
    
    copyBtn.addEventListener('click', () => copyToClipboard(content));
    
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => regenerateResponse(messageDiv));
    }
    
    // Apply syntax highlighting to code blocks
    if (sender === 'bot') {
      setTimeout(() => {
        messageDiv.querySelectorAll('pre code').forEach(block => {
          hljs.highlightElement(block);
        });
      }, 0);
    }
  }
  
  function createFileAttachments(files) {
    let attachmentsHTML = '<div class="message-files">';
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        attachmentsHTML += `
          <div class="image-attachment-container">
            <img src="${url}" alt="${file.name}" class="attachment-image" onclick="showImageModal('${url}')">
          </div>
        `;
      } else {
        attachmentsHTML += `
          <div class="file-attachment">
            <i class="${getFileIcon(file.name)}"></i>
            <span>${file.name}</span>
          </div>
        `;
      }
    });
    
    attachmentsHTML += '</div>';
    return attachmentsHTML;
  }
  
  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      'pdf': 'fas fa-file-pdf',
      'doc': 'fas fa-file-word',
      'docx': 'fas fa-file-word',
      'txt': 'fas fa-file-alt',
      'xls': 'fas fa-file-excel',
      'xlsx': 'fas fa-file-excel',
      'ppt': 'fas fa-file-powerpoint',
      'pptx': 'fas fa-file-powerpoint',
      'zip': 'fas fa-file-archive',
      'rar': 'fas fa-file-archive'
    };
    return iconMap[ext] || 'fas fa-file';
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      showToast('Failed to copy text');
    });
  }
  
  function regenerateResponse(messageElement) {
    // Find the user message that prompted this response
    const messages = Array.from(chatContainer.querySelectorAll('.user-message'));
    const lastUserMessage = messages[messages.length - 1];
    
    if (lastUserMessage) {
      const userMessageContent = lastUserMessage.querySelector('.message-bubble').textContent;
      
      // Remove the current bot message
      messageElement.remove();
      
      // Resend the user message
      promptInput.value = userMessageContent;
      sendMessage();
    }
  }
  
  function showTypingIndicator() {
    typingIndicator.classList.add('visible');
    scrollToBottom();
  }
  
  function hideTypingIndicator() {
    typingIndicator.classList.remove('visible');
  }
  
  function scrollToBottom() {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
  }
  
  function startNewChat() {
    if (isProcessing) return;
    
    currentConversationId = generateId();
    currentSettings.conversationName = 'New Conversation';
    conversationTitle.textContent = currentSettings.conversationName;
    conversationName.value = '';
    
    // Clear chat container and show welcome screen
    chatContainer.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-content">
          <div class="ai-avatar">
            <img src="/static/Icon.gif" alt="AI Assistant">
          </div>
          <h1>Hello! How can I help you today?</h1>
          <p>Your intelligent assistant powered by Gemini 2.0 Flash</p>
          
          <div class="quick-prompts">
            <div class="prompt-grid">
              <button class="quick-prompt" data-prompt="Write a professional email requesting a meeting about the upcoming project deadline.">
                <i class="fas fa-envelope"></i>
                Professional Email
              </button>
              <button class="quick-prompt" data-prompt="Explain how machine learning works in simple terms with practical examples.">
                <i class="fas fa-brain"></i>
                Machine Learning Basics
              </button>
              <button class="quick-prompt" data-prompt="/image a majestic dragon flying over a medieval castle at sunset, fantasy art, highly detailed, digital painting">
                <i class="fas fa-dragon"></i>
                Generate Fantasy Art
              </button>
              <button class="quick-prompt" data-prompt="/image a serene mountain landscape with crystal clear lake, photorealistic, 4k, professional photography">
                <i class="fas fa-mountain"></i>
                Generate Landscape
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Reattach event listeners to quick prompts
    document.querySelectorAll('.quick-prompt').forEach(prompt => {
      prompt.addEventListener('click', () => {
        const promptText = prompt.getAttribute('data-prompt');
        promptInput.value = promptText;
        promptInput.focus();
        autoResizeTextarea();
      });
    });
    
    clearAttachments();
    closeAllPanels();
    saveSettings();
  }
  
  function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  }
  
  function closeAllPanels() {
    sidebar.classList.remove('active');
    settingsPanel.classList.remove('active');
    overlay.classList.remove('active');
  }
  
  function openSettings() {
    settingsPanel.classList.add('active');
    overlay.classList.add('active');
    
    // Populate settings fields
    conversationName.value = currentSettings.conversationName;
    systemPromptInput.value = currentSettings.systemPrompt;
    temperatureSlider.value = currentSettings.temperature;
    updateTemperatureValue();
    
    // Set active theme option
    document.querySelectorAll('.theme-option').forEach(opt => {
      opt.classList.remove('active');
      if (opt.getAttribute('data-theme') === currentSettings.theme) {
        opt.classList.add('active');
      }
    });
  }
  
  function closeSettingsPanel() {
    settingsPanel.classList.remove('active');
    overlay.classList.remove('active');
  }
  
  function toggleTheme() {
    const newTheme = currentSettings.theme === 'dark' ? 'light' : 'dark';
    currentSettings.theme = newTheme;
    applyTheme(newTheme);
    saveSettings();
  }
  
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update theme toggle icon
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  }
  
  function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    currentSettings.theme = savedTheme;
    applyTheme(savedTheme);
  }
  
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
  
  function updateTemperatureValue() {
    tempValue.textContent = temperatureSlider.value;
  }
  
  function updateConversationName() {
    currentSettings.conversationName = conversationName.value || 'New Conversation';
    conversationTitle.textContent = currentSettings.conversationName;
    saveSettings();
  }
  
  function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showToast('File size too large. Please select files under 10MB.');
        return;
      }
      
      attachedFiles.push(file);
      displayFilePreview(file);
    });
    
    // Reset file input
    fileUpload.value = '';
  }
  
  function displayFilePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    
    let previewContent = '';
    
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      previewContent = `<img src="${url}" alt="${file.name}" class="preview-image">`;
    } else {
      previewContent = `<i class="${getFileIcon(file.name)}"></i>`;
    }
    
    preview.innerHTML = `
      ${previewContent}
      <span>${file.name}</span>
      <button class="remove-file" data-filename="${file.name}">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    fileAttachments.appendChild(preview);
    
    // Add event listener to remove button
    preview.querySelector('.remove-file').addEventListener('click', () => {
      removeFile(file.name);
      preview.remove();
    });
  }
  
  function removeFile(filename) {
    attachedFiles = attachedFiles.filter(file => file.name !== filename);
  }
  
  function clearAttachments() {
    attachedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        URL.revokeObjectURL(file);
      }
    });
    attachedFiles = [];
    fileAttachments.innerHTML = '';
  }
  
  function saveSettings() {
    currentSettings.temperature = parseFloat(temperatureSlider.value);
    currentSettings.systemPrompt = systemPromptInput.value;
    
    localStorage.setItem('chatSettings', JSON.stringify(currentSettings));
    showToast('Settings saved successfully!');
    closeSettingsPanel();
  }
  
  function resetSettings() {
    currentSettings = {
      theme: 'dark',
      temperature: 0.7,
      systemPrompt: '',
      conversationName: 'New Conversation'
    };
    
    localStorage.setItem('chatSettings', JSON.stringify(currentSettings));
    updateUIFromSettings();
    showToast('Settings reset to defaults!');
  }
  
  function loadSettings() {
    const saved = localStorage.getItem('chatSettings');
    if (saved) {
      currentSettings = { ...currentSettings, ...JSON.parse(saved) };
    }
    updateUIFromSettings();
  }
  
  function updateUIFromSettings() {
    applyTheme(currentSettings.theme);
    conversationTitle.textContent = currentSettings.conversationName;
    conversationName.value = currentSettings.conversationName;
    systemPromptInput.value = currentSettings.systemPrompt;
    temperatureSlider.value = currentSettings.temperature;
    updateTemperatureValue();
  }
  
  function saveToHistory(userMessage, botResponse) {
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    
    // Update current conversation or create new one
    let conversation = history.find(conv => conv.id === currentConversationId);
    
    if (!conversation) {
      conversation = {
        id: currentConversationId,
        title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString(),
        messages: []
      };
      history.unshift(conversation);
    }
    
    conversation.messages.push({
      user: userMessage,
      bot: botResponse,
      timestamp: new Date().toISOString()
    });
    
    // Update title if it's the first message
    if (conversation.messages.length === 1) {
      conversation.title = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
    }
    
    localStorage.setItem('chatHistory', JSON.stringify(history));
    loadConversationHistory();
  }
  
  function loadConversationHistory() {
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-history">
          <i class="fas fa-comments"></i>
          <div>No conversations yet</div>
          <div style="font-size: 11px; margin-top: 8px; opacity: 0.7;">Start a new chat to see history here</div>
        </div>
      `;
      return;
    }
    
    history.forEach(conversation => {
      const item = document.createElement('div');
      item.className = 'history-item';
      if (conversation.id === currentConversationId) {
        item.classList.add('active');
      }
      
      item.innerHTML = `
        <div class="history-content">
          <div class="history-title">${conversation.title}</div>
          <div class="history-time">${new Date(conversation.timestamp).toLocaleDateString()}</div>
        </div>
        <button class="delete-history" data-id="${conversation.id}">
          <i class="fas fa-trash"></i>
        </button>
      `;
      
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-history')) {
          loadConversation(conversation.id);
        }
      });
      
      const deleteBtn = item.querySelector('.delete-history');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conversation.id);
      });
      
      historyList.appendChild(item);
    });
  }
  
  function loadConversation(conversationId) {
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const conversation = history.find(conv => conv.id === conversationId);
    
    if (conversation) {
      currentConversationId = conversationId;
      currentSettings.conversationName = conversation.title;
      conversationTitle.textContent = conversation.title;
      conversationName.value = conversation.title;
      
      // Clear and rebuild chat
      chatContainer.innerHTML = '';
      
      conversation.messages.forEach(msg => {
        if (msg.user.startsWith('Generate image:')) {
          // Handle image messages
          const prompt = msg.user.replace('Generate image: "', '').replace('"', '');
          const imageMatch = msg.bot.match(/!\[Generated Image\]\((.*?)\)/);
          if (imageMatch && imageMatch[1]) {
            addImageMessage(imageMatch[1], prompt, new Date().toISOString());
          }
        } else {
          addMessage(msg.user, 'user');
          addMessage(msg.bot, 'bot');
        }
      });
      
      closeAllPanels();
      loadConversationHistory();
      saveSettings();
    }
  }
  
  function deleteConversation(conversationId) {
    let history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    history = history.filter(conv => conv.id !== conversationId);
    
    localStorage.setItem('chatHistory', JSON.stringify(history));
    
    if (conversationId === currentConversationId) {
      startNewChat();
    }
    
    loadConversationHistory();
    showToast('Conversation deleted');
  }
  
  function clearAllHistory() {
    if (confirm('Are you sure you want to clear all conversation history?')) {
      localStorage.removeItem('chatHistory');
      startNewChat();
      loadConversationHistory();
      showToast('All history cleared!');
    }
  }
  
  function filterHistory() {
    const searchTerm = searchInput.value.toLowerCase();
    const items = historyList.querySelectorAll('.history-item');
    
    items.forEach(item => {
      const title = item.querySelector('.history-title').textContent.toLowerCase();
      if (title.includes(searchTerm)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }
  
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
});

// Global functions for image handling
function showImageModal(imageUrl) {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-modal">&times;</span>
      <img src="${imageUrl}" alt="Full size image">
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Handle fullscreen change
document.addEventListener('fullscreenchange', function() {
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  const icon = fullscreenToggle.querySelector('i');
  
  if (document.fullscreenElement) {
    icon.className = 'fas fa-compress';
  } else {
    icon.className = 'fas fa-expand';
  }
});