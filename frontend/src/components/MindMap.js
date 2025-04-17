import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { createApiPath } from '../config';
import './MindMap.css';

const NODE_TYPES = {
  PERFORMANCE: '性能优化',
  FEATURE: '功能实现',
  REFACTOR: '代码重构',
  BUGFIX: 'bug修复'
};

const MindMap = ({ mindmapId, projectId = 'gameA', currentUser, mindmapRef, handleClickOutside }) => {
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);
    const [showNodeModal, setShowNodeModal] = useState(false);
    const [newNodeText, setNewNodeText] = useState('');
    const [parentId, setParentId] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [nodeToDelete, setNodeToDelete] = useState(null);
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [showLegend, setShowLegend] = useState(false);
    const [editedNodeName, setEditedNodeName] = useState('');
    const [editedNodeDetails, setEditedNodeDetails] = useState('');
    const [newNodeType, setNewNodeType] = useState('FEATURE');
    const [newNodeIsCategory, setNewNodeIsCategory] = useState(false);
    const [newNodeAmount, setNewNodeAmount] = useState(0);
    const [mindmapData, setMindmapData] = useState(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    
    // 评论相关状态
    const [newComment, setNewComment] = useState('');
    const [showCommentSection, setShowCommentSection] = useState(false);
    
    // 捐赠相关状态
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [donationAmount, setDonationAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('alipay');
    const [donationPeriod, setDonationPeriod] = useState(30); // 默认一个月(30天)
    
    // 拖拽排序相关状态
    const [draggedNode, setDraggedNode] = useState(null);
    const [dragOverNode, setDragOverNode] = useState(null);
    
    // 提交节点相关状态
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [giteeUsername, setGiteeUsername] = useState('');
    const [changeDescription, setChangeDescription] = useState('');
    
    // 用户支持节点记录
    const [supportedNodes, setSupportedNodes] = useState(() => {
        const saved = localStorage.getItem('supportedNodes');
        return saved ? JSON.parse(saved) : [];
    });
    
    const nodeDetailsRef = useRef(null);
    
    // 获取cookie
    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    };
    
    // 设置cookie
    const setCookie = (name, value, days = 365) => {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
    };
    
    useEffect(() => {
        if (mindmapId) {
            loadMindMap();
        }
    }, [mindmapId, projectId]);

    // 节点折叠状态变化时保存到cookie
    useEffect(() => {
        if (collapsedNodes.size > 0 && mindmapId) {
            const collapsedNodesArray = Array.from(collapsedNodes);
            setCookie(`${projectId}_${mindmapId}_collapsedNodes`, JSON.stringify(collapsedNodesArray));
        }
    }, [collapsedNodes, mindmapId, projectId]);

    useEffect(() => {
        if (selectedNode) {
            setEditedNodeName(selectedNode.text);
            setEditedNodeDetails(selectedNode.details || '');
            setShowCommentSection(true);
        } else {
            setShowCommentSection(false);
        }
    }, [selectedNode, currentUser]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'h' || e.key === 'H') {
                setShowLegend(true);
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'h' || e.key === 'H') {
                setShowLegend(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // 处理shift+滚轮横向滚动
    useEffect(() => {
        const handleWheel = (e) => {
            if (e.shiftKey) {
                e.preventDefault();
                if (mindmapRef.current) {
                    mindmapRef.current.scrollLeft += e.deltaY;
                }
            }
        };

        const mindmapElement = mindmapRef.current;
        if (mindmapElement) {
            mindmapElement.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            if (mindmapElement) {
                mindmapElement.removeEventListener('wheel', handleWheel);
            }
        };
    }, []);

    useEffect(() => {
        const oldHandleClickOutside = handleClickOutside;
        
        // 重新定义传入的handleClickOutside函数
        if (typeof handleClickOutside === 'function') {
            handleClickOutside = (e) => {
                // 如果点击在节点详情面板内，不要取消选中
                if (nodeDetailsRef.current && nodeDetailsRef.current.contains(e.target)) {
                    return;
                }

                if (mindmapRef.current && mindmapRef.current.contains(e.target)) {
                    // 如果点击在思维导图区域内但不是节点，取消选中
                    if (!e.target.closest('.node')) {
                        setSelectedNode(null);
                    }
                }
                
                // 调用原始的handleClickOutside
                if (oldHandleClickOutside) {
                    oldHandleClickOutside(e);
                }
            };
        }
    }, [handleClickOutside, mindmapRef]);

    const loadMindMap = async () => {
        try {
            const response = await axios.get(createApiPath(`api/projects/${projectId}/mindmaps/${mindmapId}`));
            setNodes(response.data.nodes || []);
            setMindmapData(response.data);
            
            // 检查导图是否为只读
            if (response.data.isReadOnly) {
                setIsReadOnly(true);
            } else {
                setIsReadOnly(false);
            }
            
            // 从cookie读取折叠状态
            const savedCollapsedNodes = getCookie(`${projectId}_${mindmapId}_collapsedNodes`);
            if (savedCollapsedNodes) {
                try {
                    const parsedCollapsedNodes = JSON.parse(savedCollapsedNodes);
                    setCollapsedNodes(new Set(parsedCollapsedNodes));
                } catch (e) {
                    console.error('Failed to parse collapsed nodes cookie:', e);
                }
            }
            
            setLoading(false);
        } catch (error) {
            console.error('Failed to load mindmap:', error);
            setLoading(false);
        }
    };

    const saveMindMap = async () => {
        try {
            // 保留现有的mindmapData，只更新节点内容
            const dataToSave = {
                ...(mindmapData || {}),
                nodes
            };
            
            await axios.post(createApiPath(`api/projects/${projectId}/mindmaps/${mindmapId}`), dataToSave);
            console.log('Mindmap saved successfully');
        } catch (error) {
            console.error('Failed to save mindmap:', error);
        }
    };

    useEffect(() => {
        if (nodes.length > 0) {
            saveMindMap();
        }
    }, [nodes]);

    const addNode = (parentId, text) => {
        if (!canEditMindmap()) {
            alert('您没有权限在此导图中创建节点');
            return;
        }

        const newNode = {
            id: Date.now().toString(),
            text,
            children: [],
            createdAt: new Date().toISOString(),
            createdBy: currentUser.userId,
            creatorName: currentUser?.username || '未知用户',
            details: '',
            isCategory: newNodeIsCategory,
            supporters: {}, // 初始化空的支持者列表
            comments: [], // 初始化评论列表
            supportCount: 0 // 初始化支持者数量
        };

        // 只有非分类节点才添加这些属性
        if (!newNodeIsCategory) {
            newNode.amount = parseFloat(newNodeAmount) || 0;
            newNode.type = newNodeType;
        }

        if (!parentId) {
            setNodes([...nodes, newNode]);
        } else {
            const updateNode = (nodeList) => {
                return nodeList.map(node => {
                    if (node.id === parentId) {
                        return {
                            ...node,
                            children: [...node.children, newNode]
                        };
                    }
                    if (node.children) {
                        return {
                            ...node,
                            children: updateNode(node.children)
                        };
                    }
                    return node;
                });
            };

            setNodes(updateNode(nodes));
        }
    };

    const deleteNode = (nodeId) => {
        if (!canEditMindmap()) {
            alert('您没有权限删除节点');
            return;
        }
        
        const deleteNodeRecursive = (nodeList) => {
            return nodeList.filter(node => {
                if (node.id === nodeId) {
                    return false;
                }
                if (node.children) {
                    node.children = deleteNodeRecursive(node.children);
                }
                return true;
            });
        };

        setNodes(deleteNodeRecursive(nodes));
    };

    const updateNode = (nodeId, updates) => {
        if (!canEditMindmap()) {
            alert('您没有权限更新节点');
            return;
        }
        
        const updateNodeRecursive = (nodeList) => {
            return nodeList.map(node => {
                if (node.id === nodeId) {
                    return { ...node, ...updates };
                }
                if (node.children) {
                    return {
                        ...node,
                        children: updateNodeRecursive(node.children)
                    };
                }
                return node;
            });
        };

        setNodes(updateNodeRecursive(nodes));
    };

    const saveNodeChanges = () => {
        if (selectedNode) {
            updateNode(selectedNode.id, {
                text: editedNodeName,
                details: editedNodeDetails
            });
            setSelectedNode({
                ...selectedNode,
                text: editedNodeName,
                details: editedNodeDetails
            });
        }
    };
    
    // 提交节点到投票中
    const submitNodeToVoting = async () => {
        if (!selectedNode) return;
        if (!giteeUsername.trim()) {
            alert('请输入Gitee昵称');
            return;
        }
        
        try {
            // 获取当前投票节点数据
            const response = await axios.get(createApiPath(`api/projects/${projectId}/onVoting.json`));
            const votingData = response.data || { nodes: [] };
            
            // 添加节点到投票中
            const nodeToSubmit = {
                ...selectedNode,
                submittedBy: giteeUsername,
                submittedAt: new Date().toISOString(),
                description: changeDescription,
                upvotes: [],
                downvotes: [],
                comments: []
            };
            
            votingData.nodes.push(nodeToSubmit);
            
            // 保存数据
            await axios.post(createApiPath(`api/projects/${projectId}/onVoting.json`), votingData);
            
            alert('节点已成功提交到投票中');
            setShowSubmitModal(false);
            setGiteeUsername('');
            setChangeDescription('');
        } catch (error) {
            console.error('提交节点失败:', error);
            alert('提交节点失败');
        }
    };
    
    // 支持节点
    const supportNode = (nodeId) => {
        if (!currentUser) return;
        
        // 检查用户是否已经支持过该节点
        if (supportedNodes.includes(nodeId)) {
            return;
        }
        
        // 更新节点的支持者数量
        const updateNodeRecursive = (nodeList) => {
            return nodeList.map(node => {
                if (node.id === nodeId) {
                    return { 
                        ...node, 
                        supportCount: (node.supportCount || 0) + 1 
                    };
                }
                if (node.children) {
                    return {
                        ...node,
                        children: updateNodeRecursive(node.children)
                    };
                }
                return node;
            });
        };
        
        setNodes(updateNodeRecursive(nodes));
        
        // 更新已支持节点列表
        const updatedSupportedNodes = [...supportedNodes, nodeId];
        setSupportedNodes(updatedSupportedNodes);
        localStorage.setItem('supportedNodes', JSON.stringify(updatedSupportedNodes));
        
        // 如果当前选中的是该节点，更新选中节点的状态
        if (selectedNode && selectedNode.id === nodeId) {
            setSelectedNode({
                ...selectedNode,
                supportCount: (selectedNode.supportCount || 0) + 1
            });
        }
    };

    const toggleCollapse = (nodeId) => {
        const newCollapsed = new Set(collapsedNodes);
        if (newCollapsed.has(nodeId)) {
            newCollapsed.delete(nodeId);
        } else {
            newCollapsed.add(nodeId);
        }
        setCollapsedNodes(newCollapsed);
    };

    const getNodeTypeColor = (type) => {
        switch (type) {
            case 'PERFORMANCE':
                return 'blue-border';
            case 'FEATURE':
                return 'green-border';
            case 'REFACTOR':
                return 'yellow-border';
            case 'BUGFIX':
                return 'red-border';
            default:
                return '';
        }
    };

    const canEditNode = (node) => {
        if (!currentUser) return false;
        if (isReadOnly) {
            // 只读模式下，只有管理员可以编辑
            return currentUser.id === 'admin' || currentUser.isAdmin;
        }
        return currentUser.id === 'admin' || currentUser.isAdmin || currentUser.userId === node.createdBy;
    };

    const canEditMindmap = () => {
        if (!currentUser) return false;
        if (isReadOnly) {
            // 只读模式下，只有管理员可以编辑
            return currentUser.id === 'admin' || currentUser.isAdmin;
        }
        return true;
    };

    const handleDonate = () => {
        if (!selectedNode) return;
        setShowDonateModal(true);
    };

    const submitDonation = () => {
        if (!selectedNode) return;
        
        const amount = parseFloat(donationAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('请输入有效的捐赠金额');
            return;
        }

        const now = new Date();
        // 获取支持者名称，未登录用户标记为匿名
        const supporterName = currentUser ? currentUser.username : '匿名用户';
        
        // 更新节点的支持者列表
        const updatedSupporters = {
            ...(selectedNode.supporters || {}),
            [supporterName]: {
                amount: (selectedNode.supporters?.[supporterName]?.amount || 0) + amount,
                date: now.toISOString(),
                period: donationPeriod,
                expireDate: new Date(now.getTime() + donationPeriod * 24 * 60 * 60 * 1000).toISOString()
            }
        };

        // 计算总金额
        const totalAmount = getTotalDonations(updatedSupporters);

        updateNode(selectedNode.id, {
            supporters: updatedSupporters,
            amount: totalAmount
        });

        // 更新选中的节点
        setSelectedNode({
            ...selectedNode,
            supporters: updatedSupporters,
            amount: totalAmount
        });

        setShowDonateModal(false);
        setDonationAmount('');
        
        // 这里应该调用实际的支付API，但我们暂时省略
        alert('捐赠成功，感谢您的支持！');
    };

    const getTotalDonations = (supporters) => {
        if (!supporters) return 0;
        
        return Object.values(supporters).reduce((sum, supporter) => {
            // 如果是旧格式的数据，直接累加数字
            if (typeof supporter === 'number') {
                return sum + supporter;
            }
            // 新格式的数据，累加amount字段
            return sum + (supporter.amount || 0);
        }, 0);
    };

    const getPeriodText = (period) => {
        switch (period) {
            case 30:
                return '一个月';
            case 90:
                return '三个月';
            case 180:
                return '六个月';
            case 365:
                return '一年';
            default:
                return '未知期限';
        }
    };

    const handleDragStart = (e, node) => {
        // 设置被拖拽的节点
        setDraggedNode(node);
        // 设置拖拽图像为半透明
        e.dataTransfer.effectAllowed = 'move';
        // 防止默认的拖拽图像
        if (e.target.classList.contains('node')) {
            const crt = e.target.cloneNode(true);
            crt.style.opacity = '0.5';
            crt.style.position = 'absolute';
            crt.style.top = '-1000px';
            document.body.appendChild(crt);
            e.dataTransfer.setDragImage(crt, 0, 0);
            setTimeout(() => {
                document.body.removeChild(crt);
            }, 0);
        }
    };

    const handleDragOver = (e, node) => {
        e.preventDefault();
        if (draggedNode && draggedNode.id !== node.id) {
            setDragOverNode(node);
        }
    };

    const handleDragEnd = () => {
        // 如果有拖拽和目标节点，执行排序操作
        if (draggedNode && dragOverNode) {
            // 找到两个节点的公共父节点
            const findParentNode = (nodeList, nodeId, parentNode = null) => {
                for (const node of nodeList) {
                    if (node.id === nodeId) {
                        return parentNode;
                    }
                    if (node.children && node.children.length > 0) {
                        const parent = findParentNode(node.children, nodeId, node);
                        if (parent) return parent;
                    }
                }
                return null;
            };

            // 如果是根节点
            if (!findParentNode(nodes, draggedNode.id)) {
                const updatedNodes = [...nodes];
                const draggedIndex = updatedNodes.findIndex(n => n.id === draggedNode.id);
                const targetIndex = updatedNodes.findIndex(n => n.id === dragOverNode.id);
                
                if (draggedIndex !== -1 && targetIndex !== -1) {
                    const [removed] = updatedNodes.splice(draggedIndex, 1);
                    updatedNodes.splice(targetIndex, 0, removed);
                    setNodes(updatedNodes);
                }
            } else {
                // 非根节点排序
                const updateNodeList = (nodeList) => {
                    return nodeList.map(node => {
                        if (node.children && node.children.length > 0) {
                            // 检查当前节点的子节点是否包含拖拽节点和目标节点
                            const draggedIndex = node.children.findIndex(n => n.id === draggedNode.id);
                            const targetIndex = node.children.findIndex(n => n.id === dragOverNode.id);
                            
                            if (draggedIndex !== -1 && targetIndex !== -1) {
                                // 如果两个节点在同一级别，执行排序
                                const updatedChildren = [...node.children];
                                const [removed] = updatedChildren.splice(draggedIndex, 1);
                                updatedChildren.splice(targetIndex, 0, removed);
                                
                                return {
                                    ...node,
                                    children: updatedChildren
                                };
                            }
                            
                            // 递归更新子节点
                            return {
                                ...node,
                                children: updateNodeList(node.children)
                            };
                        }
                        return node;
                    });
                };
                
                setNodes(updateNodeList(nodes));
            }
        }
        
        // 重置拖拽状态
        setDraggedNode(null);
        setDragOverNode(null);
    };

    const addComment = () => {
        if (!selectedNode || !newComment.trim()) return;
        
        // 使用当前用户名或'匿名用户'
        const authorName = currentUser ? currentUser.username : '匿名用户';
        
        const comment = {
            id: Date.now().toString(),
            text: newComment,
            author: authorName,
            createdAt: new Date().toISOString()
        };
        
        // 更新节点评论
        const updatedComments = [...(selectedNode.comments || []), comment];
        const updatedNode = {
            ...selectedNode,
            comments: updatedComments
        };
        
        // 先更新选中的节点，确保评论立即显示
        setSelectedNode(updatedNode);
        
        // 然后更新节点树
        updateNode(selectedNode.id, {
            comments: updatedComments
        });
        
        setNewComment('');
    };

    const renderNode = (node, level = 0) => {
        const isCollapsed = collapsedNodes.has(node.id);
        const isSelected = selectedNode?.id === node.id;
        const isRoot = level === 0;
        const nodeTypeClass = node.isCategory ? '' : getNodeTypeColor(node.type);
        const hasDetails = node.details && node.details.trim() !== '';
        const isDragging = draggedNode && draggedNode.id === node.id;
        const isDragOver = dragOverNode && dragOverNode.id === node.id;
        // 检查是否可以拖动节点（节点创建者或管理员）
        const canDragNode = currentUser && (
            currentUser.id === 'admin' || 
            currentUser.isAdmin || 
            currentUser.username === node.creatorName
        );

        // 判断是否显示删除按钮
        const showDeleteButton = canEditNode(node);
        
        // 检查用户是否已经支持过该节点
        const hasSupported = supportedNodes.includes(node.id);

        return (
            <div key={node.id} className={`node-container ${isRoot ? 'root' : ''}`}>
                <div 
                    className={`node ${isSelected ? 'selected' : ''} ${nodeTypeClass} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    onClick={() => setSelectedNode(node)}
                    data-tooltip={hasDetails ? node.details : null}
                    draggable={canDragNode ? "true" : "false"}
                    onDragStart={(e) => canDragNode && handleDragStart(e, node)}
                    onDragOver={(e) => handleDragOver(e, node)}
                    onDragEnd={handleDragEnd}
                >
                    <div className="node-content">
                        <span className={isRoot ? 'root-text' : ''}>{node.text}</span>
                        <div className="node-actions">
                            {canEditMindmap() && (
                                <button
                                    className="action-button add"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setParentId(node.id);
                                        setShowNodeModal(true);
                                    }}
                                >+</button>
                            )}
                            {node.children?.length > 0 && (
                                <button
                                    className="action-button collapse"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCollapse(node.id);
                                    }}
                                >{isCollapsed ? '+' : '-'}</button>
                            )}
                            {showDeleteButton && (
                                <button
                                    className="action-button delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setNodeToDelete(node);
                                        setShowConfirmModal(true);
                                    }}
                                >×</button>
                            )}
                            {/* 只有非分类节点才显示支持按钮 */}
                            {currentUser && !hasSupported && !node.isCategory && (
                                <button
                                    className="action-button support"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        supportNode(node.id);
                                    }}
                                >↑</button>
                            )}
                        </div>
                    </div>
                    <div className="info-container">{!node.isCategory && node.amount > 0 && (
                        <div className="node-amount">¥{node.amount.toLocaleString()}</div>
                    )}
                    <label className="node-creator">{node.creatorName}</label>
                    <label className="node-createdAt">{new Date(node.createdAt).toLocaleString()}</label>
                    {/* 只有非分类节点才显示支持数量 */}
                    {!node.isCategory && (
                        <label className="node-support-count">↑ {node.supportCount || 0}</label>
                    )}
                    </div>
                    
                </div>
                {!isCollapsed && node.children && (
                    <div className="children">
                        {node.children.map(child => renderNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="loading">加载中...</div>;

    return (
        <>
            {nodes.map(node => renderNode(node))}
            
            <div className="controls">
                {canEditMindmap() && (
                    <button onClick={() => {
                        setParentId(null);
                        setShowNodeModal(true);
                    }}>添加根节点</button>
                )}
            </div>
            {showNodeModal && (
                <div className="modal" onClick={() => setShowNodeModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowNodeModal(false)}>×</button>
                        <h3>添加新节点</h3>
                        <div className="form-group">
                            <label>节点名称</label>
                            <input
                                type="text"
                                value={newNodeText}
                                onChange={(e) => setNewNodeText(e.target.value)}
                                placeholder="输入节点名称"
                            />
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="isCategory"
                                checked={newNodeIsCategory}
                                onChange={(e) => setNewNodeIsCategory(e.target.checked)}
                            />
                            <label htmlFor="isCategory">是分类节点</label>
                        </div>
                        {!newNodeIsCategory && (
                            <>
                                <div className="form-group">
                                    <label>节点类型</label>
                                    <select value={newNodeType} onChange={e => setNewNodeType(e.target.value)}>
                                        <option value="PERFORMANCE">性能优化</option>
                                        <option value="FEATURE">功能实现</option>
                                        <option value="REFACTOR">代码重构</option>
                                        <option value="BUGFIX">bug修复</option>
                                    </select>
                                </div>
                            </>
                        )}
                        <div className="modal-actions">
                            <button onClick={() => {
                                if (newNodeText.trim()) {
                                    addNode(parentId, newNodeText.trim());
                                    setNewNodeText('');
                                    setNewNodeType('FEATURE');
                                    setNewNodeIsCategory(false);
                                    setNewNodeAmount(0);
                                    setShowNodeModal(false);
                                }
                            }}>确定</button>
                            <button onClick={() => setShowNodeModal(false)}>取消</button>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmModal && (
                <div className="modal" onClick={() => setShowConfirmModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowConfirmModal(false)}>×</button>
                        <h3>确认删除</h3>
                        <p>确定要删除节点 "{nodeToDelete?.text}" 及其所有子节点吗？</p>
                        <div className="modal-actions">
                            <button onClick={() => {
                                deleteNode(nodeToDelete.id);
                                setShowConfirmModal(false);
                                setNodeToDelete(null);
                                if (selectedNode && selectedNode.id === nodeToDelete.id) {
                                    setSelectedNode(null);
                                }
                            }}>确定</button>
                            <button onClick={() => {
                                setShowConfirmModal(false);
                                setNodeToDelete(null);
                            }}>取消</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedNode && (
                <div className="node-details" ref={nodeDetailsRef}>
                    {canEditNode(selectedNode) ? (
                        <input
                            type="text"
                            value={editedNodeName}
                            onChange={(e) => setEditedNodeName(e.target.value)}
                            className="node-title-input"
                        />
                    ) : (
                        <h3>{selectedNode.text}</h3>
                    )}
                    
                    <div className="node-meta">
                        <span className="creator-info">{selectedNode.creatorName}</span>
                        <span className="created-time">{new Date(selectedNode.createdAt).toLocaleString()}</span>
                        <span className={`node-type ${getNodeTypeColor(selectedNode.type)}`}>
                            {selectedNode.isCategory ? '分类节点' : NODE_TYPES[selectedNode.type] || '未知'}
                        </span>
                    </div>
                    
                    <button 
                        className="submit-node-button"
                        onClick={() => setShowSubmitModal(true)}
                    >
                        提交
                    </button>
                    
                    <div className="detail-item">
                        <label>详细信息:</label>
                        {canEditNode(selectedNode) ? (
                            <textarea
                                value={editedNodeDetails}
                                onChange={(e) => setEditedNodeDetails(e.target.value)}
                            />
                        ) : (
                            <div className="readonly-details">{selectedNode.details}</div>
                        )}
                    </div>
                    
                    {canEditNode(selectedNode) && (
                        <div className="detail-actions">
                            <button onClick={saveNodeChanges}>保存修改</button>
                        </div>
                    )}
                    
                    {!selectedNode.isCategory && (
                        <div className="supporters-section">
                            <h4>支持者</h4>
                            {Object.keys(selectedNode.supporters || {}).length > 0 ? (
                                <div className="supporters-list">
                                    {Object.entries(selectedNode.supporters || {}).map(([userId, supporter]) => {
                                        // 如果是旧格式的数据（直接是金额数字）
                                        if (typeof supporter === 'number') {
                                            return (
                                                <div key={userId} className="supporter-item">
                                                    <span className="supporter-name">{userId}</span>
                                                    <span className="supporter-amount">¥{supporter.toLocaleString()}</span>
                                                </div>
                                            );
                                        }
                                        
                                        // 新格式的数据，包含金额、日期和期限
                                        return (
                                            <div key={userId} className="supporter-item">
                                                <div className="supporter-info">
                                                    <span className="supporter-name">{userId}</span>
                                                    <span className="supporter-date">
                                                        {new Date(supporter.date).toLocaleDateString()}
                                                    </span>
                                                    <span className="supporter-period">
                                                        {getPeriodText(supporter.period)}
                                                    </span>
                                                </div>
                                                <span className="supporter-amount">¥{supporter.amount.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="total-donations">
                                        <strong>总金额:</strong> ¥{getTotalDonations(selectedNode.supporters).toLocaleString()}
                                    </div>
                                </div>
                            ) : (
                                <p className="no-supporters">暂无支持者</p>
                            )}
                            
                            {/* 允许所有人都可以捐赠，包括未登录用户 */}
                            <button className="donate-button" onClick={handleDonate}>
                                支持此节点
                            </button>
                        </div>
                    )}

                    {/* 评论区域 */}
                    <div className="comments-section">
                        <h4>评论区</h4>
                        <div className="comments-list">
                            {selectedNode.comments && selectedNode.comments.length > 0 ? (
                                selectedNode.comments.map(comment => (
                                    <div key={comment.id} className="comment-item">
                                        <div className="comment-header">
                                            <span className="comment-author">{comment.author}</span>
                                            <span className="comment-date">
                                                {new Date(comment.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="comment-text">{comment.text}</div>
                                    </div>
                                ))
                            ) : (
                                <p className="no-comments">暂无评论</p>
                            )}
                        </div>
                        
                        <div className="add-comment">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="写下您的评论..."
                                rows="3"
                            ></textarea>
                            <button onClick={addComment}>发布评论</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showDonateModal && (
                <div className="modal" onClick={() => setShowDonateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowDonateModal(false)}>×</button>
                        <h3>支持节点: {selectedNode.text}</h3>
                        <div className="form-group">
                            <label>捐赠金额</label>
                            <input
                                type="number"
                                value={donationAmount}
                                onChange={(e) => setDonationAmount(e.target.value)}
                                placeholder="请输入金额"
                                min="1"
                            />
                        </div>
                        <div className="form-group">
                            <label>支持期限</label>
                            <select 
                                value={donationPeriod} 
                                onChange={(e) => setDonationPeriod(parseInt(e.target.value, 10))}
                            >
                                <option value="30">一个月</option>
                                <option value="90">三个月</option>
                                <option value="180">六个月</option>
                                <option value="365">一年</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>支付方式</label>
                            <div className="payment-methods">
                                <label className="payment-method">
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="alipay"
                                        checked={paymentMethod === 'alipay'}
                                        onChange={() => setPaymentMethod('alipay')}
                                    />
                                    <span>支付宝</span>
                                </label>
                                <label className="payment-method">
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="wechat"
                                        checked={paymentMethod === 'wechat'}
                                        onChange={() => setPaymentMethod('wechat')}
                                    />
                                    <span>微信支付</span>
                                </label>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button onClick={submitDonation}>确认支付</button>
                            <button onClick={() => setShowDonateModal(false)}>取消</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 提交节点模态框 */}
            {showSubmitModal && (
                <div className="modal" onClick={() => setShowSubmitModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowSubmitModal(false)}>×</button>
                        <h3>提交节点到投票</h3>
                        <div className="form-group">
                            <label>Gitee昵称</label>
                            <input
                                type="text"
                                value={giteeUsername}
                                onChange={(e) => setGiteeUsername(e.target.value)}
                                placeholder="请输入您的Gitee昵称"
                            />
                        </div>
                        <div className="form-group">
                            <label>修改描述</label>
                            <textarea
                                value={changeDescription}
                                onChange={(e) => setChangeDescription(e.target.value)}
                                placeholder="请描述您提交的修改..."
                                rows="5"
                            ></textarea>
                        </div>
                        <div className="modal-actions">
                            <button onClick={submitNodeToVoting}>提交</button>
                            <button onClick={() => setShowSubmitModal(false)}>取消</button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="legend-hint">
                {!showLegend ? '按住H显示图例' : ''}
            </div>
            
            {showLegend && (
                <div className="legend">
                    <div className="legend-item">
                        <span className="blue-border">性能优化</span>
                    </div>
                    <div className="legend-item">
                        <span className="green-border">功能实现</span>
                    </div>
                    <div className="legend-item">
                        <span className="yellow-border">代码重构</span>
                    </div>
                    <div className="legend-item">
                        <span className="red-border">bug修复</span>
                    </div>
                    <div className="legend-item">
                        <span>分类节点</span>
                    </div>
                </div>
            )}
        </>
    );
};

export default MindMap; 