import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './MindMap.css';

const NODE_TYPES = {
  PERFORMANCE: '性能优化',
  FEATURE: '功能实现',
  REFACTOR: '代码重构',
  BUGFIX: 'bug修复'
};

const MindMap = ({ mindmapId, projectId = 'gameA', currentUser }) => {
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
    
    const mindmapRef = useRef(null);
    const nodeDetailsRef = useRef(null);
    
    useEffect(() => {
        if (mindmapId) {
            loadMindMap();
        }
    }, [mindmapId, projectId]);

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

    const handleClickOutside = (e) => {
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
    };

    const loadMindMap = async () => {
        try {
            const response = await axios.get(`http://localhost:3001/api/projects/${projectId}/mindmaps/${mindmapId}`);
            setNodes(response.data.nodes || []);
            setMindmapData(response.data);
            
            // 检查导图是否为只读
            if (response.data.isReadOnly) {
                setIsReadOnly(true);
            } else {
                setIsReadOnly(false);
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
            
            await axios.post(`http://localhost:3001/api/projects/${projectId}/mindmaps/${mindmapId}`, dataToSave);
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
            comments: [] // 初始化评论列表
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

    const toggleCollapse = (nodeId) => {
        setCollapsedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
            } else {
                newSet.add(nodeId);
            }
            return newSet;
        });
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

    // 检查用户是否有权限编辑节点
    const canEditNode = (node) => {
        // 如果是只读导图，只有管理员可以编辑
        if (isReadOnly) {
            return currentUser && (
                currentUser.id === 'admin' || 
                currentUser.isAdmin
            );
        }
        
        return currentUser && (
            currentUser.id === 'admin' || 
            currentUser.isAdmin || 
            currentUser.username === node.creatorName
        );
    };

    // 检查用户是否有权限编辑导图
    const canEditMindmap = () => {
        // 如果是只读导图，只有管理员可以编辑
        if (isReadOnly) {
            return currentUser && (
                currentUser.id === 'admin' || 
                currentUser.isAdmin
            );
        }
        
        return currentUser && currentUser.id !== 'guest';
    };

    // 处理捐赠功能
    const handleDonate = () => {
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

    // 拖拽排序相关函数
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

    // 添加评论
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
                        </div>
                    </div>
                    <div className="info-container">{!node.isCategory && node.amount > 0 && (
                        <div className="node-amount">¥{node.amount.toLocaleString()}</div>
                    )}
                    <label className="node-creator">{node.creatorName}</label>
                    <label className="node-createdAt">{new Date(node.createdAt).toLocaleString()}</label>
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
        <div 
            className="mindmap" 
            onClick={handleClickOutside} 
            ref={mindmapRef}
        >
            
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
                    <h3>{selectedNode.text}</h3>
                    <div className="detail-item">
                        <label>创建者:</label>
                        <span>{selectedNode.creatorName || selectedNode.createdBy}</span>
                    </div>
                    <div className="detail-item">
                        <label>创建时间:</label>
                        <span>{new Date(selectedNode.createdAt).toLocaleString()}</span>
                    </div>
                    
                    {selectedNode.isCategory ? (
                        <div className="detail-item">
                            <label>节点类型:</label>
                            <span>分类节点</span>
                        </div>
                    ) : (
                        <>
                            <div className="detail-item">
                                <label>类型:</label>
                                <span className={getNodeTypeColor(selectedNode.type)}>
                                    {NODE_TYPES[selectedNode.type] || '未知'}
                                </span>
                            </div>
                        </>
                    )}
                    
                    <div className="detail-item">
                        <label>节点名称:</label>
                        {canEditNode(selectedNode) ? (
                            <input
                                type="text"
                                value={editedNodeName}
                                onChange={(e) => setEditedNodeName(e.target.value)}
                            />
                        ) : (
                            <span>{selectedNode.text}</span>
                        )}
                    </div>
                    
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
                            <h4>支持者列表</h4>
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
        </div>
    );
};

export default MindMap; 