#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清理重复仪表板脚本
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Dashboard as DashboardModel, Variable, DashboardTemplate, VariableValue, init_database
from datetime import datetime

def cleanup_duplicate_dashboards():
    """清理重复的仪表板"""
    try:
        # 初始化数据库
        init_database()
        
        # 创建数据库连接
        DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://rify_user:rify_password@localhost:5432/rify_ops')
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("=== 清理重复仪表板 ===")
        
        # 查找所有仪表板
        dashboards = db.query(DashboardModel).all()
        print(f"总共找到 {len(dashboards)} 个仪表板")
        
        # 按标题分组
        title_groups = {}
        for dashboard in dashboards:
            title = dashboard.title
            if title not in title_groups:
                title_groups[title] = []
            title_groups[title].append(dashboard)
        
        # 找出重复的仪表板
        duplicates_to_delete = []
        for title, group in title_groups.items():
            if len(group) > 1:
                print(f"\n发现重复仪表板: {title} ({len(group)} 个)")
                # 保留最新的一个，删除其他的
                group.sort(key=lambda x: x.created_at, reverse=True)
                keep = group[0]
                to_delete = group[1:]
                
                print(f"  保留: ID={keep.id}, 创建时间={keep.created_at}")
                for dashboard in to_delete:
                    print(f"  删除: ID={dashboard.id}, 创建时间={dashboard.created_at}")
                    duplicates_to_delete.append(dashboard)
        
        if duplicates_to_delete:
            print(f"\n自动删除 {len(duplicates_to_delete)} 个重复仪表板")
            
            for dashboard in duplicates_to_delete:
                db.delete(dashboard)
            
            db.commit()
            print(f"✓ 已删除 {len(duplicates_to_delete)} 个重复仪表板")
        else:
            print("没有发现重复的仪表板")
        
        # 显示清理后的统计
        remaining_dashboards = db.query(DashboardModel).all()
        print(f"\n清理后剩余仪表板数量: {len(remaining_dashboards)}")
        
        db.close()
        
    except Exception as e:
        print(f"清理失败: {e}")
        return False
    
    return True

def cleanup_orphaned_variables():
    """清理孤立的变量值"""
    try:
        # 创建数据库连接
        DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://rify_user:rify_password@localhost:5432/rify_ops')
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("\n=== 清理孤立变量值 ===")
        
        # 查找所有变量值
        variable_values = db.query(VariableValue).all()
        print(f"总共找到 {len(variable_values)} 个变量值")
        
        # 查找所有变量
        variables = db.query(Variable).all()
        variable_names = {var.name for var in variables}
        
        # 找出孤立的变量值
        orphaned_values = []
        for vv in variable_values:
            if vv.variable_name not in variable_names:
                orphaned_values.append(vv)
                print(f"  孤立变量值: {vv.variable_name} = {vv.value}")
        
        if orphaned_values:
            print(f"\n自动删除 {len(orphaned_values)} 个孤立变量值")
            
            for vv in orphaned_values:
                db.delete(vv)
            
            db.commit()
            print(f"✓ 已删除 {len(orphaned_values)} 个孤立变量值")
        else:
            print("没有发现孤立的变量值")
        
        db.close()
        
    except Exception as e:
        print(f"清理变量值失败: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("数据库清理工具 - 自动清理模式")
    
    # 自动执行全部清理
    print("开始清理重复仪表板和孤立变量值...")
    
    success1 = cleanup_duplicate_dashboards()
    success2 = cleanup_orphaned_variables()
    
    if success1 and success2:
        print("\n✓ 所有清理操作完成")
    else:
        print("\n⚠️ 部分清理操作失败")
        sys.exit(1)