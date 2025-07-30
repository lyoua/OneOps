#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
初始化仪表板模板到数据库
"""

from models import SessionLocal, DashboardTemplate as DashboardTemplateModel
from datetime import datetime
import json

# 预设仪表板模板数据
DASHBOARD_TEMPLATES = [
    {
        "id": "node-exporter",
        "name": "Node Exporter监控",
        "description": "系统资源监控：CPU、内存、磁盘、网络",
        "category": "系统监控",
        "tags": ["系统", "Node Exporter", "CPU", "内存"],
        "is_builtin": True,
        "variables": [
            {
                "name": "instance",
                "label": "实例",
                "type": "query",
                "query": "label_values(up{job=\"node-exporter\"}, instance)",
                "value": "192.168.50.81:9100",
                "multi": False
            },
            {
                "name": "job",
                "label": "任务",
                "type": "query",
                "query": "label_values(up, job)",
                "value": "node-exporter",
                "multi": False
            }
        ],
        "panels": [
            {
                "title": "CPU使用率",
                "query": "100 - (avg(irate(node_cpu_seconds_total{mode=\"idle\",instance=\"$instance\"}[5m])) * 100)",
                "chartType": "line",
                "unit": "%"
            },
            {
                "title": "内存使用率",
                "query": "(1 - (node_memory_MemAvailable_bytes{instance=\"$instance\"} / node_memory_MemTotal_bytes{instance=\"$instance\"})) * 100",
                "chartType": "line",
                "unit": "%"
            },
            {
                "title": "磁盘使用率",
                "query": "100 - ((node_filesystem_avail_bytes{instance=\"$instance\",mountpoint=\"/\",fstype!=\"rootfs\"} / node_filesystem_size_bytes{instance=\"$instance\",mountpoint=\"/\",fstype!=\"rootfs\"}) * 100)",
                "chartType": "gauge",
                "unit": "%"
            },
            {
                "title": "网络流量",
                "query": "irate(node_network_receive_bytes_total{instance=\"$instance\",device!=\"lo\"}[5m])",
                "chartType": "line",
                "unit": "bytes/s"
            }
        ]
    },
    {
        "id": "prometheus-monitoring",
        "name": "Prometheus监控",
        "description": "Prometheus自身监控指标",
        "category": "监控系统",
        "tags": ["Prometheus", "监控", "性能"],
        "is_builtin": True,
        "variables": [
            {
                "name": "instance",
                "label": "实例",
                "type": "query",
                "query": "label_values(prometheus_build_info, instance)",
                "value": "192.168.50.81:9090",
                "multi": False
            }
        ],
        "panels": [
            {
                "title": "查询执行时间",
                "query": "prometheus_engine_query_duration_seconds{instance=\"$instance\",quantile=\"0.9\"}",
                "chartType": "line",
                "unit": "s"
            },
            {
                "title": "活跃时间序列",
                "query": "prometheus_tsdb_symbol_table_size_bytes{instance=\"$instance\"}",
                "chartType": "stat",
                "unit": "bytes"
            },
            {
                "title": "采样率",
                "query": "rate(prometheus_tsdb_samples_appended_total{instance=\"$instance\"}[5m])",
                "chartType": "line",
                "unit": "samples/s"
            }
        ]
    },
    {
        "id": "kubernetes-overview",
        "name": "Kubernetes概览",
        "description": "Kubernetes集群监控概览",
        "category": "容器监控",
        "tags": ["Kubernetes", "容器", "集群"],
        "is_builtin": True,
        "variables": [
            {
                "name": "cluster",
                "label": "集群",
                "type": "query",
                "query": "label_values(kube_node_info, cluster)",
                "value": "default",
                "multi": False
            },
            {
                "name": "namespace",
                "label": "命名空间",
                "type": "query",
                "query": "label_values(kube_namespace_status_phase{cluster=\"$cluster\"}, namespace)",
                "value": "default",
                "multi": True
            }
        ],
        "panels": [
            {
                "title": "节点数量",
                "query": "count(kube_node_info{cluster=\"$cluster\"})",
                "chartType": "stat",
                "unit": "个"
            },
            {
                "title": "Pod数量",
                "query": "count(kube_pod_info{cluster=\"$cluster\",namespace=~\"$namespace\"})",
                "chartType": "stat",
                "unit": "个"
            },
            {
                "title": "CPU使用率",
                "query": "sum(rate(container_cpu_usage_seconds_total{cluster=\"$cluster\",namespace=~\"$namespace\"}[5m])) by (namespace)",
                "chartType": "line",
                "unit": "cores"
            },
            {
                "title": "内存使用量",
                "query": "sum(container_memory_working_set_bytes{cluster=\"$cluster\",namespace=~\"$namespace\"}) by (namespace)",
                "chartType": "line",
                "unit": "bytes"
            }
        ]
    },
    {
        "id": "database-monitoring",
        "name": "数据库监控",
        "description": "数据库性能监控",
        "category": "数据库",
        "tags": ["数据库", "性能", "连接"],
        "is_builtin": True,
        "variables": [
            {
                "name": "instance",
                "label": "数据库实例",
                "type": "query",
                "query": "label_values(mysql_up, instance)",
                "value": "192.168.50.81:3306",
                "multi": False
            }
        ],
        "panels": [
            {
                "title": "连接数",
                "query": "mysql_global_status_threads_connected{instance=\"$instance\"}",
                "chartType": "line",
                "unit": "connections"
            },
            {
                "title": "查询QPS",
                "query": "rate(mysql_global_status_queries{instance=\"$instance\"}[5m])",
                "chartType": "line",
                "unit": "queries/s"
            },
            {
                "title": "慢查询",
                "query": "rate(mysql_global_status_slow_queries{instance=\"$instance\"}[5m])",
                "chartType": "line",
                "unit": "queries/s"
            },
            {
                "title": "缓冲池命中率",
                "query": "(mysql_global_status_innodb_buffer_pool_read_requests{instance=\"$instance\"} - mysql_global_status_innodb_buffer_pool_reads{instance=\"$instance\"}) / mysql_global_status_innodb_buffer_pool_read_requests{instance=\"$instance\"} * 100",
                "chartType": "gauge",
                "unit": "%"
            }
        ]
    }
]

def init_templates():
    """初始化模板到数据库"""
    db = SessionLocal()
    try:
        # 检查是否已有模板
        existing_count = db.query(DashboardTemplateModel).count()
        if existing_count > 0:
            print(f"数据库中已有 {existing_count} 个模板，跳过初始化")
            return
        
        # 创建模板
        for template_data in DASHBOARD_TEMPLATES:
            template = DashboardTemplateModel(
                id=template_data["id"],
                name=template_data["name"],
                description=template_data["description"],
                category=template_data["category"],
                panels=template_data["panels"],
                variables=template_data["variables"],
                tags=template_data["tags"],
                is_builtin=template_data["is_builtin"]
            )
            db.add(template)
        
        db.commit()
        print(f"成功初始化 {len(DASHBOARD_TEMPLATES)} 个仪表板模板")
        
    except Exception as e:
        print(f"初始化模板失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_templates()