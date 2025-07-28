import React, { useState, useEffect } from 'react';
import { Server, Wifi, Clock, AlertCircle, CheckCircle, Activity, Network, Zap, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// API配置
const API_BASE_URL = 'http://localhost:8001/api';

// API调用函数
const systemMonitoringAPI = {
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
  getPrometheusMetrics: async (prometheusUrl: string, timeRange: string = '24h', queryType: string = 'node_exporter') => {
    try {
      // 支持不同类型的Prometheus查询
      const queryTypes = {
        node_exporter: {
          cpu: '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
          memory: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
          disk: '(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100',
          network_in: 'rate(node_network_receive_bytes_total[5m]) * 8',
          network_out: 'rate(node_network_transmit_bytes_total[5m]) * 8'
        },
        cadvisor: {
          cpu: 'sum(rate(container_cpu_usage_seconds_total[5m])) by (instance) * 100',
          memory: 'sum(container_memory_usage_bytes) by (instance) / sum(container_spec_memory_limit_bytes) by (instance) * 100',
          disk: 'sum(container_fs_usage_bytes) by (instance) / sum(container_fs_limit_bytes) by (instance) * 100',
          network_in: 'sum(rate(container_network_receive_bytes_total[5m])) by (instance) * 8',
          network_out: 'sum(rate(container_network_transmit_bytes_total[5m])) by (instance) * 8'
        },
        kubernetes: {
          cpu: 'sum(rate(container_cpu_usage_seconds_total{container!="POD",container!=""}[5m])) by (pod) * 100',
          memory: 'sum(container_memory_working_set_bytes{container!="POD",container!=""}) by (pod) / sum(container_spec_memory_limit_bytes{container!="POD",container!=""}) by (pod) * 100',
          disk: 'sum(container_fs_usage_bytes{container!="POD",container!=""}) by (pod) / sum(container_fs_limit_bytes{container!="POD",container!=""}) by (pod) * 100',
          network_in: 'sum(rate(container_network_receive_bytes_total[5m])) by (pod) * 8',
          network_out: 'sum(rate(container_network_transmit_bytes_total[5m])) by (pod) * 8'
        }
      };
      
      const queries = queryTypes[queryType as keyof typeof queryTypes] || queryTypes.node_exporter;

      const results: any = {};
      
      for (const [key, query] of Object.entries(queries)) {
        try {
          const response = await fetch(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
          const data = await response.json();
          results[key] = data.data?.result?.[0]?.value?.[1] || 0;
        } catch (error) {
          console.error(`获取${key}指标失败:`, error);
          results[key] = 0;
        }
      }
      
      return results;
    } catch (error) {
      console.error('获取Prometheus指标失败:', error);
      return { cpu: 0, memory: 0, disk: 0, network_in: 0, network_out: 0 };
    }
  },

  // 获取Prometheus历史数据
  getPrometheusRangeData: async (prometheusUrl: string, timeRange: string = '24h') => {
    try {
      const step = timeRange === '1h' ? '60s' : timeRange === '6h' ? '300s' : '3600s';
      const duration = timeRange === '1h' ? '1h' : timeRange === '6h' ? '6h' : timeRange === '7d' ? '7d' : '24h';
      
      const queries = {
        cpu: '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
        memory: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
        disk: '(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100',
        network: 'rate(node_network_receive_bytes_total[5m]) * 8 / 1024 / 1024'
      };

      const results: any = {};
      
      for (const [key, query] of Object.entries(queries)) {
        try {
          const response = await fetch(`${prometheusUrl}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${Math.floor(Date.now() / 1000) - (duration === '1h' ? 3600 : duration === '6h' ? 21600 : duration === '7d' ? 604800 : 86400)}&end=${Math.floor(Date.now() / 1000)}&step=${step}`);
          const data = await response.json();
          results[key] = data.data?.result?.[0]?.values || [];
        } catch (error) {
          console.error(`获取${key}历史数据失败:`, error);
          results[key] = [];
        }
      }
      
      return results;
    } catch (error) {
      console.error('获取Prometheus历史数据失败:', error);
      return { cpu: [], memory: [], disk: [], network: [] };
    }
  },

  // 检查服务连通性
  checkServiceConnectivity: async (services: any[]) => {
    const results = [];
    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await fetch(service.url, { 
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        const responseTime = Date.now() - startTime;
        results.push({
          ...service,
          status: 'connected',
          latency: responseTime,
          lastCheck: new Date().toISOString()
        });
      } catch (error) {
        results.push({
          ...service,
          status: 'disconnected',
          latency: 0,
          lastCheck: new Date().toISOString()
        });
      }
    }
    return results;
  },

  // 获取Docker容器信息（如果有Docker API）
  getContainerMetrics: async (dockerUrl?: string) => {
    if (!dockerUrl) return [];
    
    try {
      const response = await fetch(`${dockerUrl}/containers/json`);
      const containers = await response.json();
      
      const metrics = [];
      for (const container of containers) {
        try {
          const statsResponse = await fetch(`${dockerUrl}/containers/${container.Id}/stats?stream=false`);
          const stats = await statsResponse.json();
          
          const cpuPercent = calculateCpuPercent(stats);
          const memoryPercent = (stats.memory_stats.usage / stats.memory_stats.limit) * 100;
          
          metrics.push({
            name: container.Names[0].replace('/', ''),
            cpu: cpuPercent,
            memory: memoryPercent,
            status: container.State === 'running' ? 'running' : 'stopped'
          });
        } catch (error) {
          console.error(`获取容器${container.Names[0]}指标失败:`, error);
        }
      }
      
      return metrics;
    } catch (error) {
      console.error('获取容器指标失败:', error);
      return [];
    }
  }
};

// 计算CPU使用率
const calculateCpuPercent = (stats: any) => {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const numberCpus = stats.cpu_stats.online_cpus || 1;
  
  if (systemDelta > 0 && cpuDelta > 0) {
    return (cpuDelta / systemDelta) * numberCpus * 100;
  }
  return 0;
};

const SystemMonitoring: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [activeTab, setActiveTab] = useState('performance');
  const [queryType, setQueryType] = useState('node_exporter');
  const [config, setConfig] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [connectivityData, setConnectivityData] = useState<any[]>([]);
  const [containerMetrics, setContainerMetrics] = useState<any[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 加载配置和数据
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取配置
      const configData = await systemMonitoringAPI.getConfig();
      setConfig(configData.data);
      
      // 获取当前指标
      if (configData.data?.monitoring?.prometheus?.url) {
        const metrics = await systemMonitoringAPI.getPrometheusMetrics(configData.data.monitoring.prometheus.url, selectedTimeRange, queryType);
        setCurrentMetrics(metrics);
        
        // 获取历史数据
        const rangeData = await systemMonitoringAPI.getPrometheusRangeData(configData.data.monitoring.prometheus.url, selectedTimeRange);
        
        // 转换历史数据为图表格式
        const chartData = [];
        const maxLength = Math.max(
          rangeData.cpu?.length || 0,
          rangeData.memory?.length || 0,
          rangeData.disk?.length || 0,
          rangeData.network?.length || 0
        );
        
        for (let i = 0; i < maxLength; i++) {
          const timestamp = rangeData.cpu?.[i]?.[0] || rangeData.memory?.[i]?.[0] || rangeData.disk?.[i]?.[0] || rangeData.network?.[i]?.[0];
          if (timestamp) {
            chartData.push({
              time: new Date(timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              cpu: parseFloat(rangeData.cpu?.[i]?.[1] || 0),
              memory: parseFloat(rangeData.memory?.[i]?.[1] || 0),
              disk: parseFloat(rangeData.disk?.[i]?.[1] || 0),
              network: parseFloat(rangeData.network?.[i]?.[1] || 0)
            });
          }
        }
        setPerformanceData(chartData);
      }
      
      // 检查服务连通性
      const services = [
        { name: 'Prometheus', url: configData.data?.monitoring?.prometheus?.url, host: new URL(configData.data?.monitoring?.prometheus?.url || 'http://localhost:9090').hostname, port: new URL(configData.data?.monitoring?.prometheus?.url || 'http://localhost:9090').port || '9090' },
        { name: 'Grafana', url: configData.data?.monitoring?.grafana?.url, host: new URL(configData.data?.monitoring?.grafana?.url || 'http://localhost:3000').hostname, port: new URL(configData.data?.monitoring?.grafana?.url || 'http://localhost:3000').port || '3000' },
        { name: 'Elasticsearch', url: configData.data?.monitoring?.elk?.elasticsearch_url, host: new URL(configData.data?.monitoring?.elk?.elasticsearch_url || 'http://localhost:9200').hostname, port: new URL(configData.data?.monitoring?.elk?.elasticsearch_url || 'http://localhost:9200').port || '9200' },
        { name: 'Kibana', url: configData.data?.monitoring?.elk?.kibana_url, host: new URL(configData.data?.monitoring?.elk?.kibana_url || 'http://localhost:5601').hostname, port: new URL(configData.data?.monitoring?.elk?.kibana_url || 'http://localhost:5601').port || '5601' },
        { name: 'Logstash', url: configData.data?.monitoring?.elk?.logstash_url, host: new URL(configData.data?.monitoring?.elk?.logstash_url || 'http://localhost:5044').hostname, port: new URL(configData.data?.monitoring?.elk?.logstash_url || 'http://localhost:5044').port || '5044' }
      ].filter(service => service.url);
      
      const serviceResults = await systemMonitoringAPI.checkServiceConnectivity(services);
      setConnectivityData(serviceResults);
      
      // 获取容器指标（如果配置了Docker）
      if (configData.data?.monitoring?.docker?.url) {
        const containers = await systemMonitoringAPI.getContainerMetrics(configData.data.monitoring.docker.url);
        setContainerMetrics(containers);
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTimeRange, queryType]);

  useEffect(() => {
    // 每30秒自动刷新
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [selectedTimeRange, queryType]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'disconnected':
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'connected':
      case 'running':
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

  const getLatencyColor = (latency: number) => {
    if (latency === 0) return 'text-red-600';
    if (latency < 20) return 'text-green-600';
    if (latency < 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载系统监控数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题和控制 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">系统监控</h1>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}
            </span>
          )}
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="node_exporter">Node Exporter</option>
            <option value="cadvisor">cAdvisor</option>
            <option value="kubernetes">Kubernetes</option>
          </select>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="1h">最近1小时</option>
            <option value="6h">最近6小时</option>
            <option value="24h">最近24小时</option>
            <option value="7d">最近7天</option>
          </select>
          <button 
            onClick={loadData}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">错误: {error}</p>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('performance')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'performance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-2" />
            性能监控
          </button>
          <button
            onClick={() => setActiveTab('connectivity')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'connectivity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Wifi className="w-4 h-4 inline mr-2" />
            服务连通性
          </button>
          <button
            onClick={() => setActiveTab('containers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'containers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Server className="w-4 h-4 inline mr-2" />
            容器监控
          </button>
        </nav>
      </div>

      {/* 性能监控标签页 */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* 实时指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">CPU使用率</p>
                  <p className="text-2xl font-bold text-gray-900">{parseFloat(currentMetrics.cpu || 0).toFixed(1)}%</p>
                </div>
                <Activity className="w-8 h-8 text-blue-600" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(100, parseFloat(currentMetrics.cpu || 0))}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">内存使用率</p>
                  <p className="text-2xl font-bold text-gray-900">{parseFloat(currentMetrics.memory || 0).toFixed(1)}%</p>
                </div>
                <Server className="w-8 h-8 text-green-600" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.min(100, parseFloat(currentMetrics.memory || 0))}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">磁盘使用率</p>
                  <p className="text-2xl font-bold text-gray-900">{parseFloat(currentMetrics.disk || 0).toFixed(1)}%</p>
                </div>
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.min(100, parseFloat(currentMetrics.disk || 0))}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">网络流量</p>
                  <p className="text-2xl font-bold text-gray-900">{((parseFloat(currentMetrics.network_in || 0) + parseFloat(currentMetrics.network_out || 0)) / 1024 / 1024).toFixed(1)}MB/s</p>
                </div>
                <Network className="w-8 h-8 text-orange-600" />
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <span>上行: {(parseFloat(currentMetrics.network_out || 0) / 1024 / 1024).toFixed(1)}MB/s | 下行: {(parseFloat(currentMetrics.network_in || 0) / 1024 / 1024).toFixed(1)}MB/s</span>
              </div>
            </div>
          </div>

          {/* 性能趋势图表 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">系统性能趋势</h3>
              {loading && (
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              )}
            </div>
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="CPU (%)" />
                  <Area type="monotone" dataKey="memory" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="内存 (%)" />
                  <Area type="monotone" dataKey="disk" stackId="3" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="磁盘 (%)" />
                  <Area type="monotone" dataKey="network" stackId="4" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="网络 (MB/s)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-gray-500">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>暂无性能数据</p>
                  <p className="text-sm">请检查Prometheus配置</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 服务连通性标签页 */}
      {activeTab === 'connectivity' && (
        <div className="space-y-6">
          {/* 连通性概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">在线服务</p>
                  <p className="text-2xl font-bold text-green-600">
                    {connectivityData.filter(s => s.status === 'connected').length}/{connectivityData.length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">平均延迟</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {connectivityData.length > 0 ? 
                      Math.round(connectivityData.filter(s => s.latency > 0).reduce((sum, s) => sum + s.latency, 0) / connectivityData.filter(s => s.latency > 0).length || 0) : 0}ms
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">故障服务</p>
                  <p className="text-2xl font-bold text-red-600">
                    {connectivityData.filter(s => s.status === 'disconnected').length}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          {/* 服务连通性详情表格 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">服务连通性监控</h3>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                批量测试
              </button>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">加载中...</span>
                </div>
              ) : connectivityData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">暂无服务配置</p>
                  <p className="text-sm text-gray-400 mt-2">
                    请前往 <a href="/config" className="text-blue-600 hover:underline">配置管理</a> 页面配置服务地址
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        服务名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        主机地址
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        端口
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        延迟
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        最后检查
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {connectivityData.map((service, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIcon(service.status)}
                            <span className="ml-3 text-sm font-medium text-gray-900">{service.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {service.host}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {service.port}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getStatusBadge(service.status)}>
                            {service.status === 'connected' ? '已连接' : 
                             service.status === 'warning' ? '警告' : '断开连接'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getLatencyColor(service.latency)}`}>
                            {service.latency > 0 ? `${service.latency}ms` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(service.lastCheck).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">测试</button>
                          <button className="text-green-600 hover:text-green-900">详情</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 容器监控标签页 */}
      {activeTab === 'containers' && (
        <div className="space-y-6">
          {/* 容器概览 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">运行中容器</p>
                  <p className="text-2xl font-bold text-green-600">
                    {containerMetrics.filter(c => c.status === 'running').length}
                  </p>
                </div>
                <Server className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">警告容器</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {containerMetrics.filter(c => c.status === 'stopped' || c.status === 'warning').length}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总CPU使用</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {containerMetrics.length > 0 ? 
                      (containerMetrics.reduce((sum, c) => sum + (c.cpu || 0), 0) / containerMetrics.length).toFixed(1) : 0}%
                  </p>
                </div>
                <Activity className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总内存使用</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {containerMetrics.length > 0 ? 
                      (containerMetrics.reduce((sum, c) => sum + (c.memory || 0), 0) / containerMetrics.length).toFixed(1) : 0}%
                  </p>
                </div>
                <Server className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* 容器详情 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">容器资源使用情况</h3>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">加载容器数据中...</span>
                </div>
              ) : containerMetrics.length === 0 ? (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 mx-auto mb-2 opacity-50 text-gray-400" />
                  <p className="text-gray-500">暂无容器数据</p>
                  <p className="text-sm text-gray-400 mt-2">
                    请检查Docker配置或确保有运行中的容器
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {containerMetrics.map((container, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          {getStatusIcon(container.status)}
                          <span className="ml-2 font-medium text-gray-900">{container.name}</span>
                        </div>
                        <span className={getStatusBadge(container.status)}>
                          {container.status === 'running' ? '运行中' : 
                           container.status === 'stopped' ? '已停止' : '警告'}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>CPU使用率</span>
                            <span>{(container.cpu || 0).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, container.cpu || 0)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>内存使用率</span>
                            <span>{(container.memory || 0).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, container.memory || 0)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMonitoring;