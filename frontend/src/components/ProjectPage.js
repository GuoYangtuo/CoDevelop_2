import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [updateLogs, setUpdateLogs] = useState({});
    const [showReadOnlyModal, setShowReadOnlyModal] = useState(false);
    const [newMindmapName, setNewMindmapName] = useState('');
    const [newMindmapReadOnly, setNewMindmapReadOnly] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setCurrentUser(JSON.parse(savedUser));
        }
        loadMindmaps();
    }, [projectId]);

    const loadMindmaps = async () => {
        try {
            const response = await axios.get(`http://localhost:3001/api/projects/${projectId}/mindmaps`);
            // 过滤掉名为updateLogs.json的文件以及id为updateLogs的导图
            const filteredMindmaps = response.data.filter(mindmap => 
                mindmap.id !== 'updateLogs.json' && mindmap.id !== 'updateLogs'
            ).map(mindmap => ({
                ...mindmap,
                isReadOnly: mindmap.isReadOnly || false // 确保isReadOnly属性存在
            }));
            setMindmaps(filteredMindmaps);
            
            // 自动选择第一个导图
            if (filteredMindmaps.length > 0 && !selectedMindmap) {
                setSelectedMindmap(filteredMindmaps[0].id);
            }
            
            setLoading(false);
        } catch (error) {
            console.error('Failed to load mindmaps:', error);
            if (error.response && error.response.status === 404) {
                setProjectExists(false);
            }
            setLoading(false);
        }
    };

    const loadUpdateLogs = async () => {
        try {
            const response = await axios.get(`http://localhost:3001/api/projects/${projectId}/updateLogs`);
            setUpdateLogs(response.data);
        } catch (error) {
            console.error('Failed to load update logs:', error);
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

    const deleteMindmap = async (mindmapId) => {
        if (!currentUser || (currentUser.id !== 'admin' && !currentUser.isAdmin)) {
            alert('只有管理员可以删除思维导图');
            return;
        }

        if (true) {
            try {
                await axios.delete(`http://localhost:3001/api/projects/${projectId}/mindmaps/${mindmapId}`);
                loadMindmaps();
                if (selectedMindmap === mindmapId) {
                    setSelectedMindmap(null);
                }
            } catch (error) {
                console.error('Failed to delete mindmap:', error);
                alert('删除失败，请稍后重试');
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
            alert('请输入导图名称');
            return;
        }

        try {
            await axios.post(`http://localhost:3001/api/projects/${projectId}/mindmaps/${newMindmapName}`, {
                nodes: [],
                createdAt: new Date().toISOString(),
                createdBy: currentUser.id,
                creatorName: currentUser.username,
                isReadOnly: newMindmapReadOnly
            });
            loadMindmaps();
            setSelectedMindmap(newMindmapName);
            setShowReadOnlyModal(false);
        } catch (error) {
            console.error('Failed to create mindmap:', error);
            alert('创建导图失败，请稍后重试');
        }
    };

    const handleDownloadClick = () => {
        setShowDownloadModal(true);
        loadUpdateLogs();
    };

    const downloadLatestRelease = () => {
        window.open(`http://localhost:3001/api/projects/${projectId}/download`, '_blank');
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
                    className="download-button"
                    onClick={handleDownloadClick}
                >
                    <span role="img" aria-label="download">💾</span>
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
                                                deleteMindmap(mindmap.id);
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
            
            <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
                {selectedMindmap ? (
                    <MindMap
                        mindmapId={selectedMindmap}
                        projectId={projectId}
                        currentUser={currentUser}
                    />
                ) : (
                    <div className="welcome">
                        <h2>欢迎使用思维导图</h2>
                        <p>从侧边栏选择一个思维导图或创建一个新的</p>
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

            {showDownloadModal && (
                <div className="modal" onClick={() => setShowDownloadModal(false)}>
                    <div className="download-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowDownloadModal(false)}>×</button>
                        <h3>下载项目: {projectId}</h3>
                        
                        <div className="download-section">
                            <button 
                                className="download-action-button" 
                                onClick={downloadLatestRelease}
                            >
                                下载最新版本
                            </button>
                        </div>
                        
                        <div className="update-logs-section">
                            <h4>更新日志</h4>
                            {Object.keys(updateLogs).length > 0 ? (
                                <div className="update-logs-list">
                                    {Object.entries(updateLogs)
                                        .sort(([versionA], [versionB]) => {
                                            // 尝试按版本号排序，降序（新版本在前）
                                            const partsA = versionA.split('.').map(Number);
                                            const partsB = versionB.split('.').map(Number);
                                            
                                            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                                                const partA = partsA[i] || 0;
                                                const partB = partsB[i] || 0;
                                                if (partA !== partB) {
                                                    return partB - partA; // 降序排列
                                                }
                                            }
                                            return 0;
                                        })
                                        .map(([version, changes]) => (
                                            <div key={version} className="version-entry">
                                                <h5>版本 {version}</h5>
                                                <ul>
                                                    {changes.map((change, index) => (
                                                        <li key={index}>{change}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="no-logs">暂无更新日志</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectPage; 