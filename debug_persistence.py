#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试默认查询和变量持久化问题
"""

import requests
import json
import time

# 配置
BASE_URL = 'http://192.168.50.81:8003/api'

def test_dashboard_persistence():
    """测试仪表板持久化问题"""
    print("=== 测试仪表板持久化问题 ===")
    
    # 创建测试仪表板数据
    test_dashboard = {
        "id": f"test_dashboard_{int(time.time())}",
        "title": f"测试仪表板_{int(time.time())}",
        "description": "测试默认查询持久化",
        "timeRange": "1h",
        "refreshInterval": 30,
        "variables": [
            {
                "id": "test_instance",
                "name": "instance",
                "label": "实例",
                "type": "query",
                "query": "label_values(up, instance)",
                "value": "192.168.50.81:9090",
                "multi": True
            }
        ],
        "panels": [
            {
                "id": "panel_1",
                "title": "CPU使用率",
                "type": "line",
                "query": "100 - (avg(irate(node_cpu_seconds_total{mode=\"idle\",instance=\"$instance\"}[5m])) * 100)",
                "defaultQuery": "100 - (avg(irate(node_cpu_seconds_total{mode=\"idle\",instance=\"$instance\"}[5m])) * 100)",
                "color": "#ef4444",
                "unit": "%",
                "isCustomQuery": False
            },
            {
                "id": "panel_2",
                "title": "内存使用率",
                "type": "line",
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
                
                # 2. 立即读取仪表板，检查defaultQuery是否保存
                print("\n2. 读取仪表板，检查defaultQuery...")
                get_response = requests.get(f'{BASE_URL}/dashboards/{dashboard_id}')
                
                if get_response.status_code == 200:
                    saved_dashboard = get_response.json()['data']
                    print(f"读取到的仪表板: {json.dumps(saved_dashboard, indent=2, ensure_ascii=False)}")
                    
                    # 检查panels中的defaultQuery
                    if saved_dashboard.get('panels'):
                        for panel in saved_dashboard['panels']:
                            if 'defaultQuery' in panel:
                                print(f"✓ 面板 '{panel['title']}' 的defaultQuery已保存: {panel['defaultQuery']}")
                            else:
                                print(f"✗ 面板 '{panel['title']}' 缺少defaultQuery")
                    
                    # 3. 测试更新defaultQuery
                    print("\n3. 测试更新defaultQuery...")
                    updated_dashboard = saved_dashboard.copy()
                    if updated_dashboard['panels']:
                        updated_dashboard['panels'][0]['defaultQuery'] = "rate(node_cpu_seconds_total[5m])"
                        updated_dashboard['panels'][0]['query'] = "rate(node_cpu_seconds_total[5m])"
                    
                    update_response = requests.put(f'{BASE_URL}/dashboards/{dashboard_id}', json=updated_dashboard)
                    
                    if update_response.status_code == 200:
                        print("✓ 仪表板更新成功")
                        
                        # 4. 再次读取，验证更新是否持久化
                        print("\n4. 验证更新是否持久化...")
                        verify_response = requests.get(f'{BASE_URL}/dashboards/{dashboard_id}')
                        
                        if verify_response.status_code == 200:
                            verified_dashboard = verify_response.json()['data']
                            if verified_dashboard['panels'] and verified_dashboard['panels'][0].get('defaultQuery') == "rate(node_cpu_seconds_total[5m])":
                                print("✓ defaultQuery更新已持久化")
                            else:
                                print("✗ defaultQuery更新未持久化")
                                print(f"实际值: {verified_dashboard['panels'][0].get('defaultQuery') if verified_dashboard['panels'] else 'None'}")
                        else:
                            print(f"✗ 验证读取失败: {verify_response.status_code}")
                    else:
                        print(f"✗ 更新失败: {update_response.status_code} - {update_response.text}")
                else:
                    print(f"✗ 读取仪表板失败: {get_response.status_code} - {get_response.text}")
            else:
                print(f"✗ 创建失败: {result.get('message')}")
        else:
            print(f"✗ 创建请求失败: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"✗ 测试过程中发生错误: {e}")

def test_variable_persistence():
    """测试变量持久化问题"""
    print("\n=== 测试变量持久化问题 ===")
    
    test_variable = {
        "name": f"test_var_{int(time.time())}",
        "label": "测试变量",
        "type": "query",
        "query": "label_values(up, job)",
        "value": "prometheus",
        "multi": False,
        "description": "测试变量持久化"
    }
    
    try:
        # 1. 创建变量
        print("1. 创建测试变量...")
        response = requests.post(f'{BASE_URL}/variables', json=test_variable)
        print(f"创建响应状态: {response.status_code}")
        print(f"创建响应内容: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                variable_id = result['data']['id']
                print(f"✓ 变量创建成功，ID: {variable_id}")
                
                # 2. 读取变量，检查query是否保存
                print("\n2. 读取变量，检查query...")
                get_response = requests.get(f'{BASE_URL}/variables')
                
                if get_response.status_code == 200:
                    variables = get_response.json()['data']
                    saved_variable = next((v for v in variables if v['id'] == variable_id), None)
                    
                    if saved_variable:
                        print(f"读取到的变量: {json.dumps(saved_variable, indent=2, ensure_ascii=False)}")
                        
                        if saved_variable.get('query'):
                            print(f"✓ 变量query已保存: {saved_variable['query']}")
                        else:
                            print("✗ 变量query未保存")
                    else:
                        print("✗ 未找到创建的变量")
                else:
                    print(f"✗ 读取变量失败: {get_response.status_code} - {get_response.text}")
            else:
                print(f"✗ 创建失败: {result.get('message')}")
        else:
            print(f"✗ 创建请求失败: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"✗ 测试过程中发生错误: {e}")

def main():
    """主测试函数"""
    print("开始调试默认查询和变量持久化问题...\n")
    
    # 测试后端连接
    try:
        response = requests.get(f'{BASE_URL}/dashboards')
        if response.status_code == 200:
            print("✓ 后端服务连接正常\n")
        else:
            print(f"✗ 后端服务连接失败: {response.status_code}")
            return
    except Exception as e:
        print(f"✗ 无法连接后端服务: {e}")
        return
    
    # 运行测试
    test_dashboard_persistence()
    test_variable_persistence()
    
    print("\n调试测试完成！")

if __name__ == "__main__":
    main()