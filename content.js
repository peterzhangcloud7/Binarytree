console.log('内容脚本已注入');

// 单例模式管理进度条
let progressInstance = null;

function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
        const rows = document.querySelectorAll('.row');
        if (rows.length > 0) {
            observer.disconnect();
            sendTreeData();
            addExpandAllButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 创建带层数统计的进度显示元素（单例）
function getProgressInstance() {
    if (!progressInstance) {
        const progressContainer = document.createElement('div');
        progressContainer.id = 'expand-progress-container';
        progressContainer.style.position = 'fixed';
        progressContainer.style.top = '20px';
        progressContainer.style.right = '20px';
        progressContainer.style.zIndex = '9999';
        progressContainer.style.backgroundColor = 'white';
        progressContainer.style.padding = '15px';
        progressContainer.style.borderRadius = '4px';
        progressContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        progressContainer.style.display = 'none';
        progressContainer.style.width = '250px';
        
        // 进度标题
        const progressTitle = document.createElement('div');
        progressTitle.style.fontWeight = 'bold';
        progressTitle.style.marginBottom = '10px';
        progressTitle.textContent = '节点展开进度';
        
        // 进度条
        const progressBarContainer = document.createElement('div');
        progressBarContainer.style.marginBottom = '10px';
        
        const progressBar = document.createElement('div');
        progressBar.style.width = '100%';
        progressBar.style.height = '8px';
        progressBar.style.backgroundColor = '#f0f0f0';
        progressBar.style.borderRadius = '4px';
        progressBar.style.overflow = 'hidden';
        
        const progressBarInner = document.createElement('div');
        progressBarInner.style.height = '100%';
        progressBarInner.style.width = '0%';
        progressBarInner.style.backgroundColor = '#1890ff';
        progressBarInner.style.transition = 'width 0.3s';
        
        progressBar.appendChild(progressBarInner);
        progressBarContainer.appendChild(progressBar);
        
        // 进度文本
        const progressText = document.createElement('div');
        progressText.style.marginBottom = '10px';
        progressText.style.fontSize = '14px';
        
        // 层数统计
        const levelStats = document.createElement('div');
        levelStats.id = 'level-stats';
        levelStats.style.fontSize = '13px';
        levelStats.style.color = '#666';
        
        progressContainer.appendChild(progressTitle);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBarContainer);
        progressContainer.appendChild(levelStats);
        
        document.body.appendChild(progressContainer);
        
        progressInstance = {
            container: progressContainer,
            text: progressText,
            bar: progressBarInner,
            stats: levelStats
        };
    }
    return progressInstance;
}

// 更可靠的层级计算
function getNodeLevel(nodeElement) {
    let level = 0;
    let currentElement = nodeElement.parentElement;
    
    while (currentElement) {
        if (currentElement.classList.contains('ant-spin-nested-loading')) {
            level++;
            currentElement = currentElement.parentElement;
        } else if (currentElement.classList.contains('ant-spin-container')) {
            currentElement = currentElement.parentElement;
        } else {
            break;
        }
    }
    
    return Math.max(0, level - 1); // 减去根层级
}


 

