const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver'); // 用于创建压缩文件
const cron = require('node-cron'); // 用于定时任务

const app = express();
const PORT = 3001;

// 确保存储目录存在
const STORAGE_DIR = path.join(__dirname, 'mindmaps');
const USERS_FILE = path.join(__dirname, 'users.json');
const PROJECTS_DIR = path.join(__dirname, 'projects');
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR);
}

if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR);
    // 创建默认的gameA项目
    fs.mkdirSync(path.join(PROJECTS_DIR, 'gameA'));
}

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

// 初始化用户文件
if (!fs.existsSync(USERS_FILE)) {
    const initialUsers = {
        users: [
            {
                id: 'admin',
                username: 'admin',
                password: 'admin',
                createdAt: new Date().toISOString(),
                isAdmin: true
            }
        ]
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2));
} else {
    // 确保admin账户存在
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!usersData.users.some(user => user.id === 'admin')) {
        usersData.users.push({
            id: 'admin',
            username: 'admin',
            password: 'admin',
            createdAt: new Date().toISOString(),
            isAdmin: true
        });
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
    }
}

app.use(cors());
app.use(bodyParser.json());

// 定义每日备份函数
const backupProjects = () => {
    try {
        console.log('开始每日备份...');
        const date = new Date().toISOString().split('T')[0]; // 获取当前日期，如：2023-05-01
        const backupPath = path.join(BACKUP_DIR, `projects_backup.zip`);
        
        // 创建一个文件以写入压缩数据
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // 设置压缩级别
        });
        
        // 监听错误事件
        archive.on('error', (err) => {
            throw err;
        });
        
        // 将存档管道到文件
        archive.pipe(output);
        
        // 将projects目录添加到压缩文件
        archive.directory(PROJECTS_DIR, 'projects');
        
        // 完成归档
        archive.finalize();
        
        output.on('close', () => {
            console.log(`备份完成：${backupPath}，总共 ${archive.pointer()} 字节`);
        });
    } catch (error) {
        console.error('备份失败:', error);
    }
};

// 设置定时任务：每天0时执行备份
cron.schedule('0 0 * * *', () => {
    backupProjects();
});

// 用户相关API
app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body;
        const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        
        if (usersData.users.some(user => user.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const userId = crypto.randomUUID();
        const newUser = {
            id: userId,
            username,
            password, // 实际应用中应该加密存储
            createdAt: new Date().toISOString(),
            isAdmin: false
        };

        usersData.users.push(newUser);
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
        
        res.json({ userId, username });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register' });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        
        const user = usersData.users.find(u => u.username === username && u.password === password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({ 
            userId: user.id, 
            username: user.username,
            isAdmin: user.isAdmin || false
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to login' });
    }
});

// 项目相关API
app.get('/api/projects', (req, res) => {
    try {
        const projects = fs.readdirSync(PROJECTS_DIR)
            .filter(dir => fs.statSync(path.join(PROJECTS_DIR, dir)).isDirectory())
            .map(dir => ({
                id: dir,
                name: dir
            }));
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get projects' });
    }
});

app.post('/api/projects', (req, res) => {
    try {
        const { name } = req.body;
        
        if (name === 'admin') {
            return res.status(400).json({ error: '项目名不能为admin' });
        }
        
        const projectDir = path.join(PROJECTS_DIR, name);
        if (fs.existsSync(projectDir)) {
            return res.status(400).json({ error: '项目已存在' });
        }
        
        fs.mkdirSync(projectDir);
        res.json({ success: true, id: name, name });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create project' });
    }
});

app.put('/api/projects/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        
        if (name === 'admin') {
            return res.status(400).json({ error: '项目名不能为admin' });
        }
        
        if (id === 'admin') {
            return res.status(400).json({ error: '不能修改admin项目' });
        }
        
        const oldPath = path.join(PROJECTS_DIR, id);
        const newPath = path.join(PROJECTS_DIR, name);
        
        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: '项目不存在' });
        }
        
        if (fs.existsSync(newPath) && id !== name) {
            return res.status(400).json({ error: '新项目名已存在' });
        }
        
        if (id !== name) {
            fs.renameSync(oldPath, newPath);
        }
        
        res.json({ success: true, id: name, name });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update project' });
    }
});

app.delete('/api/projects/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        if (id === 'admin') {
            return res.status(400).json({ error: '不能删除admin项目' });
        }
        
        if (id === 'gameA') {
            return res.status(400).json({ error: '不能删除默认项目' });
        }
        
        const projectDir = path.join(PROJECTS_DIR, id);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ error: '项目不存在' });
        }
        
        // 删除项目目录及其所有内容
        fs.rmdirSync(projectDir, { recursive: true });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// 获取项目下的所有思维导图列表
