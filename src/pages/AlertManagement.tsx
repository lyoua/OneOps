import React, { useState, useEffect } from 'react';
import { Bell, Plus, Settings, Mail, MessageSquare, Phone, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { configManager, getApiBaseUrl } from '../utils/config';

// 告警管理API
const alertManagementAPI = {
  // 获取配置信息
  getConfig: async () => {
    const response = await fetch(`${getApiBaseUrl()}/config`);
    if (!response.ok) throw new Error('Failed to fetch config');
    return response.json();
  },

  // 获取告警历史
  getAlerts: async (params: { severity?: string; status?: string; limit?: number } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.severity && params.severity !== 'all') queryParams.append('severity', params.severity);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    
    const response = await fetch(`${getApiBaseUrl()}/alerts?${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    return response.json();
  },

  // 获取告警统计
  getAlertStats: async () => {
    const response = await fetch(`${getApiBaseUrl()}/alerts/stats`);
    if (!response.ok) throw new Error('Failed to fetch alert stats');
    return response.json();
  },

  // 获取告警趋势数据
  getAlertTrends: async (hours: number = 24) => {
    const response = await fetch(`${getApiBaseUrl()}/alerts/trends?hours=${hours}`);
    if (!response.ok) throw new Error('Failed to fetch alert trends');
    return response.json();
  },

  // 获取告警规则
  getAlertRules: async () => {
    const response = await fetch(`${getApiBaseUrl()}/alert-rules`);
    if (!response.ok) throw new Error('Failed to fetch alert rules');
    return response.json();
  },

  // 获取通知渠道
  getNotificationChannels: async () => {
    const response = await fetch(`${getApiBaseUrl()}/notification-channels`);
    if (!response.ok) throw new Error('Failed to fetch notification channels');
    return response.json();
  },

  // 确认告警
  acknowledgeAlert: async (alertId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to acknowledge alert');
    return response.json();
  },

  // 解决告警
  resolveAlert: async (alertId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/alerts/${alertId}/resolve`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to resolve alert');
    return response.json();
  },

  // 测试通知渠道
  testNotificationChannel: async (channelId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/notification-channels/${channelId}/test`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to test notification channel');
    return response.json();
  }
};

const AlertManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('alerts');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showRuleModal, setShowRuleModal] = useState(false);

  // 状态管理
  const [config, setConfig] = useState<any>(null);
  const [alertHistory, setAlertHistory] = useState<any[]>([]);
  const [alertStats, setAlertStats] = useState<any>(null);
  const [alertTrendData, setAlertTrendData] = useState<any[]>([]);
  const [alertRules, setAlertRules] = useState<any[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 数据加载函数
  const loadData = async () => {
    try {
      setError(null);
      
      // 获取配置信息
      const configData = await alertManagementAPI.getConfig();
      setConfig(configData);

      // 获取告警统计
      const statsData = await alertManagementAPI.getAlertStats();
      setAlertStats(statsData);

      // 获取告警趋势
      const trendsData = await alertManagementAPI.getAlertTrends(24);
      setAlertTrendData(trendsData);

      // 获取告警历史
      const alertsData = await alertManagementAPI.getAlerts({
        severity: selectedSeverity,
        status: selectedStatus,
        limit: 100
      });
      setAlertHistory(alertsData);

      // 获取告警规则
      const rulesData = await alertManagementAPI.getAlertRules();
      setAlertRules(rulesData);

      // 获取通知渠道
      const channelsData = await alertManagementAPI.getNotificationChannels();
      setNotificationChannels(channelsData);

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load alert management data:', err);
      setError('加载告警管理数据失败，请检查Alertmanager连接配置');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 手动刷新
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // 处理告警操作
  const handleAlertAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    try {
      if (action === 'acknowledge') {
        await alertManagementAPI.acknowledgeAlert(alertId);
      } else {
        await alertManagementAPI.resolveAlert(alertId);
      }
      // 重新加载数据
      await loadData();
    } catch (err) {
      console.error(`Failed to ${action} alert:`, err);
      setError(`${action === 'acknowledge' ? '确认' : '解决'}告警失败`);
    }
  };

  // 测试通知渠道
  const handleTestChannel = async (channelId: string) => {
    try {
      await alertManagementAPI.testNotificationChannel(channelId);
      // 重新加载数据以更新最后测试时间
      await loadData();
    } catch (err) {
      console.error('Failed to test notification channel:', err);
      setError('测试通知渠道失败');
    }
  };

  // 初始化数据加载
  useEffect(() => {
    const initialize = async () => {
      // 首先加载配置管理器设置
      await configManager.loadConfig();
      // 然后加载告警管理数据
      loadData();
    };
    
    initialize();
  }, []);

  // 当过滤条件改变时重新加载告警数据
  useEffect(() => {
    if (!loading) {
      const loadFilteredAlerts = async () => {
        try {
          const alertsData = await alertManagementAPI.getAlerts({
            severity: selectedSeverity,
            status: selectedStatus,
            limit: 100
          });
          setAlertHistory(alertsData);
        } catch (err) {
          console.error('Failed to load filtered alerts:', err);
        }
      };
      loadFilteredAlerts();
    }
  }, [selectedSeverity, selectedStatus, loading]);

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      if (!refreshing) {
        loadData();
      }
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [refreshing]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'low':
        return <AlertTriangle className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'acknowledged':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (severity) {
      case 'critical':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'high':
        return `${baseClasses} bg-orange-100 text-orange-800`;
      case 'medium':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'low':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'active':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'acknowledged':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'resolved':
        return `${baseClasses} bg-green-100 text-green-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-5 h-5 text-blue-500" />;
      case 'sms':
        return <Phone className="w-5 h-5 text-green-500" />;
      case 'webhook':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const filteredAlerts = alertHistory.filter(alert => {
    const matchesSeverity = selectedSeverity === 'all' || alert.severity === selectedSeverity;
    const matchesStatus = selectedStatus === 'all' || alert.status === selectedStatus;
    return matchesSeverity && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">告警管理</h1>
          {lastUpdate && (
            <p className="text-sm text-gray-500 mt-1">
              最后更新: {lastUpdate.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button 
            onClick={() => setShowRuleModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建规则
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">数据加载失败</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <p className="text-sm text-red-600 mt-2">
                请前往 <a href="/config" className="underline">配置管理</a> 页面检查Alertmanager连接设置
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">正在加载告警管理数据...</span>
        </div>
      )}

      {/* 统计概览 */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">活跃告警</p>
                <p className="text-2xl font-bold text-red-600">
                  {alertStats?.active_alerts || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="mt-4 text-sm text-red-600">
              <span>{alertStats?.critical_alerts || 0}个严重告警</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">已确认告警</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {alertStats?.acknowledged_alerts || 0}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="mt-4 text-sm text-yellow-600">
              <span>等待处理</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">今日已解决</p>
                <p className="text-2xl font-bold text-green-600">
                  {alertStats?.resolved_today || 0}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-4 text-sm text-green-600">
              <span>
                平均处理时间: {alertStats?.avg_resolution_time || '0分钟'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">告警规则</p>
                <p className="text-2xl font-bold text-blue-600">
                  {alertRules.length}
                </p>
              </div>
              <Settings className="w-8 h-8 text-blue-600" />
            </div>
            <div className="mt-4 text-sm text-blue-600">
              <span>
                {alertRules.filter(rule => rule.enabled).length}个已启用
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'alerts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            告警历史
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'rules'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            告警规则
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'notifications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            通知配置
          </button>
        </nav>
      </div>

      {/* 告警历史标签页 */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* 告警趋势图 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">告警趋势分析</h3>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">加载中...</span>
              </div>
            ) : alertTrendData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无告警趋势数据</p>
                  <p className="text-sm mt-2">请检查Alertmanager连接配置</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alertTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="critical" fill="#ef4444" name="严重" />
                  <Bar dataKey="high" fill="#f97316" name="高" />
                  <Bar dataKey="medium" fill="#eab308" name="中" />
                  <Bar dataKey="low" fill="#3b82f6" name="低" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 过滤器 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">所有严重级别</option>
                <option value="critical">严重</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">所有状态</option>
                <option value="active">活跃</option>
                <option value="acknowledged">已确认</option>
                <option value="resolved">已解决</option>
              </select>

              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                刷新数据
              </button>
            </div>
          </div>

          {/* 告警列表 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">告警详情</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">加载中...</span>
              </div>
            ) : alertHistory.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无告警数据</p>
                  <p className="text-sm mt-2">
                    请前往 <a href="/config" className="text-blue-600 underline">配置管理</a> 页面检查Alertmanager连接设置
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        告警信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        严重级别
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        服务
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        持续时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        负责人
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {alertHistory.map((alert) => (
                      <tr key={alert.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-start">
                            {getSeverityIcon(alert.severity)}
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{alert.title || alert.alertname}</p>
                              <p className="text-sm text-gray-500">{alert.description || alert.summary}</p>
                              <p className="text-xs text-gray-400">
                                {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 
                                 alert.startsAt ? new Date(alert.startsAt).toLocaleString() : '未知时间'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getSeverityBadge(alert.severity)}>
                            {alert.severity === 'critical' ? '严重' : 
                             alert.severity === 'high' ? '高' :
                             alert.severity === 'medium' ? '中' : '低'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIcon(alert.status)}
                            <span className={`ml-2 ${getStatusBadge(alert.status)}`}>
                              {alert.status === 'active' ? '活跃' :
                               alert.status === 'acknowledged' ? '已确认' : '已解决'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {alert.service || alert.instance || alert.job || '未知服务'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {alert.duration || '未知'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {alert.assignee || '未分配'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {alert.status === 'active' && (
                            <button 
                              onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                              className="text-yellow-600 hover:text-yellow-900 mr-3"
                            >
                              确认
                            </button>
                          )}
                          {alert.status !== 'resolved' && (
                            <button 
                              onClick={() => handleAlertAction(alert.id, 'resolve')}
                              className="text-green-600 hover:text-green-900 mr-3"
                            >
                              解决
                            </button>
                          )}
                          <button className="text-blue-600 hover:text-blue-900">详情</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 告警规则标签页 */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">告警规则配置</h3>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                新建规则
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">加载中...</span>
              </div>
            ) : alertRules.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无告警规则</p>
                  <p className="text-sm mt-2">
                    请前往 <a href="/config" className="text-blue-600 underline">配置管理</a> 页面检查Alertmanager连接设置
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        规则名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        触发条件
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        持续时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        严重级别
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        通知方式
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {alertRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rule.name || rule.alert}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {rule.condition || rule.expr}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {rule.duration || rule.for || '0s'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getSeverityBadge(rule.severity || rule.labels?.severity || 'low')}>
                            {(rule.severity || rule.labels?.severity) === 'critical' ? '严重' : 
                             (rule.severity || rule.labels?.severity) === 'high' ? '高' :
                             (rule.severity || rule.labels?.severity) === 'medium' ? '中' : '低'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {(rule.notifications || ['email']).map((type, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                                {type === 'email' ? '邮件' : type === 'sms' ? '短信' : 'Webhook'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (rule.enabled !== false) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {(rule.enabled !== false) ? '已启用' : '已禁用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">编辑</button>
                          <button className={`mr-3 ${
                            (rule.enabled !== false) ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                          }`}>
                            {(rule.enabled !== false) ? '禁用' : '启用'}
                          </button>
                          <button className="text-gray-600 hover:text-gray-900">删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 通知配置标签页 */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">通知渠道配置</h3>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                添加渠道
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">加载中...</span>
              </div>
            ) : notificationChannels.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无通知渠道</p>
                  <p className="text-sm mt-2">
                    请前往 <a href="/config" className="text-blue-600 underline">配置管理</a> 页面检查Alertmanager连接设置
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {notificationChannels.map((channel) => (
                    <div key={channel.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          {getNotificationIcon(channel.type)}
                          <span className="ml-2 font-medium text-gray-900">
                            {channel.name || channel.receiver || `${channel.type}通知`}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          (channel.status === 'active' || channel.enabled !== false) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(channel.status === 'active' || channel.enabled !== false) ? '活跃' : '未激活'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">配置信息:</p>
                        <p className="text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded break-all">
                          {channel.config || channel.url || channel.webhook_url || channel.email || '未配置'}
                        </p>
                        <p className="text-xs text-gray-500">
                          最后测试: {channel.lastTest ? 
                            (typeof channel.lastTest === 'string' ? channel.lastTest : new Date(channel.lastTest).toLocaleString()) : 
                            '从未测试'}
                        </p>
                      </div>
                      <div className="mt-4 flex space-x-2">
                        <button 
                          onClick={() => handleTestChannel(channel.id)}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                        >
                          测试
                        </button>
                        <button className="flex-1 border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-50">
                          编辑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertManagement;