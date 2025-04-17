import React, { useState } from 'react';
import axios from 'axios';
import { createApiPath } from '../config';
import './Auth.css';

const Auth = ({ onLogin, onClose }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
        
        try {
            const response = await axios.post(createApiPath(endpoint), {
                username,
                password
            });
            
            localStorage.setItem('user', JSON.stringify(response.data));
            onLogin(response.data);
            setLoading(false);
        } catch (error) {
            setError(isRegister ? '注册失败，用户名可能已存在' : '登录失败，请检查用户名和密码');
            setLoading(false);
        }
    };

    return (
        <div className="auth-container" onClick={onClose}>
            <div className="auth-box" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2>{isRegister ? '注册' : '登录'}</h2>
                {error && <div className="error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>用户名</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit">{isRegister ? '注册' : '登录'}</button>
                </form>
                <button
                    className="switch-mode"
                    onClick={() => setIsRegister(!isRegister)}
                >
                    {isRegister ? '切换到登录' : '切换到注册'}
                </button>
            </div>
        </div>
    );
};

export default Auth; 