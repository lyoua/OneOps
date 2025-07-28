from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置文件路径
CONFIG_FILE = 'config.json'

# 默认配置
DEFAULT_CONFIG = {
    "system": {
        "platform_name": "综合运维平台",
        "version": "1.0.0",
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "theme": "dark",
        "auto_refresh": True,
        "refresh_interval": 30
    },
    "monitoring": {
        "prometheus": {
            "enabled": True,
            "url": "http://localhost:9090",
            "timeout": 30
        },
        "elk": {
            "enabled": True,
            "elasticsearch_url": "http://localhost:9200",
            "kibana_url": "http://localhost:5601",
            "logstash_url": "http://localhost:5044"
        },
        "grafana": {
            "enabled": False,
            "url": "http://localhost:3000",
            "api_key": ""
        }
    },
    "alerts": {
        "email": {
            "enabled": True,
            "smtp_server": "smtp.example.com",
            "smtp_port": 587,
            "username": "",
            "password": "",
            "from_email": "alerts@example.com"
        },
        "webhook": {
            "enabled": False,
            "url": "",
            "timeout": 10
        },
        "dingtalk": {
            "enabled": False,
            "webhook_url": "",
            "secret": ""
        }
    },
    "security": {
        "session_timeout": 3600,
        "max_login_attempts": 5,
        "password_policy": {
            "min_length": 8,
            "require_uppercase": True,
            "require_lowercase": True,
            "require_numbers": True,
            "require_special_chars": True
        }
    },
    "database": {
        "type": "sqlite",
        "host": "localhost",
        "port": 5432,
        "name": "ops_platform",
        "username": "",
        "password": ""
    }
}

def load_config():
    """加载配置文件"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载配置文件失败: {e}")
            return DEFAULT_CONFIG.copy()
    else:
        # 如果配置文件不存在，创建默认配置
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()

def save_config(config):
    """保存配置文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存配置文件失败: {e}")
        return False

@app.route('/api/config', methods=['GET'])
def get_config():
    """获取配置"""
    try:
        config = load_config()
        return jsonify({
            "success": True,
            "data": config,
            "message": "配置获取成功"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取配置失败: {str(e)}"
        }), 500

@app.route('/api/config', methods=['PUT'])
def update_config():
    """更新配置"""
    try:
        new_config = request.get_json()
        if not new_config:
            return jsonify({
                "success": False,
                "data": None,
                "message": "请求数据不能为空"
            }), 400
        
        # 验证配置格式
        current_config = load_config()
        
        # 合并配置（保留现有配置结构）
        def merge_config(current, new):
            for key, value in new.items():
                if key in current:
                    if isinstance(current[key], dict) and isinstance(value, dict):
                        merge_config(current[key], value)
                    else:
                        current[key] = value
                else:
                    current[key] = value
        
        merge_config(current_config, new_config)
        
        # 添加更新时间戳
        current_config['last_updated'] = datetime.now().isoformat()
        
        if save_config(current_config):
            return jsonify({
                "success": True,
                "data": current_config,
                "message": "配置更新成功"
            })
        else:
            return jsonify({
                "success": False,
                "data": None,
                "message": "配置保存失败"
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"更新配置失败: {str(e)}"
        }), 500

@app.route('/api/config/section/<section>', methods=['GET'])
def get_config_section(section):
    """获取特定配置节"""
    try:
        config = load_config()
        if section in config:
            return jsonify({
                "success": True,
                "data": config[section],
                "message": f"配置节 {section} 获取成功"
            })
        else:
            return jsonify({
                "success": False,
                "data": None,
                "message": f"配置节 {section} 不存在"
            }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取配置节失败: {str(e)}"
        }), 500

@app.route('/api/config/section/<section>', methods=['PUT'])
def update_config_section(section):
    """更新特定配置节"""
    try:
        section_data = request.get_json()
        if not section_data:
            return jsonify({
                "success": False,
                "data": None,
                "message": "请求数据不能为空"
            }), 400
        
        config = load_config()
        config[section] = section_data
        config['last_updated'] = datetime.now().isoformat()
        
        if save_config(config):
            return jsonify({
                "success": True,
                "data": config[section],
                "message": f"配置节 {section} 更新成功"
            })
        else:
            return jsonify({
                "success": False,
                "data": None,
                "message": "配置保存失败"
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"更新配置节失败: {str(e)}"
        }), 500

@app.route('/api/config/reset', methods=['POST'])
def reset_config():
    """重置配置为默认值"""
    try:
        default_config = DEFAULT_CONFIG.copy()
        default_config['last_updated'] = datetime.now().isoformat()
        
        if save_config(default_config):
            return jsonify({
                "success": True,
                "data": default_config,
                "message": "配置重置成功"
            })
        else:
            return jsonify({
                "success": False,
                "data": None,
                "message": "配置重置失败"
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"重置配置失败: {str(e)}"
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "success": True,
        "data": {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0"
        },
        "message": "服务运行正常"
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "data": None,
        "message": "接口不存在"
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "success": False,
        "data": None,
        "message": "服务器内部错误"
    }), 500

# 删除重复的函数定义

