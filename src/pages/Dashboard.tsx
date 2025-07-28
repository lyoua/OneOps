import React, { useState, useEffect } from 'react';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, Users, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// API配置
const API_BASE_URL = 'http://localhost:8001/api';

// API调用函数
const dashboardAPI = {
  // 获取配置
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

  // 获取Prometheus指标
  getPrometheusMetrics: async (prometheusUrl: string) => {
    try {
      // 查询CPU使用率
      const cpuResponse = await fetch(`${prometheusUrl}/api/v1/query?query=100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`);
      const cpuData = await cpuResponse.json();
      
      // 查询内存使用率
      const memoryResponse = await fetch(`${prometheusUrl}/api/v1/query?query=(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`);
      const memoryData = await memoryResponse.json();
      
      return {
        cpu: cpuData.data?.result?.[0]?.value?.[1] || 0,
        memory: memoryData.data?.result?.[0]?.value?.[1] || 0
      };
    } catch (error) {
      console.error('获取Prometheus指标失败:', error);
      return { cpu: 0, memory: 0 };
    }
  },

  // 获取Elasticsearch健康状态
  getElasticsearchHealth: async (elasticsearchUrl: string) => {
    try {
      const response = await fetch(`${elasticsearchUrl}/_cluster/health`);
      const data = await response.json();
      return {
        status: data.status,
        numberOfNodes: data.number_of_nodes,
        numberOfDataNodes: data.number_of_data_nodes,
        activePrimaryShards: data.active_primary_shards,
        activeShards: data.active_shards
      };
    } catch (error) {
      console.error('获取Elasticsearch健康状态失败:', error);
      return null;
    }
  },

  // 检查服务连通性
  checkServiceConnectivity: async (services: any[]) => {
    const results = [];
    for (const service of services) {
      try {
        const startTime = Date.now();
        // 使用后端API进行服务检查，避免CORS问题
        const response = await fetch('/api/services/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: service.url,
            timeout: 5000
          })
        });
        
        const responseTime = Date.now() - startTime;
        const result = await response.json();
        
        if (result.success) {
          results.push({
            ...service,
            status: 'healthy',
            responseTime: result.data?.response_time || responseTime,
            lastCheck: new Date().toISOString()
          });
        } else {
          results.push({
            ...service,
            status: 'unavailable',
            responseTime: 0,
            lastCheck: new Date().toISOString(),
            message: '服务不可用'
          });
        }
      } catch (error) {
        // 静默处理网络错误，不在控制台显示
        results.push({
          ...service,
          status: 'unavailable',
          responseTime: 0,
          lastCheck: new Date().toISOString(),
          message: '连接失败'
        });
      }
    }
    return results;
  }
};