// 改进的展开所有节点函数
function addExpandAllButton() {
    const searchWrapper = document.querySelector('.table-page-search-wrapper');
    if (!searchWrapper) return;
    
    const queryButtonCol = searchWrapper.querySelector('.ant-col-md-3');
    if (!queryButtonCol) return;
    
    // 防止重复添加按钮
    if (queryButtonCol.querySelector('.expand-all-button')) return;
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'ant-col ant-col-sm-24 ant-col-md-6';
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.alignItems = 'center';
    buttonsContainer.style.gap = '8px';
    buttonsContainer.style.paddingLeft = '24px';
    buttonsContainer.style.paddingRight = '24px';
    
    const queryButton = queryButtonCol.querySelector('.ant-btn-primary');
    if (!queryButton) return;
    
    // 创建展开单层按钮
    const expandSingleButton = queryButton.cloneNode(true);
    expandSingleButton.classList.add('expand-all-button');
    expandSingleButton.innerHTML = '<span>展开单层节点</span>';
    
    // 创建展开所有层按钮
    const expandAllButton = queryButton.cloneNode(true);
    expandAllButton.classList.add('expand-all-layers-button');
    expandAllButton.innerHTML = '<span>展开所有层节点</span>';
    
    // 创建查看网络图按钮
    const viewNetworkButton = queryButton.cloneNode(true);
    viewNetworkButton.classList.add('view-network-button');
    viewNetworkButton.innerHTML = '<span>查看网络图</span>';
    viewNetworkButton.style.backgroundColor = '#27ae60'; // 绿色按钮
    
    const newQueryButton = queryButton.cloneNode(true);
    queryButton.parentNode.replaceChild(newQueryButton, queryButton);
    
    buttonsContainer.appendChild(newQueryButton);
    buttonsContainer.appendChild(expandSingleButton);
    buttonsContainer.appendChild(expandAllButton);
    buttonsContainer.appendChild(viewNetworkButton);
    queryButtonCol.parentNode.replaceChild(buttonsContainer, queryButtonCol);
    // 使用单例进度条
    const progress = getProgressInstance();
    
    // 展开单层节点的事件监听器  
    expandSingleButton.addEventListener('click', async function() {
        const collapsedIcons = document.querySelectorAll('.row-item i.anticon-right');
        if (collapsedIcons.length === 0) {
            alert('所有节点已展开');
            return;
        }
        
        if (expandSingleButton.disabled) return;
        expandSingleButton.disabled = true;
        
        progress.container.style.display = 'block';
        progress.text.textContent = `正在展开节点: 0/${collapsedIcons.length} (0%)`;
        progress.bar.style.width = '0%';
        progress.stats.innerHTML = '';
        
        const levelCounts = {};
        let processed = 0;
        
        const processBatch = async (startIndex) => {
            const endIndex = Math.min(startIndex + 3, collapsedIcons.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const icon = collapsedIcons[i];
                const rowItem = icon.closest('.row-item');
                const level = getNodeLevel(rowItem);
                
                icon.click();
                
                levelCounts[level] = (levelCounts[level] || 0) + 1;
                processed++;
                
                const percent = Math.round((processed / collapsedIcons.length) * 100);
                progress.text.textContent = `正在展开节点: ${processed}/${collapsedIcons.length} (${percent}%)`;
                progress.bar.style.width = `${percent}%`;
                                
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            
            if (endIndex < collapsedIcons.length) {
                requestAnimationFrame(() => processBatch(endIndex));
            } else {
                progress.text.innerHTML = `<span style="color:#52c41a;">✓ 已完成 ${collapsedIcons.length} 个节点的展开</span>`;
                expandSingleButton.disabled = false;
                
                setTimeout(() => {
                    progress.container.style.display = 'none';
                }, 3000);
            }
        };
        
        processBatch(0);
    });
    
    // 展开所有层节点的事件监听器 (新功能)
    expandAllButton.addEventListener('click', async function() {
        if (expandAllButton.disabled) return;
        expandAllButton.disabled = true;
        
        // 初始化进度条
        progress.container.style.display = 'block';
        progress.text.textContent = '正在扫描所有可展开节点...';
        progress.bar.style.width = '0%';
        progress.stats.innerHTML = '';
        
        let totalProcessed = 0;
        let currentLevel = 0;
        const levelCounts = {};
        
        // 递归展开所有层级
        const expandAllLevels = async () => {
            const collapsedIcons = document.querySelectorAll('.row-item i.anticon-right');
            
            if (collapsedIcons.length === 0) {
                progress.text.innerHTML = `<span style="color:#52c41a;">✓ 已完成所有层级节点的展开</span>`;
                expandAllButton.disabled = false;
                
                setTimeout(() => {
                    progress.container.style.display = 'none';
                }, 3000);
                return;
            }
            
            progress.text.textContent = `正在展开第 ${currentLevel + 1} 层节点: ${collapsedIcons.length} 个`;
            
            let processed = 0;
            const totalToProcess = collapsedIcons.length;
            
            // 处理当前层级的节点
            const processBatch = async (startIndex) => {
                const endIndex = Math.min(startIndex + 3, totalToProcess);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const icon = collapsedIcons[i];
                    const rowItem = icon.closest('.row-item');
                    const level = getNodeLevel(rowItem);
                    
                    icon.click();
                    
                    levelCounts[level] = (levelCounts[level] || 0) + 1;
                    processed++;
                    totalProcessed++;
                    
                    const percent = Math.round((processed / totalToProcess) * 100);
                    progress.text.textContent = `正在展开第 ${currentLevel + 1} 层节点: ${processed}/${totalToProcess} (${percent}%)`;
                    progress.bar.style.width = `${percent}%`;
                    
                    await new Promise(resolve => setTimeout(resolve, 30));
                }
                
                if (endIndex < totalToProcess) {
                    requestAnimationFrame(() => processBatch(endIndex));
                } else {
                    // 当前层级处理完成，等待DOM更新后处理下一层级
                    currentLevel++;
                    setTimeout(() => {
                        requestAnimationFrame(expandAllLevels);
                    }, 500);
                }
            };
            
            processBatch(0);
        };
        
        expandAllLevels();
    });
}

 
// 发送树数据到background
function sendTreeData() {
    const flatData = {};
    const rows = document.querySelectorAll('.row');
    
    if (rows.length === 0) {
        console.warn('未找到任何数据行');
        return;
    }
    
    rows.forEach(row => parseRow(row, flatData));
    
    const tree = buildTreeByPlacement(flatData);
    if (!tree.rootId) {
        console.warn('无法确定根节点');
        return;
    }
    
    chrome.runtime.sendMessage({
        action: "updateTreeData",
        tree: flatData,
        rootId: tree.rootId
    });
}

