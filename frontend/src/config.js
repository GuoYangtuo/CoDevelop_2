// API基础URL配置
const config = {
  // 开发环境API基础URL
  development: {
    apiBaseUrl: 'http://127.0.0.1:3001'
  },
  // 生产环境API基础URL
  production: {
    apiBaseUrl: 'http://175.178.61.89:3001'
  }
};

// 根据当前环境选择对应的配置
const env = process.env.NODE_ENV || 'development';
const currentConfig = config[env];

// 导出配置
export const API_BASE_URL = currentConfig.apiBaseUrl;

// 导出API路径创建函数
export const createApiPath = (path) => {
  // 确保path以/开头
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${formattedPath}`;
}; 