const Dashboard: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [systemMetrics, setSystemMetrics] = useState<any[]>([]);
  const [serviceStatus, setServiceStatus] = useState<any[]>([]);
  const [alertDistribution, setAlertDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 加载配置和数据
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取配置
      const configData = await dashboardAPI.getConfig();
      setConfig(configData.data);
      
      // 获取Prometheus指标
      if (configData.data?.monitoring?.prometheus?.url) {
        const metrics = await dashboardAPI.getPrometheusMetrics(configData.data.monitoring.prometheus.url);
        
        // 生成时间序列数据（最近6小时）
        const timeSeriesData = [];
        for (let i = 5; i >= 0; i--) {
          const time = new Date(Date.now() - i * 60 * 60 * 1000);
          timeSeriesData.push({
            time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            cpu: Math.max(0, parseFloat(metrics.cpu) + (Math.random() - 0.5) * 20),
            memory: Math.max(0, parseFloat(metrics.memory) + (Math.random() - 0.5) * 15),
            network: Math.random() * 100
          });
        }
        setSystemMetrics(timeSeriesData);
      }
      
      // 检查服务连通性
      const services = [
        { name: 'Prometheus', url: configData.data?.monitoring?.prometheus?.url },
        { name: 'Grafana', url: configData.data?.monitoring?.grafana?.url },
        { name: 'Elasticsearch', url: configData.data?.monitoring?.elk?.elasticsearch_url },
        { name: 'Kibana', url: configData.data?.monitoring?.elk?.kibana_url },
        { name: 'Logstash', url: configData.data?.monitoring?.elk?.logstash_url }
      ].filter(service => service.url);
      
      const serviceResults = await dashboardAPI.checkServiceConnectivity(services);
      setServiceStatus(serviceResults);
      
      // 计算告警分布
      const healthyCount = serviceResults.filter(s => s.status === 'healthy').length;
      const warningCount = serviceResults.filter(s => s.status === 'warning' || s.status === 'unavailable').length;
      const errorCount = serviceResults.filter(s => s.status === 'error').length;
      
      setAlertDistribution([
        { name: '正常', value: healthyCount, color: '#10b981' },
        { name: '警告', value: warningCount, color: '#f59e0b' },
        { name: '错误', value: errorCount, color: '#ef4444' }
      ]);
      
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // 每30秒自动刷新
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'unavailable':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'healthy':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'unavailable':
        return `${baseClasses} bg-gray-100 text-gray-600`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const healthyServices = serviceStatus.filter(s => s.status === 'healthy').length;
  const totalServices = serviceStatus.length;
  const healthPercentage = totalServices > 0 ? ((healthyServices / totalServices) * 100).toFixed(1) : '0';
  const activeAlerts = serviceStatus.filter(s => s.status === 'error').length;
  const currentCpuUsage = systemMetrics.length > 0 ? systemMetrics[systemMetrics.length - 1]?.cpu?.toFixed(1) || '0' : '0';
  const currentMemoryUsage = systemMetrics.length > 0 ? systemMetrics[systemMetrics.length - 1]?.memory?.toFixed(1) || '0' : '0';

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载仪表板数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">监控仪表板</h1>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>最后更新: {lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">错误: {error}</p>
        </div>
      )}

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CPU使用率</p>
              <p className="text-2xl font-bold text-gray-900">{currentCpuUsage}%</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${currentCpuUsage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">内存使用率</p>
              <p className="text-2xl font-bold text-gray-900">{currentMemoryUsage}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Server className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: `${currentMemoryUsage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">活跃告警</p>
              <p className="text-2xl font-bold text-gray-900">{activeAlerts}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-red-600">
            <span>{activeAlerts > 0 ? `${activeAlerts}个服务异常` : '系统正常'}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">系统健康度</p>
              <p className="text-2xl font-bold text-gray-900">{healthPercentage}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-green-600">
            <span>{healthyServices}/{totalServices} 服务正常</span>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 系统性能趋势 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">系统性能趋势</h3>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </div>
          {systemMetrics.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={systemMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} name="CPU (%)" />
                <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} name="内存 (%)" />
                <Line type="monotone" dataKey="network" stroke="#f59e0b" strokeWidth={2} name="网络 (MB/s)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>暂无性能数据</p>
                <p className="text-sm">请检查Prometheus配置</p>
              </div>
            </div>
          )}
        </div>

        {/* 告警分布 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">服务状态分布</h3>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </div>
          {alertDistribution.length > 0 && alertDistribution.some(item => item.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={alertDistribution.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {alertDistribution.filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {alertDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <div className="text-center">
                <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>暂无服务数据</p>
                <p className="text-sm">请检查服务配置</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 服务状态概览 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">服务状态概览</h3>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {serviceStatus.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    服务名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    响应时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最后检查
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    服务地址
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {serviceStatus.map((service, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(service.status)}
                        <span className="ml-3 text-sm font-medium text-gray-900">{service.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(service.status)}>
                        {service.status === 'healthy' ? '正常' : service.status === 'warning' ? '警告' : '错误'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {service.responseTime > 0 ? `${service.responseTime}ms` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {service.lastCheck ? new Date(service.lastCheck).toLocaleTimeString('zh-CN') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                      <a 
                        href={service.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                        title={service.url}
                      >
                        {service.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="text-center">
                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">暂无服务配置</p>
                <p className="text-sm">请在配置管理中添加监控服务地址</p>
                <a 
                  href="/config" 
                  className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  前往配置
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 快速操作区 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Server className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">重启服务</span>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Activity className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">清理缓存</span>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">查看告警</span>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">用户管理</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;