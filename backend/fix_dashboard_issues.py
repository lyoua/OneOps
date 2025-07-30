#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复仪表板相关问题的脚本
- 清理重复的仪表板
- 修复变量数据
"""

import os
import sys
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import sessionmaker
from models import Dashboard, Variable, init_database
from collections import defaultdict
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
        dashboards = db.query(Dashboard).order_by(Dashboard.created_at.desc()).all()
        print(f"总仪表板数量: {len(dashboards)}")
        
        # 按标题分组
        title_groups = defaultdict(list)
        for dashboard in dashboards:
            title_groups[dashboard.title].append(dashboard)
        
        # 找出重复的仪表板
        duplicates_to_delete = []
        for title, dashboard_list in title_groups.items():
            if len(dashboard_list) > 1:
                print(f"\n发现重复仪表板: {title} ({len(dashboard_list)} 个)")
                # 保留最新的（第一个），删除其他的
                for dashboard in dashboard_list[1:]:
                    print(f"  标记删除: ID={dashboard.id}, 创建时间={dashboard.created_at}")
                    duplicates_to_delete.append(dashboard)
        
        if duplicates_to_delete:
            print(f"\n准备删除 {len(duplicates_to_delete)} 个重复仪表板")
            
            for dashboard in duplicates_to_delete:
                db.delete(dashboard)
            
            db.commit()
            print(f"✓ 已删除 {len(duplicates_to_delete)} 个重复仪表板")
        else:
            print("没有发现重复的仪表板")
        
        # 显示清理后的统计
        remaining_dashboards = db.query(Dashboard).all()
        print(f"\n清理后剩余仪表板数量: {len(remaining_dashboards)}")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"清理重复仪表板失败: {e}")
        return False

def fix_variable_labels():
    """修复变量标签问题"""
    try:
        # 初始化数据库
        init_database()
        
        # 创建数据库连接
        DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://rify_user:rify_password@localhost:5432/rify_ops')
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("=== 修复变量标签 ===")
        
        # 查找所有变量
        variables = db.query(Variable).all()
        print(f"总变量数量: {len(variables)}")
        
        fixed_count = 0
        for variable in variables:
            # 如果label为空或None，使用name作为label
            if not variable.label or variable.label.strip() == '':
                variable.label = variable.name
                fixed_count += 1
                print(f"修复变量标签: {variable.name} -> {variable.label}")
        
        if fixed_count > 0:
            db.commit()
            print(f"✓ 已修复 {fixed_count} 个变量标签")
        else:
            print("所有变量标签都正常")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"修复变量标签失败: {e}")
        return False

def main():
    """主函数"""
    print("开始修复仪表板相关问题...")
    print(f"时间: {datetime.now()}")
    
    success = True
    
    # 清理重复仪表板
    if not cleanup_duplicate_dashboards():
        success = False
    
    # 修复变量标签
    if not fix_variable_labels():
        success = False
    
    if success:
        print("\n✓ 所有问题修复完成")
    else:
        print("\n✗ 部分问题修复失败")
        sys.exit(1)

if __name__ == '__main__':
    main()