// 初始解析行数据函数
function parseRow(rowElement, treeData) {
    const rowItem = rowElement.querySelector('.row-item');
    if (!rowItem) return;

    const text = rowItem.textContent.replace(/<svg[^>]*>.*?<\/svg>/g, '').replace(/\s+/g, ' ').trim();
    
    const idMatch = text.match(/#(\d+)\s*\|\s*账号：(\S+)/) || 
                   text.match(/#(\d+).*?账号[:：]\s*(\S+)/) ||
                   text.match(/(\d+)\s*\|\s*ID[:：]\s*(\S+)/i);
    
    if (!idMatch) return;
    
    const numericId = idMatch[1];
    const accountId = idMatch[2];

    treeData[accountId] = {
        id: accountId,
        numericId: numericId,
        placement: extractValue(text, /安置人：(\S+)/) || null,
        recommender: extractValue(text, /推荐人 (\S+)/) || null,
        position: extractValue(text, /(左区|右区)/) || null,
        performance: extractValue(text, /团队业绩：([\d.]+)/) || '0',
        personalPerformance: extractValue(text, /个人业绩：([\d.]+)/) || '0',
        leftPerformance: extractValue(text, /左区业绩：([\d.]+)/) || '0',
        rightPerformance: extractValue(text, /右区业绩：([\d.]+)/) || '0',
        newThisMonth: extractValue(text, /本月新增：([\d.]+)/) || '0',
        level: parseInt(extractValue(text, /(\d+)层/)) || 0,  // 这里使用从文本中提取的层级
        children: []
    };
}

// 构建树结构函数
function buildTreeByPlacement(flatData) {
    const treeMap = {};
    let rootId = null;

    Object.values(flatData).forEach(node => {
        treeMap[node.id] = { ...node };
    });

    Object.values(treeMap).forEach(node => {
        if (node.placement && treeMap[node.placement]) {
            treeMap[node.placement].children.push(node.id);
            
            if (node.position === '左区') {
                treeMap[node.placement].leftChild = node.id;
            } else if (node.position === '右区') {
                treeMap[node.placement].rightChild = node.id;
            }
        } else if (!rootId) {
            rootId = node.id;
        }
    });

    return { rootId, tree: treeMap };
}

// 提取值函数
function extractValue(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

// 监听页面变化，当数据加载时自动发送
observeDOMChanges();

// 同时保留原有的消息监听器，以便手动触发
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getTreeData") {
        const flatData = {};
        const rows = document.querySelectorAll('.row');
        
        if (rows.length === 0) {
            sendResponse({ status: "error", message: "未找到任何数据行" });
            return;
        }
        
        rows.forEach(row => parseRow(row, flatData));
        
        const tree = buildTreeByPlacement(flatData);
        if (!tree.rootId) {
            sendResponse({ status: "error", message: "无法确定根节点" });
            return;
        }
        
        sendResponse({
            status: "success",
            tree: flatData,
            rootId: tree.rootId
        });
    }
    return true;
});