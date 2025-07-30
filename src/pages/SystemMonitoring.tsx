import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, TrendingUp, Activity, Settings, RefreshCw, Plus, Monitor, Server, Database, Globe, Edit3, Save, X, Play, Code, Variable, Network, Edit, Trash2, PieChart as PieChartIcon, Gauge, ChevronDown, Copy, Edit2, FileText, Eye, Loader2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Cell, Pie, Legend } from 'recharts';
import { configManager, getApiBaseUrl, getPrometheusBaseUrl, loadConfig, type AppConfig } from '../utils/config';
import dataService, { Template, Variable as DataVariable, Dashboard as DataDashboard, VariableValue } from '../services/dataService';
import { usePrompt } from '../hooks/usePrompt';
import { toast } from 'sonner';

// 配置管理 API
const configAPI = {
  getConfig: async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/config`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取配置失败:', error);
      throw error;
    }
  }
};

// 类型定义
interface PrometheusMetric {
  metric: Record<string, string>;
  value?: [number, string];
  values?: [number, string][];
}

interface PrometheusResponse {
  status: string;
  data: {
    resultType: string;
    result: PrometheusMetric[];
  };
}

interface Variable {
  name: string;
  label: string;
  query: string;
  value: string;
  options: string[];
  type?: 'query' | 'custom' | 'constant' | 'interval' | 'datasource';
  multi?: boolean;
  includeAll?: boolean;
  allValue?: string;
  hide?: 'none' | 'label' | 'variable';
}

interface CustomVariable {
  id: string;
  name: string;
  label: string;
  type: 'query' | 'custom' | 'constant' | 'interval' | 'datasource';
  query?: string;
  options?: string[];
  value: string | string[];
  multi?: boolean;
  description?: string;
  refresh?: 'never' | 'on_dashboard_load' | 'on_time_range_change';
  sort?: 'disabled' | 'alphabetical_asc' | 'alphabetical_desc' | 'numerical_asc' | 'numerical_desc';
  includeAll?: boolean;
  allValue?: string;
  regex?: string;
  hide?: 'none' | 'label' | 'variable';
}

interface Panel {
  id: string;
  title: string;
  type: 'line' | 'area' | 'bar' | 'pie' | 'stat' | 'gauge';
  query: string;
  color: string;
  unit?: string;
  data: any[];
  isEditing?: boolean;
  refreshInterval?: number;
  description?: string;
  chartType?: 'line' | 'area' | 'bar' | 'pie' | 'gauge' | 'stat';
  timeRange?: string;
  position?: { x: number; y: number; w: number; h: number };
  thresholds?: { value: number; color: string }[];
  decimals?: number;
  queryHistory?: string[];
  maxDataPoints?: number;
  minInterval?: string;
  defaultQuery?: string; // 默认查询语句
  customQuery?: string;  // 自定义查询语句
  isCustomQuery?: boolean; // 是否使用自定义查询
}

interface Dashboard {
  id: string;
  title: string;
  description: string;
  category: string;
  variables: Variable[];
  panels: Panel[];
  timeRange: string;
  refreshInterval: number;
  name?: string;
  customVariables?: CustomVariable[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  panels: Omit<Panel, 'id'>[];
  variables: Omit<CustomVariable, 'id'>[];
  tags: string[];
}

// Prometheus API 调用函数
const queryPrometheus = async (query: string, timeRange: string = '1h'): Promise<PrometheusResponse | null> => {
  try {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - parseTimeRange(timeRange);
    
    const url = `${getPrometheusBaseUrl()}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${startTime}&end=${endTime}&step=60`;
    
    const response = await fetch(url);
    if (!response.ok) {
      // 如果是400错误，可能是查询语法问题
      if (response.status === 400) {
        const errorText = await response.text();
        console.warn(`Prometheus查询语法错误 (${response.status}): ${errorText}`);
        console.warn(`查询语句: ${query}`);
      } else {
        console.warn(`Prometheus服务错误 (${response.status}): 请检查Prometheus服务是否正常运行`);
      }
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    // 网络错误或服务不可用
    console.warn('Prometheus服务不可用，请检查服务状态:', error);
    return null;
  }
};

const queryPrometheusInstant = async (query: string): Promise<PrometheusResponse | null> => {
  try {
    const url = `${getPrometheusBaseUrl()}/api/v1/query?query=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      // 如果是400错误，可能是查询语法问题
      if (response.status === 400) {
        const errorText = await response.text();
        console.warn(`Prometheus查询语法错误 (${response.status}): ${errorText}`);
        console.warn(`查询语句: ${query}`);
      } else {
        console.warn(`Prometheus服务错误 (${response.status}): 请检查Prometheus服务是否正常运行`);
      }
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    // 网络错误或服务不可用
    console.warn('Prometheus服务不可用，请检查服务状态:', error);
    return null;
  }
};

// 时间范围解析
const parseTimeRange = (timeRange: string): number => {
  const timeMap: Record<string, number> = {
    '5m': 5 * 60,
    '15m': 15 * 60,
    '30m': 30 * 60,
    '1h': 60 * 60,
    '3h': 3 * 60 * 60,
    '6h': 6 * 60 * 60,
    '12h': 12 * 60 * 60,
    '24h': 24 * 60 * 60,
    '7d': 7 * 24 * 60 * 60
  };
  return timeMap[timeRange] || 3600;
};

// 数据转换函数 - 支持多时间序列展示
const transformPrometheusData = (response: PrometheusResponse | null, type: string) => {
  if (!response || response.status !== 'success') {
    return [];
  }

  const result = response.data.result;
  
  if (type === 'instant') {
    return result.map(metric => ({
      name: metric.metric.instance || metric.metric.__name__ || 'Unknown',
      value: parseFloat(metric.value?.[1] || '0')
    }));
  }
  
  if (type === 'timeseries') {
    if (result.length === 0) {
      return [];
    }
    
    // 如果只有一个时间序列，保持原有格式
    if (result.length === 1) {
      const values = result[0].values || [];
      return values.map(([timestamp, value]) => ({
        time: new Date(timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        value: parseFloat(value)
      }));
    }
    
    // 多个时间序列：合并所有时间点，为每个序列创建单独的数据列
    const allTimestamps = new Set<number>();
    const seriesData: { [key: string]: { [timestamp: number]: number } } = {};
    const seriesNames: string[] = [];
    
    // 收集所有时间戳和序列数据
    result.forEach((metric, index) => {
      const seriesName = getSeriesName(metric.metric, index);
      seriesNames.push(seriesName);
      seriesData[seriesName] = {};
      
      (metric.values || []).forEach(([timestamp, value]) => {
        const ts = Number(timestamp);
        allTimestamps.add(ts);
        seriesData[seriesName][ts] = parseFloat(value);
      });
    });
    
    // 按时间戳排序并构建最终数据
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    return sortedTimestamps.map(timestamp => {
      const dataPoint: any = {
        time: new Date(timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      };
      
      // 为每个序列添加数据点
      seriesNames.forEach(seriesName => {
        dataPoint[seriesName] = seriesData[seriesName][timestamp] || null;
      });
      
      return dataPoint;
    });
  }
  
  return [];
};

// 生成序列名称的辅助函数
const getSeriesName = (metric: any, index: number): string => {
  // 优先使用有意义的标签组合
  const meaningfulLabels = ['instance', 'job', 'device', 'mode', 'cpu', 'mountpoint', 'fstype'];
  const labels: string[] = [];
  
  meaningfulLabels.forEach(label => {
    if (metric[label] && metric[label] !== '') {
      labels.push(`${label}=${metric[label]}`);
    }
  });
  
  // 如果没有有意义的标签，使用__name__或默认名称
  if (labels.length === 0) {
    return metric.__name__ || `series-${index + 1}`;
  }
  
  return labels.join(', ');
};

// 获取多序列数据的序列名称列表
const getSeriesNames = (data: any[]): string[] => {
  if (data.length === 0) return [];
  
  const firstDataPoint = data[0];
  return Object.keys(firstDataPoint).filter(key => key !== 'time');
};

// 为多序列生成不同颜色
const getSeriesColor = (index: number, baseColor: string): string => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#ec4899', // pink
    '#6366f1', // indigo
  ];
  
  if (index === 0) {
    return baseColor;
  }
  
  return colors[index % colors.length];
};

