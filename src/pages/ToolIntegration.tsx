import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle, AlertCircle, XCircle, RefreshCw, Plus, BarChart3, Activity, ExternalLink, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// API配置
const API_BASE_URL = 'http://localhost:8001/api';

interface Tool {
  id: string;
  name: string;
  type: string;
  category: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'connecting';
  health: 'healthy' | 'warning' | 'error';
  version: string;
  lastSync: string;
  metrics: Record<string, any>;
}

interface IntegrationStat {
  name: string;
  value: number;
  color: string;
}

interface HealthTrendData {
  time: string;
  healthy: number;
  warning: number;
  error: number;
}

interface AvailableTool {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: React.ComponentType<any>;
  supported: boolean;
}

// 工具集成API
const toolAPI = {
  // 获取配置信息
  getConfig: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/config`);
      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('获取配置失败:', error);
      return null;
    }
  },

  // 检查单个工具连接状态
  checkToolConnection: async (toolName: string, endpoint: string, toolType: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tools/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: toolName,
          endpoint: endpoint,
          type: toolType
        })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`检查${toolName}状态失败:`, error);
      return { success: false, status: 'disconnected', message: '连接失败' };
    }
  },

  // 批量检查工具状态
  checkToolsStatus: async (tools: Array<{name: string, endpoint: string, type: string}>) => {
    const results: any = {};
    for (const tool of tools) {
      const result = await toolAPI.checkToolConnection(tool.name, tool.endpoint, tool.type);
      results[tool.name.toLowerCase()] = {
        status: result.status || 'disconnected',
        health: result.success ? 'healthy' : 'error',
        version: result.version || 'Unknown',
        metrics: result.metrics || {}
      };
    }
    return results;
  }
};

const ToolIntegration: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [integratedTools, setIntegratedTools] = useState<Tool[]>([]);
  const [integrationStats, setIntegrationStats] = useState<IntegrationStat[]>([]);
  const [healthTrend, setHealthTrend] = useState<HealthTrendData[]>([]);
  const [config, setConfig] = useState<any>(null);

  // 可用工具列表
  const availableTools: AvailableTool[] = [
    {
      id: 'zabbix',
      name: 'Zabbix',
      type: '监控工具',
      description: '企业级网络监控解决方案',
      icon: Activity,
      supported: false
    },
    {
      id: 'nagios',
      name: 'Nagios',
      type: '监控工具',
      description: '开源IT基础设施监控',
      icon: Activity,
      supported: false
    },
    {
      id: 'splunk',
      name: 'Splunk',
      type: '日志分析',
      description: '机器数据分析平台',
      icon: BarChart3,
      supported: false
    },
    {
      id: 'datadog',
      name: 'Datadog',
      type: '监控工具',
      description: '云规模监控和分析',
      icon: Activity,
      supported: false
    },
    {
      id: 'ansible',
      name: 'Ansible',
      type: '自动化工具',
      description: 'IT自动化和配置管理',
      icon: Settings,
      supported: false
    }
  ];

  // 加载工具集成状态
  const loadToolsStatus = async () => {
    try {
      setLoading(true);
      
      // 获取配置
      const configData = await toolAPI.getConfig();
      setConfig(configData.data);
      
      if (!configData.data) {
        setIntegratedTools([]);
        setIntegrationStats([]);
        return;
      }
      
      // 准备要检查的工具列表
      const toolsToCheck = [];
      
      if (configData.data.monitoring?.prometheus?.enabled) {
        toolsToCheck.push({
          name: 'Prometheus',
          endpoint: configData.data.monitoring.prometheus.url || 'http://localhost:9090',
          type: 'monitoring'
        });
      }
      
      if (configData.data.monitoring?.elk?.enabled) {
        toolsToCheck.push({
          name: 'Elasticsearch',
          endpoint: configData.data.monitoring.elk.elasticsearch_url || 'http://localhost:9200',
          type: 'elk'
        });
        toolsToCheck.push({
          name: 'Kibana',
          endpoint: configData.data.monitoring.elk.kibana_url || 'http://localhost:5601',
          type: 'elk'
        });
      }
      
      if (configData.data.monitoring?.grafana?.enabled) {
        toolsToCheck.push({
          name: 'Grafana',
          endpoint: configData.data.monitoring.grafana.url || 'http://localhost:3000',
          type: 'monitoring'
        });
      }
      
      // 检查工具状态
      const toolsStatus = await toolAPI.checkToolsStatus(toolsToCheck);
      
      // 构建集成工具列表
      const tools: Tool[] = [];
      
      // Prometheus
      if (configData.data.monitoring?.prometheus?.enabled) {
        tools.push({
          id: 'prometheus',
          name: 'Prometheus',
          type: '监控工具',
          category: 'monitoring',
          endpoint: configData.data.monitoring.prometheus.url || 'http://localhost:9090',
          status: toolsStatus.prometheus?.status || 'disconnected',
          health: toolsStatus.prometheus?.health || 'error',
          version: toolsStatus.prometheus?.version || 'Unknown',
          lastSync: new Date().toLocaleString(),
          metrics: toolsStatus.prometheus?.metrics || {}
        });
      }
      
      // Elasticsearch
      if (configData.data.monitoring?.elk?.enabled) {
        tools.push({
          id: 'elasticsearch',
          name: 'Elasticsearch',
          type: '搜索引擎',
          category: 'elk',
          endpoint: configData.data.monitoring.elk.elasticsearch_url || 'http://localhost:9200',
          status: toolsStatus.elasticsearch?.status || 'disconnected',
          health: toolsStatus.elasticsearch?.health || 'error',
          version: toolsStatus.elasticsearch?.version || 'Unknown',
          lastSync: new Date().toLocaleString(),
          metrics: toolsStatus.elasticsearch?.metrics || {}
        });
        
        // Kibana
        tools.push({
          id: 'kibana',
          name: 'Kibana',
          type: '数据可视化',
          category: 'elk',
          endpoint: configData.data.monitoring.elk.kibana_url || 'http://localhost:5601',
          status: toolsStatus.kibana?.status || 'disconnected',
          health: toolsStatus.kibana?.health || 'error',
          version: toolsStatus.kibana?.version || 'Unknown',
          lastSync: new Date().toLocaleString(),
          metrics: toolsStatus.kibana?.metrics || {}
        });
      }
      
      // Grafana
      if (configData.data.monitoring?.grafana?.enabled) {
        tools.push({
          id: 'grafana',
          name: 'Grafana',
          type: '数据可视化',
          category: 'monitoring',
          endpoint: configData.data.monitoring.grafana.url || 'http://localhost:3000',
          status: toolsStatus.grafana?.status || 'disconnected',
          health: toolsStatus.grafana?.health || 'error',
          version: toolsStatus.grafana?.version || 'Unknown',
          lastSync: new Date().toLocaleString(),
          metrics: toolsStatus.grafana?.metrics || {}
        });
      }
      
      setIntegratedTools(tools);
      
      // 更新统计数据
      const stats: IntegrationStat[] = [
        {
          name: '监控工具',
          value: tools.filter(t => t.category === 'monitoring').length,
          color: '#3b82f6'
        },
        {
          name: 'ELK Stack',
          value: tools.filter(t => t.category === 'elk').length,
          color: '#10b981'
        },
        {
          name: 'CI/CD',
          value: tools.filter(t => t.category === 'cicd').length,
          color: '#f59e0b'
        },
        {
          name: '容器工具',
          value: tools.filter(t => t.category === 'container').length,
          color: '#ef4444'
        }
      ].filter(stat => stat.value > 0);
      
      setIntegrationStats(stats);
      
      // 更新健康趋势数据
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const healthyCount = tools.filter(t => t.health === 'healthy').length;
      const warningCount = tools.filter(t => t.health === 'warning').length;
      const errorCount = tools.filter(t => t.health === 'error').length;
      
      setHealthTrend(prev => {
        const newTrend = [...prev, {
          time: timeStr,
          healthy: healthyCount,
          warning: warningCount,
          error: errorCount
        }];
        return newTrend.slice(-10); // 保留最近10条记录
      });
      
    } catch (error) {
      console.error('加载工具状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新工具状态
  const refreshToolsStatus = async () => {
    setRefreshing(true);
    await loadToolsStatus();
    setRefreshing(false);
  };

  // 初始化加载
  useEffect(() => {
    loadToolsStatus();
  }, []);

  // 过滤工具
  const filteredTools = selectedCategory === 'all' 
    ? integratedTools 
    : integratedTools.filter(tool => tool.category === selectedCategory);

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'connecting':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'disconnected':
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  // 获取健康状态图标
  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  // 获取状态徽章样式
  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'connected':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'connecting':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'disconnected':
      default:
        return `${baseClasses} bg-red-100 text-red-800`;
    }
  };

  // 获取类别图标
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'monitoring':
        return <Activity className="w-5 h-5 text-blue-500" />;
      case 'elk':
        return <BarChart3 className="w-5 h-5 text-green-500" />;
      case 'cicd':
        return <Settings className="w-5 h-5 text-orange-500" />;
      case 'container':
        return <Settings className="w-5 h-5 text-purple-500" />;
      default:
        return <Settings className="w-5 h-5 text-gray-500" />;
    }
  };

  const healthyCount = integratedTools.filter(tool => tool.health === 'healthy').length;
  const warningCount = integratedTools.filter(tool => tool.health === 'warning').length;
  const errorCount = integratedTools.filter(tool => tool.health === 'error').length;

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">工具集成</h1>
        <div className="flex items-center space-x-3">
          <button 
            onClick={refreshToolsStatus}
            disabled={refreshing}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新状态
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加集成
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">正在加载工具集成状态...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* 统计概览 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">已集成工具</p>
                  <p className="text-2xl font-bold text-blue-600">{integratedTools.length}</p>
                </div>
                <Settings className="w-8 h-8 text-blue-600" />
              </div>
              <div className="mt-4 text-sm text-blue-600">
                <span>{integratedTools.filter(t => t.status === 'connected').length}个已连接</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">健康状态</p>
                  <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="mt-4 text-sm text-green-600">
                <span>正常运行</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">警告状态</p>
                  <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
              <div className="mt-4 text-sm text-yellow-600">
                <span>需要关注</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">错误状态</p>
                  <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="mt-4 text-sm text-red-600">
                <span>需要修复</span>
              </div>
            </div>
          </div>

          {/* 标签页导航 */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                概览
              </button>
              <button
                onClick={() => setActiveTab('tools')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'tools'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                集成工具
              </button>
              <button
                onClick={() => setActiveTab('marketplace')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'marketplace'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                工具市场
              </button>
            </nav>
          </div>

          {/* 概览标签页 */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 集成分布 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">集成工具分布</h3>
                  {integrationStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={integrationStats}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {integrationStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>暂无集成工具</p>
                        <p className="text-sm">请先在配置管理中启用相关服务</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 健康状态趋势 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">健康状态趋势</h3>
                  {healthTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={healthTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="healthy" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="warning" stroke="#f59e0b" strokeWidth={2} />
                        <Line type="monotone" dataKey="error" stroke="#ef4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>暂无趋势数据</p>
                        <p className="text-sm">数据将在工具运行后显示</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 快速概览 */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">集成工具概览</h3>
                </div>
                <div className="p-6">
                  {integratedTools.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {integratedTools.slice(0, 4).map((tool) => (
                        <div key={tool.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              {getCategoryIcon(tool.category)}
                              <span className="ml-2 font-medium text-gray-900">{tool.name}</span>
                            </div>
                            {getStatusIcon(tool.status)}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">状态:</span>
                              <span className={`text-sm ${
                                tool.status === 'connected' ? 'text-green-600' :
                                tool.status === 'disconnected' ? 'text-red-600' : 'text-blue-600'
                              }`}>
                                {tool.status === 'connected' ? '已连接' : 
                                 tool.status === 'disconnected' ? '已断开' : '连接中'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              最后同步: {tool.lastSync}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">暂无集成工具</p>
                      <p className="text-sm text-gray-400 mt-2">请在配置管理中启用相关服务</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 集成工具标签页 */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              {/* 过滤器 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="all">所有类别</option>
                    <option value="elk">ELK Stack</option>
                    <option value="monitoring">监控工具</option>
                    <option value="cicd">CI/CD</option>
                    <option value="container">容器工具</option>
                  </select>
                  <button 
                    onClick={refreshToolsStatus}
                    disabled={refreshing}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    刷新状态
                  </button>
                </div>
              </div>

              {/* 工具列表 */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">集成工具详情</h3>
                </div>
                <div className="overflow-x-auto">
                  {filteredTools.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            工具信息
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            类型
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            状态
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            健康状态
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            版本
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTools.map((tool) => (
                          <tr key={tool.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                {getCategoryIcon(tool.category)}
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">{tool.name}</p>
                                  <p className="text-sm text-gray-500">{tool.endpoint}</p>
                                  <p className="text-xs text-gray-400">最后同步: {tool.lastSync}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {tool.type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {getStatusIcon(tool.status)}
                                <span className={`ml-2 ${getStatusBadge(tool.status)}`}>
                                  {tool.status === 'connected' ? '已连接' : 
                                   tool.status === 'disconnected' ? '已断开' : '连接中'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {getHealthIcon(tool.health)}
                                <span className={`ml-2 text-sm ${
                                  tool.health === 'healthy' ? 'text-green-600' :
                                  tool.health === 'warning' ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {tool.health === 'healthy' ? '健康' :
                                   tool.health === 'warning' ? '警告' : '错误'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {tool.version}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button className="text-blue-600 hover:text-blue-900 mr-3">
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button className="text-green-600 hover:text-green-900 mr-3">测试</button>
                              <button className="text-gray-600 hover:text-gray-900 mr-3">配置</button>
                              <button className="text-red-600 hover:text-red-900">移除</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-12">
                      <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">暂无集成工具</p>
                      <p className="text-sm text-gray-400 mt-2">请在配置管理中启用相关服务</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 工具市场标签页 */}
          {activeTab === 'marketplace' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">可用工具</h3>
                  <p className="text-sm text-gray-600 mt-1">选择要集成的运维工具</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableTools.map((tool) => {
                      const IconComponent = tool.icon;
                      return (
                        <div key={tool.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <IconComponent className="w-8 h-8 text-blue-500" />
                              <span className="ml-3 font-medium text-gray-900">{tool.name}</span>
                            </div>
                            {tool.supported ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                支持
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                计划中
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">类型: {tool.type}</p>
                            <p className="text-sm text-gray-600">{tool.description}</p>
                          </div>
                          <div className="mt-4">
                            {tool.supported ? (
                              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                                添加集成
                              </button>
                            ) : (
                              <button className="w-full bg-gray-300 text-gray-500 px-4 py-2 rounded-md text-sm cursor-not-allowed" disabled>
                                即将支持
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ToolIntegration;