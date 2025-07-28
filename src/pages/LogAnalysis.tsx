import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Calendar, RefreshCw, Play, Pause, Settings, Download, ChevronDown, ChevronRight, Clock, Server, AlertTriangle, Info, XCircle } from 'lucide-react';

// Kibana风格的API接口
const kibanaAPI = {
  // 获取日志数据
  getLogs: async (params: any = {}) => {
    try {
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });
      
      const response = await fetch(`/api/logs?${queryParams.toString()}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取日志失败:', error);
      return { logs: [], total: 0, success: false };
    }
  },

  // 获取实时日志流
  getLogStream: async (params: any = {}) => {
    try {
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });
      
      const response = await fetch(`/api/logs/stream?${queryParams.toString()}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取实时日志失败:', error);
      return { logs: [], total: 0, success: false };
    }
  },

  // 获取索引列表
  getLogIndices: async () => {
    try {
      const response = await fetch('/api/logs/indices');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取索引列表失败:', error);
      return { data: [], success: false };
    }
  },

  // 获取自定义索引
  getCustomIndices: async () => {
    try {
      const response = await fetch('http://localhost:8001/api/custom-indices');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取自定义索引失败:', error);
      return { data: [], success: false };
    }
  },

  // 获取配置
  getConfig: async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取配置失败:', error);
      return { data: {}, success: false };
    }
  }
};