@app.route('/api/services/connectivity', methods=['POST'])
def check_service_connectivity():
    """检查服务连通性"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "message": "请求数据不能为空"
            }), 400
        
        services = data.get('services', [])
        results = []
        
        for service in services:
            host = service.get('host')
            port = service.get('port')
            service_type = service.get('type', 'tcp')
            
            if not host or not port:
                results.append({
                    'id': service.get('id'),
                    'name': service.get('name'),
                    'status': 'error',
                    'message': '主机或端口未指定'
                })
                continue
            
            try:
                if service_type.lower() == 'http' or service_type.lower() == 'https':
                    # HTTP/HTTPS 检查
                    import requests
                    url = f"{service_type.lower()}://{host}:{port}"
                    response = requests.get(url, timeout=5)
                    status = 'connected' if response.status_code < 400 else 'warning'
                    latency = response.elapsed.total_seconds() * 1000
                else:
                    # TCP 端口检查
                    import socket
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(5)
                    result = sock.connect_ex((host, int(port)))
                    sock.close()
                    status = 'connected' if result == 0 else 'disconnected'
                    latency = 0  # TCP连接不计算延迟
                
                results.append({
                    'id': service.get('id'),
                    'name': service.get('name'),
                    'status': status,
                    'latency': latency,
                    'lastCheck': datetime.now().isoformat()
                })
                
            except Exception as e:
                results.append({
                    'id': service.get('id'),
                    'name': service.get('name'),
                    'status': 'disconnected',
                    'error': str(e),
                    'lastCheck': datetime.now().isoformat()
                })
        
        return jsonify({
            "success": True,
            "data": results,
            "message": "服务连通性检查完成"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"检查服务连通性失败: {str(e)}"
        }), 500

@app.route('/api/tools/check', methods=['POST'])
def check_tool_connection():
    """检查工具连接状态"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "message": "请求数据不能为空"
            }), 400
        
        tool_name = data.get('name')
        endpoint = data.get('endpoint')
        tool_type = data.get('type')
        
        if not endpoint:
            return jsonify({
                "success": False,
                "message": "工具端点不能为空"
            }), 400
        
        try:
            import requests
            import urllib.parse
            
            # 解析URL
            parsed_url = urllib.parse.urlparse(endpoint)
            if not parsed_url.scheme:
                endpoint = 'http://' + endpoint
                parsed_url = urllib.parse.urlparse(endpoint)
            
            # 根据工具类型检查不同的端点
            check_url = endpoint
            if tool_name == 'Elasticsearch':
                check_url = endpoint + '/_cluster/health'
            elif tool_name == 'Kibana':
                check_url = endpoint + '/api/status'
            elif tool_name == 'Prometheus':
                check_url = endpoint + '/-/healthy'
            elif tool_name == 'Grafana':
                check_url = endpoint + '/api/health'
            
            # 发送请求检查连接
            response = requests.get(check_url, timeout=10)
            
            if response.status_code < 400:
                # 尝试获取版本信息
                version = 'Unknown'
                metrics = {}
                
                if tool_name == 'Elasticsearch':
                    try:
                        info_response = requests.get(endpoint, timeout=5)
                        if info_response.status_code == 200:
                            info_data = info_response.json()
                            version = info_data.get('version', {}).get('number', 'Unknown')
                            
                        # 获取集群统计信息
                        stats_response = requests.get(endpoint + '/_cluster/stats', timeout=5)
                        if stats_response.status_code == 200:
                            stats_data = stats_response.json()
                            metrics = {
                                'indices': stats_data.get('indices', {}).get('count', 0),
                                'documents': stats_data.get('indices', {}).get('docs', {}).get('count', 0),
                                'storage': stats_data.get('indices', {}).get('store', {}).get('size_in_bytes', 0)
                            }
                    except:
                        pass
                
                elif tool_name == 'Prometheus':
                    try:
                        # 获取Prometheus配置信息
                        config_response = requests.get(endpoint + '/api/v1/status/config', timeout=5)
                        if config_response.status_code == 200:
                            # 获取目标数量
                            targets_response = requests.get(endpoint + '/api/v1/targets', timeout=5)
                            if targets_response.status_code == 200:
                                targets_data = targets_response.json()
                                active_targets = targets_data.get('data', {}).get('activeTargets', [])
                                metrics = {
                                    'targets': len(active_targets),
                                    'healthy_targets': len([t for t in active_targets if t.get('health') == 'up'])
                                }
                    except:
                        pass
                
                return jsonify({
                    "success": True,
                    "status": "connected",
                    "version": version,
                    "metrics": metrics,
                    "message": f"{tool_name} 连接成功"
                })
            else:
                return jsonify({
                    "success": False,
                    "status": "disconnected",
                    "message": f"{tool_name} 连接失败: HTTP {response.status_code}"
                })
                
        except requests.exceptions.Timeout:
            return jsonify({
                "success": False,
                "status": "disconnected",
                "message": f"{tool_name} 连接超时"
            })
        except requests.exceptions.ConnectionError:
            return jsonify({
                "success": False,
                "status": "disconnected",
                "message": f"{tool_name} 连接被拒绝"
            })
        except Exception as e:
            return jsonify({
                "success": False,
                "status": "disconnected",
                "message": f"{tool_name} 连接失败: {str(e)}"
            })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"检查工具连接失败: {str(e)}"
        }), 500

