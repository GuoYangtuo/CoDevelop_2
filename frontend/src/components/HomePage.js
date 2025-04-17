import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { createApiPath } from '../config';
import './HomePage.css';

const HomePage = () => {
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await axios.get(createApiPath('api/projects'));
                setProjects(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch projects:', error);
                setError('无法加载项目列表');
                setLoading(false);
            }
        };

        fetchProjects();
    }, []);

    if (loading) {
        return <div className="loading">加载中...</div>;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    // 找到默认项目（gameA）或第一个可用项目
    const defaultProject = projects.find(p => p.id === 'gameA') || projects[0];
    
    if (defaultProject) {
        return <Navigate to={`/${defaultProject.id}`} />;
    }

    // 如果没有项目，显示一个错误信息
    return (
        <div className="home-page">
            <h1>无可用项目</h1>
            <p>没有找到任何项目，请联系管理员。</p>
            <a href="/admin" className="admin-link">前往管理页面</a>
        </div>
    );
};

export default HomePage; 