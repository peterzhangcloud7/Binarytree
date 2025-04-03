// 存储当前树数据
let currentTreeData = {};
let currentRootId = '';

// 监听来自content script的数据更新
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateTreeData") {
        currentTreeData = message.tree;
        currentRootId = message.rootId;
        
        // 更新storage
        chrome.storage.local.set({
            treeData: currentTreeData,
            currentRootId: currentRootId
        });
    }
});

// 点击图标时打开popup
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // 如果已有数据，直接打开popup
        if (Object.keys(currentTreeData).length > 0) {
            chrome.tabs.create({
                url: chrome.runtime.getURL('popup.html')
            });
            return;
        }
        
        // 否则请求数据
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getTreeData" });
        
        if (!response?.tree) {
            throw new Error('无效的树数据');
        }

        await chrome.storage.local.set({
            treeData: response.tree,
            currentRootId: response.rootId || Object.keys(response.tree).find(key => !response.tree[key].placement)
        });

        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    } catch (error) {
        console.error('扩展操作失败:', error);
    }
});