@app.route('/api/tools/metrics', methods=['POST'])
def get_tool_metrics():
    """获取工具指标"""
    try:
        data = request.get_json()
        tool_type = data.get('type')
        endpoint = data.get('endpoint')
        
        if not endpoint:
            return jsonify({
                "success": False,
                "message": "端点不能为空"
            }), 400
        
        # 这里可以根据不同的工具类型获取不同的指标
        # 目前返回基本的连接状态
        return jsonify({
            "success": True,
            "metrics": {
                "status": "connected",
                "lastCheck": datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"获取工具指标失败: {str(e)}"
        }), 500

@app.route('/api/alerts/stats', methods=['GET'])
def get_alert_stats():
    """获取告警统计信息"""
    try:
        # 模拟告警统计数据
        stats = {
            "total": 45,
            "critical": 3,
            "warning": 12,
            "info": 30,
            "resolved": 156,
            "trend": [
                {"time": "00:00", "critical": 2, "warning": 8, "info": 25},
                {"time": "04:00", "critical": 1, "warning": 10, "info": 28},
                {"time": "08:00", "critical": 3, "warning": 12, "info": 30},
                {"time": "12:00", "critical": 2, "warning": 9, "info": 27},
                {"time": "16:00", "critical": 4, "warning": 15, "info": 32},
                {"time": "20:00", "critical": 3, "warning": 12, "info": 30}
            ]
        }
        
        return jsonify({
            "success": True,
            "data": stats,
            "message": "告警统计获取成功"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取告警统计失败: {str(e)}"
        }), 500

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """获取告警列表"""
    try:
        # 获取查询参数
        limit = request.args.get('limit', 100, type=int)
        severity = request.args.get('severity')
        status = request.args.get('status')
        
        # 模拟告警数据
        alerts = [
            {
                "id": "alert-001",
                "title": "CPU使用率过高",
                "severity": "critical",
                "status": "active",
                "source": "Prometheus",
                "timestamp": "2025-01-25T11:15:00Z",
                "description": "服务器CPU使用率超过90%",
                "tags": ["cpu", "performance"]
            },
            {
                "id": "alert-002",
                "title": "内存使用率警告",
                "severity": "warning",
                "status": "active",
                "source": "Prometheus",
                "timestamp": "2025-01-25T11:10:00Z",
                "description": "服务器内存使用率超过80%",
                "tags": ["memory", "performance"]
            },
            {
                "id": "alert-003",
                "title": "磁盘空间不足",
                "severity": "warning",
                "status": "active",
                "source": "Prometheus",
                "timestamp": "2025-01-25T11:05:00Z",
                "description": "磁盘使用率超过85%",
                "tags": ["disk", "storage"]
            },
            {
                "id": "alert-004",
                "title": "服务响应时间过长",
                "severity": "critical",
                "status": "resolved",
                "source": "Grafana",
                "timestamp": "2025-01-25T10:30:00Z",
                "description": "API响应时间超过5秒",
                "tags": ["api", "performance"]
            },
            {
                "id": "alert-005",
                "title": "数据库连接异常",
                "severity": "critical",
                "status": "active",
                "source": "Elasticsearch",
                "timestamp": "2025-01-25T10:15:00Z",
                "description": "数据库连接池耗尽",
                "tags": ["database", "connection"]
            }
        ]
        
        # 应用过滤器
        filtered_alerts = alerts
        if severity:
            filtered_alerts = [a for a in filtered_alerts if a['severity'] == severity]
        if status:
            filtered_alerts = [a for a in filtered_alerts if a['status'] == status]
            
        # 应用限制
        filtered_alerts = filtered_alerts[:limit]
        
        return jsonify({
            "success": True,
            "data": filtered_alerts,
            "total": len(alerts),
            "filtered": len(filtered_alerts),
            "message": "告警列表获取成功"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取告警列表失败: {str(e)}"
        }), 500

@app.route('/api/logs/indices', methods=['GET'])
def get_log_indices():
    """获取Elasticsearch索引列表"""
    try:
        config = load_config()
        elk_config = config.get('monitoring', {}).get('elk', {})
        
        if not elk_config.get('enabled', False):
            return jsonify({
                "success": False,
                "data": None,
                "message": "ELK Stack未启用，请在配置管理中启用"
            }), 400
            
        elasticsearch_url = elk_config.get('elasticsearch_url')
        if not elasticsearch_url:
            return jsonify({
                "success": False,
                "data": None,
                "message": "Elasticsearch URL未配置，请在配置管理中设置"
            }), 400
        
        try:
            import requests
            
            # 获取所有索引信息
            indices_url = f"{elasticsearch_url}/_cat/indices?format=json&h=index,health,status,uuid,pri,rep,docs.count,docs.deleted,store.size,pri.store.size,creation.date,creation.date.string"
            response = requests.get(indices_url, timeout=10)
            
            if response.status_code == 200:
                indices_data = response.json()
                
                # 过滤日志相关索引
                log_indices = []
                for index in indices_data:
                    index_name = index.get('index', '')
                    # 过滤系统索引和非日志索引
                    if not index_name.startswith('.') and ('log' in index_name.lower() or 'filebeat' in index_name.lower() or 'metricbeat' in index_name.lower()):
                        log_indices.append({
                            "index": index_name,
                            "health": index.get('health', 'unknown'),
                            "status": index.get('status', 'unknown'),
                            "uuid": index.get('uuid', ''),
                            "pri": index.get('pri', '0'),
                            "rep": index.get('rep', '0'),
                            "docs_count": int(index.get('docs.count', 0)) if index.get('docs.count', '0').isdigit() else 0,
                            "docs_deleted": int(index.get('docs.deleted', 0)) if index.get('docs.deleted', '0').isdigit() else 0,
                            "size": index.get('store.size', '0b'),
                            "pri_store_size": index.get('pri.store.size', '0b'),
                            "creation_date": index.get('creation.date', ''),
                            "creation_date_string": index.get('creation.date.string', '')
                        })
                
                # 按索引名称排序
                log_indices.sort(key=lambda x: x['index'], reverse=True)
                
                return jsonify({
                    "success": True,
                    "data": log_indices,
                    "total": len(log_indices),
                    "message": "索引列表获取成功"
                })
            else:
                return jsonify({
                    "success": False,
                    "data": None,
                    "message": f"Elasticsearch查询失败: {response.status_code}"
                }), 500
                
        except requests.exceptions.RequestException as e:
            return jsonify({
                "success": False,
                "data": None,
                "message": f"连接Elasticsearch失败: {str(e)}"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": [],
            "message": f"获取索引列表失败: {str(e)}"
        }), 500

@app.route('/api/logs/stream', methods=['GET'])
def get_log_stream():
    """获取实时日志流"""
    try:
        # 检查Elasticsearch配置
        config = load_config()
        elk_config = config.get('monitoring', {}).get('elk', {})
        
        if not elk_config.get('enabled', False):
            return jsonify({
                "success": False,
                "data": None,
                "message": "ELK Stack未启用，请在配置管理中启用"
            }), 400
            
        elasticsearch_url = elk_config.get('elasticsearch_url')
        if not elasticsearch_url:
            return jsonify({
                "success": False,
                "data": None,
                "message": "Elasticsearch URL未配置，请在配置管理中设置"
            }), 400
        
        # 获取查询参数
        index_pattern = request.args.get('index', 'logstash-*')
        query = request.args.get('query', '')
        level = request.args.get('level', 'all')
        service = request.args.get('service', 'all')
        size = int(request.args.get('size', 100))
        from_timestamp = request.args.get('from', 'now-5m')
        
        try:
            import requests
            
            # 构建Elasticsearch查询
            query_body = {
                "size": size,
                "sort": [{"@timestamp": {"order": "desc"}}],
                "query": {
                    "bool": {
                        "must": [],
                        "filter": [
                            {
                                "range": {
                                    "@timestamp": {
                                        "gte": from_timestamp
                                    }
                                }
                            }
                        ]
                    }
                }
            }
            
            # 日志级别过滤
            if level != 'all':
                query_body["query"]["bool"]["must"].append({
                    "match": {"level": level}
                })
            
            # 服务过滤
            if service != 'all':
                query_body["query"]["bool"]["must"].append({
                    "match": {"service": service}
                })
            
            # 查询过滤
            if query:
                query_body["query"]["bool"]["must"].append({
                    "multi_match": {
                        "query": query,
                        "fields": ["message", "service", "source"]
                    }
                })
            
            # 执行Elasticsearch查询
            search_url = f"{elasticsearch_url}/{index_pattern}/_search"
            response = requests.post(search_url, json=query_body, timeout=10)
            
            if response.status_code == 200:
                es_data = response.json()
                hits = es_data.get('hits', {}).get('hits', [])
                
                logs = []
                for hit in hits:
                    source = hit.get('_source', {})
                    logs.append({
                        "id": hit.get('_id'),
                        "timestamp": source.get('@timestamp', source.get('timestamp')),
                        "level": source.get('level', 'INFO'),
                        "service": source.get('service', source.get('container_name', 'unknown')),
                        "message": source.get('message', source.get('log', '')),
                        "source": source.get('source', source.get('source_type', 'unknown')),
                        "index": hit.get('_index'),
                        "host": source.get('host', {}),
                        "fields": source
                    })
                
                return jsonify({
                    "success": True,
                    "data": logs,
                    "total": len(logs),
                    "index_pattern": index_pattern,
                    "message": "实时日志流获取成功"
                })
            else:
                return jsonify({
                    "success": False,
                    "data": None,
                    "message": f"Elasticsearch查询失败: {response.status_code}"
                }), 500
                
        except requests.exceptions.RequestException as e:
            return jsonify({
                "success": False,
                "data": None,
                "message": f"连接Elasticsearch失败: {str(e)}"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": [],
            "message": f"获取实时日志失败: {str(e)}"
        }), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """获取日志数据"""
    try:
        # 检查Elasticsearch配置
        config = load_config()
        elk_config = config.get('monitoring', {}).get('elk', {})
        
        if not elk_config.get('enabled', False):
            return jsonify({
                "success": False,
                "data": None,
                "message": "ELK Stack未启用，请在配置管理中启用"
            }), 400
            
        elasticsearch_url = elk_config.get('elasticsearch_url')
        if not elasticsearch_url:
            return jsonify({
                "success": False,
                "data": None,
                "message": "Elasticsearch URL未配置，请在配置管理中设置"
            }), 400
        
        # 获取查询参数
        match_pattern = request.args.get('match_pattern', '')
        level = request.args.get('level', 'all')
        service = request.args.get('service', 'all')
        time_range = request.args.get('time_range', '24h')
        index_pattern = request.args.get('index', 'logstash-*')
        size = int(request.args.get('size', 100))
        
        try:
            import requests
            
            # 构建Elasticsearch查询
            query_body = {
                "size": size,
                "sort": [{"@timestamp": {"order": "desc"}}],
                "query": {
                    "bool": {
                        "must": [],
                        "filter": []
                    }
                }
            }
            
            # 时间范围过滤
            if time_range:
                query_body["query"]["bool"]["filter"].append({
                    "range": {
                        "@timestamp": {
                            "gte": f"now-{time_range}"
                        }
                    }
                })
            
            # 日志级别过滤
            if level != 'all':
                query_body["query"]["bool"]["must"].append({
                    "match": {"level": level}
                })
            
            # 服务过滤
            if service != 'all':
                query_body["query"]["bool"]["must"].append({
                    "match": {"service": service}
                })
            
            # 匹配模式过滤
            if match_pattern:
                query_body["query"]["bool"]["must"].append({
                    "multi_match": {
                        "query": match_pattern,
                        "fields": ["message", "service", "source"]
                    }
                })
            
            # 执行Elasticsearch查询
            search_url = f"{elasticsearch_url}/{index_pattern}/_search"
            response = requests.post(search_url, json=query_body, timeout=10)
            
            if response.status_code == 200:
                es_data = response.json()
                hits = es_data.get('hits', {}).get('hits', [])
                
                logs = []
                for hit in hits:
                    source = hit.get('_source', {})
                    logs.append({
                        "id": hit.get('_id'),
                        "timestamp": source.get('@timestamp', source.get('timestamp')),
                        "level": source.get('level', 'INFO'),
                        "service": source.get('service', source.get('container_name', 'unknown')),
                        "message": source.get('message', source.get('log', '')),
                        "source": source.get('source', source.get('source_type', 'unknown')),
                        "index": hit.get('_index'),
                        "host": source.get('host', {}),
                        "fields": source
                    })
                
                total_hits = es_data.get('hits', {}).get('total', {})
                if isinstance(total_hits, dict):
                    total = total_hits.get('value', 0)
                else:
                    total = total_hits
                
                return jsonify({
                    "success": True,
                    "data": logs,
                    "total": total,
                    "filtered": len(logs),
                    "index_pattern": index_pattern,
                    "message": "日志获取成功"
                })
            else:
                return jsonify({
                    "success": False,
                    "data": None,
                    "message": f"Elasticsearch查询失败: {response.status_code}"
                }), 500
                
        except requests.exceptions.RequestException as e:
            return jsonify({
                "success": False,
                "data": None,
                "message": f"连接Elasticsearch失败: {str(e)}"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取日志失败: {str(e)}"
        }), 500

@app.route('/api/logs/stats', methods=['GET'])
def get_log_stats():
    """获取日志统计信息"""
    try:
        # 检查Elasticsearch配置
        config = load_config()
        elk_config = config.get('monitoring', {}).get('elk', {})
        
        if not elk_config.get('enabled', False):
            return jsonify({
                "success": False,
                "data": None,
                "message": "ELK Stack未启用，请在配置管理中启用"
            }), 400
            
        elasticsearch_url = elk_config.get('elasticsearch_url')
        if not elasticsearch_url:
            return jsonify({
                "success": False,
                "data": None,
                "message": "Elasticsearch URL未配置，请在配置管理中设置"
            }), 400
        
        try:
            import requests
            
            # 获取查询参数
            time_range = request.args.get('time_range', '24h')
            index_pattern = request.args.get('index', 'logstash-*')
            
            # 构建Elasticsearch聚合查询
            query_body = {
                "size": 0,
                "query": {
                    "bool": {
                        "filter": [
                            {
                                "range": {
                                    "@timestamp": {
                                        "gte": f"now-{time_range}"
                                    }
                                }
                            }
                        ]
                    }
                },
                "aggs": {
                    "log_levels": {
                        "terms": {
                            "field": "level.keyword",
                            "size": 10
                        }
                    },
                    "services": {
                        "cardinality": {
                            "field": "service.keyword"
                        }
                    }
                }
            }
            
            # 执行Elasticsearch查询
            search_url = f"{elasticsearch_url}/{index_pattern}/_search"
            response = requests.post(search_url, json=query_body, timeout=10)
            
            if response.status_code == 200:
                es_data = response.json()
                
                # 获取总日志数
                total_hits = es_data.get('hits', {}).get('total', {})
                if isinstance(total_hits, dict):
                    total_logs = total_hits.get('value', 0)
                else:
                    total_logs = total_hits
                
                # 获取日志级别统计
                level_buckets = es_data.get('aggregations', {}).get('log_levels', {}).get('buckets', [])
                error_logs = 0
                warning_logs = 0
                
                for bucket in level_buckets:
                    level = bucket.get('key', '').upper()
                    count = bucket.get('doc_count', 0)
                    if level in ['ERROR', 'FATAL']:
                        error_logs += count
                    elif level in ['WARN', 'WARNING']:
                        warning_logs += count
                
                # 获取活跃服务数
                active_services = es_data.get('aggregations', {}).get('services', {}).get('value', 0)
                
                return jsonify({
                    "success": True,
                    "data": {
                        "totalLogs": total_logs,
                        "errorLogs": error_logs,
                        "warningLogs": warning_logs,
                        "activeServices": active_services
                    },
                    "message": "日志统计获取成功"
                })
            else:
                return jsonify({
                    "success": False,
                    "data": None,
                    "message": f"Elasticsearch查询失败: {response.status_code}"
                }), 500
                
        except requests.exceptions.RequestException as e:
            return jsonify({
                "success": False,
                "data": None,
                "message": f"连接Elasticsearch失败: {str(e)}"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取日志统计失败: {str(e)}"
        }), 500

@app.route('/api/logs/trends', methods=['GET'])
def get_log_trends():
    """获取日志趋势数据"""
    try:
        # 检查Elasticsearch配置
        config = load_config()
        elk_config = config.get('monitoring', {}).get('elk', {})
        
        if not elk_config.get('enabled', False):
            return jsonify({
                "success": False,
                "data": None,
                "message": "ELK Stack未启用，请在配置管理中启用"
            }), 400
            
        elasticsearch_url = elk_config.get('elasticsearch_url')
        if not elasticsearch_url:
            return jsonify({
                "success": False,
                "data": None,
                "message": "Elasticsearch URL未配置，请在配置管理中设置"
            }), 400
        
        try:
            import requests
            from datetime import datetime, timedelta
            
            # 获取查询参数
            time_range = request.args.get('time_range', '24h')
            index_pattern = request.args.get('index', 'logstash-*')
            interval = request.args.get('interval', '1h')
            
            # 构建Elasticsearch时间序列聚合查询
            query_body = {
                "size": 0,
                "query": {
                    "bool": {
                        "filter": [
                            {
                                "range": {
                                    "@timestamp": {
                                        "gte": f"now-{time_range}"
                                    }
                                }
                            }
                        ]
                    }
                },
                "aggs": {
                    "time_series": {
                        "date_histogram": {
                            "field": "@timestamp",
                            "fixed_interval": interval,
                            "min_doc_count": 0
                        },
                        "aggs": {
                            "log_levels": {
                                "terms": {
                                    "field": "level.keyword",
                                    "size": 10
                                }
                            }
                        }
                    }
                }
            }
            
            # 执行Elasticsearch查询
            search_url = f"{elasticsearch_url}/{index_pattern}/_search"
            response = requests.post(search_url, json=query_body, timeout=10)
            
            if response.status_code == 200:
                es_data = response.json()
                
                # 处理时间序列数据
                time_buckets = es_data.get('aggregations', {}).get('time_series', {}).get('buckets', [])
                trends = []
                
                for bucket in time_buckets:
                    timestamp = bucket.get('key_as_string', bucket.get('key'))
                    total = bucket.get('doc_count', 0)
                    
                    # 统计各级别日志数量
                    level_buckets = bucket.get('log_levels', {}).get('buckets', [])
                    errors = 0
                    warnings = 0
                    info = 0
                    
                    for level_bucket in level_buckets:
                        level = level_bucket.get('key', '').upper()
                        count = level_bucket.get('doc_count', 0)
                        if level in ['ERROR', 'FATAL']:
                            errors += count
                        elif level in ['WARN', 'WARNING']:
                            warnings += count
                        elif level in ['INFO', 'DEBUG', 'TRACE']:
                            info += count
                    
                    # 格式化时间
                    if isinstance(timestamp, str):
                        try:
                            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                            time_str = dt.strftime("%H:%M")
                        except:
                            time_str = str(timestamp)
                    else:
                        dt = datetime.fromtimestamp(timestamp / 1000)
                        time_str = dt.strftime("%H:%M")
                    
                    trends.append({
                        "time": time_str,
                        "timestamp": timestamp,
                        "total": total,
                        "errors": errors,
                        "warnings": warnings,
                        "info": info
                    })
                
                return jsonify({
                    "success": True,
                    "data": trends,
                    "message": "日志趋势获取成功"
                })
            else:
                return jsonify({
                    "success": False,
                    "data": None,
                    "message": f"Elasticsearch查询失败: {response.status_code}"
                }), 500
                
        except requests.exceptions.RequestException as e:
            return jsonify({
                "success": False,
                "data": None,
                "message": f"连接Elasticsearch失败: {str(e)}"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取日志趋势失败: {str(e)}"
        }), 500

@app.route('/api/system/metrics', methods=['GET'])
def get_system_metrics():
    """获取系统指标"""
    try:
        # 检查Prometheus配置
        config = load_config()
        prometheus_config = config.get('monitoring', {}).get('prometheus', {})
        
        if not prometheus_config.get('enabled', False):
            return jsonify({
                "success": False,
                "data": None,
                "message": "Prometheus未启用，请在配置管理中启用"
            }), 400
            
        prometheus_url = prometheus_config.get('url')
        if not prometheus_url:
            return jsonify({
                "success": False,
                "data": None,
                "message": "Prometheus URL未配置，请在配置管理中设置"
            }), 400
        
        # 获取查询参数
        query_type = request.args.get('query_type', 'node_exporter')
        
        try:
            import requests
            
            # 根据查询类型构建不同的查询
            if query_type == 'cadvisor':
                cpu_query = 'rate(container_cpu_usage_seconds_total[5m]) * 100'
                memory_query = '(container_memory_usage_bytes / container_spec_memory_limit_bytes) * 100'
            elif query_type == 'kubernetes':
                cpu_query = 'rate(container_cpu_usage_seconds_total{container!="POD",container!=""}[5m]) * 100'
                memory_query = '(container_memory_working_set_bytes{container!="POD",container!=""} / container_spec_memory_limit_bytes) * 100'
            else:  # node_exporter
                cpu_query = '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
                memory_query = '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'
            
            # 查询CPU使用率
            cpu_response = requests.get(f'{prometheus_url}/api/v1/query', 
                                      params={'query': cpu_query}, timeout=10)
            
            # 查询内存使用率
            memory_response = requests.get(f'{prometheus_url}/api/v1/query', 
                                         params={'query': memory_query}, timeout=10)
            
            cpu_value = 0
            memory_value = 0
            
            if cpu_response.status_code == 200:
                cpu_data = cpu_response.json()
                if cpu_data.get('data', {}).get('result'):
                    cpu_value = float(cpu_data['data']['result'][0]['value'][1])
            
            if memory_response.status_code == 200:
                memory_data = memory_response.json()
                if memory_data.get('data', {}).get('result'):
                    memory_value = float(memory_data['data']['result'][0]['value'][1])
            
            return jsonify({
                "success": True,
                "data": {
                    "cpu": round(cpu_value, 2),
                    "memory": round(memory_value, 2),
                    "query_type": query_type
                },
                "message": "系统指标获取成功"
            })
            
        except requests.exceptions.RequestException:
            # 如果Prometheus不可用，返回模拟数据
            import random
            return jsonify({
                "success": True,
                "data": {
                    "cpu": round(random.uniform(20, 80), 2),
                    "memory": round(random.uniform(30, 70), 2),
                    "query_type": query_type
                },
                "message": "系统指标获取成功（模拟数据）"
            })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取系统指标失败: {str(e)}"
        }), 500

