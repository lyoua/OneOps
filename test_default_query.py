#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试默认查询保存功能
"""

import requests
import json
import time

# 配置
BASE_URL = 'http://192.168.50.81:8002/api'

def test_dashboard_save():
    """测试仪表板保存功能"""
    print("=== 测试仪表板保存功能 ===")
    
    # 创建测试仪表板数据
    timestamp = int(time.time())
    test_dashboard = {
        "id": f"test_dashboard_{timestamp}",
        "title": f"测试仪表板_{timestamp}",
        "description": "用于测试默认查询保存的仪表板",
        "time_range": "1h",
        "refresh_interval": 30,
        "variables": [
            {
                "name": "instance",
                "label": "实例",
                "type": "query",
                "query": "label_values(up, instance)",
                "value": "192.168.50.81:9090"
            }
        ],
        "panels": [
            {
                "id": "test_panel_1",
                "title": "CPU使用率",
                "type": "line",
                "query": "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\",instance=\"$instance\"}[5m])) * 100)",
                "defaultQuery": "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\",instance=\"$instance\"}[5m])) * 100)",
                "color": "#3b82f6",
                "unit": "%",
                "isCustomQuery": False
            },
            {
                "id": "test_panel_2",
                "title": "内存使用率",
                "type": "area",
                "query": "(1 - (node_memory_MemAvailable_bytes{instance=\"$instance\"} / node_memory_MemTotal_bytes{instance=\"$instance\"})) * 100",
                "defaultQuery": "(1 - (node_memory_MemAvailable_bytes{instance=\"$instance\"} / node_memory_MemTotal_bytes{instance=\"$instance\"})) * 100",
                "color": "#10b981",
                "unit": "%",
                "isCustomQuery": False
            }
        ]
    }
    
    try:
        # 1. 创建仪表板
        print("1. 创建测试仪表板...")
        response = requests.post(f'{BASE_URL}/dashboards', json=test_dashboard)
        print(f"创建响应状态: {response.status_code}")
        print(f"创建响应内容: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                dashboard_id = result['data']['id']
                print(f"✓ 仪表板创建成功，ID: {dashboard_id}")
                
                # 2. 验证仪表板是否正确保存
                print("\n2. 验证仪表板保存...")
                get_response = requests.get(f'{BASE_URL}/dashboards/{dashboard_id}')
                if get_response.status_code == 200:
                    saved_dashboard = get_response.json()['data']
                    print(f"✓ 仪表板读取成功")
                    
                    # 检查defaultQuery是否正确保存
                    panels = saved_dashboard.get('panels', [])
                    for panel in panels:
                        if 'defaultQuery' in panel:
                            print(f"✓ 面板 '{panel['title']}' 的默认查询已保存: {panel['defaultQuery'][:50]}...")
                        else:
                            print(f"✗ 面板 '{panel['title']}' 缺少默认查询")
                    
                    # 3. 测试更新默认查询
                    print("\n3. 测试更新默认查询...")
                    updated_dashboard = saved_dashboard.copy()
                    if updated_dashboard['panels']:
                        updated_dashboard['panels'][0]['defaultQuery'] = "rate(node_cpu_seconds_total[5m])"
                        updated_dashboard['panels'][0]['query'] = "rate(node_cpu_seconds_total[5m])"
                    
                    update_response = requests.put(f'{BASE_URL}/dashboards/{dashboard_id}', json=updated_dashboard)
                    if update_response.status_code == 200:
                        print("✓ 仪表板更新成功")
                        
                        # 验证更新
                        verify_response = requests.get(f'{BASE_URL}/dashboards/{dashboard_id}')
                        if verify_response.status_code == 200:
                            verified_dashboard = verify_response.json()['data']
                            if verified_dashboard['panels'] and verified_dashboard['panels'][0]['defaultQuery'] == "rate(node_cpu_seconds_total[5m])":
                                print("✓ 默认查询更新验证成功")
                            else:
                                print("✗ 默认查询更新验证失败")
                    else:
                        print(f"✗ 仪表板更新失败: {update_response.status_code}")
                        
                else:
                    print(f"✗ 仪表板读取失败: {get_response.status_code}")
            else:
                print(f"✗ 仪表板创建失败: {result.get('message', '未知错误')}")
        else:
            print(f"✗ 仪表板创建请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"✗ 测试过程中发生错误: {e}")

def test_variable_save():
    """测试变量保存功能"""
    print("\n=== 测试变量保存功能 ===")
    
    test_variable = {
        "name": f"test_var_{int(time.time())}",
        "type": "query",
        "default_value": "192.168.50.81:9090",
        "description": "测试变量"
    }
    
    try:
        # 1. 创建变量
        print("1. 创建测试变量...")
        response = requests.post(f'{BASE_URL}/variables', json=test_variable)
        print(f"创建响应状态: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                variable_id = result['data']['id']
                print(f"✓ 变量创建成功，ID: {variable_id}")
                
                # 2. 保存变量值
                print("\n2. 保存变量值...")
                variable_value = {
                    "variable_name": test_variable["name"],
                    "value": "192.168.50.81:9100"
                }
                
                value_response = requests.post(f'{BASE_URL}/variable-values', json=variable_value)
                if value_response.status_code == 200:
                    print("✓ 变量值保存成功")
                    
                    # 3. 验证变量值
                    print("\n3. 验证变量值...")
                    get_response = requests.get(f'{BASE_URL}/variable-values')
                    if get_response.status_code == 200:
                        values = get_response.json()['data']
                        found = False
                        for value in values:
                            if value['variable_name'] == test_variable["name"]:
                                print(f"✓ 变量值验证成功: {value['value']}")
                                found = True
                                break
                        if not found:
                            print("✗ 变量值验证失败：未找到保存的值")
                    else:
                        print(f"✗ 变量值读取失败: {get_response.status_code}")
                else:
                    print(f"✗ 变量值保存失败: {value_response.status_code}")
            else:
                print(f"✗ 变量创建失败: {result.get('message', '未知错误')}")
        else:
            print(f"✗ 变量创建请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"✗ 测试过程中发生错误: {e}")

def main():
    """主测试函数"""
    print("开始测试默认查询和变量保存功能...\n")
    
    # 测试后端连接
    try:
        response = requests.get(f'{BASE_URL}/health')
        if response.status_code == 200:
            print("✓ 后端服务连接正常\n")
        else:
            print(f"✗ 后端服务连接失败: {response.status_code}")
            return
    except Exception as e:
        print(f"✗ 无法连接到后端服务: {e}")
        return
    
    # 运行测试
    test_dashboard_save()
    test_variable_save()
    
    print("\n=== 测试完成 ===")

if __name__ == '__main__':
    main()