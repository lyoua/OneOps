-- 创建数据库表结构

-- 仪表板表
CREATE TABLE IF NOT EXISTS dashboards (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    panels JSONB,
    variables JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 变量表
CREATE TABLE IF NOT EXISTS variables (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    type VARCHAR(50),
    query TEXT,
    options JSONB,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 仪表板模板表
CREATE TABLE IF NOT EXISTS dashboard_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    panels JSONB,
    variables JSONB,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配置表
CREATE TABLE IF NOT EXISTS configs (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dashboards_name ON dashboards(name);
CREATE INDEX IF NOT EXISTS idx_variables_name ON variables(name);
CREATE INDEX IF NOT EXISTS idx_dashboard_templates_name ON dashboard_templates(name);
CREATE INDEX IF NOT EXISTS idx_configs_key ON configs(key);

-- 插入默认模板数据
INSERT INTO dashboard_templates (id, name, description, panels, variables, tags) VALUES
('node-exporter', 'Node Exporter监控', '系统资源监控模板', 
'[
  {
    "id": "cpu-usage",
    "title": "CPU使用率",
    "type": "line",
    "query": "100 - (avg(irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
    "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}
  },
  {
    "id": "memory-usage",
    "title": "内存使用率",
    "type": "line",
    "query": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
    "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8}
  },
  {
    "id": "disk-usage",
    "title": "磁盘使用率",
    "type": "bar",
    "query": "(1 - (node_filesystem_avail_bytes{fstype!=\"tmpfs\"} / node_filesystem_size_bytes{fstype!=\"tmpfs\"})) * 100",
    "gridPos": {"x": 0, "y": 8, "w": 12, "h": 8}
  },
  {
    "id": "network-io",
    "title": "网络IO",
    "type": "line",
    "query": "irate(node_network_receive_bytes_total{device!=\"lo\"}[5m])",
    "gridPos": {"x": 12, "y": 8, "w": 12, "h": 8}
  }
]',
'[
  {
    "name": "instance",
    "label": "实例",
    "type": "query",
    "query": "label_values(up, instance)",
    "value": "192.168.50.81:9100"
  },
  {
    "name": "job",
    "label": "任务",
    "type": "query",
    "query": "label_values(up, job)",
    "value": "node"
  }
]',
'["系统监控", "Node Exporter"]'),

('application', '应用监控', '应用性能监控模板',
'[
  {
    "id": "request-rate",
    "title": "请求速率",
    "type": "line",
    "query": "rate(http_requests_total[5m])",
    "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}
  },
  {
    "id": "response-time",
    "title": "响应时间",
    "type": "line",
    "query": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
    "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8}
  },
  {
    "id": "error-rate",
    "title": "错误率",
    "type": "stat",
    "query": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
    "gridPos": {"x": 0, "y": 8, "w": 6, "h": 4}
  },
  {
    "id": "active-connections",
    "title": "活跃连接数",
    "type": "gauge",
    "query": "sum(http_connections_active)",
    "gridPos": {"x": 6, "y": 8, "w": 6, "h": 4}
  }
]',
'[
  {
    "name": "service",
    "label": "服务",
    "type": "query",
    "query": "label_values(http_requests_total, service)",
    "value": "api"
  }
]',
'["应用监控", "HTTP"]');