@app.route('/api/services/check', methods=['POST'])
def check_single_service():
    """检查单个服务连通性"""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({
                "success": False,
                "data": None,
                "message": "请提供服务URL"
            }), 400
        
        import requests
        import time
        
        url = data.get('url')
        timeout = data.get('timeout', 5)
        
        start_time = time.time()
        try:
            response = requests.get(url, timeout=timeout, verify=False)
            response_time = int((time.time() - start_time) * 1000)
            
            return jsonify({
                "success": True,
                "data": {
                    "status_code": response.status_code,
                    "response_time": response_time,
                    "status": 'healthy' if response.status_code == 200 else 'warning'
                },
                "message": "服务检查完成"
            })
            
        except requests.exceptions.RequestException as e:
            response_time = int((time.time() - start_time) * 1000)
            return jsonify({
                "success": False,
                "data": {
                    "status_code": 0,
                    "response_time": response_time,
                    "status": 'unavailable',
                    "error": str(e)
                },
                "message": "服务连接失败"
            })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"检查服务失败: {str(e)}"
        }), 500

@app.route('/api/services/batch-check', methods=['POST'])
def batch_check_services():
    """批量检查服务连通性"""
    try:
        data = request.get_json()
        if not data or 'services' not in data:
            return jsonify({
                "success": False,
                "data": None,
                "message": "请提供服务列表"
            }), 400
        
        import requests
        import time
        import concurrent.futures
        
        def check_service_item(service):
            url = service.get('url')
            timeout = service.get('timeout', 5)
            
            start_time = time.time()
            try:
                response = requests.get(url, timeout=timeout)
                latency = int((time.time() - start_time) * 1000)
                
                return {
                    **service,
                    "status": 'online' if response.status_code == 200 else 'warning',
                    "latency": latency,
                    "status_code": response.status_code,
                    "response_time": latency,
                    "last_check": datetime.now().isoformat(),
                    "uptime": 99.9 if response.status_code == 200 else 95.0
                }
                
            except requests.exceptions.Timeout:
                latency = int((time.time() - start_time) * 1000)
                return {
                    **service,
                    "status": "warning",
                    "latency": latency,
                    "status_code": 0,
                    "response_time": latency,
                    "last_check": datetime.now().isoformat(),
                    "uptime": 90.0,
                    "error": "请求超时"
                }
                
            except Exception as e:
                latency = int((time.time() - start_time) * 1000)
                return {
                    **service,
                    "status": "offline",
                    "latency": 0,
                    "status_code": 0,
                    "response_time": latency,
                    "last_check": datetime.now().isoformat(),
                    "uptime": 0.0,
                    "error": str(e)
                }
        
        services = data['services']
        
        # 使用线程池并发检查服务
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(check_service_item, services))
        
        return jsonify({
            "success": True,
            "data": results,
            "message": "批量服务检查完成"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"批量检查服务失败: {str(e)}"
        }), 500

@app.route('/api/custom-indices', methods=['GET'])
def get_custom_indices():
    """获取自定义索引列表"""
    try:
        config = load_config()
        custom_indices = config.get('custom_indices', [])
        
        return jsonify({
            "success": True,
            "data": custom_indices,
            "message": "获取自定义索引列表成功"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"获取自定义索引列表失败: {str(e)}"
        }), 500

@app.route('/api/custom-indices', methods=['POST'])
def add_custom_index():
    """添加自定义索引"""
    try:
        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({
                "success": False,
                "data": None,
                "message": "请提供索引名称"
            }), 400
        
        index_name = data['name'].strip()
        description = data.get('description', '').strip()
        
        if not index_name:
            return jsonify({
                "success": False,
                "data": None,
                "message": "索引名称不能为空"
            }), 400
        
        config = load_config()
        custom_indices = config.get('custom_indices', [])
        
        # 检查是否已存在
        for index in custom_indices:
            if index['name'] == index_name:
                return jsonify({
                    "success": False,
                    "data": None,
                    "message": "索引名称已存在"
                }), 400
        
        # 添加新索引
        new_index = {
            "name": index_name,
            "description": description,
            "created_at": datetime.now().isoformat()
        }
        
        custom_indices.append(new_index)
        config['custom_indices'] = custom_indices
        
        # 保存配置
        save_config(config)
        
        return jsonify({
            "success": True,
            "data": new_index,
            "message": "自定义索引添加成功"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"添加自定义索引失败: {str(e)}"
        }), 500

