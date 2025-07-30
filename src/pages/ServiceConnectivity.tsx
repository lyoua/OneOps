import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, CheckCircle, AlertTriangle, XCircle, Activity, Globe, Server, Database, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// API配置
const API_BASE_URL = 'http://192.168.50.81:8001/api';

interface Service {
  id: string;
  name: string;
  host: string;
  port: number;
  type: string;
  url?: string;
  status?: 'connected' | 'warning' | 'disconnected' | 'error';
  latency?: number;
  lastCheck?: string;
  uptime?: number;
  error?: string;
}

interface ConnectivityData {
  time: string;
  connected: number;
  warning: number;
  disconnected: number;
}

interface LatencyData {
  time: string;
  [key: string]: any;
}

interface NetworkTest {
  id: string;
  name: string;
  target: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  result?: {
    success: boolean;
    latency: number;
    error?: string;
  };
  lastRun?: string;
}

// 服务连通性API
const serviceAPI = {
  // 获取配置的服务列表
  getServices: async (): Promise<Service[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/config`);
      const data = await response.json();
      if (data.success) {
        const services: Service[] = [];
        const config = data.data;
        
        // Prometheus服务
        if (config.monitoring?.prometheus?.enabled && config.monitoring.prometheus.url) {
          try {
            const url = new URL(config.monitoring.prometheus.url);
            services.push({
              id: 'prometheus',
              name: 'Prometheus',
              host: url.hostname,
              port: parseInt(url.port) || 9090,
              type: 'HTTP',
              url: config.monitoring.prometheus.url
            });
          } catch (e) {
            console.warn('Invalid Prometheus URL:', config.monitoring.prometheus.url);
          }
        }
        
        // Elasticsearch服务
        if (config.monitoring?.elk?.enabled && config.monitoring.elk.elasticsearch_url) {
          try {
            const url = new URL(config.monitoring.elk.elasticsearch_url);
            services.push({
              id: 'elasticsearch',
              name: 'Elasticsearch',
              host: url.hostname,
              port: parseInt(url.port) || 9200,
              type: 'HTTP',
              url: config.monitoring.elk.elasticsearch_url
            });
          } catch (e) {
            console.warn('Invalid Elasticsearch URL:', config.monitoring.elk.elasticsearch_url);
          }
        }
        
        // Kibana服务
        if (config.monitoring?.elk?.enabled && config.monitoring.elk.kibana_url) {
          try {
            const url = new URL(config.monitoring.elk.kibana_url);
            services.push({
              id: 'kibana',
              name: 'Kibana',
              host: url.hostname,
              port: parseInt(url.port) || 5601,
              type: 'HTTP',
              url: config.monitoring.elk.kibana_url
            });
          } catch (e) {
            console.warn('Invalid Kibana URL:', config.monitoring.elk.kibana_url);
          }
        }
        
        // Grafana服务
        if (config.monitoring?.grafana?.enabled && config.monitoring.grafana.url) {
          try {
            const url = new URL(config.monitoring.grafana.url);
            services.push({
              id: 'grafana',
              name: 'Grafana',
              host: url.hostname,
              port: parseInt(url.port) || 3000,
              type: 'HTTP',
              url: config.monitoring.grafana.url
            });
          } catch (e) {
            console.warn('Invalid Grafana URL:', config.monitoring.grafana.url);
          }
        }
        
        // 数据库服务
        if (config.database?.host && config.database?.port) {
          services.push({
            id: 'database',
            name: 'Database',
            host: config.database.host,
            port: config.database.port,
            type: 'TCP'
          });
        }
        
        // Redis服务
        if (config.redis?.host && config.redis?.port) {
          services.push({
            id: 'redis',
            name: 'Redis',
            host: config.redis.host,
            port: config.redis.port,
            type: 'TCP'
          });
        }
        
        return services;
      }
      return [];
    } catch (error) {
      console.error('获取服务列表失败:', error);
      return [];
    }
  },
  
  // 批量检查所有服务
  checkAllServices: async (services: Service[]): Promise<Service[]> => {
    if (services.length === 0) {
      return [];
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/services/connectivity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          services: services.map(service => ({
            id: service.id,
            name: service.name,
            host: service.host,
            port: service.port,
            type: service.type
          }))
        })
      });
      
      const data = await response.json();
      if (data.success) {
        return data.data.map((result: any) => {
          const originalService = services.find(s => s.id === result.id);
          return {
            ...originalService,
            ...result,
            uptime: result.status === 'connected' ? 99.9 : result.status === 'warning' ? 95.0 : 0
          };
        });
      }
      
      // 如果批量检查失败，返回离线状态
      return services.map(service => ({
        ...service,
        status: 'disconnected' as const,
        latency: 0,
        lastCheck: new Date().toLocaleString(),
        uptime: 0,
        error: '连接检查失败'
      }));
      
    } catch (error) {
      console.error('检查服务连通性失败:', error);
      return services.map(service => ({
        ...service,
        status: 'disconnected' as const,
        latency: 0,
        lastCheck: new Date().toLocaleString(),
        uptime: 0,
        error: '网络错误'
      }));
    }
  },
  
  // 运行网络测试
  runNetworkTest: async (target: string, testType: string): Promise<any> => {
    try {
      const response = await fetch(`${API_BASE_URL}/network/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target,
          type: testType
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('网络测试失败:', error);
      return {
        success: false,
        error: '网络测试失败'
      };
    }
  }
};

