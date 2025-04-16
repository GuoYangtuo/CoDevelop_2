import React, { useState } from 'react';
import axios from 'axios';
import './Auth.css';

const Auth = ({ onLogin, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const response = await axios.post(`http://localhost:3001${endpoint}`, {
                username,
                password
            });

            localStorage.setItem('user', JSON.stringify(response.data));
            onLogin(response.data);
        } catch (error) {
            console.log(error);
            setError(error.response?.data?.error || '操作失败');
        }
    };

    return (
        <div className="auth-container" onClick={onClose}>
            <div className="auth-box" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2>{isLogin ? '登录' : '注册'}</h2>
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
                    <button type="submit">{isLogin ? '登录' : '注册'}</button>
                </form>
                <button
                    className="switch-mode"
                    onClick={() => setIsLogin(!isLogin)}
                >
                    {isLogin ? '切换到注册' : '切换到登录'}
                </button>
            </div>
        </div>
    );
};

export default Auth; 