@app.route('/api/custom-indices/<index_name>', methods=['DELETE'])
def delete_custom_index(index_name):
    """删除自定义索引"""
    try:
        config = load_config()
        custom_indices = config.get('custom_indices', [])
        
        # 查找并删除索引
        updated_indices = [index for index in custom_indices if index['name'] != index_name]
        
        if len(updated_indices) == len(custom_indices):
            return jsonify({
                "success": False,
                "data": None,
                "message": "索引不存在"
            }), 404
        
        config['custom_indices'] = updated_indices
        save_config(config)
        
        return jsonify({
            "success": True,
            "data": None,
            "message": "自定义索引删除成功"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"删除自定义索引失败: {str(e)}"
        }), 500

@app.route('/api/custom-indices/<index_name>', methods=['PUT'])
def update_custom_index(index_name):
    """更新自定义索引"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "data": None,
                "message": "请提供更新数据"
            }), 400
        
        config = load_config()
        custom_indices = config.get('custom_indices', [])
        
        # 查找并更新索引
        updated = False
        for index in custom_indices:
            if index['name'] == index_name:
                if 'description' in data:
                    index['description'] = data['description'].strip()
                index['updated_at'] = datetime.now().isoformat()
                updated = True
                break
        
        if not updated:
            return jsonify({
                "success": False,
                "data": None,
                "message": "索引不存在"
            }), 404
        
        config['custom_indices'] = custom_indices
        save_config(config)
        
        return jsonify({
            "success": True,
            "data": None,
            "message": "自定义索引更新成功"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "data": None,
            "message": f"更新自定义索引失败: {str(e)}"
        }), 500

if __name__ == '__main__':
    import sys
    
    # 默认端口
    port = 8001
    
    # 检查命令行参数
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.startswith('--port='):
                try:
                    port = int(arg.split('=')[1])
                except ValueError:
                    print("错误: 端口号必须是数字")
                    sys.exit(1)
            elif arg == '--help' or arg == '-h':
                print("用法: python3 backend/app.py [--port=端口号]")
                print("默认端口: 8001")
                sys.exit(0)
    
    print("启动综合运维平台后端服务...")
    print("API文档:")
    print("  GET  /api/config - 获取所有配置")
    print("  PUT  /api/config - 更新配置")
    print("  GET  /api/config/section/<section> - 获取特定配置节")
    print("  PUT  /api/config/section/<section> - 更新特定配置节")
    print("  POST /api/config/reset - 重置配置")
    print("  GET  /api/health - 健康检查")
    print("  POST /api/services/check - 检查单个服务连通性")
    print("  POST /api/services/batch-check - 批量检查服务连通性")
    print("  POST /api/services/connectivity - 检查服务连通性")
    print("  POST /api/tools/check - 检查工具连接状态")
    print("  POST /api/tools/metrics - 获取工具指标")
    print("  GET  /api/alerts/stats - 获取告警统计信息")
    print("  GET  /api/alerts - 获取告警列表")
    print("  GET  /api/logs - 获取日志数据")
    print("  GET  /api/logs/indices - 获取日志索引列表")
    print("  GET  /api/logs/stats - 获取日志统计信息")
    print("  GET  /api/logs/stream - 获取实时日志流")
    print("  GET  /api/logs/trends - 获取日志趋势数据")
    print("  GET  /api/system/metrics - 获取系统指标")
    print(f"\n服务地址: http://localhost:{port}")
    
    try:
        app.run(host='0.0.0.0', port=port, debug=True)
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"\n错误: 端口 {port} 已被占用")
            print("请尝试使用其他端口: python3 backend/app.py --port=8002")
        else:
            print(f"启动服务失败: {e}")
        sys.exit(1)