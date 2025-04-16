import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Navigate } from 'react-router-dom';
import Auth from './Auth';
import './AdminPage.css';

const AdminPage = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [showAuth, setShowAuth] = useState(false);
    const [editProject, setEditProject] = useState(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [error, setError] = useState('');
    const [draggedProject, setDraggedProject] = useState(null);
    const [dragOverProject, setDragOverProject] = useState(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setCurrentUser(JSON.parse(savedUser));
        }
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/projects');
            setProjects(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load projects:', error);
            setLoading(false);
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

    const handleAddProject = async () => {
        if (!newProjectName.trim()) {
            setError('项目名不能为空');
            return;
        }

        try {
            const response = await axios.post('http://localhost:3001/api/projects', {
                name: newProjectName
            });
            setProjects([...projects, response.data]);
            setNewProjectName('');
            setError('');
        } catch (error) {
            setError(error.response?.data?.error || '创建项目失败');
        }
    };

    const handleEditProject = async (project) => {
        if (editProject) {
            try {
                const response = await axios.put(`http://localhost:3001/api/projects/${project.id}`, {
                    name: newProjectName
                });
                setProjects(projects.map(p => p.id === project.id ? response.data : p));
                setEditProject(null);
                setNewProjectName('');
                setError('');
            } catch (error) {
                setError(error.response?.data?.error || '更新项目失败');
            }
        } else {
            setEditProject(project);
            setNewProjectName(project.name);
        }
    };

    const handleDeleteProject = async (projectId) => {
        try {
            await axios.delete(`http://localhost:3001/api/projects/${projectId}`);
            setProjects(projects.filter(p => p.id !== projectId));
            setError('');
        } catch (error) {
            setError(error.response?.data?.error || '删除项目失败');
        }
    };

    const handleDragStart = (e, project) => {
        setDraggedProject(project);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, project) => {
        e.preventDefault();
        if (draggedProject && draggedProject.id !== project.id) {
            setDragOverProject(project);
        }
    };

    const handleDragEnd = () => {
        if (draggedProject && dragOverProject) {
            const updatedProjects = [...projects];
            const draggedIndex = updatedProjects.findIndex(p => p.id === draggedProject.id);
            const targetIndex = updatedProjects.findIndex(p => p.id === dragOverProject.id);
            
            if (draggedIndex !== -1 && targetIndex !== -1) {
                const [removed] = updatedProjects.splice(draggedIndex, 1);
                updatedProjects.splice(targetIndex, 0, removed);
                setProjects(updatedProjects);
            }
        }
        
        setDraggedProject(null);
        setDragOverProject(null);
    };

    if (loading) return <div className="loading">加载中...</div>;

    // 如果用户未登录，显示登录界面
    if (!currentUser) {
        return <Auth onLogin={handleLogin} onClose={() => setShowAuth(false)} />;
    }

    // 如果用户登录了但不是管理员，重定向到主页
    if (currentUser && !currentUser.isAdmin) {
        return <Navigate to="/" />;
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h1>项目管理</h1>
                <button className="logout-button" onClick={handleLogout}>
                    退出 ({currentUser.username})
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="add-project">
                <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="新项目名称"
                />
                <button onClick={handleAddProject}>添加项目</button>
            </div>

            <div className="projects-list">
                <h2>项目列表</h2>
                {projects.length === 0 ? (
                    <p>没有项目</p>
                ) : (
                    <ul>
                        {projects.map(project => (
                            <li 
                                key={project.id} 
                                className={`project-item ${draggedProject?.id === project.id ? 'dragging' : ''} ${dragOverProject?.id === project.id ? 'drag-over' : ''}`}
                                draggable="true"
                                onDragStart={(e) => handleDragStart(e, project)}
                                onDragOver={(e) => handleDragOver(e, project)}
                                onDragEnd={handleDragEnd}
                            >
                                {editProject && editProject.id === project.id ? (
                                    <div className="edit-project">
                                        <input
                                            type="text"
                                            value={newProjectName}
                                            onChange={(e) => setNewProjectName(e.target.value)}
                                        />
                                        <button onClick={() => handleEditProject(project)}>保存</button>
                                        <button onClick={() => {
                                            setEditProject(null);
                                            setNewProjectName('');
                                        }}>取消</button>
                                    </div>
                                ) : (
                                    <div className="project-info">
                                        <span className="project-name">{project.name}</span>
                                        <div className="project-actions">
                                            <a href={`/${project.id}`} className="view-link">查看</a>
                                            <button
                                                className="edit-button"
                                                onClick={() => handleEditProject(project)}
                                            >
                                                编辑
                                            </button>
                                            <button
                                                className="delete-button"
                                                onClick={() => handleDeleteProject(project.id)}
                                            >
                                                删除
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default AdminPage; 