const KibanaLogAnalysis: React.FC = () => {
  // 搜索和过滤状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('*');
  const [timeRange, setTimeRange] = useState('15m');
  const [isRealTime, setIsRealTime] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  
  // 数据状态
  const [logs, setLogs] = useState<any[]>([]);
  const [indices, setIndices] = useState<any[]>([]);
  const [customIndices, setCustomIndices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalHits, setTotalHits] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // UI状态
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState(['timestamp', 'level', 'service', 'message']);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  
  // 引用
  const logContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 时间范围选项
  const timeRangeOptions = [
    { value: '5m', label: '最近 5 分钟' },
    { value: '15m', label: '最近 15 分钟' },
    { value: '30m', label: '最近 30 分钟' },
    { value: '1h', label: '最近 1 小时' },
    { value: '4h', label: '最近 4 小时' },
    { value: '12h', label: '最近 12 小时' },
    { value: '24h', label: '最近 24 小时' },
    { value: '7d', label: '最近 7 天' }
  ];
  
  // 刷新间隔选项
  const refreshOptions = [
    { value: 5, label: '5秒' },
    { value: 10, label: '10秒' },
    { value: 30, label: '30秒' },
    { value: 60, label: '1分钟' },
    { value: 300, label: '5分钟' }
  ];
  
  // 可用字段
  const availableFields = [
    'timestamp', 'level', 'service', 'message', 'source', 'index', 'host'
  ];
  
  // 加载数据
  const loadData = async (append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      }
      
      const params = {
        index: selectedIndex,
        query: searchQuery,
        time_range: timeRange,
        size: 500
      };
      
      const response = isRealTime ? 
        await kibanaAPI.getLogStream(params) : 
        await kibanaAPI.getLogs(params);
      
      if (response.success) {
        const newLogs = response.data || [];
        // 按时间戳排序，老日志在上，新日志在下
        const sortedLogs = newLogs.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeA - timeB; // 升序排列，老的在前
        });
        
        if (append && isRealTime) {
          setLogs(prevLogs => {
            const combined = [...prevLogs, ...sortedLogs];
            // 保持最新的1000条日志
            return combined.slice(-1000);
          });
        } else {
          setLogs(sortedLogs);
        }
        setTotalHits(response.total || newLogs.length);
      } else {
        setError(response.message || '获取日志数据失败');
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      console.error('加载日志数据失败:', err);
      setError('网络错误，请检查连接');
    } finally {
      if (!append) {
        setLoading(false);
      }
    }
  };
  
  // 加载索引列表
  const loadIndices = async () => {
    try {
      const response = await kibanaAPI.getLogIndices();
      if (response.success) {
        setIndices(response.data || []);
      }
    } catch (err) {
      console.error('加载索引列表失败:', err);
    }
  };

  // 加载自定义索引
  const loadCustomIndices = async () => {
    try {
      const response = await kibanaAPI.getCustomIndices();
      if (response.success) {
        setCustomIndices(response.data || []);
      }
    } catch (err) {
      console.error('加载自定义索引失败:', err);
    }
  };
  
  // 初始化
  useEffect(() => {
    loadIndices();
    loadCustomIndices();
    loadData();
  }, []);
  
  // 搜索参数变化时重新加载
  useEffect(() => {
    if (!isRealTime) {
      loadData();
    }
  }, [searchQuery, selectedIndex, timeRange]);
  
  // 实时模式和自动刷新
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    if ((isRealTime || autoRefresh) && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        loadData(isRealTime);
      }, refreshInterval * 1000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRealTime, autoRefresh, refreshInterval, searchQuery, selectedIndex, timeRange]);
  
  // 自动滚动到底部（实时模式和新数据加载时）
  useEffect(() => {
    if (logContainerRef.current && (isRealTime || logs.length > 0)) {
      // 延迟滚动确保DOM更新完成
      setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [logs, isRealTime]);
  
  // 切换日志展开状态
  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };
  
  // 获取日志级别样式
  const getLevelStyle = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'ERROR':
        return 'text-red-600 bg-red-50';
      case 'WARN':
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50';
      case 'INFO':
        return 'text-blue-600 bg-blue-50';
      case 'DEBUG':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };
  
  // 获取日志级别图标
  const getLevelIcon = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'ERROR':
        return <XCircle className="w-4 h-4" />;
      case 'WARN':
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4" />;
      case 'INFO':
        return <Info className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };
  
  // 格式化时间戳
  const formatTimestamp = (timestamp: any) => {
    try {
      // 如果是对象，尝试转换为字符串
      const timestampStr = typeof timestamp === 'object' && timestamp !== null 
        ? JSON.stringify(timestamp) 
        : String(timestamp || '');
      
      const date = new Date(timestampStr);
      if (isNaN(date.getTime())) {
        return timestampStr || '未知时间';
      }
      
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return String(timestamp || '未知时间');
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Kibana风格的顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Discover</h1>
            <div className="text-sm text-gray-500">
              {totalHits.toLocaleString()} hits
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* 时间范围选择器 */}
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
                disabled={isRealTime}
              >
                {timeRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 自动刷新控制 */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded ${autoRefresh ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                title="自动刷新"
              >
                {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                disabled={!autoRefresh && !isRealTime}
              >
                {refreshOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 实时模式切换 */}
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isRealTime}
                onChange={(e) => setIsRealTime(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">实时模式</span>
            </label>
            
            {/* 刷新按钮 */}
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {/* 导出按钮 */}
            <button
              className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              title="导出日志"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* 搜索栏 */}
        <div className="mt-4 space-y-3">
          {/* 第一行：日志内容搜索 */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索日志内容... (支持 Lucene 查询语法)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          
          {/* 第二行：索引选择器 */}
          <div className="flex items-center space-x-4">
            {/* 统一索引选择器 */}
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 whitespace-nowrap">选择索引:</span>
              <div className="relative">
                <select
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[300px] bg-white"
                >
                  <option value="*">所有索引</option>
                  
                  {/* 自定义索引分组 */}
                  {customIndices.length > 0 && (
                    <optgroup label="自定义索引">
                      {customIndices.map((index) => (
                        <option key={index.name} value={index.name}>
                          {index.name} - {index.description || '无描述'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  
                  {/* 预设索引分组 */}
                  {indices.length > 0 && (
                    <optgroup label="预设索引">
                      {indices.map((index) => (
                        <option key={index.index} value={index.index}>
                          {index.index} ({index.docs_count?.toLocaleString() || '0'} 条)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="absolute right-8 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
            
            {/* 刷新索引按钮 */}
            <button
              onClick={() => {
                loadIndices();
                loadCustomIndices();
              }}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="刷新索引列表"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* 状态信息 */}
        {lastUpdate && (
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>最后更新: {lastUpdate.toLocaleString('zh-CN')}</span>
              {isRealTime && (
                <div className="flex items-center space-x-1 text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span>实时流</span>
                </div>
              )}
            </div>
            <div>
              索引: {selectedIndex} | 显示 {logs.length} / {totalHits.toLocaleString()} 条日志
            </div>
          </div>
        )}
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* 主要内容区域 - 重新布局：上方字段选择器，下方日志显示 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 上方字段选择器 - 紧凑布局 */}
        <div className="bg-white border-b border-gray-200 p-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-gray-900">显示字段</h3>
            <button
              onClick={() => setShowFieldSelector(!showFieldSelector)}
              className="text-gray-400 hover:text-gray-600"
            >
              <Settings className="w-3 h-3" />
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {availableFields.map(field => (
              <label key={field} className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFields([...selectedFields, field]);
                    } else {
                      setSelectedFields(selectedFields.filter(f => f !== field));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                />
                <span className="text-xs text-gray-700">{field}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* 下方日志显示区域 - 终端风格 */}
        <div className="flex-1 flex flex-col min-h-0">
          {loading && logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">加载日志中...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>未找到匹配的日志</p>
                <p className="text-sm mt-1">请调整搜索条件或时间范围</p>
              </div>
            </div>
          ) : (
            <div 
              ref={logContainerRef}
              className="flex-1 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm leading-relaxed"
              style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
            >
              {/* 终端风格的日志显示 */}
              <div className="p-2 space-y-0.5">
                {logs.map((log, index) => {
                  const logId = log.id || `log-${index}`;
                  const isExpanded = expandedLogs.has(logId);
                  
                  return (
                    <div key={logId} className="group">
                      {/* 主日志行 */}
                      <div 
                        className="flex flex-col sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-2 hover:bg-gray-800 px-1 py-0.5 rounded cursor-pointer"
                        onClick={() => toggleLogExpansion(logId)}
                      >
                        {/* 小屏幕：垂直布局 */}
                        <div className="sm:hidden w-full space-y-1">
                          {/* 展开图标和基本信息行 */}
                          <div className="flex items-center space-x-2">
                            <div className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-500" />
                              )}
                            </div>
                            {selectedFields.includes('timestamp') && (
                              <span className="text-gray-400 text-xs">
                                {formatTimestamp(log.timestamp)}
                              </span>
                            )}
                            {selectedFields.includes('level') && (
                              <span className={`text-xs px-1 rounded ${
                                log.level === 'ERROR' ? 'text-red-400 bg-red-900/20' :
                                log.level === 'WARN' ? 'text-yellow-400 bg-yellow-900/20' :
                                log.level === 'INFO' ? 'text-blue-400 bg-blue-900/20' :
                                'text-gray-400 bg-gray-800'
                              }`}>
                                {log.level || 'INFO'}
                              </span>
                            )}
                          </div>
                          {/* 服务名 */}
                          {selectedFields.includes('service') && (
                            <div className="text-cyan-400 text-xs break-words pl-5">
                              <span className="text-gray-500">服务: </span>
                              {typeof log.service === 'object' && log.service !== null 
                                ? JSON.stringify(log.service) 
                                : String(log.service || 'unknown')}
                            </div>
                          )}
                          {/* 日志消息 */}
                          {selectedFields.includes('message') && (
                            <div className="text-green-400 break-words whitespace-pre-wrap text-sm leading-relaxed pl-5">
                              {typeof log.message === 'object' && log.message !== null 
                                ? JSON.stringify(log.message) 
                                : String(log.message || '无消息内容')}
                            </div>
                          )}
                        </div>
                        
                        {/* 大屏幕：水平布局 */}
                        <div className="hidden sm:flex sm:items-start sm:space-x-2 w-full">
                          {/* 展开/收起图标 */}
                          <div className="flex-shrink-0 mt-1">
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-gray-500" />
                            )}
                          </div>
                          
                          {/* 时间戳 */}
                          {selectedFields.includes('timestamp') && (
                            <span className="text-gray-400 flex-shrink-0 text-sm w-auto min-w-0 lg:w-44">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          )}
                          
                          {/* 日志级别 */}
                          {selectedFields.includes('level') && (
                            <span className={`flex-shrink-0 text-center text-sm w-auto min-w-0 lg:w-16 ${
                              log.level === 'ERROR' ? 'text-red-400' :
                              log.level === 'WARN' ? 'text-yellow-400' :
                              log.level === 'INFO' ? 'text-blue-400' :
                              'text-gray-400'
                            }`}>
                              {log.level || 'INFO'}
                            </span>
                          )}
                          
                          {/* 服务名 */}
                          {selectedFields.includes('service') && (
                            <span className="text-cyan-400 flex-shrink-0 break-words text-sm w-auto min-w-0 lg:w-32">
                              {typeof log.service === 'object' && log.service !== null 
                                ? JSON.stringify(log.service) 
                                : String(log.service || 'unknown')}
                            </span>
                          )}
                          
                          {/* 日志消息 */}
                          {selectedFields.includes('message') && (
                            <span className="text-green-400 break-words whitespace-pre-wrap flex-1 text-sm leading-relaxed min-w-0">
                              {typeof log.message === 'object' && log.message !== null 
                                ? JSON.stringify(log.message) 
                                : String(log.message || '无消息内容')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 展开的详细信息 */}
                      {isExpanded && (
                        <div className="ml-2 sm:ml-8 mt-2 p-3 bg-gray-800 rounded border-l-2 border-blue-500">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                            {Object.entries(log).map(([key, value]) => (
                              <div key={key} className="flex flex-col sm:flex-row">
                                <span className="text-gray-400 sm:w-20 flex-shrink-0 font-medium">{key}:</span>
                                <span className="text-green-400 break-all whitespace-pre-wrap mt-1 sm:mt-0">
                                  {typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value || '')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* 实时模式底部指示器 */}
                {isRealTime && (
                  <div className="text-center py-4 text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs">实时监控中...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KibanaLogAnalysis;