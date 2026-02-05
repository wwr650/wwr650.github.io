class NavigationApp {
    constructor() {
        this.config = null;
        this.websites = [];
        this.categories = [];
        this.filteredWebsites = [];
        this.currentCategory = 'all'; // 默认显示全部网站
        this.currentSearch = '';
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.renderCategories();
        
        // 默认显示所有网站
        this.filterAndRenderWebsites();
        
        this.updateSiteCount();
        this.setCurrentYear();
    }

    async loadConfig() {
        try {
            const response = await fetch('web.yaml');
            const yamlText = await response.text();
            this.config = this.parseYAML(yamlText);
            this.websites = this.config.websites || [];
            this.categories = this.config.categories || [];
            
            // 更新页面标题和描述
            if (this.config.settings) {
                document.title = this.config.settings.title || document.title;
                document.getElementById('siteTitle').textContent = this.config.settings.title || '个人导航页';
                document.getElementById('siteDescription').textContent = this.config.settings.description || '我的常用网站集合';
                
                // 更新作者链接
                if (this.config.settings.author) {
                    const authorLink = document.getElementById('authorLink');
                    authorLink.textContent = this.config.settings.author;
                }
            }
            
            console.log('配置加载成功:', {
                网站数量: this.websites.length,
                分类数量: this.categories.length,
                网站列表: this.websites
            });
        } catch (error) {
            console.error('加载配置文件失败:', error);
            this.showError('无法加载导航配置，请检查 web.yaml 文件');
        }
    }

    parseYAML(yamlText) {
        // 简化的 YAML 解析器
        const lines = yamlText.split('\n');
        const result = {};
        let currentSection = null;
        let currentObject = null;
        let inArray = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            // 跳过空行和注释
            if (line === '' || line.startsWith('#')) continue;
            
            // 处理章节
            if (line.endsWith(':')) {
                const section = line.slice(0, -1).trim();
                currentSection = section;
                result[section] = [];
                inArray = true;
                continue;
            }
            
            // 处理数组项
            if (line.startsWith('- ')) {
                line = line.substring(2).trim();
                if (line.includes(':')) {
                    currentObject = this.parseObject(line);
                    if (currentObject) {
                        result[currentSection].push(currentObject);
                    }
                }
            }
            
            // 处理嵌套属性
            else if (line.includes(': ') && currentObject) {
                const [key, value] = this.parseKeyValue(line);
                currentObject[key] = this.cleanValue(value);
            }
        }
        
        return result;
    }

    parseObject(line) {
        const obj = {};
        
        // 按逗号分割，但要注意不要分割描述中的逗号
        const regex = /(\w+):\s*([^,]+)(?:,\s*|$)/g;
        let match;
        
        while ((match = regex.exec(line)) !== null) {
            const key = match[1].trim();
            let value = match[2].trim();
            
            // 如果值以引号开始，需要继续读取直到找到匹配的结束引号
            if (value.startsWith('"') && !value.endsWith('"')) {
                // 处理多行字符串
                value = this.readMultiLineValue(line.substring(match.index + key.length + 2));
            }
            
            obj[key] = this.cleanValue(value);
        }
        
        return Object.keys(obj).length > 0 ? obj : null;
    }

    readMultiLineValue(startText) {
        // 简化处理，直接返回原始文本
        return startText;
    }

    parseKeyValue(line) {
        const colonIndex = line.indexOf(':');
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        return [key, value];
    }

    cleanValue(value) {
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length - 1);
        }
        return value;
    }

    setupEventListeners() {
        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', (e) => {
            this.currentSearch = e.target.value.trim().toLowerCase();
            this.filterAndRenderWebsites();
            
            // 显示/隐藏清除按钮
            if (this.currentSearch) {
                clearSearch.style.display = 'block';
            } else {
                clearSearch.style.display = 'none';
            }
        });
        
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            this.currentSearch = '';
            clearSearch.style.display = 'none';
            this.filterAndRenderWebsites();
            searchInput.focus();
        });
        
        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
        
        // 加载保存的主题
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K 聚焦搜索框
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
            
            // ESC 清除搜索
            if (e.key === 'Escape' && this.currentSearch) {
                searchInput.value = '';
                this.currentSearch = '';
                clearSearch.style.display = 'none';
                this.filterAndRenderWebsites();
            }
        });
    }

    renderCategories() {
        const container = document.getElementById('categoryNav');
        
        // 清空容器
        container.innerHTML = '';
        
        // 创建"全部网站"按钮
        const allButton = document.createElement('button');
        allButton.className = 'category-btn active';
        allButton.dataset.category = 'all';
        allButton.textContent = '🌐 全部网站';
        
        allButton.addEventListener('click', () => {
            // 更新活动按钮
            document.querySelectorAll('.category-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            allButton.classList.add('active');
            
            // 更新当前分类
            this.currentCategory = 'all';
            this.filterAndRenderWebsites();
        });
        
        container.appendChild(allButton);
        
        // 创建其他分类按钮
        this.categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-btn';
            button.dataset.category = category.id;
            button.innerHTML = `${category.icon || '📁'} ${category.name}`;
            
            button.addEventListener('click', () => {
                // 更新活动按钮
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                
                // 更新当前分类
                this.currentCategory = category.id;
                this.filterAndRenderWebsites();
            });
            
            container.appendChild(button);
        });
    }

    filterAndRenderWebsites() {
        console.log('筛选条件:', {
            当前分类: this.currentCategory,
            搜索词: this.currentSearch,
            网站总数: this.websites.length
        });
        
        // 如果当前分类是"all"，显示所有网站
        if (this.currentCategory === 'all') {
            this.filteredWebsites = this.websites.filter(website => {
                // 只按搜索词过滤
                return !this.currentSearch || 
                    website.name.toLowerCase().includes(this.currentSearch) ||
                    (website.description && website.description.toLowerCase().includes(this.currentSearch));
            });
        } else {
            // 否则按分类和搜索词过滤
            this.filteredWebsites = this.websites.filter(website => {
                const categoryMatch = website.category === this.currentCategory;
                const searchMatch = !this.currentSearch || 
                    website.name.toLowerCase().includes(this.currentSearch) ||
                    (website.description && website.description.toLowerCase().includes(this.currentSearch));
                
                return categoryMatch && searchMatch;
            });
        }
        
        console.log('筛选结果:', this.filteredWebsites.length, '个网站');
        this.renderWebsites();
        this.updateSearchHint();
    }

    renderWebsites() {
        const container = document.getElementById('websitesGrid');
        const emptyState = document.getElementById('emptyState');
        
        container.innerHTML = '';
        
        if (this.filteredWebsites.length === 0) {
            emptyState.style.display = 'block';
            container.style.display = 'none';
            return;
        }
        
        emptyState.style.display = 'none';
        container.style.display = 'grid';
        
        this.filteredWebsites.forEach((website, index) => {
            // 查找分类信息
            const categoryInfo = this.categories.find(cat => cat.id === website.category) || { name: website.category };
            
            const card = document.createElement('a');
            card.className = 'website-card';
            card.href = website.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.style.animationDelay = `${index * 0.05}s`;
            
            // 处理图标路径
            let iconUrl = website.icon || 'icons/default.png';
            
            card.innerHTML = `
                <img src="${iconUrl}" alt="${website.name}" class="website-icon" 
                     onerror="this.onerror=null; this.src='icons/default.png'">
                <h3 class="website-name">${website.name}</h3>
                <p class="website-description">${website.description || ''}</p>
                <span class="website-category">${categoryInfo.name}</span>
            `;
            
            container.appendChild(card);
        });
    }

    updateSearchHint() {
        const hintElement = document.getElementById('searchHint');
        if (this.currentSearch) {
            hintElement.textContent = `找到 ${this.filteredWebsites.length} 个匹配的网站`;
        } else {
            hintElement.textContent = `共 ${this.filteredWebsites.length} 个网站`;
        }
    }

    updateSiteCount() {
        document.getElementById('siteCount').textContent = this.websites.length;
    }

    setCurrentYear() {
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }

    showError(message) {
        const container = document.getElementById('websitesGrid');
        container.innerHTML = `
            <div class="error-message" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>加载失败</h3>
                <p>${message}</p>
                <p>请检查控制台查看详细错误信息</p>
            </div>
        `;
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new NavigationApp();
});