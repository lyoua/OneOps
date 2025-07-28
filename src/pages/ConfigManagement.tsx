import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle, Database, FileText, Bell, Shield, Plus, Trash2, Edit3 } from 'lucide-react';

// API配置
const API_BASE_URL = 'http://localhost:8001/api';

// API调用函数
const configAPI = {
  // 获取所有配置
  getConfig: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/config`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取配置失败:', error);
      throw error;
    }
  },

  // 更新配置
  updateConfig: async (config: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新配置失败:', error);
      throw error;
    }
  },

  // 更新配置节
  updateConfigSection: async (section: string, sectionData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/section/${section}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sectionData),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新配置节失败:', error);
      throw error;
    }
  },

  // 重置配置
  resetConfig: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/reset`, {
        method: 'POST',
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('重置配置失败:', error);
      throw error;
    }
  },

  // 健康检查
  healthCheck: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('健康检查失败:', error);
      throw error;
    }
  },

  // 自定义索引管理API
  getCustomIndices: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/custom-indices`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取自定义索引失败:', error);
      throw error;
    }
  },

  addCustomIndex: async (name: string, description: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/custom-indices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('添加自定义索引失败:', error);
      throw error;
    }
  },

  updateCustomIndex: async (name: string, description: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/custom-indices/${name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新自定义索引失败:', error);
      throw error;
    }
  },

  deleteCustomIndex: async (name: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/custom-indices/${name}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('删除自定义索引失败:', error);
      throw error;
    }
  },

  // 自定义索引状态管理API
  getCustomIndexStatus: async (name: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/custom-indices/${name}/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取自定义索引状态失败:', error);
      throw error;
    }
  },

  updateCustomIndexStatus: async (name: string, status: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/custom-indices/${name}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新自定义索引状态失败:', error);
      throw error;
    }
  }
};

const ConfigManagement: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [customIndices, setCustomIndices] = useState<any[]>([]);
  const [newIndexName, setNewIndexName] = useState('');
  const [newIndexDescription, setNewIndexDescription] = useState('');
  const [editingIndex, setEditingIndex] = useState<string | null>(null);

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // 检查后端状态
  const checkBackendStatus = async () => {
    setBackendStatus('checking');
    try {
      await configAPI.healthCheck();
      setBackendStatus('connected');
    } catch (error) {
      setBackendStatus('disconnected');
    }
  };

  // 加载配置
  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await configAPI.getConfig();
      if (response.success) {
        setConfig(response.data);
      } else {
        setError(response.message || '加载配置失败');
      }
    } catch (error) {
      setError('无法连接到后端服务，请确保后端服务正在运行');
    } finally {
      setLoading(false);
    }
  };

  // 加载自定义索引
  const loadCustomIndices = async () => {
    try {
      const response = await configAPI.getCustomIndices();
      if (response.success) {
        setCustomIndices(response.data || []);
      }
    } catch (error) {
      console.error('加载自定义索引失败:', error);
    }
  };

  // 添加自定义索引
  const addCustomIndex = async () => {
    if (!newIndexName.trim()) {
      showMessage('error', '请输入索引名称');
      return;
    }

    try {
      const response = await configAPI.addCustomIndex(newIndexName.trim(), newIndexDescription.trim());
      if (response.success) {
        setNewIndexName('');
        setNewIndexDescription('');
        loadCustomIndices();
        showMessage('success', '自定义索引添加成功');
      } else {
        showMessage('error', response.message || '添加自定义索引失败');
      }
    } catch (error) {
      showMessage('error', '添加自定义索引时发生错误');
    }
  };

  // 更新自定义索引
  const updateCustomIndex = async (name: string, description: string) => {
    try {
      const response = await configAPI.updateCustomIndex(name, description);
      if (response.success) {
        setEditingIndex(null);
        loadCustomIndices();
        showMessage('success', '自定义索引更新成功');
      } else {
        showMessage('error', response.message || '更新自定义索引失败');
      }
    } catch (error) {
      showMessage('error', '更新自定义索引时发生错误');
    }
  };

  // 删除自定义索引
  const deleteCustomIndex = async (name: string) => {
    if (!confirm(`确定要删除自定义索引 "${name}" 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const response = await configAPI.deleteCustomIndex(name);
      if (response.success) {
        loadCustomIndices();
        showMessage('success', '自定义索引删除成功');
      } else {
        showMessage('error', response.message || '删除自定义索引失败');
      }
    } catch (error) {
      showMessage('error', '删除自定义索引时发生错误');
    }
  };

  // 保存配置
  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await configAPI.updateConfig(config);
      if (response.success) {
        setConfig(response.data);
        showMessage('success', '配置保存成功');
      } else {
        showMessage('error', response.message || '保存配置失败');
      }
    } catch (error) {
      showMessage('error', '保存配置时发生错误');
    } finally {
      setSaving(false);
    }
  };

  // 重置配置
  const resetConfig = async () => {
    if (!confirm('确定要重置所有配置为默认值吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      setSaving(true);
      const response = await configAPI.resetConfig();
      if (response.success) {
        setConfig(response.data);
        showMessage('success', '配置重置成功');
      } else {
        showMessage('error', response.message || '重置配置失败');
      }
    } catch (error) {
      showMessage('error', '重置配置时发生错误');
    } finally {
      setSaving(false);
    }
  };

  // 更新配置值
  const updateConfigValue = (section: string, key: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  // 开始编辑
  const startEdit = (fieldPath: string, currentValue: any) => {
    setEditingField(fieldPath);
    setEditValues({ [fieldPath]: currentValue });
  };

  // 保存单个字段
  const saveField = async (fieldPath: string) => {
    const pathParts = fieldPath.split('.');
    const newValue = editValues[fieldPath];
    
    try {
      setSaving(true);
      
      // 创建新的配置对象
      const newConfig = { ...config };
      
      // 根据路径深度设置值
      if (pathParts.length === 2) {
        const [section, key] = pathParts;
        newConfig[section] = { ...newConfig[section], [key]: newValue };
      } else if (pathParts.length === 3) {
        const [section, subsection, key] = pathParts;
        newConfig[section] = {
          ...newConfig[section],
          [subsection]: {
            ...newConfig[section][subsection],
            [key]: newValue
          }
        };
      } else if (pathParts.length === 4) {
        const [section, subsection, subsubsection, key] = pathParts;
        newConfig[section] = {
          ...newConfig[section],
          [subsection]: {
            ...newConfig[section][subsection],
            [subsubsection]: {
              ...newConfig[section][subsection][subsubsection],
              [key]: newValue
            }
          }
        };
      }
      
      // 保存整个配置
      const response = await configAPI.updateConfig(newConfig);
      
      if (response.success) {
        setConfig(response.data);
        setEditingField(null);
        setEditValues({});
        showMessage('success', '配置保存成功');
      } else {
        showMessage('error', response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存配置时发生错误:', error);
      showMessage('error', '保存时发生错误');
    } finally {
      setSaving(false);
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingField(null);
    setEditValues({});
  };

  // 渲染配置项
  const renderConfigItem = (section: string, key: string, value: any, label: string, type: string = 'text') => {
    const fieldPath = `${section}.${key}`;
    const isEditing = editingField === fieldPath;
    const isPassword = type === 'password';
    const showPassword = showPasswords[fieldPath];
    
    return (
      <div key={fieldPath} className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">{label}</label>
          {!isEditing && (
            <button
              onClick={() => startEdit(fieldPath, value)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              编辑
            </button>
          )}
        </div>
        
        {isEditing ? (
          <div className="flex items-center space-x-2">
            {type === 'boolean' ? (
              <select
                value={editValues[fieldPath]?.toString()}
                onChange={(e) => setEditValues({ ...editValues, [fieldPath]: e.target.value === 'true' })}
                className="border border-gray-300 rounded-md px-3 py-2 flex-1"
              >
                <option value="true">启用</option>
                <option value="false">禁用</option>
              </select>
            ) : type === 'number' ? (
              <input
                type="number"
                value={editValues[fieldPath] || ''}
                onChange={(e) => setEditValues({ ...editValues, [fieldPath]: parseInt(e.target.value) || 0 })}
                className="border border-gray-300 rounded-md px-3 py-2 flex-1"
              />
            ) : (
              <input
                type={isPassword && !showPassword ? 'password' : 'text'}
                value={editValues[fieldPath] || ''}
                onChange={(e) => setEditValues({ ...editValues, [fieldPath]: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 flex-1"
              />
            )}
            
            {isPassword && (
              <button
                onClick={() => setShowPasswords({ ...showPasswords, [fieldPath]: !showPassword })}
                className="text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
            
            <button
              onClick={() => saveField(fieldPath)}
              disabled={saving}
              className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
            
            <button
              onClick={cancelEdit}
              className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            {type === 'boolean' ? (value ? '启用' : '禁用') : 
             isPassword ? '••••••••' : 
             value?.toString() || '未设置'}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    checkBackendStatus();
    loadConfig();
    loadCustomIndices();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>正在加载配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">配置管理</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected' ? 'bg-green-500' :
              backendStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            <span className={`text-sm ${
              backendStatus === 'connected' ? 'text-green-600' :
              backendStatus === 'disconnected' ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {backendStatus === 'connected' ? '后端已连接' :
               backendStatus === 'disconnected' ? '后端未连接' : '检查中...'}
            </span>
            <button
              onClick={checkBackendStatus}
              className="text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${backendStatus === 'checking' ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={loadConfig}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新配置
          </button>
          
          <button
            onClick={saveConfig}
            disabled={saving || backendStatus !== 'connected'}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            保存所有配置
          </button>
          
          <button
            onClick={resetConfig}
            disabled={saving || backendStatus !== 'connected'}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            重置配置
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className={`p-4 rounded-md flex items-center ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.type === 'success' ? 
            <CheckCircle className="w-5 h-5 mr-2" /> : 
            <AlertCircle className="w-5 h-5 mr-2" />
          }
          {message.text}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 配置内容 */}
      {config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 系统配置 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Settings className="w-6 h-6 text-blue-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">系统配置</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {config.system && (
                <>
                  {renderConfigItem('system', 'platform_name', config.system.platform_name, '平台名称')}
                  {renderConfigItem('system', 'version', config.system.version, '版本号')}
                  {renderConfigItem('system', 'timezone', config.system.timezone, '时区')}
                  {renderConfigItem('system', 'language', config.system.language, '语言')}
                  {renderConfigItem('system', 'theme', config.system.theme, '主题')}
                  {renderConfigItem('system', 'auto_refresh', config.system.auto_refresh, '自动刷新', 'boolean')}
                  {renderConfigItem('system', 'refresh_interval', config.system.refresh_interval, '刷新间隔(秒)', 'number')}
                </>
              )}
            </div>
          </div>

          {/* 监控配置 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Database className="w-6 h-6 text-green-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">监控配置</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {config.monitoring && (
                <>
                  {/* Prometheus配置 */}
                  {config.monitoring.prometheus && (
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium text-gray-900 mb-2">Prometheus</h4>
                      {renderConfigItem('monitoring.prometheus', 'enabled', config.monitoring.prometheus.enabled, '启用状态', 'boolean')}
                      {renderConfigItem('monitoring.prometheus', 'url', config.monitoring.prometheus.url, '服务地址')}
                      {renderConfigItem('monitoring.prometheus', 'timeout', config.monitoring.prometheus.timeout, '超时时间(秒)', 'number')}
                    </div>
                  )}
                  
                  {/* ELK配置 */}
                  {config.monitoring.elk && (
                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium text-gray-900 mb-2">ELK Stack</h4>
                      {renderConfigItem('monitoring.elk', 'enabled', config.monitoring.elk.enabled, '启用状态', 'boolean')}
                      {renderConfigItem('monitoring.elk', 'elasticsearch_url', config.monitoring.elk.elasticsearch_url, 'Elasticsearch地址')}
                      {renderConfigItem('monitoring.elk', 'kibana_url', config.monitoring.elk.kibana_url, 'Kibana地址')}
                      {renderConfigItem('monitoring.elk', 'logstash_url', config.monitoring.elk.logstash_url, 'Logstash地址')}
                    </div>
                  )}
                  
                  {/* Grafana配置 */}
                  {config.monitoring.grafana && (
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-medium text-gray-900 mb-2">Grafana</h4>
                      {renderConfigItem('monitoring.grafana', 'enabled', config.monitoring.grafana.enabled, '启用状态', 'boolean')}
                      {renderConfigItem('monitoring.grafana', 'url', config.monitoring.grafana.url, '服务地址')}
                      {renderConfigItem('monitoring.grafana', 'api_key', config.monitoring.grafana.api_key, 'API密钥', 'password')}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 告警配置 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Bell className="w-6 h-6 text-yellow-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">告警配置</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {config.alerts && (
                <>
                  {/* 邮件告警 */}
                  {config.alerts.email && (
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium text-gray-900 mb-2">邮件告警</h4>
                      {renderConfigItem('alerts.email', 'enabled', config.alerts.email.enabled, '启用状态', 'boolean')}
                      {renderConfigItem('alerts.email', 'smtp_server', config.alerts.email.smtp_server, 'SMTP服务器')}
                      {renderConfigItem('alerts.email', 'smtp_port', config.alerts.email.smtp_port, 'SMTP端口', 'number')}
                      {renderConfigItem('alerts.email', 'username', config.alerts.email.username, '用户名')}
                      {renderConfigItem('alerts.email', 'password', config.alerts.email.password, '密码', 'password')}
                      {renderConfigItem('alerts.email', 'from_email', config.alerts.email.from_email, '发件人邮箱')}
                    </div>
                  )}
                  
                  {/* Webhook告警 */}
                  {config.alerts.webhook && (
                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium text-gray-900 mb-2">Webhook告警</h4>
                      {renderConfigItem('alerts.webhook', 'enabled', config.alerts.webhook.enabled, '启用状态', 'boolean')}
                      {renderConfigItem('alerts.webhook', 'url', config.alerts.webhook.url, 'Webhook地址')}
                      {renderConfigItem('alerts.webhook', 'timeout', config.alerts.webhook.timeout, '超时时间(秒)', 'number')}
                    </div>
                  )}
                  
                  {/* 钉钉告警 */}
                  {config.alerts.dingtalk && (
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-medium text-gray-900 mb-2">钉钉告警</h4>
                      {renderConfigItem('alerts.dingtalk', 'enabled', config.alerts.dingtalk.enabled, '启用状态', 'boolean')}
                      {renderConfigItem('alerts.dingtalk', 'webhook_url', config.alerts.dingtalk.webhook_url, 'Webhook地址')}
                      {renderConfigItem('alerts.dingtalk', 'secret', config.alerts.dingtalk.secret, '密钥', 'password')}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 安全配置 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Shield className="w-6 h-6 text-red-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">安全配置</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {config.security && (
                <>
                  {renderConfigItem('security', 'session_timeout', config.security.session_timeout, '会话超时(秒)', 'number')}
                  {renderConfigItem('security', 'max_login_attempts', config.security.max_login_attempts, '最大登录尝试次数', 'number')}
                  
                  {config.security.password_policy && (
                    <div className="border-l-4 border-red-500 pl-4">
                      <h4 className="font-medium text-gray-900 mb-2">密码策略</h4>
                      {renderConfigItem('security.password_policy', 'min_length', config.security.password_policy.min_length, '最小长度', 'number')}
                      {renderConfigItem('security.password_policy', 'require_uppercase', config.security.password_policy.require_uppercase, '需要大写字母', 'boolean')}
                      {renderConfigItem('security.password_policy', 'require_lowercase', config.security.password_policy.require_lowercase, '需要小写字母', 'boolean')}
                      {renderConfigItem('security.password_policy', 'require_numbers', config.security.password_policy.require_numbers, '需要数字', 'boolean')}
                      {renderConfigItem('security.password_policy', 'require_special_chars', config.security.password_policy.require_special_chars, '需要特殊字符', 'boolean')}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 数据库配置 */}
          <div className="bg-white rounded-lg shadow lg:col-span-2">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Database className="w-6 h-6 text-purple-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">数据库配置</h3>
              </div>
            </div>
            <div className="p-6">
              {config.database && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderConfigItem('database', 'type', config.database.type, '数据库类型')}
                  {renderConfigItem('database', 'host', config.database.host, '主机地址')}
                  {renderConfigItem('database', 'port', config.database.port, '端口', 'number')}
                  {renderConfigItem('database', 'name', config.database.name, '数据库名')}
                  {renderConfigItem('database', 'username', config.database.username, '用户名')}
                  {renderConfigItem('database', 'password', config.database.password, '密码', 'password')}
                </div>
              )}
            </div>
          </div>

          {/* 自定义索引管理 */}
          <div className="bg-white rounded-lg shadow lg:col-span-2">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="w-6 h-6 text-indigo-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">自定义索引管理</h3>
                </div>
                <button
                  onClick={loadCustomIndices}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* 添加新索引 */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">添加新索引</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="索引名称"
                    value={newIndexName}
                    onChange={(e) => setNewIndexName(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="索引描述"
                    value={newIndexDescription}
                    onChange={(e) => setNewIndexDescription(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2"
                  />
                  <button
                    onClick={addCustomIndex}
                    disabled={!newIndexName.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    添加索引
                  </button>
                </div>
              </div>

              {/* 索引列表 */}
              <div className="space-y-3">
                {customIndices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无自定义索引</p>
                  </div>
                ) : (
                  customIndices.map((index) => (
                    <div key={index.name} className="border border-gray-200 rounded-lg p-4">
                      {editingIndex === index.name ? (
                        <div className="flex items-center space-x-3">
                          <input
                            type="text"
                            value={index.name}
                            disabled
                            className="border border-gray-300 rounded-md px-3 py-2 bg-gray-100 flex-1"
                          />
                          <input
                            type="text"
                            value={index.description || ''}
                            onChange={(e) => {
                              const updatedIndices = customIndices.map(idx => 
                                idx.name === index.name ? { ...idx, description: e.target.value } : idx
                              );
                              setCustomIndices(updatedIndices);
                            }}
                            className="border border-gray-300 rounded-md px-3 py-2 flex-1"
                            placeholder="索引描述"
                          />
                          <button
                            onClick={() => updateCustomIndex(index.name, index.description || '')}
                            className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{index.name}</div>
                            <div className="text-sm text-gray-600">{index.description || '无描述'}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              创建时间: {new Date(index.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setEditingIndex(index.name)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="编辑"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteCustomIndex(index.name)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigManagement;