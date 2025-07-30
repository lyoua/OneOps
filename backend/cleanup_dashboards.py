#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量清理重复仪表板脚本
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Dashboard
from collections import defaultdict

def cleanup_duplicate_dashboards():
    """清理重复的仪表板，只保留每个标题的最新一个"""
    try:
        # 数据库连接
        DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://rify_user:rify_password@localhost:5432/rify_ops')
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        db = SessionLocal()
        
        print("=== 开始清理重复仪表板 ===")
        
        # 获取所有仪表板
        all_dashboards = db.query(Dashboard).order_by(Dashboard.created_at.desc()).all()
        print(f"总仪表板数量: {len(all_dashboards)}")
        
        # 按标题分组
        title_groups = defaultdict(list)
        for dashboard in all_dashboards:
            title_groups[dashboard.title].append(dashboard)
        
        # 统计重复情况
        duplicate_count = 0
        for title, dashboards in title_groups.items():
            if len(dashboards) > 1:
                print(f"标题 '{title}' 有 {len(dashboards)} 个重复仪表板")
                duplicate_count += len(dashboards) - 1
        
        print(f"需要删除的重复仪表板数量: {duplicate_count}")
        
        if duplicate_count == 0:
            print("没有发现重复的仪表板")
            return
        
        # 确认删除
        confirm = input(f"确认删除 {duplicate_count} 个重复仪表板吗？(y/N): ")
        if confirm.lower() != 'y':
            print("取消删除操作")
            return
        
        # 删除重复的仪表板（保留最新的）
        deleted_count = 0
        for title, dashboards in title_groups.items():
            if len(dashboards) > 1:
                # 保留最新的（第一个），删除其他的
                for dashboard in dashboards[1:]:
                    print(f"删除仪表板: {dashboard.id} - {dashboard.title} (创建时间: {dashboard.created_at})")
                    db.delete(dashboard)
                    deleted_count += 1
        
        # 提交更改
        db.commit()
        print(f"\n✓ 成功删除 {deleted_count} 个重复仪表板")
        
        # 显示清理后的统计
        remaining_count = db.query(Dashboard).count()
        print(f"剩余仪表板数量: {remaining_count}")
        
    except Exception as e:
        print(f"清理失败: {e}")
        if 'db' in locals():
            db.rollback()
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    cleanup_duplicate_dashboards()