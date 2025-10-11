document.addEventListener('DOMContentLoaded', function() {
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
  
  let currentConversationId = generateId();
  let isProcessing = false;
  let attachedFiles = [];
  let currentSettings = {
    theme: 'dark',
    temperature: 0.7,
    systemPrompt: '',
    conversationName: 'New Conversation'
  };

  initializeApp();
  
  function initializeApp() {
    loadSettings();
    loadConversationHistory();
    setupEventListeners();
    setupMarkdownRenderer();
    updateUIFromSettings();
  }
  
  function setupEventListeners() {
    sendButton.addEventListener('click', sendMessage);
    promptInput.addEventListener('keydown', handleKeyDown);
    
    newChatBtn.addEventListener('click', startNewChat);
    menuBtn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeAllPanels);
    
    themeToggle.addEventListener('click', toggleTheme);
    fullscreenToggle.addEventListener('click', toggleFullscreen);
    settingsBtns.forEach(btn => btn.addEventListener('click', openSettings));
    closeSettings.addEventListener('click', closeSettingsPanel);
    saveSettingsBtn.addEventListener('click', saveSettings);
    resetSettingsBtn.addEventListener('click', resetSettings);
    
    quickPrompts.forEach(prompt => {
      prompt.addEventListener('click', () => {
        const promptText = prompt.getAttribute('data-prompt');
        promptInput.value = promptText;
        promptInput.focus();
        autoResizeTextarea();
      });
    });
    
    attachBtn.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', handleFileUpload);
    
    temperatureSlider.addEventListener('input', updateTemperatureValue);
    conversationName.addEventListener('change', updateConversationName);
    
    clearAllBtn.addEventListener('click', clearAllHistory);
    searchInput.addEventListener('input', filterHistory);
    
    promptInput.addEventListener('input', autoResizeTextarea);
    
    document.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', function() {
        const theme = this.getAttribute('data-theme');
        currentSettings.theme = theme;
        applyTheme(theme);
        
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
    
    if (message.startsWith('/image') || message.startsWith('/generate')) {
      const imagePrompt = message.replace(/^\/image\s+|\/generate\s+/, '').trim();
      if (imagePrompt) {
        await generateImage(imagePrompt);
        promptInput.value = '';
        autoResizeTextarea();
        return;
      }
    }
    
    addMessage(message, 'user', attachedFiles);
    promptInput.value = '';
    autoResizeTextarea();
    
    showTypingIndicator();
    isProcessing = true;
    sendButton.disabled = true;
    
    try {
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
    
    addMessage(`Generate image: "${prompt}"`, 'user');
    
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
        addImageMessage(data.image_base64, prompt, data.timestamp);
        saveToHistory(`Generate image: "${prompt}"`, `![Generated Image](${data.image_base64})`);
      } else if (data.status === 'loading') {
        addMessage(`The image generation model is currently loading. Please try again in a few seconds.`, 'bot');
      } else {
        throw new Error(data.message || 'Image generation failed');
      }
      
    } catch (error) {
      console.error('Error generating image:', error);
      addMessage(`Sorry, I couldn't generate the image: ${error.message}`, 'bot');
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
            <h4>Generated Image</h4>
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
    
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.remove();
    }
    
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
    
    const downloadBtn = messageDiv.querySelector('.download-btn');
    const regenerateBtn = messageDiv.querySelector('.regenerate-image-btn');
    const copyBtn = messageDiv.querySelector('.copy-btn');
    
    downloadBtn.addEventListener('click', () => downloadImage(imageData, downloadBtn.dataset.filename));
    regenerateBtn.addEventListener('click', () => generateImage(prompt));
    copyBtn.addEventListener('click', () => copyToClipboard(prompt));
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
  
  function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }
      
      attachedFiles.push(file);
      addFileAttachment(file);
    });
    
    fileUpload.value = '';
  }
  
  function addFileAttachment(file) {
    const attachment = document.createElement('div');
    attachment.className = 'file-attachment';
    
    const fileIcon = getFileIcon(file.type);
    const fileSize = formatFileSize(file.size);
    
    attachment.innerHTML = `
      <div class="file-icon">${fileIcon}</div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${fileSize}</div>
      </div>
      <button class="remove-attachment" data-filename="${file.name}">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    fileAttachments.appendChild(attachment);
    
    const removeBtn = attachment.querySelector('.remove-attachment');
    removeBtn.addEventListener('click', () => {
      removeFileAttachment(file.name);
      attachment.remove();
    });
  }
  
  function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return '<i class="fas fa-image"></i>';
    if (fileType.includes('pdf')) return '<i class="fas fa-file-pdf"></i>';
    if (fileType.includes('text') || fileType.includes('txt')) return '<i class="fas fa-file-alt"></i>';
    if (fileType.includes('word') || fileType.includes('document')) return '<i class="fas fa-file-word"></i>';
    return '<i class="fas fa-file"></i>';
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function removeFileAttachment(filename) {
    attachedFiles = attachedFiles.filter(file => file.name !== filename);
  }
  
  function clearAttachments() {
    attachedFiles = [];
    fileAttachments.innerHTML = '';
  }
  
  function addMessage(content, sender, files = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const displayTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = generateId();
    messageDiv.dataset.messageId = messageId;
    
    let messageContent = '';
    
    if (sender === 'user') {
      messageContent = `
        <div class="message-content">
          <div class="message-bubble">
            ${content ? `<p>${escapeHtml(content)}</p>` : ''}
            ${files.length > 0 ? renderFileAttachments(files) : ''}
          </div>
          <div class="message-meta">
            <span class="message-time">${displayTime}</span>
            <div class="message-actions">
              <button class="message-action copy-btn" title="Copy message">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="message-avatar">
          <i class="fas fa-user"></i>
        </div>
      `;
    } else {
      const formattedContent = marked.parse(content);
      messageContent = `
        <div class="message-avatar">
          <img src="/static/Icon.gif" alt="AI Assistant">
        </div>
        <div class="message-content">
          <div class="message-bubble">
            ${formattedContent}
          </div>
          <div class="message-meta">
            <span class="message-time">${displayTime}</span>
            <div class="message-actions">
              <button class="message-action copy-btn" title="Copy message">
                <i class="fas fa-copy"></i>
              </button>
              <button class="message-action regenerate-btn" title="Regenerate response">
                <i class="fas fa-redo"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }
    
    messageDiv.innerHTML = messageContent;
    
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
      welcomeScreen.remove();
    }
    
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
    
    const copyBtn = messageDiv.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => {
      copyToClipboard(content);
      showToast('Message copied to clipboard!');
    });
    
    if (sender === 'bot') {
      const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
      regenerateBtn.addEventListener('click', () => {
        const lastUserMessage = getLastUserMessage();
        if (lastUserMessage) {
          promptInput.value = lastUserMessage;
          sendMessage();
        }
      });
      
      messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  }
  
  function renderFileAttachments(files) {
    let html = '<div class="attached-files">';
    files.forEach(file => {
      const fileIcon = getFileIcon(file.type);
      html += `
        <div class="attached-file">
          <div class="file-icon">${fileIcon}</div>
          <span>${file.name}</span>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }
  
  function getLastUserMessage() {
    const messages = document.querySelectorAll('.user-message');
    if (messages.length === 0) return '';
    
    const lastMessage = messages[messages.length - 1];
    return lastMessage.querySelector('.message-bubble p')?.textContent || '';
  }
  
  function showTypingIndicator() {
    typingIndicator.style.display = 'flex';
    scrollToBottom();
  }
  
  function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
  }
  
  function scrollToBottom() {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
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
  }
  
  function closeSettingsPanel() {
    settingsPanel.classList.remove('active');
    overlay.classList.remove('active');
  }
  
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    currentSettings.theme = newTheme;
    applyTheme(newTheme);
    saveSettings();
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
    const value = temperatureSlider.value;
    tempValue.textContent = value;
    currentSettings.temperature = parseFloat(value);
  }
  
  function updateConversationName() {
    const name = conversationName.value.trim() || 'New Conversation';
    currentSettings.conversationName = name;
    conversationTitle.textContent = name;
  }
  
  function saveSettings() {
    currentSettings.systemPrompt = systemPromptInput.value;
    localStorage.setItem('aiChatbotSettings', JSON.stringify(currentSettings));
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
    
    updateUIFromSettings();
    saveSettings();
    showToast('Settings reset to defaults');
  }
  
  function loadSettings() {
    const saved = localStorage.getItem('aiChatbotSettings');
    if (saved) {
      currentSettings = { ...currentSettings, ...JSON.parse(saved) };
    }
  }
  
  function updateUIFromSettings() {
    applyTheme(currentSettings.theme);
    temperatureSlider.value = currentSettings.temperature;
    tempValue.textContent = currentSettings.temperature;
    systemPromptInput.value = currentSettings.systemPrompt || '';
    conversationName.value = currentSettings.conversationName;
    conversationTitle.textContent = currentSettings.conversationName;
    
    document.querySelectorAll('.theme-option').forEach(option => {
      option.classList.remove('active');
      if (option.getAttribute('data-theme') === currentSettings.theme) {
        option.classList.add('active');
      }
    });
  }
  
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    const themeIcon = themeToggle.querySelector('i');
    if (theme === 'light') {
      themeIcon.className = 'fas fa-sun';
    } else {
      themeIcon.className = 'fas fa-moon';
    }
  }
  
  function startNewChat() {
    currentConversationId = generateId();
    currentSettings.conversationName = 'New Conversation';
    
    conversationTitle.textContent = 'New Conversation';
    conversationName.value = 'New Conversation';
    
    chatContainer.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-content">
          <div class="ai-avatar">
            <img src="/static/Icon.gif" alt="AI Assistant">
          </div>
          <h1>How can I help you today?</h1>
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
              <button class="quick-prompt" data-prompt="/image a beautiful sunset over mountains with a lake reflection">
                <i class="fas fa-image"></i>
                Generate Sunset Image
              </button>
              <button class="quick-prompt" data-prompt="What are the latest trends in artificial intelligence?">
                <i class="fas fa-chart-line"></i>
                AI Trends
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    clearAttachments();
    
    document.querySelectorAll('.quick-prompt').forEach(prompt => {
      prompt.addEventListener('click', () => {
        const promptText = prompt.getAttribute('data-prompt');
        promptInput.value = promptText;
        promptInput.focus();
        autoResizeTextarea();
      });
    });
    
    if (window.innerWidth <= 768) {
      closeAllPanels();
    }
  }
  
  function saveToHistory(userMessage, botResponse) {
    const history = getConversationHistory();
    const conversation = {
      id: currentConversationId,
      name: currentSettings.conversationName,
      timestamp: new Date().toISOString(),
      messages: [
        { role: 'user', content: userMessage },
        { role: 'bot', content: botResponse }
      ]
    };
    
    const existingIndex = history.findIndex(conv => conv.id === currentConversationId);
    if (existingIndex !== -1) {
      history[existingIndex].messages.push(
        { role: 'user', content: userMessage },
        { role: 'bot', content: botResponse }
      );
      history[existingIndex].timestamp = new Date().toISOString();
      history[existingIndex].name = currentSettings.conversationName;
    } else {
      history.unshift(conversation);
    }
    
    localStorage.setItem('aiChatbotHistory', JSON.stringify(history));
    loadConversationHistory();
  }
  
  function getConversationHistory() {
    const history = localStorage.getItem('aiChatbotHistory');
    return history ? JSON.parse(history) : [];
  }
  
  function loadConversationHistory() {
    const history = getConversationHistory();
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-history">
          <i class="fas fa-comments"></i>
          <p>No conversations yet</p>
        </div>
      `;
      return;
    }
    
    history.forEach(conversation => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.dataset.conversationId = conversation.id;
      
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      const preview = lastMessage && lastMessage.role === 'bot' 
        ? truncateText(lastMessage.content.replace(/<[^>]*>/g, ''), 50)
        : 'New conversation';
      
      const time = new Date(conversation.timestamp).toLocaleDateString();
      
      historyItem.innerHTML = `
        <div class="history-item-content">
          <div class="history-item-name">${conversation.name}</div>
          <div class="history-item-preview">${preview}</div>
          <div class="history-item-time">${time}</div>
        </div>
        <button class="history-item-delete" title="Delete conversation">
          <i class="fas fa-trash"></i>
        </button>
      `;
      
      historyList.appendChild(historyItem);
      
      historyItem.addEventListener('click', (e) => {
        if (!e.target.closest('.history-item-delete')) {
          loadConversation(conversation);
        }
      });
      
      const deleteBtn = historyItem.querySelector('.history-item-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conversation.id);
      });
    });
  }
  
  function loadConversation(conversation) {
    currentConversationId = conversation.id;
    currentSettings.conversationName = conversation.name;
    
    conversationTitle.textContent = conversation.name;
    conversationName.value = conversation.name;
    
    chatContainer.innerHTML = '';
    
    conversation.messages.forEach(message => {
      if (message.content.includes('![Generated Image]')) {
        const imageMatch = message.content.match(/!\[Generated Image\]\((.*?)\)/);
        if (imageMatch) {
          const imageData = imageMatch[1];
          const promptMatch = message.content.match(/Prompt: "(.*?)"/);
          const prompt = promptMatch ? promptMatch[1] : 'Generated image';
          addImageMessage(imageData, prompt, conversation.timestamp);
        }
      } else {
        addMessage(message.content, message.role);
      }
    });
    
    if (window.innerWidth <= 768) {
      closeAllPanels();
    }
  }
  
  function deleteConversation(conversationId) {
    const history = getConversationHistory();
    const filteredHistory = history.filter(conv => conv.id !== conversationId);
    localStorage.setItem('aiChatbotHistory', JSON.stringify(filteredHistory));
    loadConversationHistory();
    
    if (conversationId === currentConversationId) {
      startNewChat();
    }
    
    showToast('Conversation deleted');
  }
  
  function clearAllHistory() {
    if (confirm('Are you sure you want to clear all conversation history? This action cannot be undone.')) {
      localStorage.removeItem('aiChatbotHistory');
      loadConversationHistory();
      startNewChat();
      showToast('All history cleared');
    }
  }
  
  function filterHistory() {
    const searchTerm = searchInput.value.toLowerCase();
    const historyItems = document.querySelectorAll('.history-item');
    
    historyItems.forEach(item => {
      const name = item.querySelector('.history-item-name').textContent.toLowerCase();
      const preview = item.querySelector('.history-item-preview').textContent.toLowerCase();
      
      if (name.includes(searchTerm) || preview.includes(searchTerm)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }
  
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  window.showImageModal = function(imageData) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content">
        <button class="modal-close">
          <i class="fas fa-times"></i>
        </button>
        <img src="${imageData}" alt="Full size generated image">
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  };
});

document.addEventListener('fullscreenchange', function() {
  const fullscreenBtn = document.getElementById('fullscreen-toggle');
  const icon = fullscreenBtn.querySelector('i');
  
  if (document.fullscreenElement) {
    icon.className = 'fas fa-compress';
  } else {
    icon.className = 'fas fa-expand';
  }
});