const ServiceConnectivity: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [connectivityHistory, setConnectivityHistory] = useState<ConnectivityData[]>([]);
  const [latencyTrend, setLatencyTrend] = useState<LatencyData[]>([]);
  const [networkTests, setNetworkTests] = useState<NetworkTest[]>([
    {
      id: 'ping-google',
      name: 'Ping测试',
      target: 'google.com',
      status: 'idle'
    },
    {
      id: 'ping-github',
      name: 'GitHub连通性',
      target: 'github.com',
      status: 'idle'
    },
    {
      id: 'dns-test',
      name: 'DNS解析测试',
      target: 'example.com',
      status: 'idle'
    }
  ]);
  
  // 加载服务列表
  const loadServices = async () => {
    try {
      setLoading(true);
      const serviceList = await serviceAPI.getServices();
      setServices(serviceList);
    } catch (error) {
      console.error('加载服务列表失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 检查所有服务连通性
  const checkAllServices = async () => {
    if (services.length === 0) return;
    
    try {
      setChecking(true);
      const results = await serviceAPI.checkAllServices(services);
      setServices(results);
      
      // 更新历史数据
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const connectedCount = results.filter(s => s.status === 'connected').length;
      const warningCount = results.filter(s => s.status === 'warning').length;
      const disconnectedCount = results.filter(s => s.status === 'disconnected' || s.status === 'error').length;
      
      setConnectivityHistory(prev => {
        const newHistory = [...prev, { 
          time: timeStr, 
          connected: connectedCount, 
          warning: warningCount, 
          disconnected: disconnectedCount 
        }];
        return newHistory.slice(-10); // 保留最近10条记录
      });
      
      // 更新延迟趋势
      const latencyData: LatencyData = { time: timeStr };
      results.forEach(service => {
        if (service.status !== 'disconnected' && service.status !== 'error' && service.latency) {
          latencyData[service.id] = service.latency;
        }
      });
      
      setLatencyTrend(prev => {
        const newTrend = [...prev, latencyData];
        return newTrend.slice(-10); // 保留最近10条记录
      });
      
    } catch (error) {
      console.error('检查服务连通性失败:', error);
    } finally {
      setChecking(false);
    }
  };
  
  // 运行网络测试
  const runNetworkTest = async (testId: string) => {
    const test = networkTests.find(t => t.id === testId);
    if (!test) return;
    
    setNetworkTests(prev => prev.map(t => 
      t.id === testId ? { ...t, status: 'running' } : t
    ));
    
    try {
      const result = await serviceAPI.runNetworkTest(test.target, 'ping');
      
      setNetworkTests(prev => prev.map(t => 
        t.id === testId ? {
          ...t,
          status: result.success ? 'completed' : 'failed',
          result: {
            success: result.success,
            latency: result.latency || 0,
            error: result.error
          },
          lastRun: new Date().toLocaleString()
        } : t
      ));
    } catch (error) {
      setNetworkTests(prev => prev.map(t => 
        t.id === testId ? {
          ...t,
          status: 'failed',
          result: {
            success: false,
            latency: 0,
            error: '测试失败'
          },
          lastRun: new Date().toLocaleString()
        } : t
      ));
    }
  };
  
  // 自动刷新
  useEffect(() => {
    loadServices();
  }, []);
  
  useEffect(() => {
    if (services.length > 0) {
      checkAllServices();
    }
  }, [services.length]);
  
  useEffect(() => {
    if (autoRefresh && services.length > 0) {
      const interval = setInterval(checkAllServices, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, services.length]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'disconnected':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'connected':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'disconnected':
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'HTTP':
      case 'HTTPS':
        return <Globe className="w-5 h-5 text-blue-500" />;
      case 'MySQL':
      case 'PostgreSQL':
      case 'TCP':
        return <Database className="w-5 h-5 text-green-500" />;
      case 'Redis':
        return <Server className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getLatencyColor = (latency?: number) => {
    if (!latency || latency === 0) return 'text-red-600';
    if (latency < 50) return 'text-green-600';
    if (latency < 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const connectedCount = services.filter(s => s.status === 'connected').length;
  const warningCount = services.filter(s => s.status === 'warning').length;
  const disconnectedCount = services.filter(s => s.status === 'disconnected' || s.status === 'error').length;
  const onlineServices = services.filter(s => s.status === 'connected' || s.status === 'warning');
  const avgLatency = onlineServices.length > 0 ? onlineServices.reduce((sum, s) => sum + (s.latency || 0), 0) / onlineServices.length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>正在加载服务列表...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题和控制 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">服务连通性监控</h1>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">自动刷新:</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-md ${
                autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {autoRefresh ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={10}>10秒</option>
              <option value={30}>30秒</option>
              <option value={60}>1分钟</option>
              <option value={300}>5分钟</option>
            </select>
          </div>
          <button 
            onClick={checkAllServices}
            disabled={checking}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            {checking ? '检查中...' : '立即刷新'}
          </button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">在线服务</p>
              <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
            </div>
            <Wifi className="w-8 h-8 text-green-600" />
          </div>
          <div className="mt-4 text-sm text-green-600">
            <span>正常运行</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">警告服务</p>
              <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
          <div className="mt-4 text-sm text-yellow-600">
            <span>需要关注</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">离线服务</p>
              <p className="text-2xl font-bold text-red-600">{disconnectedCount}</p>
            </div>
            <WifiOff className="w-8 h-8 text-red-600" />
          </div>
          <div className="mt-4 text-sm text-red-600">
            <span>需要修复</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">平均延迟</p>
              <p className={`text-2xl font-bold ${getLatencyColor(avgLatency)}`}>
                {avgLatency.toFixed(0)}ms
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
          <div className="mt-4 text-sm text-blue-600">
            <span>网络性能</span>
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
            <Activity className="w-4 h-4 inline mr-2" />
            服务概览
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Server className="w-4 h-4 inline mr-2" />
            详细信息
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            网络测试
          </button>
        </nav>
      </div>

      {/* 服务概览标签页 */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 连通性状态趋势 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">连通性状态趋势</h3>
              {connectivityHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={connectivityHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="connected" fill="#10b981" name="在线" />
                    <Bar dataKey="warning" fill="#f59e0b" name="警告" />
                    <Bar dataKey="disconnected" fill="#ef4444" name="离线" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无历史数据</p>
                  </div>
                </div>
              )}
            </div>

            {/* 延迟趋势 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">服务延迟趋势</h3>
              {latencyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={latencyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    {services.map((service, index) => (
                      <Line 
                        key={service.id}
                        type="monotone" 
                        dataKey={service.id} 
                        stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} 
                        name={service.name} 
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无延迟数据</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 服务状态卡片 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">服务状态概览</h3>
            </div>
            <div className="p-6">
              {services.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.map((service) => (
                    <div key={service.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          {getServiceTypeIcon(service.type)}
                          <span className="ml-2 font-medium text-gray-900">{service.name}</span>
                        </div>
                        {getStatusIcon(service.status || 'disconnected')}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">地址:</span>
                          <span className="text-sm text-gray-900">{service.host}:{service.port}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">状态:</span>
                          <span className={getStatusBadge(service.status || 'disconnected')}>
                            {service.status === 'connected' ? '在线' :
                             service.status === 'warning' ? '警告' : '离线'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">延迟:</span>
                          <span className={`text-sm font-medium ${getLatencyColor(service.latency)}`}>
                            {service.latency || 0}ms
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">可用性:</span>
                          <span className="text-sm text-gray-900">{service.uptime || 0}%</span>
                        </div>
                        {service.lastCheck && (
                          <div className="text-xs text-gray-500">
                            最后检查: {service.lastCheck}
                          </div>
                        )}
                        {service.error && (
                          <div className="text-xs text-red-500">
                            错误: {service.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">暂无配置的服务</p>
                  <p className="text-sm text-gray-400 mt-2">请在配置管理中添加监控服务</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 详细信息标签页 */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">服务详细信息</h3>
            </div>
            <div className="overflow-x-auto">
              {services.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        服务信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        性能指标
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        错误信息
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {services.map((service) => (
                      <tr key={service.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {getServiceTypeIcon(service.type)}
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{service.name}</p>
                              <p className="text-sm text-gray-500">{service.host}:{service.port}</p>
                              <p className="text-xs text-gray-400">{service.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIcon(service.status || 'disconnected')}
                            <span className={`ml-2 ${getStatusBadge(service.status || 'disconnected')}`}>
                              {service.status === 'connected' ? '在线' :
                               service.status === 'warning' ? '警告' : '离线'}
                            </span>
                          </div>
                          {service.lastCheck && (
                            <div className="text-xs text-gray-500 mt-1">
                              {service.lastCheck}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-600">延迟:</span>
                              <span className={`text-xs font-medium ${getLatencyColor(service.latency)}`}>
                                {service.latency || 0}ms
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-600">可用性:</span>
                              <span className="text-xs text-gray-900">{service.uptime || 0}%</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {service.error ? (
                            <span className="text-xs text-red-600">{service.error}</span>
                          ) : (
                            <span className="text-xs text-gray-500">无错误</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">暂无配置的服务</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 网络测试标签页 */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">网络连通性测试</h3>
              <button 
                onClick={() => networkTests.forEach(test => runNetworkTest(test.id))}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
              >
                运行所有测试
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {networkTests.map((test) => (
                  <div key={test.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        {getTestStatusIcon(test.status)}
                        <span className="ml-2 font-medium text-gray-900">{test.name}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        test.status === 'completed' ? 'bg-green-100 text-green-800' :
                        test.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {test.status === 'running' ? '运行中' :
                         test.status === 'completed' ? '已完成' :
                         test.status === 'failed' ? '失败' : '待运行'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">目标: {test.target}</p>
                    <div className="space-y-2">
                      {test.result && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600">状态:</span>
                            <span className={`text-xs ${test.result.success ? 'text-green-600' : 'text-red-600'}`}>
                              {test.result.success ? '成功' : '失败'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600">延迟:</span>
                            <span className="text-xs text-gray-900">{test.result.latency}ms</span>
                          </div>
                          {test.result.error && (
                            <div className="text-xs text-red-600">
                              错误: {test.result.error}
                            </div>
                          )}
                        </>
                      )}
                      {test.lastRun && (
                        <div className="text-xs text-gray-500">
                          最后运行: {test.lastRun}
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <button 
                        onClick={() => runNetworkTest(test.id)}
                        disabled={test.status === 'running'}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {test.status === 'running' ? '运行中...' : '运行测试'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceConnectivity;