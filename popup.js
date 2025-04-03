document.addEventListener("DOMContentLoaded", function () {
    // 获取DOM元素
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    const toggleViewBtn = document.getElementById("toggleViewBtn");
    const treeContainer = document.getElementById("treeContainer");
    const statusBar = document.getElementById("statusBar");
    const progressContainer = document.getElementById("progressContainer");
    const progressText = document.getElementById("progressText");
    const progressBar = document.getElementById("progressBar");

    // 应用状态变量
    let treeData = {};
    let currentRootId = '';
    let globalRootId = '';
    let nodeLevels = {};
    let showAllLevels = false;
    let maxTreeDepth = 0;

    // 初始化应用
    init();

    function init() {
        // 从storage加载数据
        chrome.storage.local.get(['treeData', 'currentRootId'], function(result) {
            if (result.treeData) {
                treeData = result.treeData;
                globalRootId = findRootNode();
                currentRootId = result.currentRootId || globalRootId;
                calculateAllLevels(globalRootId);
                renderTree(getCurrentRootId());
                updateStatusBar();
                
                // 监听数据更新
                chrome.runtime.onMessage.addListener((message) => {
                    if (message.action === "updateTreeData") {
                        handleDataUpdate(message);
                    }
                });
            } else {
                showError("无法加载树数据，请返回原页面重试");
            }
        });

        // 设置事件监听器
        setupEventListeners();
    }

    function handleDataUpdate(message) {
        treeData = message.tree;
        globalRootId = findRootNode();
        currentRootId = message.rootId || globalRootId;
        calculateAllLevels(globalRootId);
        renderTree(getCurrentRootId());
        updateStatusBar();
    }

    function updateStatusBar() {
        statusBar.textContent = `共 ${Object.keys(treeData).length} 个节点，最大深度 ${maxTreeDepth} 层`;
    }

    function setupEventListeners() {
        searchBtn.addEventListener("click", handleSearch);
        toggleViewBtn.addEventListener("click", toggleViewMode);
        searchInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") handleSearch();
        });
    }

    function handleSearch() {
        const accountId = searchInput.value.trim();
        if (!accountId) {
            renderTree(globalRootId);
            return;
        }
        if (!treeData[accountId]) {
            showError("未找到该账号");
            return;
        }
        renderTree(accountId);
    }

    function toggleViewMode() {
        showAllLevels = !showAllLevels;
        toggleViewBtn.textContent = showAllLevels ? '显示5层' : '显示全部层级';
        renderTree(getCurrentRootId());
    }

    function getCurrentRootId() {
        const searchValue = searchInput.value.trim();
        return (searchValue && treeData[searchValue]) ? searchValue : globalRootId;
    }

    // 树结构相关函数
    function findRootNode() {
        // 查找没有placement的节点作为根节点
        for (let key in treeData) {
            if (!treeData[key].placement) {
                return key;
            }
        }
        return Object.keys(treeData)[0] || '';
    }

    function calculateAllLevels(rootId) {
        nodeLevels = {};
        maxTreeDepth = 1;
        const queue = [{ id: rootId, level: 1 }];
        
        while (queue.length > 0) {
            const { id, level } = queue.shift();
            if (nodeLevels[id]) continue;
            
            nodeLevels[id] = level;
            maxTreeDepth = Math.max(maxTreeDepth, level);
            
            const children = Object.values(treeData).filter(n => n.placement === id);
            children.forEach(child => {
                queue.push({ id: child.id, level: level + 1 });
            });
        }
    }

    function renderTree(rootId) {
        if (!treeData[rootId]) {
            return showError("数据错误，无法找到根节点");
        }

        showLoadingProgress();
        
        // 异步渲染以避免阻塞UI
        setTimeout(() => {
            treeContainer.innerHTML = '<div class="tree" id="treeRoot"></div>';
            const container = document.getElementById('treeRoot');
            
            const { leftCounts, rightCounts } = calculateSubtreeCounts();
            const childCounts = calculateChildCounts();
            
            // 设置容器宽度
            const targetLevel = showAllLevels ? maxTreeDepth : 5;
            container.style.minWidth = `${calculateBottomWidth(targetLevel)}px`;
            
            // 开始渲染节点
            renderLevel([{...treeData[rootId]}], container, 0, leftCounts, rightCounts, childCounts);
            
            hideLoadingProgress();
        }, 50);
    }

    function showLoadingProgress() {
        progressContainer.style.display = 'block';
        progressText.textContent = '加载中: 0%';
        progressBar.style.width = '0%';
        
        // 模拟进度更新
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress > 90) {
                clearInterval(interval);
                return;
            }
            progressText.textContent = `加载中: ${progress}%`;
            progressBar.style.width = `${progress}%`;
        }, 50);
    }

    function hideLoadingProgress() {
        progressText.textContent = '完成!';
        progressBar.style.width = '100%';
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 500);
    }

    function calculateSubtreeCounts() {
        const leftCounts = {};
        const rightCounts = {};
        
        const countChildren = (nodeId) => {
            if (!leftCounts[nodeId] && !rightCounts[nodeId]) {
                leftCounts[nodeId] = 0;
                rightCounts[nodeId] = 0;
                
                const children = Object.values(treeData).filter(n => n.placement === nodeId);
                children.forEach(child => {
                    const childTotal = 1 + countChildren(child.id);
                    if (child.position === '左区') {
                        leftCounts[nodeId] += childTotal;
                    } else if (child.position === '右区') {
                        rightCounts[nodeId] += childTotal;
                    }
                });
            }
            return leftCounts[nodeId] + rightCounts[nodeId];
        };

        Object.keys(treeData).forEach(countChildren);
        return { leftCounts, rightCounts };
    }

    function calculateChildCounts() {
        const counts = {};
        
        const countChildren = (nodeId) => {
            if (!counts[nodeId]) {
                counts[nodeId] = 0;
                const children = Object.values(treeData).filter(n => n.placement === nodeId);
                if (children.length > 0) {
                    counts[nodeId] = 1;
                    children.forEach(child => {
                        const childDepth = countChildren(child.id);
                        counts[nodeId] = Math.max(counts[nodeId], childDepth + 1);
                    });
                }
            }
            return counts[nodeId];
        };

        Object.keys(treeData).forEach(countChildren);
        return counts;
    }

    function calculateBottomWidth(targetLevel) {
        const bottomNodes = Object.values(treeData).filter(node => {
            return nodeLevels[node.id] === targetLevel;
        });

        const NODE_WIDTH = showAllLevels ? 90 : 110;
        const MIN_GAP = showAllLevels ? 2 : 5;
        return (bottomNodes.length * NODE_WIDTH) + (Math.max(0, bottomNodes.length - 1) * MIN_GAP);
    }

    function renderLevel(nodes, parentEl, currentRenderLevel, leftCounts, rightCounts, childCounts) {
        const maxLevel = showAllLevels ? maxTreeDepth : 5;
        if (currentRenderLevel >= maxLevel) return;

        // 创建层级容器
        const levelContainer = document.createElement('div');
        levelContainer.className = `level-container level-${currentRenderLevel}`;
        
        // 节点容器
        const nodesContainer = document.createElement('div');
        nodesContainer.className = 'nodes-container';
        levelContainer.appendChild(nodesContainer);

        // 添加连接线容器
        if (currentRenderLevel > 0) {
            const connectorContainer = document.createElement('div');
            connectorContainer.className = 'connector-container';
            levelContainer.insertBefore(connectorContainer, nodesContainer);
        }

        parentEl.appendChild(levelContainer);

        // 排序节点
        const sortedNodes = sortNodes(nodes);

        // 渲染当前层级节点
        sortedNodes.forEach(node => {
            renderNode(node, nodesContainer, currentRenderLevel, leftCounts, rightCounts, childCounts);
        });

        // 延迟绘制连接线
        if (currentRenderLevel > 0) {
            setTimeout(() => drawConnectors(currentRenderLevel - 1, currentRenderLevel, levelContainer), 0);
        }

        // 递归渲染下一层级
        if (currentRenderLevel < maxLevel - 1) {
            const nextLevelNodes = [];
            sortedNodes.forEach(node => {
                const children = Object.values(treeData).filter(n => n.placement === node.id);
                nextLevelNodes.push(...children);
            });
            
            if (nextLevelNodes.length > 0) {
                renderLevel(nextLevelNodes, parentEl, currentRenderLevel + 1, leftCounts, rightCounts, childCounts);
            }
        }
    }

    function sortNodes(nodes) {
        const nodesByParent = {};
        const parentOrder = [];
        
        nodes.forEach(node => {
            const parentId = node.placement || 'root';
            if (!nodesByParent[parentId]) {
                nodesByParent[parentId] = [];
                parentOrder.push(parentId);
            }
            nodesByParent[parentId].push(node);
        });

        const sortedNodes = [];
        parentOrder.forEach(parentId => {
            const children = nodesByParent[parentId] || [];
            const leftNodes = children.filter(n => n.position === '左区');
            const rightNodes = children.filter(n => n.position === '右区');
            const otherNodes = children.filter(n => !n.position || (n.position !== '左区' && n.position !== '右区'));
            sortedNodes.push(...leftNodes, ...otherNodes, ...rightNodes);
        });

        return sortedNodes;
    }

    function renderNode(node, container, currentLevel, leftCounts, rightCounts, childCounts) {
        const nodeEl = document.createElement('div');
        nodeEl.className = `node ${node.position === '左区' ? 'left-node' : (node.position === '右区' ? 'right-node' : '')}`;
        
        const leftCount = leftCounts[node.id] || 0;
        const rightCount = rightCounts[node.id] || 0;

        nodeEl.innerHTML = `
        <div class="node-header">
            <span class="node-id">${node.numericId ? `#${node.numericId} ` : ''}${node.id}</span>
            <span class="node-level">L${nodeLevels[node.id] || '?'}</span>
        </div>
        <div class="node-position">${node.position || '根'} 
            ${node.position ? `<span style="color:rgb(0, 85, 255); font-size: 0.7em;">深(${childCounts[node.id] || 0}层)</span>` : ''}
        </div>
        <div class="node-details">
            <div><span>团队:</span><span>${node.performance || '0'}</span></div>
            <div><span>个人:</span><span>${node.personalPerformance || '0'}</span></div>
            <div><span>左区<span style="color: #27ae60">(${leftCount})</span>:</span><span>${node.leftPerformance || '0'}</span></div>
            <div><span>右区<span style="color: #e74c3c">(${rightCount})</span>:</span><span>${node.rightPerformance || '0'}</span></div>
        </div>
        <div class="node-relations">
            <div><span>推:</span><span>${
                node.recommender ? 
                `<a class="node-link recommender-link" data-id="${node.recommender}">${node.recommender}</a>` : 
                '<span class="no-relation">无</span>'
            }</span></div>
            <div><span>安:</span><span>${
                node.placement ? 
                `<a class="node-link placement-link" data-id="${node.placement}">${node.placement}</a>` : 
                '<span class="no-relation">无</span>'
            }</span></div>
        </div>
        `;
    
        container.appendChild(nodeEl);

        // 事件绑定
        nodeEl.addEventListener('click', (e) => {
            if (!e.target.classList.contains('node-link')) {
                renderTree(node.id);
                treeContainer.scrollTo(0, 0);
            }
        });

        nodeEl.querySelectorAll('.node-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = link.dataset.id;
                if (treeData[targetId]) {
                    renderTree(targetId);
                    treeContainer.scrollTo(0, 0);
                }
            });
        });
    }

    function drawConnectors(parentLevel, childLevel, container) {
        const connectors = container.querySelector('.connector-container');
        if (!connectors) return;
        
        connectors.innerHTML = '';
        
        const parentNodes = Array.from(container.parentElement.querySelectorAll(`.level-${parentLevel} .node`));
        const childNodes = Array.from(container.querySelectorAll(`.level-${childLevel} .node`));
        
        childNodes.forEach(childNode => {
            const placementLink = childNode.querySelector('.placement-link');
            if (!placementLink) return;
            
            const parentNode = parentNodes.find(node => 
                node.querySelector('.node-id').textContent.includes(placementLink.dataset.id)
            );
            
            if (parentNode) {
                const line = document.createElement('div');
                line.className = `connection-line ${
                    childNode.classList.contains('left-node') ? 'left-connection' : 'right-connection'
                }`;
                
                const parentRect = parentNode.getBoundingClientRect();
                const childRect = childNode.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                const startX = parentRect.left + parentRect.width/2 - containerRect.left;
                const startY = parentRect.bottom - containerRect.top;
                const endX = childRect.left + childRect.width/2 - containerRect.left;
                const endY = childRect.top - containerRect.top;
                
                const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
                
                line.style.width = `${length}px`;
                line.style.left = `${startX}px`;
                line.style.top = `${startY}px`;
                line.style.transform = `rotate(${angle}deg)`;
                
                connectors.appendChild(line);
            }
        });
    }

    function showError(message) {
        treeContainer.innerHTML = `
          <div class="error">
            <h3>操作失败</h3>
            <p>${message}</p>
          </div>
        `;
    }
});