app.get('/api/projects/:projectId/mindmaps', (req, res) => {
    try {
        const { projectId } = req.params;
        const projectDir = path.join(PROJECTS_DIR, projectId);
        
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ error: '项目不存在' });
        }
        
        const files = fs.readdirSync(projectDir);
        const mindmaps = files
            .filter(file => file.endsWith('.json') && file !== 'onVoting.json') // 排除onVoting.json
            .map(file => {
                const data = JSON.parse(fs.readFileSync(path.join(projectDir, file), 'utf8'));
                return {
                    id: file.replace('.json', ''),
                    name: file.replace('.json', ''),
                    createdAt: data.createdAt,
                    createdBy: data.createdBy
                };
            });
        res.json(mindmaps);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read mindmaps' });
    }
});

// 获取单个思维导图
app.get('/api/projects/:projectId/mindmaps/:id', (req, res) => {
    try {
        const { projectId, id } = req.params;
        const filePath = path.join(PROJECTS_DIR, projectId, `${id}.json`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Mindmap not found' });
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read mindmap' });
    }
});

// 保存思维导图
app.post('/api/projects/:projectId/mindmaps/:id', (req, res) => {
    try {
        const { projectId, id } = req.params;
        const projectDir = path.join(PROJECTS_DIR, projectId);
        
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }
        
        const filePath = path.join(projectDir, `${id}.json`);
        const data = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save mindmap' });
    }
});

// 删除思维导图
app.delete('/api/projects/:projectId/mindmaps/:id', (req, res) => {
    try {
        const { projectId, id } = req.params;
        const filePath = path.join(PROJECTS_DIR, projectId, `${id}.json`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Mindmap not found' });
        }
        
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete mindmap' });
    }
});

// 保留旧API以兼容
app.get('/api/mindmaps', (req, res) => {
    try {
        // 默认返回gameA项目的导图
        const projectDir = path.join(PROJECTS_DIR, 'gameA');
        
        if (!fs.existsSync(projectDir)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(projectDir);
        const mindmaps = files
            .filter(file => file.endsWith('.json') && file !== 'onVoting.json') // 排除onVoting.json
            .map(file => {
                const data = JSON.parse(fs.readFileSync(path.join(projectDir, file), 'utf8'));
                return {
                    id: file.replace('.json', ''),
                    name: file.replace('.json', ''),
                    createdAt: data.createdAt,
                    createdBy: data.createdBy
                };
            });
        res.json(mindmaps);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read mindmaps' });
    }
});

app.get('/api/mindmaps/:id', (req, res) => {
    try {
        // 默认访问gameA项目的导图
        const filePath = path.join(PROJECTS_DIR, 'gameA', `${req.params.id}.json`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Mindmap not found' });
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read mindmap' });
    }
});

app.post('/api/mindmaps/:id', (req, res) => {
    try {
        // 默认保存到gameA项目
        const projectDir = path.join(PROJECTS_DIR, 'gameA');
        
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }
        
        const filePath = path.join(projectDir, `${req.params.id}.json`);
        const data = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save mindmap' });
    }
});

app.delete('/api/mindmaps/:id', (req, res) => {
    try {
        // 默认删除gameA项目的导图
        const filePath = path.join(PROJECTS_DIR, 'gameA', `${req.params.id}.json`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Mindmap not found' });
        }
        
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete mindmap' });
    }
});

// 获取项目下的onVoting.json文件
app.get('/api/projects/:projectId/onVoting.json', (req, res) => {
    try {
        const { projectId } = req.params;
        const filePath = path.join(PROJECTS_DIR, projectId, 'onVoting.json');
        
        if (!fs.existsSync(filePath)) {
            // 如果文件不存在则创建一个空的
            fs.writeFileSync(filePath, JSON.stringify({ nodes: [] }, null, 2));
            return res.json({ nodes: [] });
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Failed to read onVoting.json:', error);
        res.status(500).json({ error: 'Failed to read onVoting.json' });
    }
});

// 保存项目下的onVoting.json文件
app.post('/api/projects/:projectId/onVoting.json', (req, res) => {
    try {
        const { projectId } = req.params;
        const projectDir = path.join(PROJECTS_DIR, projectId);
        
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }
        
        const filePath = path.join(projectDir, 'onVoting.json');
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
        
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to save onVoting.json:', error);
        res.status(500).json({ error: 'Failed to save onVoting.json' });
    }
});

// 手动触发备份的API（测试用）
app.post('/api/backup', (req, res) => {
    try {
        backupProjects();
        res.json({ success: true, message: '备份已启动' });
    } catch (error) {
        res.status(500).json({ error: '备份失败' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 