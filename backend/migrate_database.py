#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库迁移脚本 - 添加缺失的列
"""

import psycopg2
import os
from sqlalchemy import text
from models import engine, SessionLocal

def migrate_database_direct():
    """直接使用psycopg2连接数据库进行迁移"""
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://rify_user:rify_password@localhost:5432/rify_ops')
    
    try:
        # 解析数据库URL
        import urllib.parse as urlparse
        url = urlparse.urlparse(DATABASE_URL)
        
        conn = psycopg2.connect(
            host=url.hostname,
            port=url.port,
            database=url.path[1:],  # 移除开头的'/'
            user=url.username,
            password=url.password
        )
        
        cursor = conn.cursor()
        
        # 检查并添加dashboards表的version列
        try:
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='dashboards' AND column_name='version'
            """)
            
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE dashboards ADD COLUMN version INTEGER DEFAULT 1")
                print("Added version column to dashboards table")
            else:
                print("Version column already exists in dashboards table")
        except Exception as e:
            print(f"Error checking/adding version column to dashboards: {e}")
        
        # 检查并添加variables表的version列
        try:
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='variables' AND column_name='version'
            """)
            
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE variables ADD COLUMN version INTEGER DEFAULT 1")
                print("Added version column to variables table")
            else:
                print("Version column already exists in variables table")
        except Exception as e:
            print(f"Error checking/adding version column to variables: {e}")
        
        # 提交更改
        conn.commit()
        print("Database migration completed successfully")
        
    except Exception as e:
        print(f"Database migration failed: {e}")
        if 'conn' in locals():
            conn.rollback()
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def migrate_database_sqlalchemy():
    """使用SQLAlchemy进行迁移"""
    session = SessionLocal()
    try:
        # 检查并添加dashboards表的version列
        try:
            result = session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='dashboards' AND column_name='version'
            """))
            
            if not result.fetchone():
                session.execute(text("ALTER TABLE dashboards ADD COLUMN version INTEGER DEFAULT 1"))
                print("Added version column to dashboards table")
            else:
                print("Version column already exists in dashboards table")
        except Exception as e:
            print(f"Error with dashboards version column: {e}")
        
        # 检查并添加variables表的version列
        try:
            result = session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='variables' AND column_name='version'
            """))
            
            if not result.fetchone():
                session.execute(text("ALTER TABLE variables ADD COLUMN version INTEGER DEFAULT 1"))
                print("Added version column to variables table")
            else:
                print("Version column already exists in variables table")
        except Exception as e:
            print(f"Error with variables version column: {e}")
        
        # 提交更改
        session.commit()
        print("SQLAlchemy migration completed successfully")
        
    except Exception as e:
        session.rollback()
        print(f"SQLAlchemy migration failed: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    print("Starting database migration...")
    
    # 首先尝试psycopg2方法
    try:
        migrate_database_direct()
    except Exception as e:
        print(f"Direct migration failed: {e}")
        print("Trying SQLAlchemy method...")
        try:
            migrate_database_sqlalchemy()
        except Exception as e2:
            print(f"SQLAlchemy migration also failed: {e2}")
            print("Migration failed completely")
            exit(1)
    
    print("Migration completed successfully")