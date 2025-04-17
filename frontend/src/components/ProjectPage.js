import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { createApiPath } from '../config';
import { useParams, Navigate } from 'react-router-dom';
import MindMap from './MindMap';
import Auth from './Auth';
import './ProjectPage.css';

const ProjectPage = () => {
    const { projectId } = useParams();
    const [mindmaps, setMindmaps] = useState([]);
    const [selectedMindmap, setSelectedMindmap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [projectExists, setProjectExists] = useState(true);
    const [showVotingModal, setShowVotingModal] = useState(false);
    const [votingNodes, setVotingNodes] = useState([]);
    const [showReadOnlyModal, setShowReadOnlyModal] = useState(false);
    const [newMindmapName, setNewMindmapName] = useState('');
    const [newMindmapReadOnly, setNewMindmapReadOnly] = useState(false);
    const [error, setError] = useState('');
    const [newComment, setNewComment] = useState('');
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [showCommentArea, setShowCommentArea] = useState(false);
    
    // 用户投票记录
    const [votedNodes, setVotedNodes] = useState(() => {
        const saved = localStorage.getItem('votedNodes');
        return saved ? JSON.parse(saved) : {};
    });
    
    // 为思维导图添加ref
    const mindmapRef = useRef(null);
    
    // 点击外部区域处理函数
    const handleClickOutside = (e) => {
        // 这个函数将会传递给MindMap组件
        // 在MindMap组件中它会被用于处理节点选择逻辑
    };

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setCurrentUser(JSON.parse(savedUser));
        }
        loadMindmaps();
    }, [projectId]);

    const loadMindmaps = async () => {
        try {
            const response = await axios.get(createApiPath(`api/projects/${projectId}/mindmaps`));
            setMindmaps(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load mindmaps:', error);
            if (error.response && error.response.status === 404) {
                setProjectExists(false);
            }
            setLoading(false);
        }
    };

    const loadVotingNodes = async () => {
        if (!projectId) return;
        
        try {
            const response = await axios.get(createApiPath(`api/projects/${projectId}/onVoting.json`));
            setVotingNodes(response.data?.nodes || []);
        } catch (error) {
            console.error('加载投票节点失败:', error);
            setVotingNodes([]);
        }
    };

    const handleLogin = (userData) => {
        setCurrentUser(userData);
        setShowAuth(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        setCurrentUser(null);
    };

    const handleDeleteMindmap = async (mindmapId) => {
        if (window.confirm('确定要删除这个思维导图吗？此操作不可逆！')) {
            try {
                await axios.delete(createApiPath(`api/projects/${projectId}/mindmaps/${mindmapId}`));
                setMindmaps(mindmaps.filter(m => m.id !== mindmapId));
                if (selectedMindmap && selectedMindmap.id === mindmapId) {
                    setSelectedMindmap(null);
                }
            } catch (error) {
                console.error('Failed to delete mindmap:', error);
            }
        }
    };

    const createNewMindmap = async () => {
        if (!currentUser || (currentUser.id !== 'admin' && !currentUser.isAdmin)) {
            alert('只有管理员可以创建思维导图');
            return;
        }

        // 打开自定义的对话框，不使用原生confirm
        setNewMindmapName('');
        setNewMindmapReadOnly(false);
        setShowReadOnlyModal(true);
    };

    const handleCreateMindmap = async () => {
        if (!newMindmapName.trim()) {
            setError('思维导图名称不能为空');
            return;
        }
        
        try {
            await axios.post(createApiPath(`api/projects/${projectId}/mindmaps/${newMindmapName}`), {
                name: newMindmapName,
                createdAt: new Date().toISOString(),
                createdBy: currentUser ? currentUser.userId : 'guest',
                nodes: [],
                isReadOnly: false
            });
            
            setNewMindmapName('');
            setShowReadOnlyModal(false);
            loadMindmaps();
        } catch (error) {
            setError(error.response?.data?.error || '创建思维导图失败');
        }
    };

    const handleVotingClick = () => {
        setShowVotingModal(true);
        loadVotingNodes();
    };
    
    // 处理投票
    const handleVote = async (nodeId, voteType) => {
        if (!currentUser) {
            alert('请先登录后再投票');
            return;
        }
        
        // 检查用户是否已经投过票
        if (votedNodes[nodeId]) {
            alert('您已经对该节点投过票了');
            return;
        }
        
        try {
            // 获取当前投票数据
            const response = await axios.get(createApiPath(`api/projects/${projectId}/onVoting.json`));
            const votingData = response.data || { nodes: [] };
            
            // 更新节点投票
            const updatedNodes = votingData.nodes.map(node => {
                if (node.id === nodeId) {
                    const votes = voteType === 'up' ? [...(node.upvotes || []), currentUser.userId] : [...(node.downvotes || []), currentUser.userId];
                    return {
                        ...node,
                        [voteType === 'up' ? 'upvotes' : 'downvotes']: votes
                    };
                }
                return node;
            });
            
            // 保存更新后的数据
            await axios.post(createApiPath(`api/projects/${projectId}/onVoting.json`), {
                ...votingData,
                nodes: updatedNodes
            });
            
            // 更新本地状态
            setVotingNodes(updatedNodes);
            
            // 记录用户的投票
            const newVotedNodes = { ...votedNodes, [nodeId]: voteType };
            setVotedNodes(newVotedNodes);
            localStorage.setItem('votedNodes', JSON.stringify(newVotedNodes));
            
            alert('投票成功');
        } catch (error) {
            console.error('投票失败:', error);
            alert('投票失败');
        }
    };
    
    // 添加评论
    const addComment = async () => {
        if (!activeNodeId || !newComment.trim() || !currentUser) return;
        
        try {
            // 获取当前投票数据
            const response = await axios.get(createApiPath(`api/projects/${projectId}/onVoting.json`));
            const votingData = response.data || { nodes: [] };
            
            // 添加评论到节点
            const updatedNodes = votingData.nodes.map(node => {
                if (node.id === activeNodeId) {
                    const newCommentObj = {
                        id: Date.now().toString(),
                        author: currentUser.username,
                        createdAt: new Date().toISOString(),
                        text: newComment
                    };
                    
                    return {
                        ...node,
                        comments: [...(node.comments || []), newCommentObj]
                    };
                }
                return node;
            });
            
            // 保存更新后的数据
            await axios.post(createApiPath(`api/projects/${projectId}/onVoting.json`), {
                ...votingData,
                nodes: updatedNodes
            });
            
            // 更新本地状态
            setVotingNodes(updatedNodes);
            setNewComment('');
        } catch (error) {
            console.error('添加评论失败:', error);
            alert('添加评论失败');
        }
    };

    if (loading) return <div className="loading">加载中...</div>;
    
    if (!projectExists) {
        return <Navigate to="/" />;
    }

    return (
        <div className="project-page">
            <div className={`sidebar-toggle ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <button
                    className="toggle-button"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                    {sidebarCollapsed ? '+' : '-'}
                </button>
                <button
                    className="voting-button"
                    onClick={handleVotingClick}
                >
                    <span role="img" aria-label="voting">🗳️</span>
                </button>
            </div>
            
            {!sidebarCollapsed && (
                <div className="sidebar">
                    <div className="sidebar-header">
                        <button
                            className="auth-button"
                            onClick={() => currentUser ? handleLogout() : setShowAuth(true)}
                        >
                            {currentUser ? `退出 (${currentUser.username})` : '登录/注册'}
                        </button>
                    </div>
                    <h2>计划与提案</h2>
                    {currentUser && (currentUser.id === 'admin' || currentUser.isAdmin) && (
                        <button onClick={createNewMindmap}>新建思维导图</button>
                    )}
                    <ul>
                        {mindmaps.map(mindmap => (
                            <li
                                key={mindmap.id}
                                className={selectedMindmap === mindmap.id ? 'selected' : ''}
                            >
                                    <div 
                                        className="mindmap-item" 
                                        onClick={() => setSelectedMindmap(mindmap.id)}
                                    >
                                        {mindmap.name}
                                    </div>
                                    {currentUser && (currentUser.id === 'admin' || currentUser.isAdmin) && (
                                        <button 
                                            className="delete-mindmap-button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteMindmap(mindmap.id);
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}
                 ref={mindmapRef}
                 onClick={handleClickOutside}
            >
                {selectedMindmap ? (
                    <MindMap
                        mindmapId={selectedMindmap}
                        projectId={projectId}
                        currentUser={currentUser}
                        mindmapRef={mindmapRef}
                        handleClickOutside={handleClickOutside}
                    />
                ) : (
                    <div className="welcome">
                        <h2>这里是计划与提案</h2>
                        <p>从左侧边栏选择一个导图查看，登录使用更多功能</p>
                        {(!currentUser || currentUser.id === 'guest') && (
                            <button className="welcome-auth-button" onClick={() => setShowAuth(true)}>
                                登录/注册
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {showAuth && (
                <Auth 
                    onLogin={handleLogin} 
                    onClose={() => setShowAuth(false)} 
                />
            )}

            {showReadOnlyModal && (
                <div className="modal" onClick={() => setShowReadOnlyModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowReadOnlyModal(false)}>×</button>
                        <h3>创建新的思维导图</h3>
                        <div className="form-group">
                            <label>导图名称</label>
                            <input
                                type="text"
                                value={newMindmapName}
                                onChange={(e) => setNewMindmapName(e.target.value)}
                                placeholder="输入导图名称"
                            />
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="isReadOnly"
                                checked={newMindmapReadOnly}
                                onChange={(e) => setNewMindmapReadOnly(e.target.checked)}
                            />
                            <label htmlFor="isReadOnly">设为只读模式（只有管理员可编辑）</label>
                        </div>
                        <div className="modal-actions">
                            <button onClick={handleCreateMindmap}>创建</button>
                            <button onClick={() => setShowReadOnlyModal(false)}>取消</button>
                        </div>
                    </div>
                </div>
            )}

            {showVotingModal && (
                <div className="modal" onClick={() => setShowVotingModal(false)}>
                    <div className="voting-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowVotingModal(false)}>×</button>
                        <h3>投票中的节点</h3>
                        
                        {votingNodes.length > 0 ? (
                            <div className="voting-nodes-list">
                                {votingNodes.map((node) => (
                                    <div key={node.id} className="voting-node-item">
                                        <div className="voting-node-header">
                                            <h4>{node.text}</h4>
                                            <div className="voting-node-meta">
                                                <span>提交者: {node.submittedBy}</span>
                                                <span>提交时间: {new Date(node.submittedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="voting-node-description">
                                            {node.description}
                                        </div>
                                        
                                        <div className="voting-node-stats">
                                            <div className="vote-count">
                                                <span className="upvote-count">👍 {node.upvotes?.length || 0}</span>
                                                <span className="downvote-count">👎 {node.downvotes?.length || 0}</span>
                                            </div>
                                            <div className="voting-actions">
                                                {currentUser && !votedNodes[node.id] && (
                                                    <>
                                                        <button 
                                                            className="upvote-button"
                                                            onClick={() => handleVote(node.id, 'up')}
                                                        >
                                                            赞成
                                                        </button>
                                                        <button 
                                                            className="downvote-button"
                                                            onClick={() => handleVote(node.id, 'down')}
                                                        >
                                                            反对
                                                        </button>
                                                    </>
                                                )}
                                                <button 
                                                    className="comment-button"
                                                    onClick={() => {
                                                        setActiveNodeId(node.id);
                                                        setShowCommentArea(true);
                                                    }}
                                                >
                                                    评论
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {activeNodeId === node.id && showCommentArea && (
                                            <div className="comment-area">
                                                <h5>评论区</h5>
                                                {node.comments && node.comments.length > 0 ? (
                                                    <div className="comments-list">
                                                        {node.comments.map(comment => (
                                                            <div key={comment.id} className="comment-item">
                                                                <div className="comment-header">
                                                                    <span className="comment-author">{comment.author}</span>
                                                                    <span className="comment-date">
                                                                        {new Date(comment.createdAt).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div className="comment-text">{comment.text}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="no-comments">暂无评论</p>
                                                )}
                                                
                                                {currentUser && (
                                                    <div className="add-comment">
                                                        <textarea
                                                            value={newComment}
                                                            onChange={(e) => setNewComment(e.target.value)}
                                                            placeholder="写下您的评论..."
                                                            rows="3"
                                                        ></textarea>
                                                        <button onClick={addComment}>发布评论</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-voting-nodes">暂无投票中的节点</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectPage; 