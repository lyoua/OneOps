#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库状态检查脚本
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Dashboard, Variable, DashboardTemplate, VariableValue

def check_database():
    """检查数据库状态"""
    try:
        # 数据库连接
        DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://rify_user:rify_password@localhost:5432/rify_ops')
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        print("=== 数据库连接检查 ===")
        # 测试连接
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✓ 数据库连接成功")
        
        # 创建会话
        db = SessionLocal()
        
        print("\n=== 数据库表统计 ===")
        
        # 检查仪表板数量
        dashboard_count = db.query(Dashboard).count()
        print(f"仪表板数量: {dashboard_count}")
        
        # 检查变量数量
        variable_count = db.query(Variable).count()
        print(f"变量数量: {variable_count}")
        
        # 检查模板数量
        template_count = db.query(DashboardTemplate).count()
        print(f"仪表板模板数量: {template_count}")
        
        # 检查变量值数量
        variable_value_count = db.query(VariableValue).count()
        print(f"变量值数量: {variable_value_count}")
        
        print("\n=== 仪表板列表 ===")
        dashboards = db.query(Dashboard).all()
        if dashboards:
            for i, dashboard in enumerate(dashboards[:10], 1):  # 只显示前10个
                print(f"{i}. ID: {dashboard.id}, 标题: {dashboard.title}, 创建时间: {dashboard.created_at}")
            if len(dashboards) > 10:
                print(f"... 还有 {len(dashboards) - 10} 个仪表板")
        else:
            print("没有找到仪表板")
        
        print("\n=== 变量列表 ===")
        variables = db.query(Variable).all()
        if variables:
            for variable in variables:
                print(f"- {variable.name}: {variable.description or '无描述'}")
        else:
            print("没有找到变量")
        
        print("\n=== 模板列表 ===")
        templates = db.query(DashboardTemplate).all()
        if templates:
            for template in templates:
                print(f"- {template.name}: {template.description or '无描述'}")
        else:
            print("没有找到模板")
        
        db.close()
        print("\n✓ 所有检查完成")
        
    except Exception as e:
        print(f"❌ 数据库检查失败: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    success = check_database()
    sys.exit(0 if success else 1)