// 可滚动图例组件
const ScrollableLegend = ({ seriesNames, getColor, maxVisible = 5 }: {
  seriesNames: string[];
  getColor: (index: number) => string;
  maxVisible?: number;
}) => {
  const [startIndex, setStartIndex] = useState(0);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set(seriesNames));
  
  const visibleNames = seriesNames.slice(startIndex, startIndex + maxVisible);
  const canScrollLeft = startIndex > 0;
  const canScrollRight = startIndex + maxVisible < seriesNames.length;
  
  const scrollLeft = () => {
    if (canScrollLeft) {
      setStartIndex(Math.max(0, startIndex - 1));
    }
  };
  
  const scrollRight = () => {
    if (canScrollRight) {
      setStartIndex(Math.min(seriesNames.length - maxVisible, startIndex + 1));
    }
  };
  
  const toggleSeries = (seriesName: string) => {
    const newVisibleSeries = new Set(visibleSeries);
    if (newVisibleSeries.has(seriesName)) {
      newVisibleSeries.delete(seriesName);
    } else {
      newVisibleSeries.add(seriesName);
    }
    setVisibleSeries(newVisibleSeries);
  };
  
  if (seriesNames.length <= maxVisible) {
    // 如果序列数量不多，显示普通图例
    return (
      <div className="flex flex-wrap gap-2 mt-2 px-2">
        {seriesNames.map((name, index) => (
          <div 
            key={name}
            className={`flex items-center gap-1 text-xs cursor-pointer transition-opacity ${
              visibleSeries.has(name) ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={() => toggleSeries(name)}
          >
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: getColor(index) }}
            />
            <span className="text-gray-300 truncate max-w-24" title={name}>
              {name}
            </span>
          </div>
        ))}
      </div>
    );
  }
  
  // 多序列时显示可滚动图例
  return (
    <div className="mt-2 px-2">
      <div className="flex items-center gap-2">
        <button
          onClick={scrollLeft}
          disabled={!canScrollLeft}
          className={`p-1 rounded ${
            canScrollLeft 
              ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <div className="flex-1 flex gap-2 overflow-hidden">
          {visibleNames.map((name, localIndex) => {
            const globalIndex = startIndex + localIndex;
            return (
              <div 
                key={name}
                className={`flex items-center gap-1 text-xs cursor-pointer transition-opacity flex-shrink-0 ${
                  visibleSeries.has(name) ? 'opacity-100' : 'opacity-50'
                }`}
                onClick={() => toggleSeries(name)}
              >
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: getColor(globalIndex) }}
                />
                <span className="text-gray-300 truncate max-w-20" title={name}>
                  {name}
                </span>
              </div>
            );
          })}
        </div>
        
        <button
          onClick={scrollRight}
          disabled={!canScrollRight}
          className={`p-1 rounded ${
            canScrollRight 
              ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {seriesNames.length > maxVisible && (
        <div className="text-xs text-gray-500 mt-1 text-center">
          显示 {startIndex + 1}-{Math.min(startIndex + maxVisible, seriesNames.length)} / {seriesNames.length} 个序列
        </div>
      )}
    </div>
  );
};

// 预设仪表板模板
const PRESET_DASHBOARDS: Dashboard[] = [
  {
    id: 'system-overview',
    title: '系统概览',
    description: '系统整体性能监控',
    category: '系统监控',
    timeRange: '1h',
    refreshInterval: 30,
    variables: [
      {
        name: 'instance',
        label: '实例',
        query: 'label_values(up, instance)',
        value: '192.168.50.81:9090',
        options: ['192.168.50.81:9090', '192.168.50.81:9100']
      }
    ],
    panels: [
      {
        id: 'cpu-usage',
        title: 'CPU使用率',
        type: 'line',
        query: '100 - (avg(rate(node_cpu_seconds_total{mode="idle",instance="$instance"}[5m])) * 100)',
        defaultQuery: '100 - (avg(rate(node_cpu_seconds_total{mode="idle",instance="$instance"}[5m])) * 100)',
        color: '#3b82f6',
        unit: '%',
        data: [],
        isCustomQuery: false
      },
      {
        id: 'memory-usage',
        title: '内存使用率',
        type: 'area',
        query: '(1 - (node_memory_MemAvailable_bytes{instance="$instance"} / node_memory_MemTotal_bytes{instance="$instance"})) * 100',
        defaultQuery: '(1 - (node_memory_MemAvailable_bytes{instance="$instance"} / node_memory_MemTotal_bytes{instance="$instance"})) * 100',
        color: '#10b981',
        unit: '%',
        data: [],
        isCustomQuery: false
      },
      {
        id: 'disk-usage',
        title: '磁盘使用率',
        type: 'bar',
        query: '(1 - (node_filesystem_avail_bytes{instance="$instance",fstype!="tmpfs"} / node_filesystem_size_bytes{instance="$instance",fstype!="tmpfs"})) * 100',
        defaultQuery: '(1 - (node_filesystem_avail_bytes{instance="$instance",fstype!="tmpfs"} / node_filesystem_size_bytes{instance="$instance",fstype!="tmpfs"})) * 100',
        color: '#f59e0b',
        unit: '%',
        data: [],
        isCustomQuery: false
      },
      {
        id: 'network-io',
        title: '网络IO',
        type: 'line',
        query: 'rate(node_network_receive_bytes_total{instance="$instance",device!="lo"}[5m]) + rate(node_network_transmit_bytes_total{instance="$instance",device!="lo"}[5m])',
        defaultQuery: 'rate(node_network_receive_bytes_total{instance="$instance",device!="lo"}[5m]) + rate(node_network_transmit_bytes_total{instance="$instance",device!="lo"}[5m])',
        color: '#ef4444',
        unit: 'bytes/s',
        data: [],
        isCustomQuery: false
      }
    ]
  },
  {
    id: 'application-monitoring',
    title: '应用监控',
    description: '应用程序性能和状态监控',
    category: '应用监控',
    timeRange: '1h',
    refreshInterval: 30,
    variables: [
      {
        name: 'job',
        label: '任务',
        query: 'label_values(up, job)',
        value: 'prometheus',
        options: ['prometheus', 'node-exporter']
      }
    ],
    panels: [
      {
        id: 'response-time',
        title: '响应时间',
        type: 'line',
        query: 'histogram_quantile(0.95, rate(prometheus_http_request_duration_seconds_bucket{job="$job"}[5m]))',
        defaultQuery: 'histogram_quantile(0.95, rate(prometheus_http_request_duration_seconds_bucket{job="$job"}[5m]))',
        color: '#8b5cf6',
        unit: 's',
        data: [],
        isCustomQuery: false
      },
      {
        id: 'request-rate',
        title: '请求速率',
        type: 'area',
        query: 'rate(prometheus_http_requests_total{job="$job"}[5m])',
        defaultQuery: 'rate(prometheus_http_requests_total{job="$job"}[5m])',
        color: '#06b6d4',
        unit: 'req/s',
        data: [],
        isCustomQuery: false
      },
      {
        id: 'error-rate',
        title: '错误率',
        type: 'line',
        query: 'rate(prometheus_http_requests_total{job="$job",code=~"5.."}[5m]) / rate(prometheus_http_requests_total{job="$job"}[5m]) * 100',
        defaultQuery: 'rate(prometheus_http_requests_total{job="$job",code=~"5.."}[5m]) / rate(prometheus_http_requests_total{job="$job"}[5m]) * 100',
        color: '#ef4444',
        unit: '%',
        data: [],
        isCustomQuery: false
      },
      {
        id: 'up-status',
        title: '服务状态',
        type: 'stat',
        query: 'up{job="$job"}',
        defaultQuery: 'up{job="$job"}',
        color: '#10b981',
        unit: '',
        data: [],
        isCustomQuery: false
      }
    ]
  }
];

// 增强的查询编辑器组件
const QueryEditor: React.FC<{
  query: string;
  onQueryChange: (query: string) => void;
  onExecute: () => void;
  isLoading?: boolean;
  variables: CustomVariable[];
  panelId?: string;
  defaultQuery?: string;
  onSaveDefaultQuery?: (panelId: string, query: string) => void;
  onRestoreDefaultQuery?: (panelId: string) => void;
}> = ({ query, onQueryChange, onExecute, isLoading, variables, panelId, defaultQuery, onSaveDefaultQuery, onRestoreDefaultQuery }) => {
  const [showPreview, setShowPreview] = useState(false);
  
  // 变量替换预览
  const getInterpolatedQuery = () => {
    let interpolated = query;
    variables.forEach(variable => {
      const value = Array.isArray(variable.value) ? variable.value.join('|') : variable.value;
      const regex = new RegExp(`\\$${variable.name}\\b`, 'g');
      interpolated = interpolated.replace(regex, value);
    });
    return interpolated;
  };

  const interpolatedQuery = getInterpolatedQuery();
  const hasVariables = variables.some(v => query.includes(`$${v.name}`));

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Code className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">PromQL 查询编辑器</span>
        </div>
        <div className="flex items-center space-x-2">
          {hasVariables && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                showPreview ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>预览</span>
            </button>
          )}
          <button
            onClick={onExecute}
            disabled={isLoading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            <span>{isLoading ? '执行中...' : '执行'}</span>
          </button>
        </div>
      </div>
      
      {/* 默认查询管理 */}
      {panelId && (
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={() => onSaveDefaultQuery?.(panelId, query)}
            disabled={!query.trim()}
            className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            <Save className="w-3 h-3" />
            <span>保存为默认查询</span>
          </button>
          
          {defaultQuery && defaultQuery !== query && (
            <button
              onClick={() => onRestoreDefaultQuery?.(panelId)}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>恢复默认查询</span>
            </button>
          )}
          
          {defaultQuery && (
            <div className="text-xs text-gray-400">
              默认查询: <code className="bg-gray-700 px-1 rounded">{defaultQuery.length > 30 ? defaultQuery.substring(0, 30) + '...' : defaultQuery}</code>
            </div>
          )}
        </div>
      )}
      
      <div className="space-y-3">
        <textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none resize-none"
          rows={4}
          placeholder={`输入 PromQL 查询语句...\n\n支持变量替换，例如：\nup{job="$job"}\nrate(http_requests_total{instance="$instance"}[5m])`}
        />
        
        {/* 变量替换预览 */}
        {showPreview && hasVariables && (
          <div className="bg-gray-700 border border-gray-600 rounded p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Eye className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-medium text-gray-300">变量替换预览</span>
            </div>
            <code className="text-xs text-green-400 bg-gray-900 px-2 py-1 rounded block break-all">
              {interpolatedQuery}
            </code>
          </div>
        )}
        
        {/* 变量提示 */}
        {variables.length > 0 && (
          <div className="bg-gray-700 border border-gray-600 rounded p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Variable className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-medium text-gray-300">可用变量</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {variables.map(variable => (
                <button
                  key={variable.id}
                  onClick={() => {
                    const cursorPos = (document.activeElement as HTMLTextAreaElement)?.selectionStart || query.length;
                    const newQuery = query.slice(0, cursorPos) + `$${variable.name}` + query.slice(cursorPos);
                    onQueryChange(newQuery);
                  }}
                  className="bg-gray-600 hover:bg-gray-500 text-gray-300 px-2 py-1 rounded text-xs transition-colors"
                  title={`插入变量: $${variable.name}`}
                >
                  ${variable.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Grafana风格变量选择器组件
const VariableSelector: React.FC<{
  variables: CustomVariable[];
  variableValues: Record<string, string | string[]>;
  onVariableChange: (name: string, value: string | string[]) => void;
}> = ({ variables, variableValues, onVariableChange }) => {
  if (variables.length === 0) return null;

  const visibleVariables = variables.filter(v => v.hide !== 'variable');
  if (visibleVariables.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-750 border border-gray-600 rounded-xl p-6 mb-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500 bg-opacity-20 rounded-lg">
            <Variable className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">变量选择器</h3>
            <p className="text-sm text-gray-400">选择变量值来过滤监控数据</p>
          </div>
        </div>
        <div className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
          {visibleVariables.length} 个变量
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleVariables.map((variable) => {
          // 获取当前变量的值，优先使用variableValues中的值
          const currentValue = variableValues[variable.name] || variable.value || '';
          
          return (
            <div key={variable.id} className="bg-gray-700 bg-opacity-50 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                {variable.hide !== 'label' && (
                  <label className="text-sm font-semibold text-white flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span>{variable.label}</span>
                  </label>
                )}
                {variable.multi && (
                  <span className="text-xs bg-green-500 bg-opacity-20 text-green-400 px-2 py-1 rounded-full">
                    多选
                  </span>
                )}
              </div>
              {/* 强制使用单选下拉选项 */}
              <select
                value={Array.isArray(currentValue) ? (currentValue[0] || '') : (currentValue || '')}
                onChange={(e) => onVariableChange(variable.name, e.target.value)}
                className="w-full bg-gray-800 border border-gray-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200 shadow-inner"
              >
                <option value="" className="bg-gray-800">🔽 选择 {variable.label}...</option>
                {variable.includeAll && (
                  <option value={variable.allValue || '*'} className="bg-gray-800 hover:bg-gray-700 transition-colors">🌐 全部选项</option>
                )}
                {variable.options?.map((option) => (
                  <option key={option} value={option} className="bg-gray-800 hover:bg-gray-700 transition-colors">📊 {option}</option>
                ))}
              </select>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {variable.options?.length || 0} 个选项可用
                </span>
                {variable.description && (
                  <span className="text-gray-500 italic">{variable.description}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};



// 面板组件
const PanelComponent: React.FC<{ 
  panel: Panel; 
  onEdit: () => void;
  onQueryChange: (query: string) => void;
  onExecuteQuery: () => void;
  onDelete: () => void;
  isLoading?: boolean;
  variables: Variable[];
  customVariables: CustomVariable[];
  onSavePanelQuery: (panelId: string, query: string) => void;
  onRestoreDefaultQuery: (panelId: string) => void;
}> = ({ panel, onEdit, onQueryChange, onExecuteQuery, onDelete, isLoading, variables, customVariables, onSavePanelQuery, onRestoreDefaultQuery }) => {
  
  const interpolateQuery = (query: string) => {
    // 简单的变量替换逻辑
    let result = query;
    variables.forEach(variable => {
      const placeholder = `$${variable.name}`;
      result = result.replace(new RegExp(`\\${placeholder}\\b`, 'g'), variable.value);
    });
    return result;
  };

  const formatValue = (value: number, unit?: string) => {
    if (unit === 'bytes/s') {
      if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB/s`;
      if (value >= 1024) return `${(value / 1024).toFixed(2)} KB/s`;
      return `${value.toFixed(2)} B/s`;
    }
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === 's') return `${(value * 1000).toFixed(0)}ms`;
    return `${value.toFixed(2)}${unit || ''}`;
  };

  const renderChart = () => {
    if (panel.data.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center">
            <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div>暂无数据</div>
            <div className="text-xs mt-1">请检查查询语句或Prometheus连接</div>
          </div>
        </div>
      );
    }

    switch (panel.type) {
      case 'line':
        const seriesNames = getSeriesNames(panel.data);
        const isMultiSeries = seriesNames.length > 1;
        
        return (
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={panel.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatValue(value, panel.unit)} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f9fafb'
                  }}
                  formatter={(value: number, name: string) => [
                    formatValue(value, panel.unit), 
                    isMultiSeries ? name : panel.title
                  ]}
                />
                {isMultiSeries ? (
                  // 多条曲线
                  seriesNames.map((seriesName, index) => (
                    <Line 
                      key={seriesName}
                      type="monotone" 
                      dataKey={seriesName} 
                      stroke={getSeriesColor(index, panel.color)} 
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  ))
                ) : (
                  // 单条曲线
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={panel.color} 
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            {isMultiSeries && (
              <ScrollableLegend 
                seriesNames={seriesNames} 
                getColor={(index) => getSeriesColor(index, panel.color)} 
                maxVisible={5}
              />
            )}
          </div>
        );
      
      case 'area':
        const areaSeriesNames = getSeriesNames(panel.data);
        const isMultiAreaSeries = areaSeriesNames.length > 1;
        
        return (
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={panel.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatValue(value, panel.unit)} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f9fafb'
                  }}
                  formatter={(value: number, name: string) => [
                    formatValue(value, panel.unit), 
                    isMultiAreaSeries ? name : panel.title
                  ]}
                />
                {isMultiAreaSeries ? (
                  // 多个区域图
                  areaSeriesNames.map((seriesName, index) => (
                    <Area 
                      key={seriesName}
                      type="monotone" 
                      dataKey={seriesName} 
                      stroke={getSeriesColor(index, panel.color)} 
                      fill={getSeriesColor(index, panel.color)}
                      fillOpacity={0.3}
                      connectNulls={false}
                    />
                  ))
                ) : (
                  // 单个区域图
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={panel.color} 
                    fill={panel.color}
                    fillOpacity={0.3}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
            {isMultiAreaSeries && (
              <ScrollableLegend 
                seriesNames={areaSeriesNames} 
                getColor={(index) => getSeriesColor(index, panel.color)} 
                maxVisible={5}
              />
            )}
          </div>
        );
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={panel.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatValue(value, panel.unit)} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb'
                }}
                formatter={(value: number) => [formatValue(value, panel.unit), panel.title]}
              />
              <Bar dataKey="value" fill={panel.color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={panel.data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${formatValue(value, panel.unit)}`}
              >
                {panel.data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color || panel.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb'
                }}
                formatter={(value: number) => [formatValue(value, panel.unit), '']}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      
      case 'stat':
        const statValue = panel.data[0]?.value || 0;
        return (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="text-4xl font-bold" style={{ color: panel.color }}>
                {formatValue(statValue, panel.unit)}
              </div>
              <div className="text-sm text-gray-400 mt-2">当前值</div>
            </div>
          </div>
        );
      
      case 'gauge':
        const gaugeValue = panel.data[0]?.value || 0;
        const percentage = Math.min(gaugeValue, 100);
        return (
          <div className="flex items-center justify-center h-48">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#374151"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={panel.color}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${percentage * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{formatValue(gaugeValue, panel.unit)}</div>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return <div className="flex items-center justify-center h-48 text-gray-400">不支持的图表类型</div>;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-white">{panel.title}</h3>
          {panel.isCustomQuery && (
            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded" title="使用自定义查询">
              自定义
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: panel.color }}></div>
          {panel.unit && (
            <span className="text-sm text-gray-400">{panel.unit}</span>
          )}
          {panel.isEditing && (
            <>
              <button
                onClick={() => onSavePanelQuery(panel.id, panel.query)}
                className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                title="保存当前查询"
              >
                <Save className="w-4 h-4" />
              </button>
              {panel.isCustomQuery && (
                <button
                  onClick={() => onRestoreDefaultQuery(panel.id)}
                  className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
                  title="恢复默认查询"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="编辑面板"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
            title="删除面板"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {panel.isEditing && (
        <div className="p-4 border-b border-gray-700 bg-gray-900">
          <QueryEditor
            query={panel.query}
            onQueryChange={onQueryChange}
            onExecute={onExecuteQuery}
            isLoading={isLoading}
            variables={customVariables}
            panelId={panel.id}
            defaultQuery={panel.defaultQuery}
            onSaveDefaultQuery={onSavePanelQuery}
            onRestoreDefaultQuery={onRestoreDefaultQuery}
          />
          <div className="text-xs text-gray-400 mt-2">
            插值后的查询: <code className="bg-gray-800 px-2 py-1 rounded">{interpolateQuery(panel.query)}</code>
          </div>
        </div>
      )}
      
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
              <div className="text-gray-400">加载中...</div>
            </div>
          </div>
        ) : (
          renderChart()
        )}
      </div>
    </div>
  );
};

// 仪表板卡片组件
const DashboardCard: React.FC<{ 
  dashboard: Dashboard; 
  isSelected: boolean; 
  onClick: () => void; 
}> = ({ dashboard, isSelected, onClick }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '系统监控':
        return <Monitor className="w-6 h-6" />;
      case '应用监控':
        return <Activity className="w-6 h-6" />;
      case '网络监控':
        return <Globe className="w-6 h-6" />;
      case '数据库监控':
        return <Database className="w-6 h-6" />;
      default:
        return <Server className="w-6 h-6" />;
    }
  };

  return (
    <div 
      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected 
          ? 'bg-blue-900/50 border-blue-500 shadow-lg' 
          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-lg ${
          isSelected ? 'bg-blue-500' : 'bg-gray-700'
        }`}>
          {getCategoryIcon(dashboard.category)}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{dashboard.title}</h3>
          <p className="text-sm text-gray-400 mb-2">{dashboard.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{dashboard.category}</span>
            <span className="text-xs text-gray-500">{dashboard.panels.length} 个面板</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MonitoringPanel: React.FC = () => {
  // Prompt hook
  const { showPrompt, PromptComponent } = usePrompt();
  
  // 基础状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  
  // 仪表盘管理
  const [dashboards, setDashboards] = useState<Dashboard[]>(PRESET_DASHBOARDS);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard>(PRESET_DASHBOARDS[0]);
  const [dashboardTemplates, setDashboardTemplates] = useState<DashboardTemplate[]>([]);
  
  // 变量管理
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string | string[]>>({});
  
  // 监控状态
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [prometheusConnected, setPrometheusConnected] = useState(false);
  
  // UI状态
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDashboardEditor, setShowDashboardEditor] = useState(false);
  const [showVariableEditor, setShowVariableEditor] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'variables'>('dashboard');
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  
  // 首页仪表板选择状态
  const [homeDashboardId, setHomeDashboardId] = useState<string>(() => {
    return localStorage.getItem('monitoring_home_dashboard') || PRESET_DASHBOARDS[0].id;
  });
  const [showHomeDashboardSelector, setShowHomeDashboardSelector] = useState(false);

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      const response = await configAPI.getConfig();
      if (response.success && response.data) {
        setConfig(response.data);
        // 配置已通过configManager自动更新
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }, []);

  // 数据库持久化管理函数（需要在使用前定义）
  const saveDashboardToDatabase = useCallback(async (dashboard: Dashboard) => {
    try {
      // 检查仪表板是否已存在（优先按ID检查，避免重复创建）
      const existingDashboards = await dataService.getDashboards();
      const existingDashboard = existingDashboards.find((d: any) => d.id === dashboard.id);
      
      let response;
      if (existingDashboard) {
        // 更新现有仪表板
        console.log('更新现有仪表板:', dashboard.id, dashboard.title);
        response = await fetch(`${getApiBaseUrl()}/dashboards/${existingDashboard.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: dashboard.title,
            description: dashboard.description,
            time_range: dashboard.timeRange,
            refresh_interval: dashboard.refreshInterval,
            variables: dashboard.variables,
            panels: dashboard.panels
          })
        });
      } else {
        // 检查是否存在相同标题的仪表板
        const duplicateTitle = existingDashboards.find((d: any) => d.title === dashboard.title);
        if (duplicateTitle) {
          console.log('发现重复标题，更新现有仪表板:', duplicateTitle.id, dashboard.title);
          // 如果存在相同标题，更新现有的而不是创建新的
          response = await fetch(`${getApiBaseUrl()}/dashboards/${duplicateTitle.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: dashboard.title,
              description: dashboard.description,
              time_range: dashboard.timeRange,
              refresh_interval: dashboard.refreshInterval,
              variables: dashboard.variables,
              panels: dashboard.panels
            })
          });
        } else {
          // 创建新仪表板
          console.log('创建新仪表板:', dashboard.id, dashboard.title);
          response = await fetch(`${getApiBaseUrl()}/dashboards`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: dashboard.title,
              description: dashboard.description,
              time_range: dashboard.timeRange,
              refresh_interval: dashboard.refreshInterval,
              variables: dashboard.variables,
              panels: dashboard.panels
            })
          });
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '保存仪表板到数据库失败');
      }
      
      const result = await response.json();
      console.log('仪表板已保存到数据库:', result);
      return result;
    } catch (error) {
      console.error('保存仪表板到数据库失败:', error);
      throw error;
    }
  }, []);

  const saveVariableValueToDatabase = useCallback(async (variableName: string, value: string | string[]) => {
    try {
      const stringValue = Array.isArray(value) ? value.join(',') : value;
      const result = await dataService.saveVariableValue(variableName, stringValue);
      console.log('变量值已保存到数据库:', result);
      return result;
    } catch (error) {
      console.error('保存变量值到数据库失败:', error);
      throw error;
    }
  }, []);

  const loadDashboardsFromDatabase = useCallback(async () => {
    try {
      const dbDashboards = await dataService.getDashboards();
      console.log('从数据库加载的仪表板:', dbDashboards);
      
      if (dbDashboards && dbDashboards.length > 0) {
        const formattedDashboards = dbDashboards.map((db: any) => ({
          id: db.id.toString(),
          title: db.name || db.title,
          description: db.description,
          category: '数据库',
          timeRange: '1h',
          refreshInterval: 30,
          variables: db.variables || [],
          panels: (db.panels || []).map((panel: any) => ({
            ...panel,
            isEditing: false // 确保从数据库加载的面板不在编辑状态
          })),
          createdAt: db.created_at,
          updatedAt: db.updated_at
        }));
        
        setDashboards(formattedDashboards);
        
        // 如果当前选中的仪表板在数据库中有更新版本，同步更新
        const currentDashboardUpdate = formattedDashboards.find(d => d.id === selectedDashboard.id);
        if (currentDashboardUpdate) {
          setSelectedDashboard(currentDashboardUpdate);
          console.log('同步更新当前仪表板:', currentDashboardUpdate.title);
        }
      }
      
      return dbDashboards;
    } catch (error) {
      console.error('从数据库加载仪表板失败:', error);
      throw error;
    }
  }, [selectedDashboard.id]);

  const loadVariablesFromDatabase = useCallback(async () => {
    try {
      const dbVariables = await dataService.getVariables();
      console.log('从数据库加载的变量:', dbVariables);
      
      if (dbVariables && dbVariables.length > 0) {
        const formattedVariables = dbVariables.map((dbVar: any) => ({
          id: dbVar.id.toString(),
          name: dbVar.name,
          label: dbVar.label || dbVar.name,
          type: dbVar.type,
          query: dbVar.query || '',
          value: dbVar.default_value || dbVar.value,
          options: dbVar.options || [],
          multi: dbVar.multi || false,
          includeAll: dbVar.include_all || false,
          allValue: dbVar.all_value || '',
          hide: dbVar.hide || 'none' as const
        }));
        
        setCustomVariables(formattedVariables);
        
        // 加载变量值
        try {
          const variableValues = await dataService.getVariableValues();
          const initialValues: Record<string, string | string[]> = {};
          
          if (variableValues && variableValues.length > 0) {
            variableValues.forEach((vv: VariableValue) => {
              if (vv.variable_name && vv.value !== undefined && vv.value !== null) {
                initialValues[vv.variable_name] = vv.value;
              }
            });
            
            if (Object.keys(initialValues).length > 0) {
              setVariableValues(prev => ({ ...prev, ...initialValues }));
              console.log('从数据库加载变量值:', initialValues);
            }
          }
          
          // 如果数据库中没有变量值，尝试从localStorage加载
          if (Object.keys(initialValues).length === 0) {
            const savedVariableValues = localStorage.getItem('monitoring_variable_values');
            if (savedVariableValues) {
              try {
                const localValues = JSON.parse(savedVariableValues);
                setVariableValues(prev => ({ ...prev, ...localValues }));
                console.log('从localStorage加载变量值:', localValues);
              } catch (error) {
                console.error('解析localStorage变量值失败:', error);
              }
            }
          }
        } catch (error) {
          console.error('加载变量值失败:', error);
          // 回退到localStorage
          const savedVariableValues = localStorage.getItem('monitoring_variable_values');
          if (savedVariableValues) {
            try {
              const localValues = JSON.parse(savedVariableValues);
              setVariableValues(prev => ({ ...prev, ...localValues }));
              console.log('从localStorage加载变量值（回退）:', localValues);
            } catch (error) {
              console.error('解析localStorage变量值失败:', error);
            }
          }
        }
      }
      
      return dbVariables;
    } catch (error) {
      console.error('从数据库加载变量失败:', error);
      throw error;
    }
  }, []);

  const loadTemplatesFromDatabase = useCallback(async () => {
    try {
      const templates = await dataService.getTemplates();
      console.log('从数据库加载的模板:', templates);
      
      if (templates && templates.length > 0) {
        setDashboardTemplates(templates);
        return templates;
      }
      
      return [];
    } catch (error) {
      console.error('从数据库加载模板失败:', error);
      // 如果数据库加载失败，尝试从localStorage加载
      const localTemplates = dataService.loadFromLocalStorage<Template[]>('dashboard_templates');
      if (localTemplates) {
        setDashboardTemplates(localTemplates);
        return localTemplates;
      }
      return [];
    }
  }, []);

  // 检查Prometheus连接
  const checkPrometheusConnection = useCallback(async () => {
    try {
      const response = await fetch(`${getPrometheusBaseUrl()}/api/v1/status/config`);
      setPrometheusConnected(response.ok);
    } catch (error) {
      setPrometheusConnected(false);
    }
  }, []);

  // 自定义变量管理
  const createVariable = useCallback(async (variable: Omit<CustomVariable, 'id'>) => {
    const newVariable: CustomVariable = {
      ...variable,
      id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    try {
      // 使用数据服务保存变量
      const dbVariable = await dataService.createVariable({
        name: newVariable.name,
        type: newVariable.type,
        default_value: Array.isArray(newVariable.value) ? newVariable.value.join(',') : newVariable.value,
        description: newVariable.description
      });
      
      console.log('变量已保存到数据库:', dbVariable);
      
      // 更新本地状态
      setCustomVariables(prev => [...prev, newVariable]);
      
      // 如果有初始值，保存变量值
      if (newVariable.value) {
        await saveVariableValueToDatabase(newVariable.name, newVariable.value);
      }
    } catch (error) {
      console.error('保存变量到数据库失败:', error);
      // 如果数据库操作失败，仍然更新本地状态
      setCustomVariables(prev => [...prev, newVariable]);
    }
    return newVariable;
  }, []);

  const updateVariable = useCallback(async (id: string, updates: Partial<CustomVariable>) => {
    try {
      // 确保保留原有的label和query字段
      const currentVariable = customVariables.find(v => v.id === id);
      const mergedUpdates = {
        ...currentVariable,
        ...updates,
        // 确保关键字段不被意外清空
        label: updates.label || currentVariable?.label || updates.name,
        query: updates.query !== undefined ? updates.query : currentVariable?.query
      };
      
      // 优先更新到数据库
      const response = await fetch(`/api/variables/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mergedUpdates),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('变量已更新到数据库:', result.data);
          // 使用数据库返回的完整数据更新本地状态
          setCustomVariables(prev => prev.map(v => v.id === id ? {
            ...v,
            ...result.data,
            // 确保ID保持一致
            id: id,
            // 确保关键字段正确更新
            label: result.data.label || result.data.name,
            query: result.data.query || v.query
          } : v));
          console.log('本地变量状态已更新:', result.data);
          return;
        }
      }
    } catch (error) {
      console.error('更新变量到数据库失败:', error);
    }
    
    // 如果数据库操作失败，使用合并后的数据更新本地状态
    const currentVariable = customVariables.find(v => v.id === id);
    const mergedUpdates = {
      ...currentVariable,
      ...updates,
      label: updates.label || currentVariable?.label || updates.name,
      query: updates.query !== undefined ? updates.query : currentVariable?.query
    };
    setCustomVariables(prev => prev.map(v => v.id === id ? { ...v, ...mergedUpdates } : v));
  }, [customVariables]);

  const deleteVariable = useCallback(async (id: string) => {
    try {
      // 优先从数据库删除
      const response = await fetch(`/api/variables/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('变量已从数据库删除:', id);
        }
      }
    } catch (error) {
      console.error('从数据库删除变量失败:', error);
    }
    
    // 无论数据库操作是否成功，都更新本地状态
    setCustomVariables(prev => prev.filter(v => v.id !== id));
    setVariableValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  }, []);

  // Prometheus API调用函数
  const prometheusAPI = {
    // 查询当前指标
    query: async (query: string) => {
      try {
        const response = await fetch(`${getPrometheusBaseUrl()}/api/v1/query?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Prometheus查询失败:', error);
        throw error;
      }
    },

    // 查询历史指标
    queryRange: async (query: string, start: string, end: string, step: string) => {
      try {
        const response = await fetch(
          `${getPrometheusBaseUrl()}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
        );
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Prometheus范围查询失败:', error);
        throw error;
      }
    },

    // 获取所有指标名称
    getMetrics: async () => {
      try {
        const response = await fetch(`${getPrometheusBaseUrl()}/api/v1/label/__name__/values`);
        const data = await response.json();
        return data;
      } catch (error) {
        // Prometheus服务未运行时的静默处理
        return { status: 'error', data: [] };
      }
    },

    // 获取标签名称列表
    getLabelNames: async () => {
      try {
        const response = await fetch(`${getPrometheusBaseUrl()}/api/v1/labels`);
        const data = await response.json();
        return data;
      } catch (error) {
        // Prometheus服务未运行时的静默处理
        return { status: 'error', data: [] };
      }
    },

    // 获取指定标签的所有值
    getLabelValues: async (labelName: string) => {
      try {
        const response = await fetch(`${getPrometheusBaseUrl()}/api/v1/label/${encodeURIComponent(labelName)}/values`);
        const data = await response.json();
        return data;
      } catch (error) {
        console.error(`获取标签${labelName}的值失败:`, error);
        throw error;
      }
    },

    // 根据查询获取标签值
    getSeriesLabels: async (match: string) => {
      try {
        const response = await fetch(`${getPrometheusBaseUrl()}/api/v1/series?match[]=${encodeURIComponent(match)}`);
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('获取序列标签失败:', error);
        throw error;
      }
    }
  };

  // 获取变量选项
  const getVariableOptions = useCallback(async (variable: CustomVariable): Promise<string[]> => {
    if (variable.type === 'custom' && variable.options) {
      return variable.options;
    }
    
    if (variable.type === 'constant') {
      return [variable.value as string];
    }
    
    if (variable.type === 'query' && variable.query) {
      try {
        // 如果Prometheus未连接，返回模拟数据
        if (!prometheusConnected) {
          console.warn('Prometheus未连接，使用模拟数据');
          if (variable.query.includes('job')) {
            return ['node-exporter', 'prometheus', 'grafana'];
          }
          if (variable.query.includes('instance')) {
            return ['192.168.50.81:9100', '192.168.50.81:9090', '192.168.50.81:3000'];
          }
          return ['option1', 'option2', 'option3'];
        }

        if (variable.query) {
          // 如果是标签查询
          if (variable.query.startsWith('label_values(')) {
            // 解析 label_values(metric, label) 格式
            const match = variable.query.match(/label_values\(([^,)]+)(?:,\s*([^)]+))?\)/);
            if (match) {
              const [, metric, label] = match;
              if (label) {
                // 获取指定指标的指定标签值
                const seriesData = await prometheusAPI.getSeriesLabels(metric.trim());
                if (seriesData.status === 'success') {
                  const labelValues = new Set<string>();
                  seriesData.data.forEach((series: any) => {
                    if (series[label.trim()]) {
                      labelValues.add(series[label.trim()]);
                    }
                  });
                  return Array.from(labelValues).sort();
                }
              } else {
                // 获取所有标签值
                const labelData = await prometheusAPI.getLabelValues(metric.trim());
                if (labelData.status === 'success') {
                  return labelData.data.sort();
                }
              }
            }
          } else {
            // 执行普通查询
            const result = await prometheusAPI.query(variable.query);
            if (result.status === 'success' && result.data.result) {
              const values = result.data.result.map((item: any) => {
                if (item.metric) {
                  // 如果有标签，返回第一个标签的值
                  const labels = Object.keys(item.metric);
                  if (labels.length > 0) {
                    return item.metric[labels[0]];
                  }
                }
                return item.value ? item.value[1] : '';
              }).filter((v: string) => v) as string[];
              return [...new Set(values)].sort();
            }
          }
        }
        return [];
      } catch (error) {
        console.error('获取变量选项失败:', error);
        // 返回模拟数据作为降级处理
        if (variable.query?.includes('job')) {
          return ['node-exporter', 'prometheus', 'grafana'];
        }
        if (variable.query?.includes('instance')) {
          return ['192.168.50.81:9100', '192.168.50.81:9090', '192.168.50.81:3000'];
        }
        return ['fallback-option'];
      }
    }
    
    return [];
  }, [prometheusConnected]);

  // 更新变量值
  const updateVariableValue = useCallback(async (variableId: string, value: string | string[]) => {
    // 先更新本地状态
    setVariableValues(prev => ({ ...prev, [variableId]: value }));
    
    // 尝试保存到数据库
    try {
      await saveVariableValueToDatabase(variableId, value);
      console.log('变量值已同步到数据库:', { variableId, value });
    } catch (error) {
      console.warn('保存变量值到数据库失败，仅保存到本地:', error);
    }
  }, [saveVariableValueToDatabase]);

  // 替换查询中的变量
  const replaceVariables = useCallback((query: string): string => {
    let result = query;
    
    // 合并所有变量源
    const allVariables = [...customVariables, ...selectedDashboard.variables];
    
    console.log('replaceVariables - 输入查询:', query);
    console.log('replaceVariables - 所有变量:', allVariables);
    console.log('replaceVariables - 变量值状态:', variableValues);
    
    allVariables.forEach(variable => {
       // 优先使用variableValues中的值，然后是variable.value
       const value = variableValues[variable.name] || ('id' in variable ? variableValues[variable.id] : undefined) || variable.value;
       const placeholder = `$${variable.name}`;
      
      console.log(`replaceVariables - 处理变量 ${variable.name}:`, {
        placeholder,
        value,
        fromVariableValues: variableValues[variable.name],
        fromVariableId: 'id' in variable ? variableValues[variable.id] : undefined,
        fromVariableValue: variable.value
      });
      
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          // 多值变量用正则表达式格式
          const regexValue = value.length > 1 ? `(${value.join('|')})` : value[0];
          const regex = new RegExp(`\\${placeholder}\\b`, 'g');
          result = result.replace(regex, regexValue);
          console.log(`replaceVariables - 替换多值变量 ${placeholder} -> ${regexValue}`);
        } else {
          const regex = new RegExp(`\\${placeholder}\\b`, 'g');
          result = result.replace(regex, value as string);
          console.log(`replaceVariables - 替换单值变量 ${placeholder} -> ${value}`);
        }
      } else {
        console.log(`replaceVariables - 跳过变量 ${placeholder}，值为空:`, value);
      }
    });
    
    console.log('replaceVariables - 输出查询:', result);
    return result;
  }, [customVariables, variableValues, selectedDashboard.variables]);



  // 模板状态管理
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatesLoadingRef, setTemplatesLoadingRef] = useState(false);

  // 加载模板数据
  const loadTemplates = useCallback(async () => {
    // 防止重复加载
    if (templatesLoadingRef) {
      console.log('模板正在加载中，跳过重复请求');
      return;
    }
    
    try {
      setTemplatesLoadingRef(true);
      setTemplatesLoading(true);
      setTemplatesError(null);
      const templates = await dataService.getTemplates();
      setDashboardTemplates(templates);
    } catch (error) {
      console.error('加载模板失败:', error);
      setTemplatesError('加载模板失败');
      // 如果数据库加载失败，尝试从localStorage加载
      const localTemplates = dataService.loadFromLocalStorage<Template[]>('dashboard_templates');
      if (localTemplates) {
        setDashboardTemplates(localTemplates);
      }
    } finally {
      setTemplatesLoading(false);
      setTemplatesLoadingRef(false);
    }
  }, [templatesLoadingRef]);

  // 初始化默认模板（如果数据库为空）
  const initializeDefaultTemplates = useCallback(async () => {
    const defaultTemplates: Template[] = [
      {
        id: 'node-exporter',
        name: 'Node Exporter监控',
        description: '系统资源监控：CPU、内存、磁盘、网络',
        category: '系统监控',
        tags: ['系统', 'Node Exporter', 'CPU', '内存'],
        is_builtin: true,
        variables: [
          {
            name: 'instance',
            label: '实例',
            type: 'query',
            query: 'label_values(up{job="node-exporter"}, instance)',
            value: '192.168.50.81:9100',
            multi: false
          },
          {
            name: 'job',
            label: '任务',
            type: 'query', 
            query: 'label_values(up, job)',
            value: 'node-exporter',
            multi: false
          }
        ],
        panels: [
          {
            title: 'CPU使用率',
            type: 'gauge',
            query: '100 - (avg(rate(node_cpu_seconds_total{mode="idle",instance="$instance"}[5m])) * 100)',
            color: '#3b82f6',
            data: [],
            chartType: 'gauge',
            timeRange: '1h',
            refreshInterval: 30,
            position: { x: 0, y: 0, w: 6, h: 4 },
            unit: '%',
            thresholds: [{ value: 80, color: '#f59e0b' }, { value: 90, color: '#ef4444' }]
          },
          {
            title: '内存使用率',
            type: 'gauge',
            query: '(1 - (node_memory_MemAvailable_bytes{instance="$instance"} / node_memory_MemTotal_bytes{instance="$instance"})) * 100',
            color: '#10b981',
            data: [],
            chartType: 'gauge',
            timeRange: '1h',
            refreshInterval: 30,
            position: { x: 6, y: 0, w: 6, h: 4 },
            unit: '%'
          },
          {
            title: '磁盘使用率',
            type: 'bar',
            query: '(1 - (node_filesystem_avail_bytes{instance="$instance",fstype!="tmpfs"} / node_filesystem_size_bytes{instance="$instance",fstype!="tmpfs"})) * 100',
            color: '#f59e0b',
            data: [],
            chartType: 'bar',
            timeRange: '1h',
            refreshInterval: 30,
            position: { x: 0, y: 4, w: 12, h: 4 },
            unit: '%'
          },
          {
            title: '网络流量',
            type: 'line',
            query: 'rate(node_network_receive_bytes_total{instance="$instance",device!="lo"}[5m])',
            color: '#06b6d4',
            data: [],
            chartType: 'line',
            timeRange: '1h',
            refreshInterval: 30,
            position: { x: 0, y: 8, w: 12, h: 4 },
            unit: 'bytes/s'
          }
        ]
      },
      {
        id: 'application-monitoring',
        name: '应用监控',
        description: '应用性能监控：响应时间、错误率、吞吐量',
        category: '应用监控',
        tags: ['应用', '性能', 'HTTP'],
        is_builtin: true,
        variables: [
          {
            name: 'service',
            label: '服务',
            type: 'custom',
            options: ['api-server', 'web-server', 'database'],
            value: 'api-server',
            multi: false
          }
        ],
        panels: [
          {
            title: '请求响应时间',
            type: 'line',
            query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="$service"}[5m]))',
            color: '#8b5cf6',
            data: [],
            chartType: 'line',
            timeRange: '1h',
            refreshInterval: 30,
            position: { x: 0, y: 0, w: 6, h: 4 },
            unit: 's'
          },
          {
            title: '错误率',
            type: 'stat',
            query: 'rate(http_requests_total{service="$service",status=~"5.."}[5m]) / rate(http_requests_total{service="$service"}[5m]) * 100',
            color: '#ef4444',
            data: [],
            chartType: 'stat',
            timeRange: '1h',
            refreshInterval: 30,
            position: { x: 6, y: 0, w: 6, h: 4 },
            unit: '%'
          }
        ]
      },
      {
        id: 'database-monitoring',
        name: '数据库监控',
        description: '数据库性能监控：连接数、查询性能、缓存命中率',
        category: '数据库监控',
        tags: ['数据库', 'MySQL', 'PostgreSQL'],
        is_builtin: true,
        variables: [
          {
            name: 'database',
            label: '数据库',
            type: 'custom',
            options: ['mysql', 'postgresql', 'redis'],
            value: 'mysql',
            multi: false
          }
        ],
        panels: [
          {
            title: '活跃连接数',
            type: 'line',
            query: 'mysql_global_status_threads_connected{instance="$database"}',
            color: '#06b6d4',
            data: [],
            chartType: 'line',
            timeRange: '1h',
            refreshInterval: 30,
            position: { x: 0, y: 0, w: 12, h: 4 },
            unit: 'connections'
          }
        ]
      }
    ];

    try {
      // 同步默认模板到数据库
      await dataService.syncTemplates(defaultTemplates);
      console.log('默认模板已同步到数据库');
      // 重新加载模板
      await loadTemplates();
    } catch (error) {
      console.error('同步默认模板失败:', error);
      // 如果同步失败，至少保存到本地
      dataService.saveToLocalStorage('dashboard_templates', defaultTemplates);
      setDashboardTemplates(defaultTemplates);
    }
  }, [loadTemplates]);

  // 仪表盘管理
  const createDashboard = useCallback(async (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDashboard: Dashboard = {
      ...dashboard,
      id: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: dashboard.category || '自定义',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 先更新本地状态
    setDashboards(prev => [...prev, newDashboard]);
    
    // 尝试保存到数据库
    try {
      await saveDashboardToDatabase(newDashboard);
      console.log('仪表板已同步到数据库');
    } catch (error) {
      console.warn('保存仪表板到数据库失败，仅保存到本地:', error);
    }
    
    return newDashboard;
  }, [saveDashboardToDatabase]);

  const updateDashboard = useCallback(async (id: string, updates: Partial<Dashboard>) => {
    const updatedDashboard = dashboards.find(d => d.id === id);
    if (!updatedDashboard) return;
    
    const newDashboard = { ...updatedDashboard, ...updates, updatedAt: new Date().toISOString() };
    
    // 先更新本地状态
    setDashboards(prev => prev.map(d => 
      d.id === id ? newDashboard : d
    ));
    
    // 优先更新到数据库
    try {
      const response = await fetch(`${getApiBaseUrl()}/dashboards/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newDashboard.title,
          description: newDashboard.description,
          time_range: newDashboard.timeRange,
          refresh_interval: newDashboard.refreshInterval,
          variables: newDashboard.variables,
          panels: newDashboard.panels
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('仪表板已同步更新到数据库:', result);
      } else {
        const errorData = await response.json();
        console.warn('更新仪表板到数据库失败:', errorData.message);
        throw new Error(errorData.message || '更新仪表板失败');
      }
    } catch (error) {
      console.error('更新仪表板到数据库失败:', error);
      // 如果数据库更新失败，回退本地状态
      setDashboards(prev => prev.map(d => 
        d.id === id ? updatedDashboard : d
      ));
      throw error;
    }
  }, [dashboards]);

  const deleteDashboard = useCallback(async (id: string) => {
    console.log('deleteDashboard 函数被调用，ID:', id);
    
    try {
      // 先检查是否是内置仪表板（预设仪表板）
      const dashboardToDelete = dashboards.find(d => d.id === id);
      console.log('要删除的仪表板:', dashboardToDelete);
      
      const isPresetDashboard = PRESET_DASHBOARDS.some(preset => preset.id === id);
      console.log('是否为预设仪表板:', isPresetDashboard);
      
      if (isPresetDashboard) {
        console.log('尝试删除预设仪表板，操作被阻止');
        toast.error('无法删除内置仪表板');
        return;
      }

      if (!dashboardToDelete) {
        console.log('未找到要删除的仪表板');
        toast.error('未找到要删除的仪表板');
        return;
      }

      console.log('开始调用后端API删除仪表板');
      // 调用后端API删除数据库记录
      const apiUrl = `${getApiBaseUrl()}/dashboards/${id}`;
      console.log('删除API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API响应状态:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = '删除仪表板失败';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.log('API错误响应:', errorData);
        } catch (parseError) {
          console.log('解析错误响应失败:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('删除API成功响应:', result);
      
      // 更新本地状态
      console.log('更新本地状态，移除仪表板');
      const remainingDashboards = dashboards.filter(d => d.id !== id);
      setDashboards(remainingDashboards);
      console.log('剩余仪表板数量:', remainingDashboards.length);
      
      // 如果删除的是当前选中的仪表板，切换到其他仪表板
      if (selectedDashboard?.id === id) {
        console.log('删除的是当前选中的仪表板，切换到其他仪表板');
        const nextDashboard = remainingDashboards[0] || PRESET_DASHBOARDS[0];
        setSelectedDashboard(nextDashboard);
        console.log('切换到仪表板:', nextDashboard?.title);
      }
      
      // 同时从localStorage中删除
      try {
        console.log('从localStorage删除仪表板');
        const savedDashboards = JSON.parse(localStorage.getItem('monitoring_dashboards') || '[]');
        const filteredDashboards = savedDashboards.filter((d: any) => d.id !== id);
        localStorage.setItem('monitoring_dashboards', JSON.stringify(filteredDashboards));
        console.log('localStorage更新完成');
      } catch (localError) {
        console.warn('从localStorage删除仪表板失败:', localError);
      }
      
      console.log('仪表板删除操作完成');
      toast.success('仪表板删除成功');
    } catch (error) {
      console.error('删除仪表板失败:', error);
      toast.error(`删除仪表板失败: ${(error as Error).message}`);
    }
  }, [selectedDashboard, dashboards]);

  const duplicateDashboard = useCallback((dashboard: Dashboard) => {
    const newDashboard = createDashboard({
      ...dashboard,
      title: `${dashboard.title} (副本)`,
      panels: dashboard.panels.map(panel => ({
        ...panel,
        id: `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))
    });
    return newDashboard;
  }, [createDashboard]);

  // 从模板创建仪表盘或更新现有仪表盘
  const createDashboardFromTemplate = useCallback(async (templateId: string, updateExisting: boolean = false) => {
    // 防止重复操作
    if (isCreatingDashboard) {
      console.log('正在创建仪表板，跳过重复操作');
      return;
    }
    
    const template = dashboardTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setIsCreatingDashboard(true);
    
    try {
      // 如果是更新现有仪表盘，查找同名的仪表盘
      let existingDashboard: Dashboard | undefined;
      if (updateExisting) {
        existingDashboard = dashboards.find(d => d.title === template.name);
      }
      
      // 检查是否已存在相同标题的仪表板
      if (!updateExisting) {
        const duplicateDashboard = dashboards.find(d => d.title === template.name);
        if (duplicateDashboard) {
          // 如果同名仪表板已存在且不是更新操作，直接选择它
          setSelectedDashboard(duplicateDashboard);
          toast.info(`已选择现有仪表板: ${template.name}`);
          return;
        }
      }
    
    const dashboardData = {
      title: template.name,
      description: template.description,
      category: template.category || 'custom',
      panels: (template.panels || []).map(panel => ({
         id: existingDashboard ? 
           (existingDashboard.panels.find(p => p.title === panel.title)?.id || `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`) :
           `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
         title: panel.title || 'New Panel',
         type: (panel.type as any) || 'line',
         query: panel.query || '',
         defaultQuery: panel.query || '',
         color: panel.color || '#3b82f6',
         unit: panel.unit,
         data: [],
         isEditing: false,
         isCustomQuery: false
       })),
      variables: (template.variables || []).map(variable => ({
        name: variable.name,
        label: variable.label || variable.name,
        query: variable.type === 'query' ? (variable.query || `label_values(${variable.name})`) : '',
        value: Array.isArray(variable.value) ? variable.value[0] : (variable.value || ''),
        options: variable.options || []
      })),
      timeRange: existingDashboard?.timeRange || '1h',
      refreshInterval: existingDashboard?.refreshInterval || 30,
      updatedAt: new Date().toISOString()
    };
    
    // 初始化变量值到variableValues状态
    const initialVariableValues: Record<string, string | string[]> = {};
    (template.variables || []).forEach(variable => {
      const value = Array.isArray(variable.value) ? variable.value[0] : variable.value;
      if (value) {
        initialVariableValues[variable.name] = value;
      }
    });
    
    // 同时更新customVariables
    const newCustomVariables = (template.variables || []).map(variable => ({
      id: existingDashboard ? 
        (customVariables.find(v => v.name === variable.name)?.id || `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`) :
        `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: variable.name,
      label: variable.label || variable.name,
      type: variable.type as any,
      query: variable.type === 'query' ? (variable.query || `label_values(${variable.name})`) : '',
      value: Array.isArray(variable.value) ? variable.value[0] : (variable.value || ''),
      options: variable.options || [],
      multi: variable.multi || false,
      includeAll: (variable as any).include_all || false,
      allValue: (variable as any).all_value || '*',
      hide: (variable.hide as any) || 'none',
      description: variable.description
    }));
    
    if (existingDashboard && updateExisting) {
      // 更新现有仪表盘 - 只更新内容，不创建新记录
      const updatedDashboard = {
        ...existingDashboard,
        ...dashboardData,
        id: existingDashboard.id, // 确保ID不变
        createdAt: existingDashboard.createdAt // 保持原创建时间
      };
      
      // 先更新本地状态
      setDashboards(prev => prev.map(d => d.id === existingDashboard.id ? updatedDashboard : d));
      setSelectedDashboard(updatedDashboard);
      
      // 然后更新数据库
      try {
        await updateDashboard(existingDashboard.id, dashboardData);
        console.log('仪表板已更新到数据库');
      } catch (error) {
        console.error('更新仪表板到数据库失败:', error);
      }
      
      // 更新变量
      setCustomVariables(prev => {
        const filtered = prev.filter(v => !newCustomVariables.find(nv => nv.name === v.name));
        return [...filtered, ...newCustomVariables];
      });
      
      toast.success(`仪表盘 "${template.name}" 已更新`);
    } else {
      // 创建新仪表盘
      const newDashboard: Dashboard = {
        id: `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        ...dashboardData
      };
      
      setDashboards(prev => [...prev, newDashboard]);
      setSelectedDashboard(newDashboard);
      setCustomVariables(prev => [...prev, ...newCustomVariables]);
      
      // 优先保存到数据库
      try {
        await saveDashboardToDatabase(newDashboard);
        console.log('新仪表板已保存到数据库');
      } catch (error) {
        console.error('保存新仪表板到数据库失败:', error);
      }
      
      toast.success(`仪表盘 "${template.name}" 已创建`);
    }
    
      setVariableValues(prev => ({ ...prev, ...initialVariableValues }));
      console.log('仪表板操作完成，初始化变量值:', initialVariableValues);
      
      return existingDashboard || dashboards[dashboards.length - 1];
    } catch (error) {
      console.error('创建/更新仪表板失败:', error);
      toast.error('操作失败');
    } finally {
      setIsCreatingDashboard(false);
    }
  }, [dashboardTemplates, dashboards, customVariables, saveDashboardToDatabase, updateDashboard, isCreatingDashboard]);



  // 本地存储管理（保持兼容性）
  const saveToLocalStorage = useCallback(() => {
    try {
      const data = {
        dashboards,
        customVariables,
        variableValues,
        selectedDashboardId: selectedDashboard?.id
      };
      localStorage.setItem('monitoring-panel-data', JSON.stringify(data));
    } catch (error) {
      console.error('保存到本地存储失败:', error);
    }
  }, [dashboards, customVariables, variableValues, selectedDashboard]);

  const loadFromLocalStorage = useCallback(() => {
    try {
      const data = localStorage.getItem('monitoring-panel-data');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.dashboards) setDashboards(parsed.dashboards);
        if (parsed.customVariables) {
          setCustomVariables(parsed.customVariables);
          // 如果没有保存的variableValues，从customVariables初始化
          if (!parsed.variableValues) {
            const initialValues: Record<string, string | string[]> = {};
            parsed.customVariables.forEach((variable: any) => {
              if (variable.value) {
                initialValues[variable.name] = variable.value;
              }
            });
            setVariableValues(initialValues);
            console.log('从customVariables初始化变量值:', initialValues);
          }
        }
        if (parsed.variableValues) {
          setVariableValues(parsed.variableValues);
          console.log('加载保存的变量值:', parsed.variableValues);
        }
        if (parsed.selectedDashboardId) {
          const dashboard = parsed.dashboards?.find((d: Dashboard) => d.id === parsed.selectedDashboardId);
          if (dashboard) {
            setSelectedDashboard(dashboard);
            // 确保dashboard.variables的值也同步到variableValues
            if (dashboard.variables && dashboard.variables.length > 0) {
              const dashboardVariableValues: Record<string, string | string[]> = {};
              dashboard.variables.forEach((variable: any) => {
                if (variable.value) {
                  dashboardVariableValues[variable.name] = variable.value;
                }
              });
              setVariableValues(prev => ({ ...prev, ...dashboardVariableValues }));
              console.log('同步仪表板变量值:', dashboardVariableValues);
            }
          }
        }
        
        // 如果主数据中没有仪表板，尝试加载保存的仪表板数据
        if (!parsed.dashboards || parsed.dashboards.length === 0) {
          const savedDashboards = localStorage.getItem('monitoring_dashboards');
          if (savedDashboards) {
            const dashboardsData = JSON.parse(savedDashboards);
            if (dashboardsData.length > 0) {
              setDashboards(dashboardsData);
              // 如果当前选中的仪表板在保存的数据中，更新它
              const currentDashboard = dashboardsData.find((d: Dashboard) => d.id === selectedDashboard?.id);
              if (currentDashboard) {
                setSelectedDashboard(currentDashboard);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('从本地存储加载失败:', error);
    }
  }, [selectedDashboard?.id]);

  // 初始化
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      let hasDataFromDatabase = false;
      
      try {
        // 首先加载配置管理器的配置
        await configManager.loadConfig();
        
        // 然后加载应用配置
        await loadConfig();
        
        // 优先从数据库加载数据
        try {
          const dbDashboardResult = await loadDashboardsFromDatabase();
          const dbVariableResult = await loadVariablesFromDatabase();
          
          // 检查是否成功从数据库加载了数据
          hasDataFromDatabase = (dbDashboardResult && dbDashboardResult.length > 0) ||
                               (dbVariableResult && dbVariableResult.length > 0);
          
          console.log('数据库数据加载完成，hasDataFromDatabase:', hasDataFromDatabase);
          
          // 数据库加载完成后，确保首页仪表板正确设置
          if (hasDataFromDatabase && dbDashboardResult && dbDashboardResult.length > 0) {
            const savedHomeDashboardId = localStorage.getItem('monitoring_home_dashboard');
            if (savedHomeDashboardId) {
              // 延迟设置首页仪表板，确保状态已更新
              setTimeout(() => {
                const currentDashboards = dashboards.length > 0 ? dashboards : PRESET_DASHBOARDS;
                const homeDashboard = currentDashboards.find(d => d.id === savedHomeDashboardId);
                if (homeDashboard) {
                  const resetDashboard = {
                    ...homeDashboard,
                    panels: homeDashboard.panels.map(panel => ({
                      ...panel,
                      isEditing: false
                    }))
                  };
                  setSelectedDashboard(resetDashboard);
                  console.log('初始化时设置首页仪表板:', homeDashboard.title);
                }
              }, 200);
            }
          }
        } catch (dbError) {
          console.warn('数据库加载失败，回退到本地存储:', dbError);
          hasDataFromDatabase = false;
        }
        
        // 只有在数据库没有数据时才从本地存储加载
        if (!hasDataFromDatabase) {
          console.log('从本地存储加载数据');
          loadFromLocalStorage();
        }
        

        
        // 从数据库加载模板
        const templates = await loadTemplatesFromDatabase();
        
        // 检查Prometheus连接
        await checkPrometheusConnection();
        
        // 延迟检查是否需要创建默认仪表盘（等待状态更新）
        setTimeout(() => {
          if (dashboards.length === 0 && templates.length > 0) {
            console.log('没有仪表盘，创建默认仪表盘');
            createDashboardFromTemplate(templates[0].id);
          }
        }, 100);
        
      } catch (error) {
        setError('初始化失败: ' + (error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    
    initialize();
  }, []);

  // 自动保存 - 禁用以防止覆盖数据库数据
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     saveToLocalStorage();
  //   }, 1000);
  //   return () => clearTimeout(timer);
  // }, [saveToLocalStorage]);

  // 执行单个面板查询
  const executeQuery = useCallback(async (panel: Panel, timeRange: string, variables: Variable[]) => {
    setIsLoading(prev => ({ ...prev, [panel.id]: true }));
    
    try {
      // 使用replaceVariables函数进行变量替换
      const interpolatedQuery = replaceVariables(panel.query);
      
      console.log('原始查询:', panel.query);
      console.log('替换后查询:', interpolatedQuery);
      console.log('当前变量值:', variableValues);

      let data = [];
      if (panel.type === 'stat' || panel.type === 'gauge') {
        const response = await queryPrometheusInstant(interpolatedQuery);
        data = transformPrometheusData(response, 'instant');
        if (data.length > 0) {
          data = [{ value: data[0].value }];
        }
      } else if (panel.type === 'bar') {
        const response = await queryPrometheusInstant(interpolatedQuery);
        data = transformPrometheusData(response, 'instant');
      } else {
        const response = await queryPrometheus(interpolatedQuery, timeRange);
        data = transformPrometheusData(response, 'timeseries');
      }

      return { ...panel, data };
    } catch (error) {
      console.error(`Query error for panel ${panel.id}:`, error);
      return { ...panel, data: [] };
    } finally {
      setIsLoading(prev => ({ ...prev, [panel.id]: false }));
    }
  }, [replaceVariables, variableValues]);

  // 刷新所有面板数据
  const refreshAllPanels = useCallback(async () => {
    if (!prometheusConnected) {
      console.warn('Prometheus not connected, skipping refresh');
      return;
    }

    const updatedPanels = await Promise.all(
      selectedDashboard.panels.map(panel => 
        executeQuery(panel, selectedDashboard.timeRange, selectedDashboard.variables)
      )
    );

    setSelectedDashboard(prev => ({
      ...prev,
      panels: updatedPanels
    }));
    setLastUpdate(new Date());
  }, [selectedDashboard, prometheusConnected, executeQuery]);

  // 刷新单个面板
  const refreshPanel = useCallback(async (panelId: string) => {
    const panel = selectedDashboard.panels.find(p => p.id === panelId);
    if (!panel || !prometheusConnected) return;

    const updatedPanel = await executeQuery(panel, selectedDashboard.timeRange, selectedDashboard.variables);
    
    setSelectedDashboard(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === panelId ? updatedPanel : p)
    }));
  }, [selectedDashboard, prometheusConnected, executeQuery]);

  // 获取可用标签和指标
  const loadPrometheusMetadata = useCallback(async () => {
    try {
      const [labelsResult, metricsResult] = await Promise.all([
        prometheusAPI.getLabelNames(),
        prometheusAPI.getMetrics()
      ]);
      
      if (labelsResult.status === 'success') {
        setAvailableLabels(labelsResult.data);
      }
      
      if (metricsResult.status === 'success') {
        setAvailableMetrics(metricsResult.data);
      }
    } catch (error) {
      // Prometheus服务未运行时的静默处理，这是正常情况
      console.log('Prometheus服务未连接，使用模拟数据模式');
    }
  }, []);

  // 自动刷新
  useEffect(() => {
    if (!isAutoRefresh || !prometheusConnected) return;

    const interval = setInterval(refreshAllPanels, selectedDashboard.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, prometheusConnected, refreshAllPanels, selectedDashboard.refreshInterval]);

  // 初始化
  useEffect(() => {
    const initialize = async () => {
      // 首先加载配置管理器设置
      await configManager.loadConfig();
      
      // 加载基础配置和连接检查
      loadConfig();
      checkPrometheusConnection();
      loadPrometheusMetadata();
      
      // 加载模板数据
      await loadTemplates();
      
      // 加载其他数据
      loadDashboardsFromDatabase();
      loadVariablesFromDatabase();
    };
    
    initialize();
    
    const interval = setInterval(checkPrometheusConnection, 10000); // 每10秒检查一次连接
    return () => clearInterval(interval);
  }, [checkPrometheusConnection, loadPrometheusMetadata, loadTemplates, loadDashboardsFromDatabase, loadVariablesFromDatabase]);

  // 当Prometheus连接状态改变时，重新加载元数据
  useEffect(() => {
    if (prometheusConnected) {
      loadPrometheusMetadata();
    }
  }, [prometheusConnected, loadPrometheusMetadata]);

  // 自动刷新查询类型变量的选项
  useEffect(() => {
    const refreshQueryVariables = async () => {
      if (!prometheusConnected) return;
      
      for (const variable of customVariables) {
        if (variable.type === 'query' && variable.query) {
          try {
            const options = await getVariableOptions(variable);
            if (JSON.stringify(options) !== JSON.stringify(variable.options)) {
              updateVariable(variable.id, { ...variable, options });
            }
          } catch (error) {
            console.error(`刷新变量${variable.name}选项失败:`, error);
          }
        }
      }
    };

    // 立即执行一次
    refreshQueryVariables();
    
    // 每5分钟自动刷新一次
    const interval = setInterval(refreshQueryVariables, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [customVariables, prometheusConnected, getVariableOptions, updateVariable]);

  // 当选择新仪表板时刷新数据
  useEffect(() => {
    if (prometheusConnected) {
      refreshAllPanels();
    }
    // 确保切换仪表板时重置所有面板的编辑状态
    setSelectedDashboard(prev => ({
      ...prev,
      panels: prev.panels.map(panel => ({
        ...panel,
        isEditing: false
      }))
    }));
  }, [selectedDashboard.id, prometheusConnected]);
  
  // 自动选择首页仪表板
  useEffect(() => {
    if (dashboards.length > 0 && homeDashboardId) {
      const homeDashboard = dashboards.find(d => d.id === homeDashboardId);
      if (homeDashboard && selectedDashboard.id !== homeDashboardId) {
        // 确保面板编辑状态重置
        const resetDashboard = {
          ...homeDashboard,
          panels: homeDashboard.panels.map(panel => ({
            ...panel,
            isEditing: false // 确保所有面板都不在编辑状态
          }))
        };
        setSelectedDashboard(resetDashboard);
        console.log('自动选择首页仪表板:', homeDashboard.title);
      }
    }
  }, [dashboards, homeDashboardId, selectedDashboard.id]);

  // 变量值变化时刷新面板数据
  const variableValuesRef = useRef(variableValues);
  const lastRefreshRef = useRef<string>('');
  
  useEffect(() => {
    variableValuesRef.current = variableValues;
  }, [variableValues]);
  
  useEffect(() => {
    const currentValuesKey = JSON.stringify(variableValues);
    if (selectedDashboard.panels.length > 0 && 
        Object.keys(variableValues).length > 0 && 
        prometheusConnected && 
        lastRefreshRef.current !== currentValuesKey) {
      console.log('变量值变化，刷新面板数据:', variableValues);
      lastRefreshRef.current = currentValuesKey;
      refreshAllPanels();
    }
  }, [variableValues, prometheusConnected, selectedDashboard.panels.length]);

  // 确保变量值同步 - 只在初始化时执行
  const syncInitialized = useRef(false);
  useEffect(() => {
    if (!syncInitialized.current && (customVariables.length > 0 || selectedDashboard.variables.length > 0)) {
      const allVariables = [...customVariables, ...selectedDashboard.variables];
      const currentValues = { ...variableValues };
      let hasChanges = false;
      
      allVariables.forEach(variable => {
        if (variable.name && variable.value && !currentValues[variable.name]) {
          currentValues[variable.name] = variable.value;
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        console.log('初始化同步变量值到variableValues:', currentValues);
        setVariableValues(currentValues);
      }
      syncInitialized.current = true;
    }
  }, [customVariables.length, selectedDashboard.variables.length]);

  // 处理变量变化
  const handleVariableChange = useCallback(async (name: string, value: string | string[]) => {
    // 更新变量值状态
    setVariableValues(prev => {
      const newValues = { ...prev, [name]: value };
      
      // 立即保存到localStorage作为备份
      try {
        localStorage.setItem('monitoring_variable_values', JSON.stringify(newValues));
        console.log('变量值已保存到localStorage:', { name, value });
      } catch (error) {
        console.error('保存变量值到localStorage失败:', error);
      }
      
      return newValues;
    });
    
    // 同时更新customVariables中的值
    setCustomVariables(prev => prev.map(v => 
      v.name === name ? { ...v, value } : v
    ));
    
    // 更新selectedDashboard中的变量（如果存在）
    setSelectedDashboard(prev => ({
      ...prev,
      variables: prev.variables.map(v => 
        v.name === name ? { ...v, value: Array.isArray(value) ? value[0] : value } : v
      )
    }));
    
    // 异步保存变量值到数据库
    try {
      await saveVariableValueToDatabase(name, value);
      console.log('变量值已保存到数据库:', { name, value });
    } catch (error) {
      console.warn('保存变量值到数据库失败，已保存到localStorage:', error);
    }
  }, [saveVariableValueToDatabase]);

  // 处理面板编辑
  const handlePanelEdit = useCallback((panelId: string) => {
    setSelectedDashboard(prev => {
      const targetPanel = prev.panels.find(p => p.id === panelId);
      const isCurrentlyEditing = targetPanel?.isEditing || false;
      
      return {
        ...prev,
        panels: prev.panels.map(p => {
          if (p.id === panelId) {
            // 切换当前面板的编辑状态
            return { ...p, isEditing: !isCurrentlyEditing };
          } else {
            // 确保其他面板都不在编辑状态
            return { ...p, isEditing: false };
          }
        })
      };
    });
  }, []);
  
  // 关闭面板编辑模式
  const closePanelEdit = useCallback((panelId: string) => {
    setSelectedDashboard(prev => ({
      ...prev,
      panels: prev.panels.map(p => 
        p.id === panelId ? { ...p, isEditing: false } : p
      )
    }));
  }, []);

  // 处理面板删除
  const handlePanelDelete = useCallback(async (panelId: string) => {
    try {
      // 找到要删除的面板
      const targetPanel = selectedDashboard.panels.find(p => p.id === panelId);
      if (!targetPanel) {
        toast.error('未找到指定面板');
        return;
      }

      // 使用确认对话框
      const confirmed = await showPrompt({ 
        message: `确定删除面板 "${targetPanel.title}" 吗？\n\n此操作不可撤销！`,
        defaultValue: '',
        placeholder: '输入 "确认" 来删除'
      });
      
      if (confirmed !== '确认') {
        toast.info('删除操作已取消');
        return;
      }

      // 更新仪表板，移除指定面板
      const updatedDashboard = {
        ...selectedDashboard,
        panels: selectedDashboard.panels.filter(p => p.id !== panelId),
        updatedAt: new Date().toISOString()
      };
      
      // 先更新本地状态
      setSelectedDashboard(updatedDashboard);
      setDashboards(prev => prev.map(d => 
        d.id === updatedDashboard.id ? updatedDashboard : d
      ));
      
      // 保存到数据库
      await saveDashboardToDatabase(updatedDashboard);
      
      // 同时保存到localStorage作为备份
      try {
        const savedDashboards = JSON.parse(localStorage.getItem('monitoring_dashboards') || '[]');
        const dashboardIndex = savedDashboards.findIndex((d: any) => d.id === updatedDashboard.id);
        
        if (dashboardIndex >= 0) {
          savedDashboards[dashboardIndex] = updatedDashboard;
        }
        
        localStorage.setItem('monitoring_dashboards', JSON.stringify(savedDashboards));
      } catch (localError) {
        console.warn('保存到localStorage失败:', localError);
      }
      
      toast.success(`面板 "${targetPanel.title}" 已删除`);
    } catch (error) {
      console.error('删除面板失败:', error);
      toast.error(`删除面板失败: ${(error as Error).message}`);
    }
  }, [selectedDashboard, saveDashboardToDatabase, showPrompt]);

  // 处理查询变化
  const handleQueryChange = useCallback(async (panelId: string, query: string) => {
    setSelectedDashboard(prev => {
      const updatedDashboard = {
        ...prev,
        panels: prev.panels.map(p => 
          p.id === panelId ? { ...p, query, customQuery: query, isCustomQuery: true } : p
        )
      };
      
      // 自动保存到数据库
      saveDashboardToDatabase(updatedDashboard).catch(error => {
        console.error('保存面板查询到数据库失败:', error);
      });
      
      return updatedDashboard;
    });
  }, [saveDashboardToDatabase]);

  // 保存面板查询为默认查询 - 在原有值基础上更改
  const handleSavePanelQuery = useCallback(async (panelId: string, query: string) => {
    if (!query.trim()) {
      toast.error('查询语句不能为空');
      return;
    }

    try {
      // 找到要更新的面板
      const targetPanel = selectedDashboard.panels.find(p => p.id === panelId);
      if (!targetPanel) {
        toast.error('未找到指定面板');
        return;
      }

      // 更新面板的默认查询，保持其他属性不变，并立即退出编辑模式
      const updatedDashboard = {
        ...selectedDashboard,
        panels: selectedDashboard.panels.map(p => 
          p.id === panelId ? { 
            ...p, 
            defaultQuery: query, 
            query: query, // 同时更新当前查询
            isCustomQuery: false,
            isEditing: false // 立即退出编辑模式
          } : p
        ),
        updatedAt: new Date().toISOString()
      };
      
      // 先更新本地状态
      setSelectedDashboard(updatedDashboard);
      setDashboards(prev => prev.map(d => 
        d.id === updatedDashboard.id ? updatedDashboard : d
      ));
      
      // 保存到数据库
      await saveDashboardToDatabase(updatedDashboard);
      
      // 同时保存到localStorage作为备份
      try {
        const savedDashboards = JSON.parse(localStorage.getItem('monitoring_dashboards') || '[]');
        const dashboardIndex = savedDashboards.findIndex((d: any) => d.id === updatedDashboard.id);
        
        if (dashboardIndex >= 0) {
          // 更新现有仪表板
          savedDashboards[dashboardIndex] = updatedDashboard;
        } else {
          // 如果不存在则添加（这种情况应该很少见）
          savedDashboards.push(updatedDashboard);
        }
        
        localStorage.setItem('monitoring_dashboards', JSON.stringify(savedDashboards));
      } catch (localError) {
        console.warn('保存到localStorage失败:', localError);
      }
      
      toast.success(`面板 "${targetPanel.title}" 的默认查询已更新并已保存`);
      
      // 注意：编辑模式已在状态更新中关闭，无需额外调用closePanelEdit
    } catch (error) {
      console.error('保存默认查询失败:', error);
      toast.error(`保存默认查询失败: ${(error as Error).message}`);
    }
  }, [selectedDashboard, saveDashboardToDatabase, closePanelEdit]);

  // 恢复默认查询
  const handleRestoreDefaultQuery = useCallback((panelId: string) => {
    setSelectedDashboard(prev => ({
      ...prev,
      panels: prev.panels.map(p => {
        if (p.id === panelId && p.defaultQuery) {
          return { ...p, query: p.defaultQuery, isCustomQuery: false };
        }
        return p;
      })
    }));
  }, []);

  // 处理时间范围变化
  const handleTimeRangeChange = useCallback((timeRange: string) => {
    setSelectedDashboard(prev => ({ ...prev, timeRange }));
  }, []);

  // 处理刷新间隔变化
  const handleRefreshIntervalChange = useCallback((interval: number) => {
    setSelectedDashboard(prev => ({ ...prev, refreshInterval: interval }));
  }, []);
  
  // 设置首页仪表板
  const setHomeDashboard = useCallback((dashboardId: string) => {
    setHomeDashboardId(dashboardId);
    localStorage.setItem('monitoring_home_dashboard', dashboardId);
    toast.success('首页仪表板设置已保存');
  }, []);
  
  // 获取首页仪表板
  const getHomeDashboard = useCallback(() => {
    return dashboards.find(d => d.id === homeDashboardId) || dashboards[0];
  }, [dashboards, homeDashboardId]);

  // 变量编辑状态
  const [editingVariable, setEditingVariable] = useState<CustomVariable | null>(null);
  const [variablePreview, setVariablePreview] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([]);

  // 预览变量值
  const previewVariableValues = useCallback(async (variable: CustomVariable) => {
    if (!variable.query || variable.type !== 'query') return;
    
    setPreviewLoading(true);
    try {
      const options = await getVariableOptions(variable);
      setVariablePreview(options.slice(0, 10)); // 只显示前10个
    } catch (error) {
      console.error('预览变量值失败:', error);
      setVariablePreview([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [getVariableOptions]);

  // 渲染变量编辑器
  const renderVariableEditor = () => {
    if (!editingVariable) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">
              {editingVariable.id ? '编辑变量' : '新建变量'}
            </h3>
            <button
              onClick={async () => {
                setEditingVariable(null);
                setVariablePreview([]);
              }}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">变量名称</label>
                <input
                  type="text"
                  value={editingVariable.name}
                  onChange={(e) => setEditingVariable(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="例如: instance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">显示标签</label>
                <input
                  type="text"
                  value={editingVariable.label}
                  onChange={(e) => setEditingVariable(prev => prev ? { ...prev, label: e.target.value } : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="例如: 实例"
                />
              </div>
            </div>
            
            {/* 变量类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">变量类型</label>
              <select
                value={editingVariable.type}
                onChange={(e) => setEditingVariable(prev => prev ? { 
                  ...prev, 
                  type: e.target.value as CustomVariable['type'],
                  query: e.target.value === 'query' ? 'label_values(up, job)' : undefined
                } : null)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="query">查询</option>
                <option value="custom">自定义</option>
                <option value="constant">常量</option>
                <option value="interval">时间间隔</option>
              </select>
            </div>
            
            {/* 查询配置 */}
            {editingVariable.type === 'query' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">查询语句</label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => previewVariableValues(editingVariable)}
                      disabled={!editingVariable.query || previewLoading}
                      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-2 py-1 rounded"
                    >
                      {previewLoading ? '预览中...' : '预览结果'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={editingVariable.query || ''}
                  onChange={(e) => setEditingVariable(prev => prev ? { ...prev, query: e.target.value } : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none h-20 font-mono text-sm"
                  placeholder="例如: label_values(up, job) 或 label_values(node_cpu_seconds_total, instance)"
                />
                
                {/* 快速查询模板 */}
                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-2">快速模板:</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditingVariable(prev => prev ? { ...prev, query: 'label_values(up, job)' } : null)}
                      className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
                    >
                      获取所有Job
                    </button>
                    <button
                      onClick={() => setEditingVariable(prev => prev ? { ...prev, query: 'label_values(up, instance)' } : null)}
                      className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
                    >
                      获取所有实例
                    </button>
                    <button
                      onClick={() => setEditingVariable(prev => prev ? { ...prev, query: 'label_values(node_filesystem_size_bytes, device)' } : null)}
                      className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
                    >
                      获取磁盘设备
                    </button>
                  </div>
                </div>
                
                {/* 预览结果 */}
                {variablePreview.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-600">
                    <div className="text-xs text-gray-400 mb-2">预览结果 (前10项):</div>
                    <div className="flex flex-wrap gap-1">
                      {variablePreview.map((value, index) => (
                        <span key={index} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 自定义选项 */}
            {editingVariable.type === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">选项值 (每行一个)</label>
                <textarea
                  value={editingVariable.options?.join('\n') || ''}
                  onChange={(e) => setEditingVariable(prev => prev ? { 
                    ...prev, 
                    options: e.target.value.split('\n').filter(v => v.trim())
                  } : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none h-20"
                  placeholder="选项1\n选项2\n选项3"
                />
              </div>
            )}
            
            {/* 常量值 */}
            {editingVariable.type === 'constant' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">常量值</label>
                <input
                  type="text"
                  value={editingVariable.value as string || ''}
                  onChange={(e) => setEditingVariable(prev => prev ? { ...prev, value: e.target.value } : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="输入常量值"
                />
              </div>
            )}
            
            {/* 高级选项 */}
            <div className="border-t border-gray-600 pt-4">
              <div className="text-sm font-medium text-gray-300 mb-3">高级选项</div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editingVariable.includeAll || false}
                      onChange={(e) => setEditingVariable(prev => prev ? { ...prev, includeAll: e.target.checked } : null)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-300">包含"全部"选项</span>
                  </label>
                </div>
              </div>
              {/* 注释：已移除多选选项，所有变量强制为单选模式 */}
              
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-300 mb-1">描述 (可选)</label>
                <input
                  type="text"
                  value={editingVariable.description || ''}
                  onChange={(e) => setEditingVariable(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="变量描述"
                />
              </div>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-600">
            <button
              onClick={() => {
                setEditingVariable(null);
                setVariablePreview([]);
              }}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={async () => {
                if (!editingVariable) return;
                
                try {
                  if (editingVariable.id) {
                    // 更新变量 - 先获取选项，然后一次性更新
                    let finalVariable = { ...editingVariable };
                    
                    if (editingVariable.type === 'query' && editingVariable.query) {
                      try {
                        const options = await getVariableOptions(editingVariable);
                        finalVariable = { ...finalVariable, options };
                      } catch (error) {
                        console.error('获取变量选项失败:', error);
                        // 即使获取选项失败，也继续保存变量
                      }
                    }
                    
                    await updateVariable(editingVariable.id, finalVariable);
                  } else {
                    // 创建新变量
                    const newVar = await createVariable(editingVariable);
                    
                    // 如果是查询类型，获取选项并更新
                    if (newVar && newVar.type === 'query' && newVar.query) {
                      try {
                        const options = await getVariableOptions(newVar);
                        await updateVariable(newVar.id, { ...newVar, options });
                      } catch (error) {
                        console.error('获取新变量选项失败:', error);
                      }
                    }
                  }
                  
                  setEditingVariable(null);
                  setVariablePreview([]);
                } catch (error) {
                  console.error('保存变量失败:', error);
                  toast.error('保存变量失败');
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              {editingVariable.id ? '更新' : '创建'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染变量选择器
  const renderVariableSelector = () => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">变量管理</h3>
        <button
          onClick={() => {
            const newVar: CustomVariable = {
              id: '',
              name: 'new_variable',
              label: '新变量',
              type: 'query',
              query: 'label_values(up, job)',
              value: '',
              options: []
            };
            setEditingVariable(newVar);
          }}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>添加变量</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customVariables.map((variable) => (
          <div key={variable.id} className="bg-gray-700 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-300">{variable.label}</label>
                {variable.type === 'query' && (
                  <span className="text-xs bg-blue-600 text-white px-1 rounded">API</span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={async () => {
                    // 刷新变量选项
                    if (variable.type === 'query') {
                      const options = await getVariableOptions(variable);
                      updateVariable(variable.id, { ...variable, options });
                    }
                  }}
                  className="text-gray-400 hover:text-green-400"
                  title="刷新选项"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setEditingVariable(variable)}
                  className="text-gray-400 hover:text-blue-400"
                  title="编辑变量"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteVariable(variable.id)}
                  className="text-gray-400 hover:text-red-400"
                  title="删除变量"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            
            <div className="mb-2">
              <select
                value={variableValues[variable.id] || variableValues[variable.name] || variable.value || ''}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setVariableValues(prev => ({
                    ...prev,
                    [variable.id]: newValue,
                    [variable.name]: newValue
                  }));
                  // 更新变量本身的值
                  updateVariable(variable.id, { ...variable, value: newValue });
                }}
                className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-500 focus:border-blue-500 focus:outline-none"
              >
                <option value="">选择{variable.label}</option>
                {variable.includeAll && (
                  <option value={variable.allValue || '*'}>全部</option>
                )}
                {variable.options?.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            
            {/* 变量信息 */}
            <div className="text-xs text-gray-400">
              <div>类型: {variable.type}</div>
              {variable.query && (
                <div className="truncate" title={variable.query}>查询: {variable.query}</div>
              )}
              <div>选项数: {variable.options?.length || 0}</div>
            </div>
          </div>
        ))}
      </div>
      
      {/* 变量编辑器 */}
      {renderVariableEditor()}
    </div>
  );

  // 渲染仪表板管理
  const renderDashboardManager = () => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white">仪表板管理</h3>
          <button
            onClick={() => setShowHomeDashboardSelector(!showHomeDashboardSelector)}
            className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm"
          >
            <Settings className="w-4 h-4" />
            <span>首页设置</span>
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowTemplateSelector(true)}
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
          >
            <FileText className="w-4 h-4" />
            <span>从模板创建</span>
          </button>
          <button
            onClick={async () => {
              const name = await showPrompt({ message: '仪表板名称:' });
              if (name) {
                const newDashboard: Dashboard = {
                  id: Date.now().toString(),
                  title: name,
                  description: '自定义仪表板',
                  category: '自定义',
                  panels: [],
                  variables: [],
                  timeRange: '1h',
                  refreshInterval: 30
                };
                createDashboard(newDashboard);
              }
            }}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>新建仪表板</span>
          </button>
        </div>
      </div>
      
      {/* 首页仪表板选择器 */}
      {showHomeDashboardSelector && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4 border border-orange-500">
          <h4 className="text-white font-medium mb-3">选择首页默认仪表板</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className={`bg-gray-600 rounded-lg p-3 cursor-pointer transition-all hover:bg-gray-500 border-2 ${
                  homeDashboardId === dashboard.id ? 'border-orange-500 bg-orange-900/30' : 'border-transparent'
                }`}
                onClick={() => setHomeDashboard(dashboard.id)}
              >
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-white text-sm">{dashboard.title}</h5>
                  {homeDashboardId === dashboard.id && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-1">{dashboard.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>{dashboard.panels.length} 面板</span>
                  <span>{dashboard.variables.length} 变量</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-400">
            💡 选择的仪表板将在页面刷新时自动加载
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards.map((dashboard) => (
          <div
            key={dashboard.id}
            className={`bg-gray-700 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-600 border-2 ${
              selectedDashboard.id === dashboard.id ? 'border-blue-500' : 'border-transparent'
            }`}
            onClick={() => setSelectedDashboard(dashboard)}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-white">{dashboard.title}</h4>
              <div className="flex items-center space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateDashboard(dashboard);
                  }}
                  className="text-gray-400 hover:text-blue-400"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newTitle = await showPrompt({ 
                      message: '仪表板名称:', 
                      defaultValue: dashboard.title 
                    });
                     if (newTitle) {
                       updateDashboard(dashboard.id, { title: newTitle });
                     }
                  }}
                  className="text-gray-400 hover:text-yellow-400"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    
                    // 检查是否是预设仪表板
                    const isPresetDashboard = PRESET_DASHBOARDS.some(preset => preset.id === dashboard.id);
                    if (isPresetDashboard) {
                      toast.error('无法删除内置仪表板');
                      return;
                    }
                    
                    // 使用更现代的确认方式
                    try {
                      const confirmed = await showPrompt({ 
                        message: `确定删除仪表板 "${dashboard.title}" 吗？\n\n此操作不可撤销！`,
                        defaultValue: '',
                        placeholder: '输入 "确认" 来删除'
                      });
                      
                      if (confirmed === '确认') {
                        console.log('开始删除仪表板:', dashboard.id);
                        await deleteDashboard(dashboard.id);
                        console.log('仪表板删除完成:', dashboard.id);
                      } else {
                        toast.info('删除操作已取消');
                      }
                    } catch (error) {
                      console.error('删除确认过程出错:', error);
                      toast.error('删除操作失败');
                    }
                  }}
                  className="text-gray-400 hover:text-red-400"
                  title="删除仪表板"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-3">{dashboard.description}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{dashboard.panels.length} 个面板</span>
              <span>{dashboard.variables.length} 个变量</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 渲染模板选择器
  const renderTemplateSelector = () => {
    if (!showTemplateSelector) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">选择仪表板模板</h3>
            <button
              onClick={() => setShowTemplateSelector(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-400">加载模板中...</span>
            </div>
          ) : templatesError ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{templatesError}</p>
              <button
                onClick={loadTemplates}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboardTemplates.map((template) => {
                const existingDashboard = dashboards.find(d => d.title === template.name);
                return (
                  <div
                    key={template.id}
                    className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                  >
                    <h4 className="font-semibold text-white mb-2">{template.name}</h4>
                    <p className="text-gray-400 text-sm mb-3">{template.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span>{template.panels?.length || 0} 个面板</span>
                      <span>{template.variables?.length || 0} 个变量</span>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={async () => {
                          await createDashboardFromTemplate(template.id, false);
                          setShowTemplateSelector(false);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
                      >
                        创建新仪表板
                      </button>
                      {existingDashboard && (
                        <button
                          onClick={async () => {
                            await createDashboardFromTemplate(template.id, true);
                            setShowTemplateSelector(false);
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors"
                        >
                          更新现有
                        </button>
                      )}
                    </div>
                    
                    {existingDashboard && (
                      <div className="text-xs text-yellow-400 mb-2">
                        ⚠️ 已存在同名仪表板
                      </div>
                    )}
                    
                    {template.tags && template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* 头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">监控面板</h1>
            <p className="text-gray-400">基于Prometheus的实时监控系统</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Prometheus连接状态 */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                prometheusConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-400">
                Prometheus: {prometheusConnected ? '已连接' : '未连接'}
              </span>
            </div>
            
            {/* 时间范围选择 */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-400">时间范围:</label>
              <select
                value={selectedDashboard.timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value)}
                className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="5m">5分钟</option>
                <option value="15m">15分钟</option>
                <option value="30m">30分钟</option>
                <option value="1h">1小时</option>
                <option value="3h">3小时</option>
                <option value="6h">6小时</option>
                <option value="12h">12小时</option>
                <option value="24h">24小时</option>
              </select>
            </div>
            
            {/* 自动刷新控制 */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-400">自动刷新:</label>
              <button
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  isAutoRefresh 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {isAutoRefresh ? '开启' : '关闭'}
              </button>
            </div>
            
            {/* 刷新间隔 */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-400">间隔:</label>
              <select
                value={selectedDashboard.refreshInterval}
                onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value={10}>10秒</option>
                <option value={30}>30秒</option>
                <option value={60}>1分钟</option>
                <option value={300}>5分钟</option>
              </select>
            </div>
            
            {/* 手动刷新 */}
            <button
              onClick={refreshAllPanels}
              disabled={!prometheusConnected}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>刷新</span>
            </button>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            仪表板
          </button>
          <button
            onClick={() => setActiveTab('variables')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'variables'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            变量管理
          </button>
        </div>

        {/* 根据标签页显示内容 */}
        {activeTab === 'dashboard' && renderDashboardManager()}
        {activeTab === 'variables' && renderVariableSelector()}

        {/* 状态栏 */}
        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                prometheusConnected && isAutoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
              }`}></div>
              <span className="text-sm text-gray-300">
                {prometheusConnected ? (isAutoRefresh ? '实时监控中' : '监控已暂停') : '连接断开'}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}
            </div>
            {!prometheusConnected && (
              <div className="text-sm text-yellow-400">
                ⚠️ 请确保Prometheus运行在 {getApiBaseUrl()}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              当前仪表板: <span className="text-white font-medium">{selectedDashboard.title}</span>
            </div>
            <div className="text-sm text-gray-400">
              面板数量: <span className="text-white font-medium">{selectedDashboard.panels.length}</span>
            </div>
            <div className="text-sm text-gray-400">
              时间范围: <span className="text-white font-medium">{selectedDashboard.timeRange}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 变量选择器 - 在仪表板视图中显示 */}
      {activeTab === 'dashboard' && customVariables.length > 0 && (
        <VariableSelector
          variables={customVariables}
          variableValues={variableValues}
          onVariableChange={handleVariableChange}
        />
      )}

      {/* 面板网格 */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedDashboard.panels.map((panel) => (
            <PanelComponent 
              key={panel.id} 
              panel={panel}
              onEdit={() => handlePanelEdit(panel.id)}
              onQueryChange={(query) => handleQueryChange(panel.id, query)}
              onExecuteQuery={() => refreshPanel(panel.id)}
              onDelete={() => handlePanelDelete(panel.id)}
              isLoading={isLoading[panel.id]}
              variables={selectedDashboard.variables}
              customVariables={customVariables}
              onSavePanelQuery={(panelId, query) => handleSavePanelQuery(panelId, query)}
              onRestoreDefaultQuery={(panelId) => handleRestoreDefaultQuery(panelId)}
            />
          ))}
          
          {/* 添加面板按钮 */}
          <div className="bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 p-8 flex items-center justify-center hover:border-gray-500 transition-colors">
            <button
              onClick={async () => {
                const title = await showPrompt({ message: '面板标题:' });
                if (!title) return;
                const query = await showPrompt({ message: 'PromQL查询:' });
                if (title && query) {
                  const newPanel: Panel = {
                     id: Date.now().toString(),
                     title,
                     query,
                     defaultQuery: query,
                     type: 'line',
                     data: [],
                     isEditing: false,
                     color: '#3b82f6',
                     isCustomQuery: false
                   };
                  setSelectedDashboard(prev => ({
                    ...prev,
                    panels: [...prev.panels, newPanel]
                  }));
                }
              }}
              className="flex flex-col items-center space-y-2 text-gray-400 hover:text-white transition-colors"
            >
              <Plus className="w-8 h-8" />
              <span className="text-sm font-medium">添加面板</span>
            </button>
          </div>
        </div>
      )}
      
      {/* 模板选择器 */}
      {renderTemplateSelector()}
      
      {/* Prompt Dialog */}
      <PromptComponent />
    </div>
  );
};

export default MonitoringPanel;